import { describe, expect, it } from 'vitest';
import { highestKeyThisWeek, mergeWeeklyRuns } from './rio.js';

function run(
	level: number,
	id: number | null,
	completedAt: string,
): {
	dungeon: string;
	mythic_level: number;
	num_keystone_upgrades: number;
	completed_at: string;
	keystone_run_id: number | null;
} {
	return {
		dungeon: 'Test',
		mythic_level: level,
		num_keystone_upgrades: 1,
		completed_at: completedAt,
		keystone_run_id: id,
	};
}

const RESET = new Date('2026-05-28T07:00:00Z');
const THIS_WEEK = '2026-06-01T12:00:00Z';
const LAST_WEEK = '2026-05-25T12:00:00Z';

describe('highestKeyThisWeek', () => {
	it('returns the maximum mythic_level', () => {
		expect(
			highestKeyThisWeek([{ mythic_level: 10 }, { mythic_level: 14 }, { mythic_level: 12 }]),
		).toBe(14);
	});

	it('empty array returns null', () => {
		expect(highestKeyThisWeek([])).toBeNull();
	});
});

describe('mergeWeeklyRuns', () => {
	it('returns empty array for null profile', () => {
		expect(mergeWeeklyRuns(null, RESET)).toHaveLength(0);
	});

	it('includes runs from weekly_highest_level_runs within reset window', () => {
		const profile = {
			mythic_plus_weekly_highest_level_runs: [run(14, 1, THIS_WEEK)],
			mythic_plus_recent_runs: [],
		};
		expect(mergeWeeklyRuns(profile, RESET)).toHaveLength(1);
	});

	it('excludes runs from recent_runs before the reset', () => {
		const profile = {
			mythic_plus_weekly_highest_level_runs: [],
			mythic_plus_recent_runs: [run(12, 2, LAST_WEEK)],
		};
		expect(mergeWeeklyRuns(profile, RESET)).toHaveLength(0);
	});

	it('deduplicates runs with the same keystone_run_id', () => {
		const profile = {
			mythic_plus_weekly_highest_level_runs: [run(14, 1, THIS_WEEK)],
			mythic_plus_recent_runs: [run(14, 1, THIS_WEEK)],
		};
		expect(mergeWeeklyRuns(profile, RESET)).toHaveLength(1);
	});

	it('merges unique runs from both fields — beyond 10 per field', () => {
		// weekly has top 10 by level; recent has 10 most recent — 4 not in weekly
		const weekly = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19].map((l, i) => run(l, i + 1, THIS_WEEK));
		const recent = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((l, i) => run(l, i + 10, THIS_WEEK)); // ids 10-19, partly overlapping
		const profile = {
			mythic_plus_weekly_highest_level_runs: weekly,
			mythic_plus_recent_runs: recent,
		};
		// weekly ids 1-10 (levels 10-19), recent ids 10-19 (levels 6-15)
		// id 10 appears in both — deduplicated. unique ids: 1-9 + 10-19 = 19 runs
		expect(mergeWeeklyRuns(profile, RESET)).toHaveLength(19);
	});

	it('includes runs without a keystone_run_id without crashing', () => {
		const profile = {
			mythic_plus_weekly_highest_level_runs: [run(12, null, THIS_WEEK)],
			mythic_plus_recent_runs: [run(10, null, THIS_WEEK)],
		};
		// null ids are not deduplicated against each other
		expect(mergeWeeklyRuns(profile, RESET)).toHaveLength(2);
	});
});
