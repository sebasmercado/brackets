/**
 * Reproductor de canciones reactivo (Svelte 5 Runes).
 *
 * No tiene loop propio: el host llama a `tick(now)` desde su `requestAnimationFrame`,
 * así tracking, audio y teleprompter comparten el mismo reloj.
 * Incluye un compás de cuenta regresiva (count-in) antes del primer acorde.
 */
import { SONGS } from './index';
import { buildTimeline, eventIndexAt } from './timeline';
import type { ChordEvent, Song } from './types';

export type PlaybackSpeed = 0.75 | 1;

export interface BeatInfo {
	/** Tiempo dentro del compás (0 = primer tiempo). */
	beatInBar: number;
	/** `true` durante la cuenta regresiva. */
	countIn: boolean;
}

export class SongPlayer {
	song = $state<Song>(SONGS[0] as Song);
	playing = $state(false);
	speed = $state<PlaybackSpeed>(1);
	/** Posición en beats (negativa durante la cuenta regresiva). */
	position = $state(0);
	loop = $state(true);

	readonly timeline = $derived(buildTimeline(this.song));
	readonly currentIndex = $derived(eventIndexAt(this.timeline.events, Math.max(0, this.position)));
	readonly current = $derived<ChordEvent | null>(this.timeline.events[this.currentIndex] ?? null);
	readonly next = $derived<ChordEvent | null>(this.timeline.events[this.currentIndex + 1] ?? null);
	readonly countingIn = $derived(this.position < 0);
	/** Progreso 0..1 dentro del compás actual. */
	readonly barProgress = $derived(
		(((this.position % this.song.beatsPerBar) + this.song.beatsPerBar) % this.song.beatsPerBar) / this.song.beatsPerBar
	);
	/** Progreso 0..1 del acorde actual. */
	readonly chordProgress = $derived(
		this.current ? Math.min(1, Math.max(0, (this.position - this.current.startBeat) / this.current.beats)) : 0
	);
	readonly songProgress = $derived(Math.max(0, this.position) / Math.max(1, this.timeline.totalBeats));

	/** Callback por cada tiempo (metrónomo). */
	onBeat: ((info: BeatInfo) => void) | null = null;

	private lastTick: number | null = null;
	private lastBeat = Number.NEGATIVE_INFINITY;

	select(id: string): void {
		const song = SONGS.find((s) => s.id === id);
		if (!song) return;
		this.stop();
		this.song = song;
	}

	play(): void {
		if (this.playing) return;
		if (this.position <= 0 || this.position >= this.timeline.totalBeats) {
			this.position = -this.song.beatsPerBar; // cuenta regresiva de un compás
		}
		this.lastBeat = Math.floor(this.position) - 1;
		this.lastTick = null;
		this.playing = true;
	}

	pause(): void {
		this.playing = false;
		this.lastTick = null;
	}

	toggle(): void {
		if (this.playing) this.pause();
		else this.play();
	}

	stop(): void {
		this.pause();
		this.position = 0;
	}

	restart(): void {
		this.stop();
		this.play();
	}

	setSpeed(speed: PlaybackSpeed): void {
		this.speed = speed;
	}

	/** Avanza el reloj. `now` en ms (`performance.now()`). */
	tick(now: number): void {
		if (!this.playing) return;
		if (this.lastTick === null) {
			this.lastTick = now;
			this.emitBeat();
			return;
		}
		const dt = Math.min(0.1, (now - this.lastTick) / 1000); // evita saltos al volver de otra pestaña
		this.lastTick = now;
		const bps = (this.song.bpm / 60) * this.speed;
		let position = this.position + dt * bps;

		if (position >= this.timeline.totalBeats) {
			if (this.loop) {
				position -= this.timeline.totalBeats;
				this.lastBeat = Math.floor(position) - 1;
			} else {
				this.stop();
				return;
			}
		}
		this.position = position;
		this.emitBeat();
	}

	private emitBeat(): void {
		const beat = Math.floor(this.position);
		if (beat === this.lastBeat) return;
		this.lastBeat = beat;
		const bpb = this.song.beatsPerBar;
		this.onBeat?.({ beatInBar: ((beat % bpb) + bpb) % bpb, countIn: beat < 0 });
	}
}
