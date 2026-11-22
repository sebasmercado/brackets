/**
 * Librería de canciones. Los JSON se importan estáticamente (quedan
 * precacheados por el Service Worker y funcionan offline).
 */
import deMusicaLigera from './data/de-musica-ligera.json';
import knockin from './data/knockin-on-heavens-door.json';
import lamentoBoliviano from './data/lamento-boliviano.json';
import wonderwall from './data/wonderwall.json';
import type { Song } from './types';

export const SONGS: readonly Song[] = [deMusicaLigera, knockin, wonderwall, lamentoBoliviano] as Song[];

export function getSong(id: string): Song | undefined {
	return SONGS.find((s) => s.id === id);
}

export * from './types';
export { buildTimeline, eventIndexAt } from './timeline';
