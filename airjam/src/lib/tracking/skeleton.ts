/**
 * Dibujo sutil del esqueleto (brazos + manos) como guía visual del tracking.
 */
import type { TrackedPoint, TrackingFrame, ViewTransform } from '#lib/instruments/types.ts';

const HAND_LINKS: readonly [number, number][] = [
	[0, 1], [1, 2], [2, 3], [3, 4],
	[0, 5], [5, 6], [6, 7], [7, 8],
	[5, 9], [9, 10], [10, 11], [11, 12],
	[9, 13], [13, 14], [14, 15], [15, 16],
	[13, 17], [17, 18], [18, 19], [19, 20], [0, 17]
];

export function drawSkeleton(ctx: CanvasRenderingContext2D, view: ViewTransform, frame: TrackingFrame): void {
	const k = view.devicePixelRatio * view.scale;
	ctx.save();
	ctx.setTransform(k, 0, 0, k, view.devicePixelRatio * view.offsetX, view.devicePixelRatio * view.offsetY);
	ctx.lineCap = 'round';
	const px = 1 / view.scale; // 1 px CSS en coordenadas de video

	const line = (a: TrackedPoint | undefined, b: TrackedPoint | undefined) => {
		if (!a || !b || a.visibility < 0.4 || b.visibility < 0.4) return;
		ctx.moveTo(a.x, a.y);
		ctx.lineTo(b.x, b.y);
	};

	const p = frame.pose;
	if (p) {
		ctx.beginPath();
		line(p.leftShoulder, p.rightShoulder);
		line(p.leftShoulder, p.leftElbow);
		line(p.leftElbow, p.leftWrist);
		line(p.rightShoulder, p.rightElbow);
		line(p.rightElbow, p.rightWrist);
		ctx.strokeStyle = 'rgba(255,255,255,0.18)';
		ctx.lineWidth = 2 * px;
		ctx.stroke();
	}

	for (const hand of Object.values(frame.hands)) {
		if (!hand) continue;
		ctx.beginPath();
		for (const [a, b] of HAND_LINKS) line(hand.landmarks[a], hand.landmarks[b]);
		ctx.strokeStyle = hand.side === 'left' ? 'rgba(125,211,252,0.35)' : 'rgba(251,191,36,0.35)';
		ctx.lineWidth = 1.5 * px;
		ctx.stroke();
	}
	ctx.restore();
}
