/** API pública del módulo de instrumentos. */
export * from './types';
export { AudioEngine } from './engine/AudioEngine';
export { INSTRUMENTS, findInstrument } from './registry';
export { CHORDS, getChord, FREE_MODE_CHORDS } from './music/chords';
