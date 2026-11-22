/**
 * Librería de acordes abiertos de guitarra y su gesto de mano asociado.
 *
 * Los gestos se eligieron para ser fáciles de reconocer por MediaPipe y
 * mutuamente distinguibles (patrones de dedos extendidos únicos).
 */
import type { ChordDefinition, FingerPattern } from '../types';

const p = (t: 0 | 1, i: 0 | 1, m: 0 | 1, r: 0 | 1, k: 0 | 1): FingerPattern =>
	[!!t, !!i, !!m, !!r, !!k] as const;

export const CHORDS: Readonly<Record<string, ChordDefinition>> = {
	C: {
		name: 'C',
		label: 'Do mayor',
		frets: [null, 3, 2, 0, 1, 0],
		fingers: [null, 3, 2, 0, 1, 0],
		gesture: p(0, 1, 0, 0, 0),
		gestureHint: 'Solo índice',
		gestureEmoji: '☝️'
	},
	G: {
		name: 'G',
		label: 'Sol mayor',
		frets: [3, 2, 0, 0, 0, 3],
		fingers: [2, 1, 0, 0, 0, 3],
		gesture: p(0, 1, 1, 0, 0),
		gestureHint: 'Índice + medio',
		gestureEmoji: '✌️'
	},
	Am: {
		name: 'Am',
		label: 'La menor',
		frets: [null, 0, 2, 2, 1, 0],
		fingers: [null, 0, 2, 3, 1, 0],
		gesture: p(0, 1, 1, 1, 0),
		gestureHint: 'Índice + medio + anular',
		gestureEmoji: '🤟'
	},
	F: {
		name: 'F',
		label: 'Fa mayor',
		frets: [1, 3, 3, 2, 1, 1],
		fingers: [1, 3, 4, 2, 1, 1],
		gesture: p(0, 1, 1, 1, 1),
		gestureHint: 'Cuatro dedos (pulgar doblado)',
		gestureEmoji: '🖖'
	},
	D: {
		name: 'D',
		label: 'Re mayor',
		frets: [null, null, 0, 2, 3, 2],
		fingers: [null, null, 0, 1, 3, 2],
		gesture: p(1, 1, 1, 1, 1),
		gestureHint: 'Mano abierta',
		gestureEmoji: '🖐️'
	},
	Em: {
		name: 'Em',
		label: 'Mi menor',
		frets: [0, 2, 2, 0, 0, 0],
		fingers: [0, 2, 3, 0, 0, 0],
		gesture: p(0, 0, 0, 0, 0),
		gestureHint: 'Puño cerrado',
		gestureEmoji: '✊'
	},
	E: {
		name: 'E',
		label: 'Mi mayor',
		frets: [0, 2, 2, 1, 0, 0],
		fingers: [0, 2, 3, 1, 0, 0],
		gesture: p(1, 0, 0, 0, 0),
		gestureHint: 'Solo pulgar',
		gestureEmoji: '👍'
	},
	A: {
		name: 'A',
		label: 'La mayor',
		frets: [null, 0, 2, 2, 2, 0],
		fingers: [null, 0, 1, 2, 3, 0],
		gesture: p(1, 0, 0, 0, 1),
		gestureHint: 'Pulgar + meñique',
		gestureEmoji: '🤙'
	},
	Bm: {
		name: 'Bm',
		label: 'Si menor',
		frets: [null, 2, 4, 4, 3, 2],
		fingers: [null, 1, 3, 4, 2, 1],
		gesture: p(0, 1, 0, 0, 1),
		gestureHint: 'Índice + meñique',
		gestureEmoji: '🤘'
	}
};

/** Acordes disponibles en Modo Libre, en orden de "zona" del mástil. */
export const FREE_MODE_CHORDS = ['Em', 'G', 'C', 'D', 'Am', 'E', 'A', 'F'] as const;

export function getChord(name: string | null | undefined): ChordDefinition | null {
	return name ? (CHORDS[name] ?? null) : null;
}

export function patternsEqual(a: FingerPattern, b: FingerPattern): boolean {
	return a.every((v, i) => v === b[i]);
}

/** Devuelve el acorde cuyo gesto coincide exactamente con el patrón dado. */
export function chordFromPattern(pattern: FingerPattern): ChordDefinition | null {
	for (const chord of Object.values(CHORDS)) {
		if (patternsEqual(chord.gesture, pattern)) return chord;
	}
	return null;
}
