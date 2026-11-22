import { describe, expect, it } from 'vitest';
import { AcousticGuitarPlugin } from '../plugins/AcousticGuitarPlugin';
import { frame, hand, pickHand } from './fixtures';

const fretHand = () => hand('left', { x: 200, y: 420 }, [true, true, true, true, true]); // D (mano abierta)

describe('AcousticGuitarPlugin', () => {
	it('ancla el instrumento con pose + mano del mástil', () => {
		const g = new AcousticGuitarPlugin();
		g.update(frame(0, { left: fretHand() }));
		expect(g.getHud().ready).toBe(true);
	});

	it('pide la pose si no hay hombros', () => {
		const g = new AcousticGuitarPlugin();
		g.update({ timestamp: 0, width: 1280, height: 720, pose: null, hands: {} });
		expect(g.getHud().ready).toBe(false);
		expect(g.getHud().hint).toMatch(/hombros/);
	});

	it('un rasgueo hacia abajo dispara las cuerdas del acorde, de grave a aguda', () => {
		const g = new AcousticGuitarPlugin();
		g.configure({ mode: 'song-auto', targetChord: 'G' }); // G: las 6 cuerdas suenan
		g.update(frame(0, { left: fretHand(), right: pickHand('right', { x: 650, y: 380 }) }));
		const events = g.update(frame(33, { left: fretHand(), right: pickHand('right', { x: 650, y: 600 }) }));

		expect(events).toHaveLength(6);
		expect(events.map((e) => e.channel)).toEqual([0, 1, 2, 3, 4, 5]);
		expect(events.every((e) => e.direction === 'down')).toBe(true);
		expect(events.map((e) => e.label)).toEqual(['G2', 'B2', 'D3', 'G3', 'B3', 'G4']);
		// Ataques escalonados en el tiempo.
		expect(events[5]!.delay).toBeGreaterThan(events[0]!.delay);
	});

	it('respeta el cooldown por cuerda (sin rebotes)', () => {
		const g = new AcousticGuitarPlugin();
		g.configure({ mode: 'song-auto', targetChord: 'G' });
		g.update(frame(0, { left: fretHand(), right: pickHand('right', { x: 650, y: 380 }) }));
		g.update(frame(33, { left: fretHand(), right: pickHand('right', { x: 650, y: 600 }) }));
		const bounce = g.update(frame(66, { left: fretHand(), right: pickHand('right', { x: 650, y: 380 }) }));
		expect(bounce).toHaveLength(0);
		const up = g.update(frame(200, { left: fretHand(), right: pickHand('right', { x: 650, y: 600 }) }));
		expect(up.length).toBeGreaterThan(0);
	});

	it('omite cuerdas apagadas del acorde (D: ×× en 6ª y 5ª)', () => {
		const g = new AcousticGuitarPlugin();
		g.configure({ mode: 'song-auto', targetChord: 'D' });
		g.update(frame(0, { left: fretHand(), right: pickHand('right', { x: 650, y: 380 }) }));
		const events = g.update(frame(33, { left: fretHand(), right: pickHand('right', { x: 650, y: 600 }) }));
		expect(events.map((e) => e.channel)).toEqual([2, 3, 4, 5]);
	});

	it('modo manual: gesto incorrecto suena apagado y marca miss', () => {
		const g = new AcousticGuitarPlugin();
		g.configure({ mode: 'song-manual', targetChord: 'C' }); // se pide C, la mano forma D
		for (let t = 0; t < 5; t++) g.update(frame(t * 10, { left: fretHand() }));
		g.update(frame(60, { left: fretHand(), right: pickHand('right', { x: 650, y: 380 }) }));
		const events = g.update(frame(93, { left: fretHand(), right: pickHand('right', { x: 650, y: 600 }) }));
		expect(g.getHud().matched).toBe(false);
		expect(events.length).toBeGreaterThan(0);
		expect(events.every((e) => e.articulation === 'muted')).toBe(true);
	});

	it('modo zurdo: el mástil sale hacia la derecha y se rasguea con la izquierda', () => {
		const g = new AcousticGuitarPlugin();
		g.configure({ leftHanded: true, mode: 'song-auto', targetChord: 'G' });
		const neck = hand('right', { x: 1080, y: 420 });
		g.update(frame(0, { right: neck, left: pickHand('left', { x: 620, y: 380 }) }));
		expect(g.getHud().ready).toBe(true);
		const events = g.update(frame(33, { right: neck, left: pickHand('left', { x: 620, y: 600 }) }));
		expect(events.map((e) => e.channel)).toEqual([0, 1, 2, 3, 4, 5]);
		expect(events.every((e) => e.direction === 'down')).toBe(true);
	});
});
