/**
 * Clasificación de la postura de la mano del mástil → acorde.
 *
 * Usa relaciones de distancias invariantes a rotación y escala (dedo extendido
 * si la punta está claramente más lejos de la muñeca que la articulación PIP),
 * más un estabilizador temporal con histéresis para evitar parpadeos.
 */
import { chordFromPattern, FREE_MODE_CHORDS, getChord } from '../../music/chords';
import type { ChordDefinition, FingerPattern, TrackedHand } from '../../types';
import { distance } from '../../utils/vector';
import { HAND } from './constants';

const FINGERS = [
	[HAND.INDEX_PIP, HAND.INDEX_TIP],
	[HAND.MIDDLE_PIP, HAND.MIDDLE_TIP],
	[HAND.RING_PIP, HAND.RING_TIP],
	[HAND.PINKY_PIP, HAND.PINKY_TIP]
] as const;

/** Devuelve el patrón [pulgar, índice, medio, anular, meñique] extendido/flexionado. */
export function readFingerPattern(hand: TrackedHand): FingerPattern | null {
	const lm = hand.landmarks;
	const wrist = lm[HAND.WRIST];
	const middleMcp = lm[HAND.MIDDLE_MCP];
	const thumbTip = lm[HAND.THUMB_TIP];
	const thumbIp = lm[HAND.THUMB_IP];
	const indexMcp = lm[HAND.INDEX_MCP];
	const pinkyMcp = lm[HAND.PINKY_MCP];
	if (!wrist || !middleMcp || !thumbTip || !thumbIp || !indexMcp || !pinkyMcp) return null;

	const palm = Math.max(1, distance(wrist, middleMcp));

	const fingers = FINGERS.map(([pipIdx, tipIdx]) => {
		const pip = lm[pipIdx];
		const tip = lm[tipIdx];
		if (!pip || !tip) return false;
		return distance(wrist, tip) > distance(wrist, pip) * 1.18 && distance(wrist, tip) > palm * 1.25;
	});

	// Pulgar: punta lejos de la base del índice y del meñique (abierto lateralmente).
	const thumb =
		distance(thumbTip, indexMcp) > palm * 0.62 &&
		distance(thumbTip, pinkyMcp) > distance(thumbIp, pinkyMcp) * 1.05;

	return [thumb, fingers[0] ?? false, fingers[1] ?? false, fingers[2] ?? false, fingers[3] ?? false];
}

/**
 * Estabilizador temporal: un candidato debe mantenerse `holdFrames` frames
 * consecutivos para convertirse en el valor confirmado.
 */
export class Stabilizer<T> {
	private candidate: T | null = null;
	private count = 0;
	private confirmed: T | null = null;

	constructor(private readonly holdFrames = 4) {}

	push(value: T | null): T | null {
		if (value === this.candidate) {
			this.count++;
		} else {
			this.candidate = value;
			this.count = 1;
		}
		if (this.count >= this.holdFrames && value !== null) this.confirmed = value;
		return this.confirmed;
	}

	get value(): T | null {
		return this.confirmed;
	}

	reset(): void {
		this.candidate = null;
		this.count = 0;
		this.confirmed = null;
	}
}

/** Lector de acordes por gesto. */
export class GestureChordReader {
	private readonly stabilizer = new Stabilizer<string>(4);
	lastPattern: FingerPattern | null = null;

	read(hand: TrackedHand | undefined): ChordDefinition | null {
		const pattern = hand ? readFingerPattern(hand) : null;
		this.lastPattern = pattern;
		const raw = pattern ? chordFromPattern(pattern) : null;
		return getChord(this.stabilizer.push(raw?.name ?? null));
	}

	reset(): void {
		this.stabilizer.reset();
		this.lastPattern = null;
	}
}

/**
 * Lector de acordes por zonas: la distancia hombro→mano del mástil (en anchos
 * de hombro) se divide en N zonas, con histéresis en los bordes.
 */
export class ZoneChordReader {
	static readonly MIN_REACH = 0.7;
	static readonly MAX_REACH = 1.75;
	private zone = -1;

	read(reach: number): ChordDefinition | null {
		const zones = FREE_MODE_CHORDS.length;
		const { MIN_REACH, MAX_REACH } = ZoneChordReader;
		const pos = ((reach - MIN_REACH) / (MAX_REACH - MIN_REACH)) * zones;
		const clamped = Math.min(zones - 1e-6, Math.max(0, pos));
		const candidate = Math.floor(clamped);
		// Histéresis: solo cambia si se adentra un 20% en la nueva zona.
		if (this.zone < 0 || Math.abs(clamped - (this.zone + 0.5)) > 0.7) this.zone = candidate;
		return getChord(FREE_MODE_CHORDS[this.zone]);
	}

	/** Posición continua 0..1 dentro del rango de alcance (para el indicador visual). */
	static progress(reach: number): number {
		const { MIN_REACH, MAX_REACH } = ZoneChordReader;
		return Math.min(1, Math.max(0, (reach - MIN_REACH) / (MAX_REACH - MIN_REACH)));
	}

	get currentZone(): number {
		return this.zone;
	}

	reset(): void {
		this.zone = -1;
	}
}
