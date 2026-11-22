/**
 * Utilidades de teoría musical: conversión MIDI ↔ frecuencia ↔ nombre.
 */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** Frecuencia (Hz) de una nota MIDI con A4 = 440 Hz. */
export function midiToFrequency(midi: number, a4 = 440): number {
	return a4 * 2 ** ((midi - 69) / 12);
}

/** Nombre científico de una nota MIDI, ej. 40 → "E2". */
export function midiToName(midi: number): string {
	const name = NOTE_NAMES[((midi % 12) + 12) % 12] ?? '?';
	return `${name}${Math.floor(midi / 12) - 1}`;
}

/** Nombre sin octava, ej. 40 → "E". */
export function midiToPitchClass(midi: number): string {
	return NOTE_NAMES[((midi % 12) + 12) % 12] ?? '?';
}
