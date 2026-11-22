/**
 * Formato de canción: compases agrupados en secciones.
 * Cada compás es una lista de acordes que se reparten el compás en partes iguales
 * (ej. `["G", "D"]` = 2 tiempos de G y 2 de D en 4/4).
 */
export interface SongSection {
	name: string;
	bars: string[][];
	/** Veces que se repite la sección (por defecto 1). */
	repeat?: number;
}

export interface Song {
	id: string;
	title: string;
	artist: string;
	bpm: number;
	/** Tiempos por compás (numerador del compás; denominador asumido negra). */
	beatsPerBar: number;
	difficulty: 'fácil' | 'media' | 'difícil';
	/** Patrón de rasgueo sugerido, ej. "↓ ↓ ↑ ↑ ↓ ↑". */
	strumPattern: string;
	/** Nota sobre el arreglo (simplificaciones, cejilla, etc.). */
	arrangement: string;
	sections: SongSection[];
}

/** Evento plano de la línea de tiempo (en tiempos/beats). */
export interface ChordEvent {
	index: number;
	chord: string;
	startBeat: number;
	beats: number;
	section: string;
	bar: number;
}

export interface SongTimeline {
	events: ChordEvent[];
	totalBeats: number;
	totalBars: number;
}
