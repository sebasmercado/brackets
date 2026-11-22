/** Conversión de `Song` (secciones/compases) a una línea de tiempo plana en beats. */
import type { ChordEvent, Song, SongTimeline } from './types';

export function buildTimeline(song: Song): SongTimeline {
	const events: ChordEvent[] = [];
	let beat = 0;
	let bar = 0;

	for (const section of song.sections) {
		const repeat = Math.max(1, section.repeat ?? 1);
		for (let r = 0; r < repeat; r++) {
			for (const chords of section.bars) {
				const parts = chords.length > 0 ? chords : ['—'];
				const beats = song.beatsPerBar / parts.length;
				for (const chord of parts) {
					const last = events[events.length - 1];
					// Fusiona acordes consecutivos idénticos de la misma sección y compás contiguo.
					if (last && last.chord === chord && last.section === section.name && last.startBeat + last.beats === beat) {
						last.beats += beats;
					} else {
						events.push({ index: events.length, chord, startBeat: beat, beats, section: section.name, bar });
					}
					beat += beats;
				}
				bar++;
			}
		}
	}
	return { events, totalBeats: beat, totalBars: bar };
}

/** Búsqueda binaria del evento activo en `beat`. Devuelve -1 antes del inicio. */
export function eventIndexAt(events: readonly ChordEvent[], beat: number): number {
	let lo = 0;
	let hi = events.length - 1;
	let found = -1;
	while (lo <= hi) {
		const mid = (lo + hi) >> 1;
		const e = events[mid];
		if (!e) break;
		if (e.startBeat <= beat) {
			found = mid;
			lo = mid + 1;
		} else {
			hi = mid - 1;
		}
	}
	return found;
}
