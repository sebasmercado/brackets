/** Constructores de frames sintéticos para tests. */
import type { BodySide, TrackedHand, TrackedPoint, TrackedPose, TrackingFrame, Vec2 } from '../types';

export const pt = (x: number, y: number, z = 0): TrackedPoint => ({ x, y, z, visibility: 1 });

export function pose(): TrackedPose {
	return {
		leftShoulder: pt(520, 300),
		rightShoulder: pt(760, 300),
		leftElbow: pt(380, 380),
		rightElbow: pt(820, 420),
		leftWrist: pt(200, 420),
		rightWrist: pt(650, 450),
		leftHip: pt(560, 600),
		rightHip: pt(720, 600)
	};
}

/**
 * Mano sintética "vertical" con la muñeca en `wrist`.
 * @param extended [pulgar, índice, medio, anular, meñique]
 */
export function hand(
	side: BodySide,
	wrist: Vec2,
	extended: [boolean, boolean, boolean, boolean, boolean] = [true, true, true, true, true],
	s = 40
): TrackedHand {
	const lm: TrackedPoint[] = new Array(21).fill(null).map(() => pt(wrist.x, wrist.y));
	lm[0] = pt(wrist.x, wrist.y);
	// Pulgar (1-4) hacia el costado.
	const tx = extended[0] ? 1 : 0.35;
	lm[1] = pt(wrist.x - 0.4 * s, wrist.y - 0.3 * s);
	lm[2] = pt(wrist.x - 0.7 * s, wrist.y - 0.6 * s);
	lm[3] = pt(wrist.x - 0.9 * s * tx - 0.3 * s, wrist.y - 0.9 * s);
	lm[4] = pt(wrist.x - 1.4 * s * tx, wrist.y - 1.1 * s);
	// Dedos (MCP, PIP, DIP, TIP) hacia arriba, separados en x.
	const bases = [5, 9, 13, 17];
	bases.forEach((b, f) => {
		const x = wrist.x + (f - 1.5) * 0.35 * s;
		const ext = extended[f + 1];
		lm[b] = pt(x, wrist.y - 1.0 * s);
		lm[b + 1] = pt(x, wrist.y - 1.45 * s);
		lm[b + 2] = ext ? pt(x, wrist.y - 1.8 * s) : pt(x, wrist.y - 1.2 * s);
		lm[b + 3] = ext ? pt(x, wrist.y - 2.2 * s) : pt(x, wrist.y - 0.9 * s);
	});
	return { side, landmarks: lm, score: 1 };
}

/** Mano de rasgueo con pulgar e índice juntos en `pick`. */
export function pickHand(side: BodySide, pick: Vec2): TrackedHand {
	const h = hand(side, { x: pick.x + 30, y: pick.y + 60 });
	h.landmarks[4] = pt(pick.x, pick.y);
	h.landmarks[8] = pt(pick.x, pick.y);
	return h;
}

export function frame(timestamp: number, hands: Partial<Record<BodySide, TrackedHand>>): TrackingFrame {
	return { timestamp, width: 1280, height: 720, pose: pose(), hands };
}
