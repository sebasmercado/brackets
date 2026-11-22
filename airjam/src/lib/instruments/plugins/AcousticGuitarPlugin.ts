/**
 * Plugin de Guitarra Acústica.
 *
 * Pipeline por frame:
 *   TrackingFrame → GuitarGeometrySolver (anclaje cuerpo + mano del mástil)
 *                 → selección de acorde (según PlayMode)
 *                 → StrumDetector (mano de rasgueo cruza cuerdas)
 *                 → TriggerEvent[] (Karplus-Strong) + efectos visuales
 */
import { CHORDS, getChord } from '../music/chords';
import { midiToFrequency, midiToName, midiToPitchClass } from '../music/notes';
import type {
	BodySide,
	ChordDefinition,
	InstrumentHud,
	InstrumentPlugin,
	InstrumentSettings,
	PlayMode,
	TrackedHand,
	TrackingFrame,
	TriggerEvent,
	Vec2,
	ViewTransform
} from '../types';
import { midpoint } from '../utils/vector';
import { HAND, STANDARD_TUNING, STRING_COUNT } from './guitar/constants';
import { ParticleSystem, StringVibrations } from './guitar/effects';
import { GuitarGeometrySolver, type GeometryResult, type GuitarGeometry } from './guitar/geometry';
import { GestureChordReader, ZoneChordReader } from './guitar/gestures';
import { drawGuitar, type NeckFeedback } from './guitar/renderer';
import { StrumDetector } from './guitar/StrumDetector';

const HINTS: Record<Exclude<GeometryResult, { ok: true }>['reason'], string> = {
	'no-pose': 'Alejate un poco: necesito ver tus hombros',
	'no-fret-hand': 'Mostrá la mano del mástil',
	'neck-too-short': 'Extendé el brazo del mástil hacia el costado'
};

/** Frecuencias de todas las notas usadas por la librería de acordes (para pre-render de audio). */
export function guitarWarmupFrequencies(): number[] {
	const set = new Set<number>();
	for (const chord of Object.values(CHORDS)) {
		chord.frets.forEach((fret, i) => {
			const open = STANDARD_TUNING[i];
			if (fret !== null && open !== undefined) set.add(open + fret);
		});
	}
	return [...set].sort((a, b) => a - b).map((m) => midiToFrequency(m));
}

export class AcousticGuitarPlugin implements InstrumentPlugin {
	readonly id = 'acoustic-guitar';
	readonly name = 'Guitarra Acústica';
	readonly family = 'string' as const;
	readonly supportedModes: readonly PlayMode[] = ['free', 'song-auto', 'song-manual'];

	private settings: InstrumentSettings = {
		mode: 'free',
		leftHanded: false,
		targetChord: null,
		chordInput: 'gesture'
	};

	private readonly solver = new GuitarGeometrySolver();
	private readonly strum = new StrumDetector(STRING_COUNT);
	private readonly gestureReader = new GestureChordReader();
	private readonly zoneReader = new ZoneChordReader();
	private readonly vibrations = new StringVibrations(STRING_COUNT);
	private readonly particles = new ParticleSystem();

	private geometry: GuitarGeometry | null = null;
	private activeChord: ChordDefinition | null = null;
	private detectedChord: ChordDefinition | null = null;
	private feedback: NeckFeedback = 'neutral';
	private lastRenderTime = 0;
	private hud: InstrumentHud = {
		ready: false,
		activeChord: null,
		detectedChord: null,
		matched: null,
		hint: 'Preparando…',
		lastStrum: null
	};

	configure(settings: Partial<InstrumentSettings>): void {
		const prev = this.settings;
		this.settings = { ...prev, ...settings };
		if (settings.leftHanded !== undefined && settings.leftHanded !== prev.leftHanded) {
			this.solver.reset();
			this.strum.reset();
			this.gestureReader.reset();
		}
		if (settings.chordInput !== undefined && settings.chordInput !== prev.chordInput) {
			this.zoneReader.reset();
			this.gestureReader.reset();
		}
	}

