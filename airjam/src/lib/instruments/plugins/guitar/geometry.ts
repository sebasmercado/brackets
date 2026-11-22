/**
 * Modelo geométrico de la guitarra anclada al cuerpo del usuario.
 *
 *            cejuela (mano del mástil)
 *   nut ●═══════════════════════════════● bridge
 *        \  6 cuerdas paralelas con     /
 *         \ conicidad + perspectiva    /   bodyCenter ≈ torso/cadera (lado de rasgueo)
 *
 * Todas las coordenadas están en píxeles del video espejado.
 */
import type { BodySide, TrackedHand, TrackedPoint, TrackedPose, Vec2 } from '../../types';
import { OneEuroFilter, OneEuroFilter2D } from '../../utils/OneEuroFilter';
import {
	add,
	clamp,
	distance,
	lerp,
	midpoint,
	normalize,
	perp,
	scale,
	sub
} from '../../utils/vector';
import { HAND, STRING_COUNT } from './constants';

export interface StringSegment {
	/** Extremo en la cejuela. */
	a: Vec2;
	/** Extremo en el puente. */
	b: Vec2;
}

export interface GuitarGeometry {
	nut: Vec2;
	bridge: Vec2;
	bodyCenter: Vec2;
	soundHole: Vec2;
	/** Vector unitario cejuela → puente. */
	axis: Vec2;
	/** Normal unitaria hacia la 6ª cuerda (lado "arriba" en pantalla). */
	up: Vec2;
	/** Ancho de hombros en px: unidad de escala independiente de la distancia a cámara. */
	unit: number;
	/** Longitud cejuela→puente. */
	length: number;
	/** Ancho del haz de cuerdas en la cejuela y en el puente. */
	nutWidth: number;
	bridgeWidth: number;
	strings: StringSegment[];
	/** Distancia hombro→mano del mástil normalizada (para el modo "zonas"). */
	reach: number;
}

export interface GeometryInput {
	pose: TrackedPose | null;
	fretHand: TrackedHand | undefined;
	fretSide: BodySide;
	frameHeight: number;
	timestamp: number;
}

export type GeometryResult =
	| { ok: true; geometry: GuitarGeometry }
	| { ok: false; reason: 'no-pose' | 'no-fret-hand' | 'neck-too-short' };

const MIN_VISIBILITY = 0.35;

const visible = (p: TrackedPoint | undefined): p is TrackedPoint =>
	!!p && p.visibility >= MIN_VISIBILITY;

/**
 * Calcula la geometría frame a frame aplicando suavizado One-Euro a los
 * anclajes (los anclajes tiemblan menos que la mano de rasgueo).
 */
export class GuitarGeometrySolver {
	private readonly bodyFilter = new OneEuroFilter2D(0.8, 0.01);
	private readonly nutFilter = new OneEuroFilter2D(1.5, 0.03);
	private readonly unitFilter = new OneEuroFilter(0.6, 0.005);
	private lastUp: Vec2 | null = null;

	solve({ pose, fretHand, fretSide, frameHeight, timestamp }: GeometryInput): GeometryResult {
		if (!pose || !visible(pose.leftShoulder) || !visible(pose.rightShoulder)) {
			return { ok: false, reason: 'no-pose' };
		}

		const strumSide: BodySide = fretSide === 'left' ? 'right' : 'left';
		const shoulderL = pose.leftShoulder;
		const shoulderR = pose.rightShoulder;
		const shoulderMid = midpoint(shoulderL, shoulderR);
		const unit = this.unitFilter.filter(Math.max(40, distance(shoulderL, shoulderR)), timestamp);

		// Cadera: si no es visible (webcam cercana), se estima bajo los hombros.
		const hipMid =
			visible(pose.leftHip) && visible(pose.rightHip)
				? midpoint(pose.leftHip, pose.rightHip)
				: add(shoulderMid, { x: 0, y: unit * 1.25 });

		// El cuerpo de la guitarra descansa sobre el vientre, desplazado al lado de rasgueo.
		const strumShoulder = strumSide === 'left' ? shoulderL : shoulderR;
		const lateral = normalize(sub(strumShoulder, shoulderMid));
		let body = add(lerp(shoulderMid, hipMid, 0.68), scale(lateral, unit * 0.18));
		body = { x: body.x, y: Math.min(body.y, frameHeight * 0.86) };
		const bodyCenter = this.bodyFilter.filter(body, timestamp);

		// Cejuela: palma de la mano del mástil (o muñeca de la pose como respaldo).
		const fretWristPose = fretSide === 'left' ? pose.leftWrist : pose.rightWrist;
		let nutRaw: Vec2 | null = null;
		let handZ = 0;
		if (fretHand) {
			const w = fretHand.landmarks[HAND.WRIST];
			const m = fretHand.landmarks[HAND.MIDDLE_MCP];
			if (w && m) nutRaw = midpoint(w, m);
		}
		if (!nutRaw && visible(fretWristPose)) nutRaw = fretWristPose;
		if (!nutRaw) return { ok: false, reason: 'no-fret-hand' };
		if (visible(fretWristPose)) {
			const shoulderZ = (shoulderL.z + shoulderR.z) / 2;
			handZ = fretWristPose.z - shoulderZ;
		}
		const nut = this.nutFilter.filter(nutRaw, timestamp);

		const neckVec = sub(nut, bodyCenter);
		const neckLen = Math.hypot(neckVec.x, neckVec.y);
		if (neckLen < unit * 0.55) return { ok: false, reason: 'neck-too-short' };

		const toNut = normalize(neckVec);
		const axis = scale(toNut, -1);
		const bridge = add(bodyCenter, scale(axis, unit * 0.42));
		const soundHole = add(bodyCenter, scale(toNut, unit * 0.16));

		// Normal estable: siempre apuntando hacia arriba en pantalla (6ª cuerda arriba).
		let up = perp(axis);
		if (up.y > 0.05 || (Math.abs(up.y) <= 0.05 && this.lastUp && up.x * this.lastUp.x < 0)) {
			up = scale(up, -1);
		}
		this.lastUp = up;

		// Perspectiva: si la mano del mástil está más cerca de la cámara (z menor), la cejuela se ve más ancha.
		const perspective = clamp(1 - handZ * 0.5, 0.75, 1.35);
		const nutWidth = unit * 0.2 * perspective;
		const bridgeWidth = unit * 0.3;

		const strings: StringSegment[] = [];
		for (let i = 0; i < STRING_COUNT; i++) {
			// i = 0 → 6ª cuerda (E grave), arriba.
			const k = 0.5 - i / (STRING_COUNT - 1);
			strings.push({
				a: add(nut, scale(up, nutWidth * k)),
				b: add(bridge, scale(up, bridgeWidth * k))
			});
		}

		const fretShoulder = fretSide === 'left' ? shoulderL : shoulderR;
		const reach = distance(fretShoulder, nut) / unit;

		return {
			ok: true,
			geometry: {
				nut,
				bridge,
				bodyCenter,
				soundHole,
				axis,
				up,
				unit,
				length: distance(nut, bridge),
				nutWidth,
				bridgeWidth,
				strings,
				reach
			}
		};
	}

	reset(): void {
		this.bodyFilter.reset();
		this.nutFilter.reset();
		this.unitFilter.reset();
		this.lastUp = null;
	}
}
