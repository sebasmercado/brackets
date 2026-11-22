/**
 * Motor de audio singleton de AirJam.
 *
 * Responsabilidades:
 *  - Crear y desbloquear el `AudioContext` tras un gesto del usuario
 *    (requisito de autoplay de los navegadores).
 *  - Mantener el grafo master: sintetizadores → [dry | send reverb] → compresor → salida.
 *  - Registrar sintetizadores enchufables (`Synthesizer`) y enrutar los
 *    `TriggerEvent` emitidos por los plugins según `event.synth`.
 *
 * Los plugins nunca tocan la Web Audio API: solo producen eventos. Esto permite
 * sumar sintetizadores de percusión (ruido/envolvente) sin modificar instrumentos.
 *
 *   synthBus ─┬─────────────────────────────┐
 *             └─ reverbSend → Convolver ─ wet ┴→ compressor → master → destination
 */
import type { Synthesizer, SynthId, TriggerEvent } from '../types';
import { ClickSynth } from './ClickSynth';
import { createSyntheticImpulse } from './impulse';
import { KarplusStrongSynth } from './KarplusStrongSynth';

export type SynthFactory = (ctx: AudioContext, destination: AudioNode) => Synthesizer;

export interface AudioLatencyInfo {
	baseLatencyMs: number;
	outputLatencyMs: number;
}

export class AudioEngine {
	private static instance: AudioEngine | null = null;

	/** Acceso al singleton. No crea el `AudioContext` hasta `unlock()`. */
	static get(): AudioEngine {
		AudioEngine.instance ??= new AudioEngine();
		return AudioEngine.instance;
	}

	private ctx: AudioContext | null = null;
	private master: GainNode | null = null;
	private synthBus: GainNode | null = null;
	private reverbSend: GainNode | null = null;
	private readonly synths = new Map<SynthId, Synthesizer>();
	private readonly factories = new Map<SynthId, SynthFactory>([
		['karplus-strong', (ctx, dest) => new KarplusStrongSynth(ctx, dest)],
		['click', (ctx, dest) => new ClickSynth(ctx, dest)]
	]);

	private constructor() {}

	get context(): AudioContext | null {
		return this.ctx;
	}

	get isRunning(): boolean {
		return this.ctx?.state === 'running';
	}

	/**
	 * Registra (o reemplaza) una fábrica de sintetizador. Si el contexto ya
	 * existe, el sintetizador se instancia de inmediato.
	 */
	registerSynth(id: SynthId, factory: SynthFactory): void {
		this.factories.set(id, factory);
		if (this.ctx && this.synthBus) {
			this.synths.get(id)?.dispose();
			this.synths.set(id, factory(this.ctx, this.synthBus));
		}
	}

	getSynth<T extends Synthesizer>(id: SynthId): T | null {
		return (this.synths.get(id) as T | undefined) ?? null;
	}

	/**
	 * Crea/reanuda el `AudioContext`. Debe llamarse dentro de un handler de
	 * interacción del usuario (click/tap).
	 */
	async unlock(): Promise<void> {
		if (!this.ctx) this.build();
		const ctx = this.ctx;
		if (!ctx) throw new Error('No se pudo crear el AudioContext');
		if (ctx.state !== 'running') await ctx.resume();

		// iOS Safari: reproducir un buffer silencioso termina de "despertar" el audio.
		const silent = ctx.createBuffer(1, 1, ctx.sampleRate);
		const src = ctx.createBufferSource();
		src.buffer = silent;
		src.connect(ctx.destination);
		src.start();
	}

	async suspend(): Promise<void> {
		if (this.ctx?.state === 'running') await this.ctx.suspend();
	}

	async resume(): Promise<void> {
		if (this.ctx && this.ctx.state !== 'running') await this.ctx.resume();
	}

	/** Dispara un evento en su sintetizador. Ignora eventos si el audio no corre. */
	trigger(event: TriggerEvent): void {
		const ctx = this.ctx;
		if (!ctx || ctx.state !== 'running') return;
		const synth = this.synths.get(event.synth);
		if (!synth) {
			if (import.meta.env.DEV) console.warn(`[AudioEngine] Sintetizador no registrado: ${event.synth}`);
			return;
		}
		synth.trigger(event, ctx.currentTime + Math.max(0, event.delay));
	}

	dispatch(events: readonly TriggerEvent[]): void {
		for (const event of events) this.trigger(event);
	}

	setMasterVolume(value: number): void {
		if (!this.ctx || !this.master) return;
		this.master.gain.setTargetAtTime(Math.max(0, Math.min(1, value)), this.ctx.currentTime, 0.02);
	}

	setReverbAmount(value: number): void {
		if (!this.ctx || !this.reverbSend) return;
		this.reverbSend.gain.setTargetAtTime(Math.max(0, Math.min(1, value)), this.ctx.currentTime, 0.05);
	}

	getLatency(): AudioLatencyInfo {
		const ctx = this.ctx;
		return {
			baseLatencyMs: (ctx?.baseLatency ?? 0) * 1000,
			outputLatencyMs: (ctx?.outputLatency ?? 0) * 1000
		};
	}

	stopAll(): void {
		for (const synth of this.synths.values()) synth.stopAll();
	}

	async dispose(): Promise<void> {
		for (const synth of this.synths.values()) synth.dispose();
		this.synths.clear();
		await this.ctx?.close();
		this.ctx = null;
		this.master = null;
		this.synthBus = null;
		this.reverbSend = null;
	}

	private build(): void {
		const ctx = new AudioContext({ latencyHint: 'interactive' });

		const master = ctx.createGain();
		master.gain.value = 0.85;

		const compressor = ctx.createDynamicsCompressor();
		compressor.threshold.value = -14;
		compressor.knee.value = 10;
		compressor.ratio.value = 4;
		compressor.attack.value = 0.003;
		compressor.release.value = 0.2;

		const synthBus = ctx.createGain();
		const reverbSend = ctx.createGain();
		reverbSend.gain.value = 0.22;
		const convolver = ctx.createConvolver();
		convolver.buffer = createSyntheticImpulse(ctx);

		synthBus.connect(compressor);
		synthBus.connect(reverbSend).connect(convolver).connect(compressor);
		compressor.connect(master).connect(ctx.destination);

		this.ctx = ctx;
		this.master = master;
		this.synthBus = synthBus;
		this.reverbSend = reverbSend;

		for (const [id, factory] of this.factories) this.synths.set(id, factory(ctx, synthBus));
	}
}
