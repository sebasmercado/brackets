/**
 * Adaptador de MediaPipe Tasks Vision → `TrackingFrame` agnóstico.
 *
 * - `PoseLandmarker` (lite): hombros, codos, muñecas y caderas para anclar el instrumento.
 *   Se ejecuta cada `poseEvery` frames (el torso se mueve lento) para liberar GPU.
 * - `HandLandmarker` (2 manos): se ejecuta en cada frame (el rasgueo es rápido).
 * - Las manos se asignan a izquierda/derecha *anatómicas* emparejándolas con
 *   las muñecas de la pose (más robusto que la etiqueta de lateralidad).
 * - Las coordenadas se espejan (x → 1 - x) para coincidir con el video en modo selfie.
 *
 * El módulo de MediaPipe se importa dinámicamente: no forma parte del bundle inicial
 * y nunca se evalúa en SSR.
 */
import type { HandLandmarker, NormalizedLandmark, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { BodySide, TrackedHand, TrackedPoint, TrackedPose, TrackingFrame, Vec2 } from '#lib/instruments/types.ts';

const MODELS = {
	pose: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task',
	hand: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task'
} as const;

/** Índices de landmarks de MediaPipe Pose. */
const POSE = {
	LEFT_SHOULDER: 11,
	RIGHT_SHOULDER: 12,
	LEFT_ELBOW: 13,
	RIGHT_ELBOW: 14,
	LEFT_WRIST: 15,
	RIGHT_WRIST: 16,
	LEFT_HIP: 23,
	RIGHT_HIP: 24
} as const;

export type TrackerStage = 'runtime' | 'pose-model' | 'hand-model' | 'ready';

export interface VisionTrackerOptions {
	/** Ruta base del runtime WASM servido localmente. */
	wasmBasePath?: string;
	poseEvery?: number;
	onStage?: (stage: TrackerStage) => void;
}

export class VisionTracker {
	private pose: PoseLandmarker | null = null;
	private hands: HandLandmarker | null = null;
	private lastPose: TrackedPose | null = null;
	private frameCount = 0;
	private lastVideoTime = -1;
	private readonly poseEvery: number;
	delegate: 'GPU' | 'CPU' = 'GPU';

	constructor(private readonly options: VisionTrackerOptions = {}) {
		this.poseEvery = Math.max(1, options.poseEvery ?? 2);
	}

	get ready(): boolean {
		return !!this.pose && !!this.hands;
	}

	async init(): Promise<void> {
		const { onStage } = this.options;
		onStage?.('runtime');
		const vision = await import('@mediapipe/tasks-vision');
		const fileset = await vision.FilesetResolver.forVisionTasks(this.options.wasmBasePath ?? '/mediapipe/wasm');

		const create = async <T>(factory: (delegate: 'GPU' | 'CPU') => Promise<T>): Promise<T> => {
			try {
				return await factory(this.delegate);
			} catch (error) {
				// Algunos dispositivos no soportan WebGL2 delegate: degradamos a CPU.
				if (this.delegate === 'CPU') throw error;
				console.warn('[VisionTracker] GPU delegate no disponible, usando CPU.', error);
				this.delegate = 'CPU';
				return factory('CPU');
			}
		};

		onStage?.('pose-model');
		this.pose = await create((delegate) =>
			vision.PoseLandmarker.createFromOptions(fileset, {
				baseOptions: { modelAssetPath: MODELS.pose, delegate },
				runningMode: 'VIDEO',
				numPoses: 1,
				minPoseDetectionConfidence: 0.5,
				minPosePresenceConfidence: 0.5,
				minTrackingConfidence: 0.5
			})
		);

		onStage?.('hand-model');
		this.hands = await create((delegate) =>
			vision.HandLandmarker.createFromOptions(fileset, {
				baseOptions: { modelAssetPath: MODELS.hand, delegate },
				runningMode: 'VIDEO',
				numHands: 2,
				minHandDetectionConfidence: 0.5,
				minHandPresenceConfidence: 0.5,
				minTrackingConfidence: 0.5
			})
		);
		onStage?.('ready');
	}

	/**
	 * Procesa el frame actual del video. Devuelve `null` si el video no avanzó
	 * (evita inferencias duplicadas cuando el rAF corre más rápido que la cámara).
	 */
	detect(video: HTMLVideoElement, timestamp: number): TrackingFrame | null {
		if (!this.pose || !this.hands || video.readyState < 2) return null;
		if (video.currentTime === this.lastVideoTime) return null;
		this.lastVideoTime = video.currentTime;

		const width = video.videoWidth;
		const height = video.videoHeight;
		const ts = Math.round(timestamp);

		if (this.frameCount++ % this.poseEvery === 0 || !this.lastPose) {
			const poseResult = this.pose.detectForVideo(video, ts);
			const lm = poseResult.landmarks[0];
			this.lastPose = lm ? toPose(lm, width, height) : null;
		}

		const handResult = this.hands.detectForVideo(video, ts);
		const detected = handResult.landmarks.map((landmarks, i) => ({
			landmarks: landmarks.map((p) => toPoint(p, width, height)),
			label: handResult.handedness[i]?.[0]?.categoryName ?? '',
			score: handResult.handedness[i]?.[0]?.score ?? 0
		}));

		return {
			timestamp,
			width,
			height,
			pose: this.lastPose,
			hands: assignHands(detected, this.lastPose)
		};
	}

	dispose(): void {
		this.pose?.close();
		this.hands?.close();
		this.pose = null;
		this.hands = null;
		this.lastPose = null;
	}
}

/* -------------------------------------------------------------------------- */

function toPoint(p: NormalizedLandmark, width: number, height: number): TrackedPoint {
	return {
		x: (1 - p.x) * width, // espejado
		y: p.y * height,
		z: p.z,
		visibility: p.visibility ?? 1
	};
}

function toPose(lm: NormalizedLandmark[], width: number, height: number): TrackedPose | null {
	const get = (i: number): TrackedPoint | null => {
		const p = lm[i];
		return p ? toPoint(p, width, height) : null;
	};
	const pts = {
		leftShoulder: get(POSE.LEFT_SHOULDER),
		rightShoulder: get(POSE.RIGHT_SHOULDER),
		leftElbow: get(POSE.LEFT_ELBOW),
		rightElbow: get(POSE.RIGHT_ELBOW),
		leftWrist: get(POSE.LEFT_WRIST),
		rightWrist: get(POSE.RIGHT_WRIST),
		leftHip: get(POSE.LEFT_HIP),
		rightHip: get(POSE.RIGHT_HIP)
	};
	if (Object.values(pts).some((p) => p === null)) return null;
	return pts as TrackedPose;
}

interface RawHand {
	landmarks: TrackedPoint[];
	label: string;
	score: number;
}

const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Asigna cada mano detectada a un lado anatómico.
 * 1) Con pose: emparejamiento óptimo muñeca-de-mano ↔ muñeca-de-pose.
 * 2) Sin pose: etiqueta de MediaPipe (que asume imagen espejada; con el video
 *    crudo de la webcam la etiqueta "Left" corresponde a la mano derecha real).
 */