	update(frame: TrackingFrame): TriggerEvent[] {
		const fretSide: BodySide = this.settings.leftHanded ? 'right' : 'left';
		const strumSide: BodySide = this.settings.leftHanded ? 'left' : 'right';
		const fretHand = frame.hands[fretSide];
		const strumHand = frame.hands[strumSide];

		const result = this.solver.solve({
			pose: frame.pose,
			fretHand,
			fretSide,
			frameHeight: frame.height,
			timestamp: frame.timestamp
		});

		// El acorde se resuelve aunque el cuerpo no esté anclado (el HUD sigue a la canción).
		this.resolveChord(fretHand, result.ok ? result.geometry : null);

		if (!result.ok) {
			this.geometry = null;
			this.strum.reset();
			this.setHud({ ready: false, hint: HINTS[result.reason] });
			return [];
		}
		const geometry = result.geometry;
		this.geometry = geometry;

		const pick = strumHand ? this.pickPosition(strumHand) : null;
		const { hits, frameMs } = this.strum.detect(pick, frame.timestamp, geometry);

		const events: TriggerEvent[] = [];
		const now = performance.now();
		const mismatch = this.feedback === 'miss';
		const spacingMs = Math.min(frameMs, 45);
		const firstT = hits[0]?.t ?? 0;

		for (const hit of hits) {
			const fret = this.fretFor(hit.stringIndex);
			const open = STANDARD_TUNING[hit.stringIndex];
			if (fret === null || open === undefined) continue; // cuerda apagada en el acorde
			const midi = open + fret;
			const delay = ((hit.t - firstT) * spacingMs) / 1000;
			const posBrightness = (hit.u - 0.38) / 0.62; // cerca del puente = más brillante

			events.push({
				instrumentId: this.id,
				synth: 'karplus-strong',
				channel: hit.stringIndex,
				frequency: midiToFrequency(midi),
				velocity: hit.velocity,
				delay,
				articulation: mismatch ? 'muted' : 'normal',
				direction: hit.direction,
				brightness: 0.35 + posBrightness * 0.45 + (hit.direction === 'up' ? 0.1 : 0),
				label: midiToName(midi)
			});

			this.vibrations.excite(hit.stringIndex, mismatch ? 0.25 : 0.4 + hit.velocity * 0.6, now + delay * 1000);
			this.particles.burst(hit.point, hit.direction, geometry.up, geometry.unit, now, hit.velocity);
		}

		const lastHit = hits[hits.length - 1];
		this.setHud({
			ready: true,
			hint: strumHand ? null : 'Mostrá la mano de rasgueo',
			lastStrum: lastHit ? lastHit.direction : this.hud.lastStrum
		});
		return events;
	}

	render(ctx: CanvasRenderingContext2D, view: ViewTransform, now: number): void {
		const dt = this.lastRenderTime ? Math.min(0.05, (now - this.lastRenderTime) / 1000) : 0;
		this.lastRenderTime = now;
		this.particles.step(now, dt);
		if (!this.geometry) return;

		const labels: string[] = [];
		const muted: boolean[] = [];
		for (let i = 0; i < STRING_COUNT; i++) {
			const fret = this.fretFor(i);
			const open = STANDARD_TUNING[i] ?? 40;
			muted.push(fret === null);
			labels.push(fret === null ? '×' : midiToPitchClass(open + fret));
		}

		const zone =
			this.settings.mode === 'free' && this.settings.chordInput === 'zone'
				? {
						index: this.zoneReader.currentZone,
						progress: ZoneChordReader.progress(this.geometry.reach)
					}
				: null;

		drawGuitar(ctx, view, {
			geometry: this.geometry,
			labels,
			muted,
			vibrations: this.vibrations,
			particles: this.particles,
			feedback: this.feedback,
			zone,
			now
		});
	}

	getHud(): InstrumentHud {
		return this.hud;
	}

	reset(): void {
		this.solver.reset();
		this.strum.reset();
		this.gestureReader.reset();
		this.zoneReader.reset();
		this.vibrations.reset();
		this.particles.reset();
		this.geometry = null;
		this.activeChord = null;
		this.detectedChord = null;
		this.feedback = 'neutral';
	}

	dispose(): void {
		this.reset();
	}

	/* ------------------------------------------------------------------------ */

	/** "Púa" virtual: punto medio entre pulgar e índice de la mano de rasgueo. */
	private pickPosition(hand: TrackedHand): Vec2 | null {
		const thumb = hand.landmarks[HAND.THUMB_TIP];
		const index = hand.landmarks[HAND.INDEX_TIP];
		if (!thumb || !index) return null;
		return midpoint(thumb, index);
	}

	private resolveChord(fretHand: TrackedHand | undefined, geometry: GuitarGeometry | null): void {
		const { mode, chordInput, targetChord } = this.settings;
		const target = getChord(targetChord);

		if (mode === 'song-auto') {
			// No hace falta leer el gesto: la canción dicta el acorde.
			this.detectedChord = null;
			this.activeChord = target;
			this.feedback = 'neutral';
		} else if (mode === 'song-manual') {
			this.detectedChord = this.gestureReader.read(fretHand);
			const matched = !!target && this.detectedChord?.name === target.name;
			this.activeChord = matched ? target : this.detectedChord;
			this.feedback = !target ? 'neutral' : matched ? 'match' : 'miss';
		} else {
			if (chordInput === 'gesture') this.detectedChord = this.gestureReader.read(fretHand);
			else if (geometry) this.detectedChord = this.zoneReader.read(geometry.reach);
			if (this.detectedChord) this.activeChord = this.detectedChord;
			this.feedback = 'neutral';
		}

		this.setHud({
			activeChord: this.activeChord?.name ?? null,
			detectedChord: this.detectedChord?.name ?? null,
			matched: mode === 'song-manual' && target ? this.feedback === 'match' : null
		});
	}

	/** Traste de la cuerda `i` en el acorde activo (`0` = al aire si no hay acorde). */
	private fretFor(i: number): number | null {
		if (!this.activeChord) return 0;
		const fret = this.activeChord.frets[i];
		return fret === undefined ? 0 : fret;
	}

	/** Actualiza el HUD creando un objeto nuevo solo si algo cambió (barato para la UI). */
	private setHud(patch: Partial<InstrumentHud>): void {
		const next = { ...this.hud, ...patch };
		const changed = (Object.keys(next) as (keyof InstrumentHud)[]).some((k) => next[k] !== this.hud[k]);
		if (changed) this.hud = next;
	}
}
