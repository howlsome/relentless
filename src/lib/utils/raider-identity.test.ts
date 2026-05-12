import { describe, it, expect } from 'vitest';
import {
	getActiveCharacters,
	getCurrentWoWWeek,
	getResetStart,
	getCurrentRole,
	getRoleAtDate,
	getCharacterAtDate,
	buildRoleSummary,
	mergeComplianceAcrossCharacters,
	getMembershipStatus,
	buildMergedTimeline,
	getDesignationForSeason,
	upsertComplianceWeek,
	computeCurrentStreak,
	computeLongestStreak
} from './raider-identity.mjs';

function makePlayer(overrides = {}) {
	return {
		raider_id: 'uuid-1',
		display_name: 'Test',
		status: 'active',
		team_designation: 'main',
		membership_history: [{ event: 'joined', date: '2026-03-17', note: 'Founder' }],
		characters: [{ name: 'TestChar', realm: 'Draenor', class: 'Rogue', spec: 'Subtlety', role: 'dps', active: true }],
		role_history: [{ role: 'dps', class: 'Rogue', spec: 'Subtlety', character: 'TestChar', from: '2026-03-17', to: null }],
		...overrides
	};
}

// ── getActiveCharacters ───────────────────────────────────────────────────────

describe('getActiveCharacters', () => {
	it('returns only active:true characters', () => {
		const player = makePlayer({
			characters: [
				{ name: 'A', realm: 'D', class: 'Rogue', spec: 'Subtlety', role: 'dps', active: true },
				{ name: 'B', realm: 'D', class: 'Mage',  spec: 'Fire',     role: 'dps', active: false }
			]
		});
		const result = getActiveCharacters(player);
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe('A');
	});

	it('returns multiple when more than one is active', () => {
		const player = makePlayer({
			characters: [
				{ name: 'A', realm: 'D', class: 'Rogue', spec: 'Subtlety', role: 'dps', active: true },
				{ name: 'B', realm: 'D', class: 'Mage',  spec: 'Fire',     role: 'dps', active: true }
			]
		});
		expect(getActiveCharacters(player)).toHaveLength(2);
	});

	it('treats missing active field as inactive', () => {
		const player = makePlayer({ characters: [{ name: 'X', realm: 'D', class: 'Mage', spec: 'Fire', role: 'dps' }] });
		expect(getActiveCharacters(player)).toHaveLength(0);
	});
});

// ── getCurrentRole ────────────────────────────────────────────────────────────

describe('getCurrentRole', () => {
	it('returns the role_history entry with to === null', () => {
		const player = makePlayer({
			role_history: [
				{ role: 'healer', class: 'Priest', spec: 'Holy', character: 'Old', from: '2025-01-01', to: '2026-01-01' },
				{ role: 'dps',    class: 'Rogue',  spec: 'Sub',  character: 'New', from: '2026-01-01', to: null }
			]
		});
		const cur = getCurrentRole(player);
		expect(cur?.character).toBe('New');
		expect(cur?.role).toBe('dps');
	});

	it('returns null when no active role entry exists', () => {
		const player = makePlayer({ role_history: [] });
		expect(getCurrentRole(player)).toBeNull();
	});
});

// ── getRoleAtDate ─────────────────────────────────────────────────────────────

describe('getRoleAtDate', () => {
	const player = makePlayer({
		role_history: [
			{ role: 'healer', class: 'Priest', spec: 'Holy', character: 'OldChar', from: '2025-10-01', to: '2026-01-01' },
			{ role: 'dps',    class: 'Rogue',  spec: 'Sub',  character: 'NewChar', from: '2026-01-01', to: null }
		]
	});

	it('returns correct entry for a date in range', () => {
		expect(getRoleAtDate(player, '2025-11-15')?.character).toBe('OldChar');
		expect(getRoleAtDate(player, '2026-03-01')?.character).toBe('NewChar');
	});

	it('returns null for dates before the first entry', () => {
		expect(getRoleAtDate(player, '2020-01-01')).toBeNull();
	});
});

// ── getCharacterAtDate ────────────────────────────────────────────────────────

describe('getCharacterAtDate', () => {
	const player = makePlayer({
		role_history: [
			{ role: 'dps', class: 'Rogue', spec: 'Sub', character: 'TestChar', from: '2026-03-17', to: null }
		]
	});

	it('returns character name active at the given date', () => {
		expect(getCharacterAtDate(player, '2026-04-01')).toBe('TestChar');
	});

	it('returns null for dates before first entry', () => {
		expect(getCharacterAtDate(player, '2025-01-01')).toBeNull();
	});
});

// ── buildRoleSummary ──────────────────────────────────────────────────────────

