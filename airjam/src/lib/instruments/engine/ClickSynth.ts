/**
 * Sintetizador percusivo mínimo (ruido + oscilador con envolvente).
 *
 * Se usa como metrónomo del modo Canciones y sirve de referencia para futuros
 * sintetizadores de batería/cajón: no tiene altura definida, solo `velocity`
 * y `articulation` ('accent' = primer tiempo del compás).
 */
import type { Synthesizer, TriggerEvent } from '../types';

export class ClickSynth implements Synthesizer {
	readonly id = 'click' as const;
	private readonly output: GainNode;
	private readonly noise: AudioBuffer;

	constructor(
		private readonly ctx: BaseAudioContext,
		destination: AudioNode
	) {
		this.output = ctx.createGain();
		this.output.gain.value = 0.35;
		this.output.connect(destination);

		// Buffer de ruido blanco corto reutilizable.
		const len = Math.round(ctx.sampleRate * 0.05);
		this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
		const data = this.noise.getChannelData(0);
		for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
	}

	trigger(event: TriggerEvent, when: number): void {
		const accent = event.articulation === 'accent';
		const vel = Math.max(0.05, Math.min(1, event.velocity));

		const osc = this.ctx.createOscillator();
		osc.type = 'triangle';
		osc.frequency.value = event.frequency > 0 ? event.frequency : accent ? 1760 : 1320;

		const src = this.ctx.createBufferSource();
		src.buffer = this.noise;
		const hp = this.ctx.createBiquadFilter();
		hp.type = 'highpass';
		hp.frequency.value = 4000;

		const env = this.ctx.createGain();
		env.gain.setValueAtTime(0, when);
		env.gain.linearRampToValueAtTime(vel * (accent ? 1 : 0.6), when + 0.002);
		env.gain.exponentialRampToValueAtTime(0.0001, when + 0.06);

		osc.connect(env);
		src.connect(hp).connect(env);
		env.connect(this.output);
		osc.start(when);
		src.start(when);
		osc.stop(when + 0.08);
		src.stop(when + 0.08);
		osc.onended = () => {
			osc.disconnect();
			src.disconnect();
			hp.disconnect();
			env.disconnect();
		};
	}

	stopAll(): void {
		/* clicks de ~60 ms: no requiere corte explícito */
	}

	dispose(): void {
		this.output.disconnect();
	}
}