function assignHands(hands: RawHand[], pose: TrackedPose | null): Partial<Record<BodySide, TrackedHand>> {
	const out: Partial<Record<BodySide, TrackedHand>> = {};
	if (hands.length === 0) return out;

	const make = (h: RawHand, side: BodySide): TrackedHand => ({ side, landmarks: h.landmarks, score: h.score });
	const wristOf = (h: RawHand): Vec2 | undefined => h.landmarks[0];

	if (pose) {
		const [a, b] = hands;
		const wa = a ? wristOf(a) : undefined;
		if (a && wa && !b) {
			const side: BodySide = dist(wa, pose.leftWrist) <= dist(wa, pose.rightWrist) ? 'left' : 'right';
			out[side] = make(a, side);
			return out;
		}
		const wb = b ? wristOf(b) : undefined;
		if (a && b && wa && wb) {
			const straight = dist(wa, pose.leftWrist) + dist(wb, pose.rightWrist);
			const crossed = dist(wa, pose.rightWrist) + dist(wb, pose.leftWrist);
			if (straight <= crossed) {
				out.left = make(a, 'left');
				out.right = make(b, 'right');
			} else {
				out.left = make(b, 'left');
				out.right = make(a, 'right');
			}
			return out;
		}
	}

	for (const h of hands) {
		const side: BodySide = h.label === 'Left' ? 'right' : 'left';
		if (!out[side] || out[side].score < h.score) out[side] = make(h, side);
	}
	return out;
}
