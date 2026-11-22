/**
 * Contratos centrales de AirJam.
 *
 * Todo instrumento (guitarra, bajo, batería…) se implementa como un
 * `InstrumentPlugin` que:
 *   1. recibe un `TrackingFrame` agnóstico de MediaPipe,
 *   2. devuelve `TriggerEvent`s que el `AudioEngine` enruta al sintetizador indicado,
 *   3. se dibuja a sí mismo en un `<canvas>` mediante `render()`.
 *
 * Así la UI, el tracking y el audio quedan desacoplados (Strategy / Plugin pattern).
 */

/* -------------------------------------------------------------------------- */
/*                                  Geometría                                 */
/* -------------------------------------------------------------------------- */

export interface Vec2 {
	x: number;
	y: number;
}

/** Landmark en píxeles del frame de video (ya espejado), con visibilidad 0..1. */
export interface TrackedPoint extends Vec2 {
	/** Profundidad relativa (MediaPipe `z`). Menor = más cerca de la cámara. */
	z: number;
	visibility: number;
}

/* -------------------------------------------------------------------------- */
/*                                  Tracking                                  */
/* -------------------------------------------------------------------------- */

/** Lado anatómico del usuario (no el lado de la pantalla). */
export type BodySide = 'left' | 'right';

export interface TrackedHand {
	/** Mano anatómica del usuario a la que se asignó esta detección. */
	side: BodySide;
	/** 21 landmarks de MediaPipe Hands en píxeles del frame espejado. */
	landmarks: TrackedPoint[];
	/** Confianza de la clasificación de lateralidad. */
	score: number;
}

/** Subconjunto de landmarks de pose relevante para anclar instrumentos. */
export interface TrackedPose {
	leftShoulder: TrackedPoint;
	rightShoulder: TrackedPoint;
	leftElbow: TrackedPoint;
	rightElbow: TrackedPoint;
	leftWrist: TrackedPoint;
	rightWrist: TrackedPoint;
	leftHip: TrackedPoint;
	rightHip: TrackedPoint;
}

/**
 * Frame de tracking normalizado y agnóstico de la librería de visión.
 * Coordenadas en píxeles del video *espejado* (lo que el usuario ve).
 */
export interface TrackingFrame {
	/** `performance.now()` en ms del momento de captura. */
	timestamp: number;
	width: number;
	height: number;
	pose: TrackedPose | null;
	hands: Partial<Record<BodySide, TrackedHand>>;
}

/* -------------------------------------------------------------------------- */
/*                                    Audio                                   */
/* -------------------------------------------------------------------------- */

/** Identificador de los sintetizadores registrados en el `AudioEngine`. */
export type SynthId = 'karplus-strong' | 'click' | (string & {});

export type StrumDirection = 'down' | 'up';

export type Articulation = 'normal' | 'muted' | 'accent';

/**
 * Evento sonoro emitido por un plugin. El `AudioEngine` lo enruta al
 * sintetizador `synth` sin que el plugin conozca la Web Audio API.
 */
export interface TriggerEvent {
	instrumentId: string;
	synth: SynthId;
	/** Canal/voz lógica (índice de cuerda, pad, etc.). Usado para voice-stealing. */
	channel: number;
	/** Frecuencia fundamental en Hz (ignorada por sintetizadores sin altura). */
	frequency: number;
	/** Intensidad 0..1. */
	velocity: number;
	/** Retardo relativo en segundos respecto de "ahora" (rasgueos escalonados). */
	delay: number;
	articulation: Articulation;
	direction?: StrumDirection;
	/** Brillo tímbrico 0..1 (posición de pulsación / ataque). */
	brightness?: number;
	/** Etiqueta para depuración/HUD, ej. "E2". */
	label?: string;
}

/** Contrato de un sintetizador enchufable en el `AudioEngine`. */
export interface Synthesizer {
	readonly id: SynthId;
	/** Dispara un evento en el tiempo absoluto `when` del `AudioContext`. */
	trigger(event: TriggerEvent, when: number): void;
	/** Detiene todas las voces activas. */
	stopAll(): void;
	dispose(): void;
}

