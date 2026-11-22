/**
 * Efectos visuales: vibración física de cuerdas y partículas de rasgueo.
 * Estado puro (sin canvas) para poder testearse y reutilizarse en otros
 * instrumentos de cuerda (bajo, ukelele).
 */
import type { StrumDirection, Vec2 } from '../../types';

interface Vibration {
	start: number;
	amplitude: number;
	/** Frecuencia visual (Hz) — no es la real, sino una legible a 60 fps. */
	frequency: number;
}

/** Vibración como onda estacionaria amortiguada: A·e^(-t/τ)·sin(πs)·sin(2πft). */
export class StringVibrations {
	private readonly items: (Vibration | null)[];

	constructor(
		count: number,
		private readonly decayMs = 650
	) {
		this.items = new Array<Vibration | null>(count).fill(null);
	}

	excite(index: number, amplitude: number, at: number): void {
		this.items[index] = { start: at, amplitude, frequency: 11 + index * 1.7 };
	}

	/**
	 * Desplazamiento perpendicular normalizado (multiplicar por el ancho de
	 * escala) en la posición `s` ∈ [0,1] a lo largo de la cuerda.
	 */
	displacement(index: number, s: number, now: number): number {
		const v = this.items[index];
		if (!v) return 0;
		const t = now - v.start;
		if (t < 0) return 0;
		if (t > this.decayMs * 5) {
			this.items[index] = null;
			return 0;
		}
		const env = v.amplitude * Math.exp(-t / this.decayMs);
		const phase = 2 * Math.PI * v.frequency * (t / 1000);
		// Fundamental + 2º armónico para un movimiento más orgánico.
		return env * (Math.sin(Math.PI * s) * Math.sin(phase) + 0.25 * Math.sin(2 * Math.PI * s) * Math.sin(phase * 2.01));
	}

	/** Energía actual 0..1 (para el brillo de la cuerda). */
	energy(index: number, now: number): number {
		const v = this.items[index];
		if (!v) return 0;
		const t = now - v.start;
		return t < 0 ? 0 : v.amplitude * Math.exp(-t / this.decayMs);
	}

	reset(): void {
		this.items.fill(null);
	}
}

export interface Particle {
	x: number;
	y: number;
	vx: number;
	vy: number;
	born: number;
	life: number;
	size: number;
	hue: number;
}

/** Sistema de partículas con pool acotado (sin crecimiento de memoria). */
export class ParticleSystem {
	readonly particles: Particle[] = [];

	constructor(private readonly max = 180) {}

	burst(at: Vec2, direction: StrumDirection, up: Vec2, unit: number, now: number, intensity: number): void {
		const count = Math.round(3 + intensity * 6);
		const sign = direction === 'down' ? -1 : 1;
		for (let i = 0; i < count; i++) {
			if (this.particles.length >= this.max) this.particles.shift();
			const spread = (Math.random() - 0.5) * 1.4;
			const speed = unit * (0.25 + Math.random() * 0.6) * (0.5 + intensity);
			this.particles.push({
				x: at.x,
				y: at.y,
				vx: (up.x * sign + spread * up.y) * speed,
				vy: (up.y * sign - spread * up.x) * speed,
				born: now,
				life: 380 + Math.random() * 420,
				size: unit * (0.006 + Math.random() * 0.012),
				hue: 32 + Math.random() * 18
			});
		}
	}

	/** Integra posiciones y elimina partículas muertas. `dt` en segundos. */
	step(now: number, dt: number): void {
		for (let i = this.particles.length - 1; i >= 0; i--) {
			const p = this.particles[i];
			if (!p) continue;
			if (now - p.born > p.life) {
				this.particles.splice(i, 1);
				continue;
			}
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			p.vx *= 0.92;
			p.vy = p.vy * 0.92 + 30 * dt; // leve gravedad
		}
	}

	reset(): void {
		this.particles.length = 0;
	}
}
