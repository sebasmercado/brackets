/** Constantes físicas/visuales de la guitarra acústica. */

/** Afinación estándar en MIDI, de la 6ª (E2) a la 1ª (E4). */
export const STANDARD_TUNING = [40, 45, 50, 55, 59, 64] as const;

export const STRING_COUNT = STANDARD_TUNING.length;

/** Cooldown por cuerda para evitar rebotes del tracking (ms). */
export const STRING_COOLDOWN_MS = 90;

/** Rango del parámetro `u` (0 = cejuela, 1 = puente) donde se puede rasguear. */
export const STRUM_ZONE: readonly [number, number] = [0.38, 1];

/** Índices de landmarks de MediaPipe Hands. */
export const HAND = {
	WRIST: 0,
	THUMB_CMC: 1,
	THUMB_MCP: 2,
	THUMB_IP: 3,
	THUMB_TIP: 4,
	INDEX_MCP: 5,
	INDEX_PIP: 6,
	INDEX_TIP: 8,
	MIDDLE_MCP: 9,
	MIDDLE_PIP: 10,
	MIDDLE_TIP: 12,
	RING_MCP: 13,
	RING_PIP: 14,
	RING_TIP: 16,
	PINKY_MCP: 17,
	PINKY_PIP: 18,
	PINKY_TIP: 20
} as const;
