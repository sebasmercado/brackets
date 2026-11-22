/**
 * Filtro One-Euro (Casiez et al., 2012): suavizado adaptativo de baja latencia.
 * Poco suavizado con movimientos rápidos (rasgueo) y mucho con la mano quieta
 * (elimina el temblor del tracking sin agregar retraso perceptible).
 */
import type { Vec2 } from '../types';

class LowPass {
	private y: number | null = null;
	filter(x: number, alpha: number): number {
		this.y = this.y === null ? x : alpha * x + (1 - alpha) * this.y;
		return this.y;
	}
	get last(): number | null {
		return this.y;
	}
	reset(): void {
		this.y = null;
	}
}

const alpha = (cutoff: number, dt: number): number => {
	const tau = 1 / (2 * Math.PI * cutoff);
	return 1 / (1 + tau / dt);
};

export class OneEuroFilter {
	private readonly x = new LowPass();
	private readonly dx = new LowPass();
	private lastTime: number | null = null;

	constructor(
		private readonly minCutoff = 1.2,
		private readonly beta = 0.02,
		private readonly dCutoff = 1
	) {}

	/** @param timestamp en milisegundos. */
	filter(value: number, timestamp: number): number {
		const prev = this.x.last;
		if (this.lastTime === null || prev === null) {
			this.lastTime = timestamp;
			this.dx.filter(0, 1);
			return this.x.filter(value, 1);
		}
		const dt = Math.max(1e-3, (timestamp - this.lastTime) / 1000);
		this.lastTime = timestamp;
		const dValue = this.dx.filter((value - prev) / dt, alpha(this.dCutoff, dt));
		const cutoff = this.minCutoff + this.beta * Math.abs(dValue);
		return this.x.filter(value, alpha(cutoff, dt));
	}

	reset(): void {
		this.x.reset();
		this.dx.reset();
		this.lastTime = null;
	}
}

/** Filtro One-Euro para puntos 2D. */
export class OneEuroFilter2D {
	private readonly fx: OneEuroFilter;
	private readonly fy: OneEuroFilter;

	constructor(minCutoff?: number, beta?: number) {
		this.fx = new OneEuroFilter(minCutoff, beta);
		this.fy = new OneEuroFilter(minCutoff, beta);
	}

	filter(p: Vec2, timestamp: number): Vec2 {
		return { x: this.fx.filter(p.x, timestamp), y: this.fy.filter(p.y, timestamp) };
	}

	reset(): void {
		this.fx.reset();
		this.fy.reset();
	}
}
