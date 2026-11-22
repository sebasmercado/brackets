import { describe, expect, it } from 'vitest';
import { CHORDS } from '../music/chords';
import { SONGS } from '../../songs/index';
import { buildTimeline, eventIndexAt } from '../../songs/timeline';
import type { Song } from '../../songs/types';

const song: Song = {
	id: 't',
	title: 'T',
	artist: 'A',
	bpm: 120,
	beatsPerBar: 4,
	difficulty: 'fácil',
	strumPattern: '',
	arrangement: '',
	sections: [{ name: 'S', bars: [['G'], ['G'], ['C', 'D']], repeat: 2 }]
};

describe('buildTimeline', () => {
	it('fusiona acordes repetidos y divide compases', () => {
		const { events, totalBeats, totalBars } = buildTimeline(song);
		expect(totalBars).toBe(6);
		expect(totalBeats).toBe(24);
		expect(events.slice(0, 3).map((e) => [e.chord, e.startBeat, e.beats])).toEqual([
			['G', 0, 8],
			['C', 8, 2],
			['D', 10, 2]
		]);
	});

	it('busca el evento activo por beat', () => {
		const { events } = buildTimeline(song);
		expect(eventIndexAt(events, -1)).toBe(-1);
		expect(events[eventIndexAt(events, 9)]?.chord).toBe('C');
		expect(events[eventIndexAt(events, 11.5)]?.chord).toBe('D');
	});

	it('todas las canciones usan acordes definidos en la librería', () => {
		for (const s of SONGS) {
			for (const e of buildTimeline(s).events) expect(CHORDS[e.chord], `${s.id}: ${e.chord}`).toBeDefined();
		}
	});
});
