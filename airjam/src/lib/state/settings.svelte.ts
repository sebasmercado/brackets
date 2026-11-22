/**
 * Preferencias de la sesión (Svelte 5 Runes) con persistencia best-effort en
 * localStorage (puede fallar en modo privado: nunca es crítico).
 */
import type { ChordInputMode, PlayMode } from '#lib/instruments/types.ts';

export type AppMode = 'free' | 'songs';

interface Persisted {
	appMode: AppMode;
	autoChord: boolean;
	leftHanded: boolean;
	chordInput: ChordInputMode;
	metronome: boolean;
	showSkeleton: boolean;
	songId: string;
}

const STORAGE_KEY = 'airjam:settings:v1';

const DEFAULTS: Persisted = {
	appMode: 'free',
	autoChord: true,
	leftHanded: false,
	chordInput: 'gesture',
	metronome: true,
	showSkeleton: true,
	songId: 'de-musica-ligera'
};

function load(): Persisted {
	try {
		const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
		return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Persisted>) } : { ...DEFAULTS };
	} catch {
		return { ...DEFAULTS };
	}
}

export class Settings {
	appMode = $state<AppMode>(DEFAULTS.appMode);
	/** En modo Canciones: `true` = Auto-Acorde, `false` = Manual. */
	autoChord = $state(DEFAULTS.autoChord);
	leftHanded = $state(DEFAULTS.leftHanded);
	chordInput = $state<ChordInputMode>(DEFAULTS.chordInput);
	metronome = $state(DEFAULTS.metronome);
	showSkeleton = $state(DEFAULTS.showSkeleton);
	songId = $state(DEFAULTS.songId);

	/** Modo efectivo del instrumento derivado de la UI. */
	readonly playMode = $derived<PlayMode>(
		this.appMode === 'free' ? 'free' : this.autoChord ? 'song-auto' : 'song-manual'
	);

	/** Carga desde localStorage. Llamar solo en el cliente. */
	hydrate(): void {
		const data = load();
		this.appMode = data.appMode;
		this.autoChord = data.autoChord;
		this.leftHanded = data.leftHanded;
		this.chordInput = data.chordInput;
		this.metronome = data.metronome;
		this.showSkeleton = data.showSkeleton;
		this.songId = data.songId;
	}

	persist(): void {
		const data: Persisted = {
			appMode: this.appMode,
			autoChord: this.autoChord,
			leftHanded: this.leftHanded,
			chordInput: this.chordInput,
			metronome: this.metronome,
			showSkeleton: this.showSkeleton,
			songId: this.songId
		};
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
		} catch {
			/* almacenamiento no disponible */
		}
	}
}
