import { describe, expect, it } from 'vitest';
import { renderKarplusStrong } from '../engine/KarplusStrongSynth';

/** Mock mínimo de BaseAudioContext para renderizar offline en Node. */
function mockContext(sampleRate = 48000): BaseAudioContext {
	return {
		sampleRate,
		createBuffer: (_ch: number, length: number, sr: number) => {
			const data = new Float32Array(length);
			return { length, sampleRate: sr, getChannelData: () => data } as unknown as AudioBuffer;
		}
	} as unknown as BaseAudioContext;
}

/** Estimación de pitch por autocorrelación. */
function estimatePitch(data: Float32Array, sr: number, minHz = 60, maxHz = 500): number {
	const start = Math.round(sr * 0.1);
	const n = Math.round(sr * 0.1);
	let bestLag = 0;
	let best = -Infinity;
	for (let lag = Math.floor(sr / maxHz); lag <= Math.ceil(sr / minHz); lag++) {
		let sum = 0;
		for (let i = 0; i < n; i++) sum += (data[start + i] ?? 0) * (data[start + i + lag] ?? 0);
		if (sum > best) {
			best = sum;
			bestLag = lag;
		}
	}
	return sr / bestLag;
}

describe('renderKarplusStrong', () => {
	it.each([82.41, 110, 196, 329.63])('afina %f Hz con error < 1.5%%', (freq) => {
		const ctx = mockContext();
		const buffer = renderKarplusStrong(ctx, freq, { muted: false, seed: 1 });
		const pitch = estimatePitch(buffer.getChannelData(0), ctx.sampleRate);
		expect(Math.abs(pitch - freq) / freq).toBeLessThan(0.015);
	});

	it('decae (energía final << inicial) y no satura', () => {
		const ctx = mockContext();
		const data = renderKarplusStrong(ctx, 110, { muted: false, seed: 2 }).getChannelData(0);
		const rms = (a: number, b: number) => {
			let s = 0;
			for (let i = a; i < b; i++) s += (data[i] ?? 0) ** 2;
			return Math.sqrt(s / (b - a));
		};
		const head = rms(0, 4800);
		const tail = rms(data.length - 4800, data.length);
		expect(tail).toBeLessThan(head * 0.05);
		expect(data.reduce((m, v) => Math.max(m, Math.abs(v)), 0)).toBeLessThanOrEqual(1.0001);
	});

	it('la articulación apagada es corta', () => {
		const ctx = mockContext();
		const buffer = renderKarplusStrong(ctx, 110, { muted: true, seed: 1 });
		expect(buffer.length / ctx.sampleRate).toBeLessThan(0.3);
	});
});
