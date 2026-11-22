/**
 * Sintetizador de cuerda pulsada por modelado físico (Karplus-Strong extendido).
 *
 * Estrategia de baja latencia:
 *  - La forma de onda de cada nota se *renderiza* una vez con el algoritmo KS
 *    (línea de retardo fraccional + filtro promediador + pérdida por periodo) y
 *    se cachea como `AudioBuffer` (LRU). Reproducir un buffer cacheado es
 *    instantáneo: no hay trabajo de CPU en el camino crítico del rasgueo.
 *  - La dinámica (velocidad) y el brillo se aplican en tiempo real con nodos
 *    nativos (Gain + Biquad lowpass por voz), así un mismo buffer sirve para
 *    cualquier intensidad.
 *  - Cada cuerda (`channel`) es monofónica: un nuevo ataque "roba" la voz
 *    anterior con un release corto, igual que una cuerda real.
 *
 * Cuerpo acústico: la salida pasa por un resonador de caja (peaking ~100 Hz +
 * pasa-banda ~220 Hz en paralelo + shelving de agudos) antes del bus master.
 */
import type { Synthesizer, TriggerEvent } from '../types';

interface Voice {
	source: AudioBufferSourceNode;
	gain: GainNode;
}

export interface KarplusStrongOptions {
	/** Variantes de excitación por nota (round-robin) para evitar el efecto "ametralladora". */
	variants?: number;
	/** Máximo de buffers cacheados. */
	cacheSize?: number;
	/** Cantidad de canales/cuerdas (para paneo estéreo). */
	channels?: number;
}

const MUTED_DURATION = 0.28;

export class KarplusStrongSynth implements Synthesizer {
	readonly id = 'karplus-strong' as const;

	private readonly ctx: BaseAudioContext;
	private readonly input: GainNode;
	private readonly output: GainNode;
	private readonly voices = new Map<number, Voice>();
	private readonly cache = new Map<string, AudioBuffer>();
	private readonly variantCounter = new Map<string, number>();
	private readonly variants: number;
	private readonly cacheSize: number;
	private readonly channels: number;
	private readonly bodyNodes: AudioNode[] = [];

	constructor(ctx: BaseAudioContext, destination: AudioNode, options: KarplusStrongOptions = {}) {
		this.ctx = ctx;
		this.variants = options.variants ?? 3;
		this.cacheSize = options.cacheSize ?? 72;
		this.channels = options.channels ?? 6;

		this.input = ctx.createGain();
		this.output = ctx.createGain();
		this.output.gain.value = 0.9;
		this.buildBody();
		this.output.connect(destination);
	}

	/** Resonancia de caja acústica: modos de aire/tapa + suavizado de agudos. */
	private buildBody(): void {
		const { ctx } = this;

		const airMode = ctx.createBiquadFilter();
		airMode.type = 'peaking';
		airMode.frequency.value = 102;
		airMode.Q.value = 1.4;
		airMode.gain.value = 5;

		const topMode = ctx.createBiquadFilter();
		topMode.type = 'bandpass';
		topMode.frequency.value = 220;
		topMode.Q.value = 0.9;
		const topGain = ctx.createGain();
		topGain.gain.value = 0.45;

		const presence = ctx.createBiquadFilter();
		presence.type = 'peaking';
		presence.frequency.value = 2800;
		presence.Q.value = 0.8;
		presence.gain.value = 2;

		const highShelf = ctx.createBiquadFilter();
		highShelf.type = 'highshelf';
		highShelf.frequency.value = 6500;
		highShelf.gain.value = -6;

		// input → airMode → presence → highShelf → output  (camino principal)
		// input → topMode → topGain → output              (resonancia paralela)
		this.input.connect(airMode).connect(presence).connect(highShelf).connect(this.output);
		this.input.connect(topMode).connect(topGain).connect(this.output);
		this.bodyNodes.push(airMode, topMode, topGain, presence, highShelf);
	}

	trigger(event: TriggerEvent, when: number): void {
		if (event.frequency <= 0) return;
		const muted = event.articulation === 'muted';
		const velocity = Math.min(1, Math.max(0, event.velocity));
		const brightness = Math.min(1, Math.max(0, event.brightness ?? 0.6));

		const buffer = this.getBuffer(event.frequency, muted);

		// Voice stealing: una cuerda solo puede sonar una vez a la vez.
		this.release(event.channel, when);

		const source = this.ctx.createBufferSource();
		source.buffer = buffer;

		const tone = this.ctx.createBiquadFilter();
		tone.type = 'lowpass';
		tone.frequency.value = 1200 + brightness * velocity * 9000;
		tone.Q.value = 0.5;

		const gain = this.ctx.createGain();
		const accent = event.articulation === 'accent' ? 1.25 : 1;
		gain.gain.value = (0.12 + velocity * 0.55) * accent;

		const pan = this.ctx.createStereoPanner();
		pan.pan.value = ((event.channel / Math.max(1, this.channels - 1)) * 2 - 1) * 0.35;

		source.connect(tone).connect(gain).connect(pan).connect(this.input);
		source.start(when);
		source.onended = () => {
			source.disconnect();
			tone.disconnect();
			gain.disconnect();
			pan.disconnect();
			if (this.voices.get(event.channel)?.source === source) this.voices.delete(event.channel);
		};

		this.voices.set(event.channel, { source, gain });
	}

