import { describe, it, expect } from 'vitest';
import {
	countWeeklyRuns,
	countAllRuns,
	highestKeyThisWeek,
	getWeekOnWeekDelta
} from './rio.mjs';

function run(level: number) {
	return { dungeon: 'Test', mythic_level: level, timed: true, completed_at: '2026-05-06T20:00:00Z' };
}

describe('countWeeklyRuns (qualifying ≥ minLevel)', () => {
	it('counts runs at or above minLevel', () => {
		expect(countWeeklyRuns([run(10), run(12), run(9)], 10)).toBe(2);
	});

	it('empty array returns 0', () => {
		expect(countWeeklyRuns([], 10)).toBe(0);
	});

	it('all below minLevel returns 0', () => {
		expect(countWeeklyRuns([run(9), run(8)], 10)).toBe(0);
	});
});

describe('countAllRuns', () => {
	it('returns total count regardless of level', () => {
		expect(countAllRuns([run(5), run(10), run(15)])).toBe(3);
	});

	it('empty array returns 0', () => {
		expect(countAllRuns([])).toBe(0);
	});
});

describe('highestKeyThisWeek', () => {
	it('returns the maximum mythic_level', () => {
		expect(highestKeyThisWeek([run(10), run(14), run(12)])).toBe(14);
	});

	it('empty array returns null', () => {
		expect(highestKeyThisWeek([])).toBeNull();
	});
});

describe('getWeekOnWeekDelta', () => {
	const weekA = { week: '2026-19', total_dungeons: 8, highest_key_level: 14, met: true, count: 5, reset_start: '' };
	const weekB = { week: '2026-18', total_dungeons: 5, highest_key_level: 11, met: true, count: 4, reset_start: '' };

	it('returns positive delta when this week > last week (total_dungeons)', () => {
		expect(getWeekOnWeekDelta(weekA, weekB, 'total_dungeons')).toBe(3);
	});

	it('returns negative delta when this week < last week', () => {
		expect(getWeekOnWeekDelta(weekB, weekA, 'total_dungeons')).toBe(-3);
	});

	it('returns 0 when equal', () => {
		expect(getWeekOnWeekDelta(weekA, weekA, 'total_dungeons')).toBe(0);
	});

	it('returns null when previous week entry is absent', () => {
		expect(getWeekOnWeekDelta(weekA, null, 'total_dungeons')).toBeNull();
	});

	it('works for highest_key_level field', () => {
		expect(getWeekOnWeekDelta(weekA, weekB, 'highest_key_level')).toBe(3);
	});
});
