import { describe, expect, it } from 'vitest';
import { chordFromPattern } from '../music/chords';
import { readFingerPattern } from '../plugins/guitar/gestures';
import { hand } from './fixtures';

describe('readFingerPattern', () => {
	it('mano abierta → D', () => {
		const p = readFingerPattern(hand('left', { x: 300, y: 400 }, [true, true, true, true, true]));
		expect(p).toEqual([true, true, true, true, true]);
		expect(p && chordFromPattern(p)?.name).toBe('D');
	});

	it('puño → Em', () => {
		const p = readFingerPattern(hand('left', { x: 300, y: 400 }, [false, false, false, false, false]));
		expect(p).toEqual([false, false, false, false, false]);
		expect(p && chordFromPattern(p)?.name).toBe('Em');
	});

	it('índice + medio → G', () => {
		const p = readFingerPattern(hand('left', { x: 300, y: 400 }, [false, true, true, false, false]));
		expect(p && chordFromPattern(p)?.name).toBe('G');
	});
});