	/** Pre-renderiza buffers (ej. al cambiar de acorde) fuera del camino crítico. */
	warmup(frequencies: readonly number[]): void {
		for (const f of frequencies) {
			for (let v = 0; v < this.variants; v++) this.getBuffer(f, false, v);
		}
	}

	stopAll(): void {
		const now = this.ctx.currentTime;
		for (const channel of [...this.voices.keys()]) this.release(channel, now);
	}

	dispose(): void {
		this.stopAll();
		this.input.disconnect();
		this.output.disconnect();
		for (const node of this.bodyNodes) node.disconnect();
		this.cache.clear();
	}

	private release(channel: number, when: number): void {
		const voice = this.voices.get(channel);
		if (!voice) return;
		voice.gain.gain.cancelScheduledValues(when);
		voice.gain.gain.setTargetAtTime(0, when, 0.012);
		try {
			voice.source.stop(when + 0.08);
		} catch {
			/* la voz ya había terminado */
		}
		this.voices.delete(channel);
	}

	private getBuffer(frequency: number, muted: boolean, forcedVariant?: number): AudioBuffer {
		const base = `${frequency.toFixed(2)}|${muted ? 'm' : 'o'}`;
		let variant = forcedVariant;
		if (variant === undefined) {
			const n = this.variantCounter.get(base) ?? 0;
			variant = n % this.variants;
			this.variantCounter.set(base, n + 1);
		}
		const key = `${base}|${variant}`;

		const cached = this.cache.get(key);
		if (cached) {
			// Refresca la posición LRU.
			this.cache.delete(key);
			this.cache.set(key, cached);
			return cached;
		}

		const buffer = renderKarplusStrong(this.ctx, frequency, { muted, seed: variant + 1 });
		this.cache.set(key, buffer);
		if (this.cache.size > this.cacheSize) {
			const oldest = this.cache.keys().next().value;
			if (oldest !== undefined) this.cache.delete(oldest);
		}
		return buffer;
	}
}

/* -------------------------------------------------------------------------- */
/*                         Render del algoritmo KS                            */
/* -------------------------------------------------------------------------- */

interface RenderOptions {
	muted: boolean;
	seed: number;
}

/** PRNG determinista (mulberry32) para excitaciones reproducibles. */
function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * Karplus-Strong con:
 *  - excitación de ruido filtrado + filtro peine de posición de púa,
 *  - retardo fraccional (interpolación lineal) para afinación precisa,
 *  - factor de pérdida calculado para un T60 dependiente de la frecuencia.
 */
export function renderKarplusStrong(
	ctx: BaseAudioContext,
	frequency: number,
	{ muted, seed }: RenderOptions
): AudioBuffer {
	const sr = ctx.sampleRate;
	// Graves sustentan más que agudos, como en una guitarra real.
	const t60 = muted ? 0.12 : Math.min(4.5, Math.max(1.6, 340 / frequency));
	const duration = muted ? MUTED_DURATION : Math.min(4, t60 * 1.05);
	const length = Math.ceil(sr * duration);

	const buffer = ctx.createBuffer(1, length, sr);
	const out = buffer.getChannelData(0);

	// El filtro promediador agrega medio sample de retardo: lo compensamos.
	const period = sr / frequency - 0.5;
	const n = Math.max(2, Math.floor(period));

	// 1) Excitación: ruido → lowpass de un polo → peine de posición de púa.
	const rand = mulberry32(seed * 7919 + Math.round(frequency * 10));
	const excitation = new Float32Array(n + 2);
	const lp = muted ? 0.35 : 0.62;
	let prev = 0;
	for (let i = 0; i < excitation.length; i++) {
		prev = prev + lp * (rand() * 2 - 1 - prev);
		excitation[i] = prev;
	}
	const pickOffset = Math.max(1, Math.round(n * 0.14));
	let mean = 0;
	for (let i = excitation.length - 1; i >= 0; i--) {
		excitation[i] = (excitation[i] ?? 0) - (i >= pickOffset ? (excitation[i - pickOffset] ?? 0) : 0);
		mean += excitation[i] ?? 0;
	}
	mean /= excitation.length;
	let peak = 1e-9;
	for (let i = 0; i < excitation.length; i++) {
		excitation[i] = (excitation[i] ?? 0) - mean;
		peak = Math.max(peak, Math.abs(excitation[i] ?? 0));
	}
	for (let i = 0; i < excitation.length && i < length; i++) out[i] = (excitation[i] ?? 0) / peak;

	// 2) Lazo de realimentación con retardo fraccional.
	//    rho: pérdida por periodo para alcanzar -60 dB en t60 segundos.
	const rho = Math.pow(10, -3 / (t60 * frequency));
	for (let i = excitation.length; i < length; i++) {
		const d = i - period;
		const idx = Math.floor(d);
		const fr = d - idx;
		const a = (out[idx] ?? 0) * (1 - fr) + (out[idx + 1] ?? 0) * fr;
		const b = (out[idx - 1] ?? 0) * (1 - fr) + (out[idx] ?? 0) * fr;
		out[i] = rho * 0.5 * (a + b);
	}

	// 3) Fade-out final para evitar clicks al cortar el buffer.
	const fade = Math.min(length, Math.round(sr * 0.04));
	for (let i = 0; i < fade; i++) {
		const k = length - fade + i;
		out[k] = (out[k] ?? 0) * (1 - i / fade);
	}
	return buffer;
}
