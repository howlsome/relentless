import { describe, it, expect } from 'vitest';
import { highestKeyThisWeek } from './rio.js';

function run(level: number) {
	return { dungeon: 'Test', mythic_level: level, timed: true, completed_at: '2026-05-06T20:00:00Z' };
}

describe('highestKeyThisWeek', () => {
	it('returns the maximum mythic_level', () => {
		expect(highestKeyThisWeek([run(10), run(14), run(12)])).toBe(14);
	});

	it('empty array returns null', () => {
		expect(highestKeyThisWeek([])).toBeNull();
	});
});
