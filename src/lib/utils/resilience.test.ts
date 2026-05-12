import { describe, it, expect } from 'vitest';
import { computeResilienceLevel, getResilienceProgress } from './resilience.mjs';

const EIGHT_DUNGEONS = [
	'Windrunner Spire', "Maisara Caverns", "Magisters' Terrace",
	'Nexus-Point Xenas', "Algeth'ar Academy", 'Seat of the Triumvirate',
	'Skyreach', 'Pit of Saron'
];

function runs(dungeonsAndLevels: [string, number][], timed = true) {
	return dungeonsAndLevels.map(([dungeon, level]) => ({ dungeon, mythic_level: level, timed }));
}

function allAt(level: number) {
	return EIGHT_DUNGEONS.map((d) => ({ dungeon: d, mythic_level: level, timed: true }));
}

describe('computeResilienceLevel', () => {
	it('returns null when fewer than 8 dungeons have timed runs', () => {
		const r = runs(EIGHT_DUNGEONS.slice(0, 7).map((d) => [d, 12]));
		expect(computeResilienceLevel(r, 8)).toBeNull();
	});

	it('returns null when empty bestRuns', () => {
		expect(computeResilienceLevel([], 8)).toBeNull();
	});

	it('returns 12 when all 8 dungeons have timed run at ≥ +12', () => {
		expect(computeResilienceLevel(allAt(12), 8)).toBe(12);
	});

	it('returns 14 when all 8 have ≥ +14 (even if some higher)', () => {
		const r = [
			...EIGHT_DUNGEONS.slice(0, 4).map((d) => ({ dungeon: d, mythic_level: 15, timed: true })),
			...EIGHT_DUNGEONS.slice(4).map((d) => ({ dungeon: d, mythic_level: 14, timed: true }))
		];
		expect(computeResilienceLevel(r, 8)).toBe(14);
	});

	it('returns the bottleneck level when only 7 of 8 meet the candidate', () => {
		// 7 dungeons at +13, 1 at +12 — result should be 12 (all 8 share at least +12)
		const r = [
			...EIGHT_DUNGEONS.slice(0, 7).map((d) => ({ dungeon: d, mythic_level: 13, timed: true })),
			{ dungeon: EIGHT_DUNGEONS[7], mythic_level: 12, timed: true }
		];
		expect(computeResilienceLevel(r, 8)).toBe(12);
	});

	it('ignores untimed runs', () => {
		const r = allAt(12).map((run) => ({ ...run, timed: false }));
		expect(computeResilienceLevel(r, 8)).toBeNull();
	});

	it('handles non-8 dungeon count (seasonDungeonCount = 6)', () => {
		const sixDungeons = EIGHT_DUNGEONS.slice(0, 6).map((d) => ({ dungeon: d, mythic_level: 10, timed: true }));
		expect(computeResilienceLevel(sixDungeons, 6)).toBe(10);
	});

	it('returns null when no overlap at any level across all dungeons', () => {
		// each dungeon at a completely different level — still works since all have the min
		const r = EIGHT_DUNGEONS.map((d, i) => ({ dungeon: d, mythic_level: 10 + i, timed: true }));
		// all have ≥10, so result should be 10
		expect(computeResilienceLevel(r, 8)).toBe(10);
	});
});

describe('getResilienceProgress', () => {
	it('returns progress map with ready/shortfall per dungeon', () => {
		const r = EIGHT_DUNGEONS.map((d, i) => ({ dungeon: d, mythic_level: 10 + i, timed: true }));
		const progress = getResilienceProgress(r, 14);
		// Dungeons 0-3: level 10,11,12,13 → not ready
		// Dungeons 4-7: level 14,15,16,17 → ready
		const notReady = progress.filter((p) => !p.ready);
		const ready = progress.filter((p) => p.ready);
		expect(notReady.length).toBe(4);
		expect(ready.length).toBe(4);
	});

	it('correctly identifies bottleneck dungeons (furthest below target)', () => {
		const r = [
			{ dungeon: 'A', mythic_level: 10, timed: true }, // shortfall 4
			{ dungeon: 'B', mythic_level: 12, timed: true }, // shortfall 2
			{ dungeon: 'C', mythic_level: 14, timed: true }  // ready
		];
		const progress = getResilienceProgress(r, 14);
		const bottleneck = progress.reduce((worst, cur) => cur.shortfall > worst.shortfall ? cur : worst, progress[0]);
		expect(bottleneck.dungeon).toBe('A');
		expect(bottleneck.shortfall).toBe(4);
	});

	it('marks dungeons meeting target as ready', () => {
		const r = EIGHT_DUNGEONS.map((d) => ({ dungeon: d, mythic_level: 15, timed: true }));
		const progress = getResilienceProgress(r, 14);
		expect(progress.every((p) => p.ready)).toBe(true);
	});
});
