/**
 * Registro de instrumentos disponibles. Cada entrada se carga de forma diferida
 * (code-splitting) para que sumar instrumentos no penalice el bundle inicial.
 *
 * Para agregar uno nuevo: implementá `InstrumentPlugin` y sumá su descriptor acá.
 */
import type { InstrumentDescriptor } from './types';

export const INSTRUMENTS: readonly InstrumentDescriptor[] = [
	{
		id: 'acoustic-guitar',
		name: 'Guitarra Acústica',
		family: 'string',
		load: async () => new (await import('./plugins/AcousticGuitarPlugin')).AcousticGuitarPlugin()
	}
	// { id: 'bass', name: 'Bajo', family: 'string', load: async () => new (await import('./plugins/BassPlugin')).BassPlugin() },
	// { id: 'drums', name: 'Batería', family: 'percussion', load: async () => new (await import('./plugins/DrumsPlugin')).DrumsPlugin() },
];

export function findInstrument(id: string): InstrumentDescriptor | undefined {
	return INSTRUMENTS.find((i) => i.id === id);
}