describe('buildRoleSummary', () => {
	it('returns role history sorted oldest-first', () => {
		const player = makePlayer({
			role_history: [
				{ role: 'dps',    class: 'Rogue',  spec: 'Sub',  character: 'B', from: '2026-01-01', to: null },
				{ role: 'healer', class: 'Priest', spec: 'Holy', character: 'A', from: '2025-01-01', to: '2026-01-01' }
			]
		});
		const summary = buildRoleSummary(player);
		expect(summary[0].character).toBe('A');
		expect(summary[1].character).toBe('B');
	});
});

// ── mergeComplianceAcrossCharacters ──────────────────────────────────────────

describe('mergeComplianceAcrossCharacters', () => {
	it('sums runs from multiple characters', () => {
		const result = mergeComplianceAcrossCharacters([
			{ mplus_weekly_count_at_or_above_minimum: 3, mplus_total_dungeons_this_week: 5 },
			{ mplus_weekly_count_at_or_above_minimum: 2, mplus_total_dungeons_this_week: 3 }
		]);
		expect(result.count).toBe(5);
		expect(result.total_dungeons).toBe(8);
	});
});

// ── getMembershipStatus ───────────────────────────────────────────────────────

describe('getMembershipStatus', () => {
	it('returns active when last event is joined', () => {
		const p = makePlayer({ membership_history: [{ event: 'joined', date: '2026-01-01' }] });
		expect(getMembershipStatus(p)).toBe('active');
	});

	it('returns inactive when last event is left', () => {
		const p = makePlayer({ membership_history: [
			{ event: 'joined', date: '2026-01-01' },
			{ event: 'left',   date: '2026-03-01' }
		]});
		expect(getMembershipStatus(p)).toBe('inactive');
	});

	it('returns active when raider has rejoined after leaving', () => {
		const p = makePlayer({ membership_history: [
			{ event: 'joined', date: '2026-01-01' },
			{ event: 'left',   date: '2026-02-01' },
			{ event: 'joined', date: '2026-03-01' }
		]});
		expect(getMembershipStatus(p)).toBe('active');
	});
});

// ── buildMergedTimeline ───────────────────────────────────────────────────────

describe('buildMergedTimeline', () => {
	it('returns empty array for raider with only a single join event', () => {
		const p = makePlayer();
		expect(buildMergedTimeline(p)).toHaveLength(0);
	});

	it('returns events when 2+ notable events exist, sorted oldest-first', () => {
		const p = makePlayer({
			membership_history: [
				{ event: 'joined', date: '2026-01-01', note: 'Joined' },
				{ event: 'left',   date: '2026-02-01', note: 'Break' }
			],
			role_history: []
		});
		const timeline = buildMergedTimeline(p);
		expect(timeline.length).toBeGreaterThanOrEqual(2);
		expect(timeline[0].date <= timeline[1].date).toBe(true);
	});
});

// ── getDesignationForSeason ───────────────────────────────────────────────────

describe('getDesignationForSeason', () => {
	it('returns correct designation from designation_history', () => {
		const p = makePlayer({
			team_designation: 'main',
			designation_history: [
				{ season_id: 'midnight-s1', designation: 'alt', set_date: '2026-03-17' }
			]
		});
		expect(getDesignationForSeason(p, 'midnight-s1')).toBe('alt');
	});

	it('falls back to current team_designation when no history entry', () => {
		const p = makePlayer({ team_designation: 'main', designation_history: [] });
		expect(getDesignationForSeason(p, 'midnight-s2')).toBe('main');
	});
});

// ── getCurrentWoWWeek / streak helpers ───────────────────────────────────────

describe('getCurrentWoWWeek', () => {
	it('Wed 07:05 UTC returns new week', () => {
		const d = new Date('2026-05-13T07:05:00Z');
		expect(getCurrentWoWWeek(d)).toBe('2026-20');
	});

	it('Wed 06:59 UTC returns previous week', () => {
		const d = new Date('2026-05-13T06:59:00Z');
		expect(getCurrentWoWWeek(d)).toBe('2026-19');
	});
});

describe('computeCurrentStreak / computeLongestStreak', () => {
	const weeks = [
		{ week: '2026-19', met: true },
		{ week: '2026-18', met: true },
		{ week: '2026-17', met: true },
		{ week: '2026-16', met: false },
		{ week: '2026-15', met: true }
	];

	it('current streak counts consecutive met from latest', () => {
		expect(computeCurrentStreak(weeks)).toBe(3);
	});

	it('longest streak across all time', () => {
		expect(computeLongestStreak(weeks)).toBe(3);
	});

	it('empty weeks → streak 0', () => {
		expect(computeCurrentStreak([])).toBe(0);
		expect(computeLongestStreak([])).toBe(0);
	});
});

// ── Two raiders with same display_name are distinct by raider_id ─────────────

describe('raider identity by raider_id', () => {
	it('two raiders with same display_name but different UUID are distinct', () => {
		const a = makePlayer({ raider_id: 'uuid-a', display_name: 'Same' });
		const b = makePlayer({ raider_id: 'uuid-b', display_name: 'Same' });
		expect(a.raider_id).not.toBe(b.raider_id);
	});
});
