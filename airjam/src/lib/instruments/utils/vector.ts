/** Operaciones vectoriales 2D inmutables y sin asignaciones ocultas. */
import type { Vec2 } from '../types';

export const vec = (x: number, y: number): Vec2 => ({ x, y });
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, y: a.y * k });
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
export const cross = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x;
export const length = (a: Vec2): number => Math.hypot(a.x, a.y);
export const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);
export const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({
	x: a.x + (b.x - a.x) * t,
	y: a.y + (b.y - a.y) * t
});
export const midpoint = (a: Vec2, b: Vec2): Vec2 => lerp(a, b, 0.5);

export function normalize(a: Vec2): Vec2 {
	const len = length(a);
	return len > 1e-9 ? { x: a.x / len, y: a.y / len } : { x: 0, y: 0 };
}

/** Perpendicular rotada 90° en sentido antihorario. */
export const perp = (a: Vec2): Vec2 => ({ x: -a.y, y: a.x });

export const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

export interface SegmentHit {
	/** Parámetro 0..1 sobre el primer segmento (movimiento de la púa). */
	t: number;
	/** Parámetro 0..1 sobre el segundo segmento (la cuerda). */
	u: number;
	point: Vec2;
}

/**
 * Intersección de los segmentos P0→P1 y Q0→Q1.
 * Devuelve `null` si son paralelos o no se cruzan.
 */
export function segmentIntersection(p0: Vec2, p1: Vec2, q0: Vec2, q1: Vec2): SegmentHit | null {
	const r = sub(p1, p0);
	const s = sub(q1, q0);
	const denom = cross(r, s);
	if (Math.abs(denom) < 1e-9) return null;
	const qp = sub(q0, p0);
	const t = cross(qp, s) / denom;
	const u = cross(qp, r) / denom;
	if (t < 0 || t > 1 || u < 0 || u > 1) return null;
	return { t, u, point: add(p0, scale(r, t)) };
}

/** Lado (signo) de un punto respecto de la recta A→B. */
export const sideOfLine = (a: Vec2, b: Vec2, p: Vec2): number => Math.sign(cross(sub(b, a), sub(p, a)));
