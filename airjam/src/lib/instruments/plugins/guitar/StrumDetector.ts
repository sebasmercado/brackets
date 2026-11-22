/**
 * Detección de rasgueo por intersección de segmentos.
 *
 * Entre dos frames, la "púa" (punto medio entre pulgar e índice de la mano de
 * rasgueo) describe un segmento P(t-1)→P(t). Si ese segmento cruza el segmento
 * de una cuerda dentro de la zona de rasgueo, la cuerda se dispara. Esto es
 * robusto a FPS bajos: un rasgueo rápido que cruza las 6 cuerdas en un solo
 * frame las detecta todas, ordenadas por el instante de cruce.
 */
import type { StrumDirection, Vec2 } from '../../types';
import { distance, dot, segmentIntersection, sub } from '../../utils/vector';
import { STRING_COOLDOWN_MS, STRUM_ZONE } from './constants';
import type { GuitarGeometry } from './geometry';

export interface StrumHit {
	stringIndex: number;
	/** Fracción 0..1 del movimiento del frame en que ocurrió el cruce. */
	t: number;
	/** Posición 0..1 sobre la cuerda (0 cejuela, 1 puente). */
	u: number;
	point: Vec2;
	direction: StrumDirection;
	/** Velocidad normalizada 0..1. */
	velocity: number;
}

export interface StrumResult {
	hits: StrumHit[];
	/** Duración del frame en ms (para escalonar los ataques). */
	frameMs: number;
}

export class StrumDetector {
	private prev: Vec2 | null = null;
	private prevTime = 0;
	private readonly lastHit: number[];

	constructor(stringCount: number) {
		this.lastHit = new Array<number>(stringCount).fill(-Infinity);
	}

	detect(pick: Vec2 | null, timestamp: number, geometry: GuitarGeometry): StrumResult {
		const empty: StrumResult = { hits: [], frameMs: 0 };
		if (!pick) {
			this.prev = null;
			return empty;
		}
		const prev = this.prev;
		const frameMs = timestamp - this.prevTime;
		this.prev = pick;
		this.prevTime = timestamp;
		if (!prev || frameMs <= 0 || frameMs > 200) return empty;

		const moved = distance(prev, pick);
		// Saltos imposibles = error de tracking (cambio de mano, oclusión).
		if (moved > geometry.unit * 1.2 || moved < geometry.unit * 0.004) return empty;

		const motion = sub(pick, prev);
		// "Abajo" = desde la 6ª cuerda hacia la 1ª (opuesto a `up`).
		const direction: StrumDirection = dot(motion, geometry.up) < 0 ? 'down' : 'up';
		const speed = moved / geometry.unit / (frameMs / 1000); // anchos de hombro por segundo
		const velocity = Math.min(1, Math.max(0.15, 0.12 + speed / 9));

		const hits: StrumHit[] = [];
		geometry.strings.forEach((s, i) => {
			const hit = segmentIntersection(prev, pick, s.a, s.b);
			if (!hit || hit.u < STRUM_ZONE[0] || hit.u > STRUM_ZONE[1]) return;
			const lastHit = this.lastHit[i] ?? -Infinity;
			if (timestamp - lastHit < STRING_COOLDOWN_MS) return;
			this.lastHit[i] = timestamp;
			hits.push({ stringIndex: i, t: hit.t, u: hit.u, point: hit.point, direction, velocity });
		});
		hits.sort((a, b) => a.t - b.t);
		return { hits, frameMs };
	}

	reset(): void {
		this.prev = null;
		this.lastHit.fill(-Infinity);
	}
}
