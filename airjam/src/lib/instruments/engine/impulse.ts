/**
 * Respuesta al impulso sintética para el `ConvolverNode` (reverb de sala chica).
 * Ruido estéreo decorrelado con decaimiento exponencial y pre-delay corto:
 * evita descargar archivos IR y pesa 0 KB en el bundle.
 */
export function createSyntheticImpulse(
	ctx: BaseAudioContext,
	{ duration = 1.6, decay = 3.2, preDelay = 0.012 } = {}
): AudioBuffer {
	const sr = ctx.sampleRate;
	const length = Math.round(sr * duration);
	const offset = Math.round(sr * preDelay);
	const impulse = ctx.createBuffer(2, length, sr);

	for (let ch = 0; ch < 2; ch++) {
		const data = impulse.getChannelData(ch);
		let lp = 0;
		for (let i = offset; i < length; i++) {
			const t = (i - offset) / (length - offset);
			// Lowpass progresivo: las colas de reverb pierden agudos con el tiempo.
			const coef = 0.85 - t * 0.6;
			lp = lp + coef * (Math.random() * 2 - 1 - lp);
			data[i] = lp * Math.pow(1 - t, decay);
		}
	}
	return impulse;
}