/* -------------------------------------------------------------------------- */
/*                               Música y modos                               */
/* -------------------------------------------------------------------------- */

/**
 * - `free`: improvisación; el acorde sale del gesto de la mano del mástil.
 * - `song-auto`: el acorde lo dicta la canción; el usuario solo rasguea.
 * - `song-manual`: el usuario debe formar el gesto del acorde que pide la canción.
 */
export type PlayMode = 'free' | 'song-auto' | 'song-manual';

/** Gesto de la mano del mástil: dedos extendidos [pulgar, índice, medio, anular, meñique]. */
export type FingerPattern = readonly [boolean, boolean, boolean, boolean, boolean];

export interface ChordDefinition {
	/** Nombre canónico, ej. "Am". */
	name: string;
	/** Nombre largo para accesibilidad, ej. "La menor". */
	label: string;
	/**
	 * Traste por cuerda, de la 6ª (E grave) a la 1ª (e aguda).
	 * `null` = cuerda apagada (no se toca), `0` = al aire.
	 */
	frets: readonly (number | null)[];
	/** Dedo sugerido por cuerda (1=índice … 4=meñique), `0`/`null` si no aplica. */
	fingers: readonly (number | null)[];
	/** Gesto de mano asociado para los modos `free` y `song-manual`. */
	gesture: FingerPattern;
	/** Descripción breve del gesto, ej. "Índice + medio (✌️)". */
	gestureHint: string;
	gestureEmoji: string;
}

/* -------------------------------------------------------------------------- */
/*                              Plugin de instrumento                         */
/* -------------------------------------------------------------------------- */

/** Transformación de coordenadas de video (px) → canvas (px CSS). */
export interface ViewTransform {
	scale: number;
	offsetX: number;
	offsetY: number;
	/** Tamaño del canvas en píxeles CSS. */
	width: number;
	height: number;
	devicePixelRatio: number;
}

export interface InstrumentSettings {
	mode: PlayMode;
	leftHanded: boolean;
	/** Acorde objetivo dictado por la canción (modos `song-*`). */
	targetChord: string | null;
	/**
	 * Cómo se elige el acorde en Modo Libre:
	 * - `gesture`: patrón de dedos extendidos de la mano del mástil.
	 * - `zone`: distancia de la mano del mástil al hombro (8 zonas).
	 */
	chordInput: ChordInputMode;
}

export type ChordInputMode = 'gesture' | 'zone';

/** Estado resumido que el plugin expone a la UI (HUD). Debe ser barato de comparar. */
export interface InstrumentHud {
	/** El instrumento está anclado al cuerpo y listo para tocarse. */
	ready: boolean;
	/** Acorde que suena actualmente. */
	activeChord: string | null;
	/** Acorde detectado por gesto (puede diferir del objetivo). */
	detectedChord: string | null;
	/** En `song-manual`: si el gesto coincide con el acorde pedido. */
	matched: boolean | null;
	/** Mensaje de guía para el usuario, ej. "Mostrá ambas manos". */
	hint: string | null;
	lastStrum: StrumDirection | null;
}

export interface InstrumentPlugin {
	readonly id: string;
	readonly name: string;
	readonly family: 'string' | 'percussion';
	readonly supportedModes: readonly PlayMode[];

	/** Aplica configuración (modo, zurdo, acorde objetivo). Idempotente. */
	configure(settings: Partial<InstrumentSettings>): void;

	/**
	 * Procesa un frame de tracking y devuelve los eventos sonoros a disparar.
	 * Debe ser puro respecto del audio: no accede al `AudioContext`.
	 */
	update(frame: TrackingFrame): TriggerEvent[];

	/** Dibuja el instrumento. `now` en ms (`performance.now()`). */
	render(ctx: CanvasRenderingContext2D, view: ViewTransform, now: number): void;

	getHud(): InstrumentHud;

	reset(): void;
	dispose(): void;
}

/** Fábrica registrada en el `InstrumentRegistry`. */
export interface InstrumentDescriptor {
	id: string;
	name: string;
	family: InstrumentPlugin['family'];
	/** Carga diferida para mantener el bundle inicial liviano. */
	load: () => Promise<InstrumentPlugin>;
}
