import { describe, expect, it } from 'vitest';
import { segmentIntersection } from '../utils/vector';

describe('segmentIntersection', () => {
	it('detecta el cruce de dos segmentos', () => {
		const hit = segmentIntersection({ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 });
		expect(hit).not.toBeNull();
		expect(hit?.t).toBeCloseTo(0.5);
		expect(hit?.u).toBeCloseTo(0.5);
	});

	it('devuelve null si no se cruzan o son paralelos', () => {
		expect(segmentIntersection({ x: 0, y: 1 }, { x: 0, y: 2 }, { x: -1, y: 0 }, { x: 1, y: 0 })).toBeNull();
		expect(segmentIntersection({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 })).toBeNull();
	});
});
