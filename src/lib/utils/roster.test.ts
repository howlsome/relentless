import { describe, it, expect, vi } from 'vitest';
import {
	isValidClassSpec,
	canonicalRole,
	CLASS_SPECS,
	VALID_CLASSES,
	validateRoster,
	getActivePlayers,
	getEffectiveStartDate,
	isWeekTracked,
	validateRoleForSpec
} from './roster.js';
import type { Roster, Player } from '$lib/types/roster.js';

// ── Fixture helpers ────────────────────────────────────────────────────────────

function makePlayer(overrides: Partial<Player> = {}): Player {
	return {
		raider_id: 'test-uuid',
		display_name: 'TestRaider',
		status: 'active',
		team_designation: 'main',
		membership_history: [{ event: 'joined', date: '2026-03-17' }],
		characters: [{ name: 'Char', realm: 'Draenor', class: 'Rogue', spec: 'Subtlety', role: 'dps', active: true }],
		role_history: [],
		...overrides
	};
}

function makeRoster(players: Player[] = [], overrides: Partial<Roster> = {}): Roster {
	return {
		app_name: 'Test',
		realm: 'Draenor',
		region: 'eu',
		mplus_weekly_minimum: 4,
		mplus_minimum_key_level: 10,
		tracking_start_date: '2026-01-01',
		mplus_seasons: [{ season_id: 'test-s1', label: 'Test', start_date: '2026-01-01', end_date: null, dungeon_count: 8, dungeons: [] }],
		raid_difficulties: ['heroic', 'mythic'],
		wcl_expansion_id: 11,
		players,
		...overrides
	};
}

// ── getActivePlayers ──────────────────────────────────────────────────────────

describe('getActivePlayers', () => {
	it('returns players with status active', () => {
		const roster = makeRoster([makePlayer(), makePlayer({ raider_id: 'b', status: 'inactive' as const })]);
		expect(getActivePlayers(roster)).toHaveLength(1);
		expect(getActivePlayers(roster)[0].raider_id).toBe('test-uuid');
	});

	it('excludes inactive players', () => {
		const roster = makeRoster([makePlayer({ status: 'inactive' as const })]);
		expect(getActivePlayers(roster)).toHaveLength(0);
	});

	it('missing status defaults to active', () => {
		const player = makePlayer();
		// @ts-ignore testing missing field
		delete player.status;
		expect(getActivePlayers(makeRoster([player]))).toHaveLength(1);
	});

	it('empty roster returns []', () => {
		expect(getActivePlayers(makeRoster([]))).toHaveLength(0);
	});
});

// ── getEffectiveStartDate ─────────────────────────────────────────────────────

describe('getEffectiveStartDate', () => {
	it('returns player-level date when set', () => {
		const player = makePlayer({ tracking_start_date: '2026-04-01' });
		const roster = makeRoster([], { tracking_start_date: '2026-01-01' });
		expect(getEffectiveStartDate(player, roster)).toBe('2026-04-01');
	});

	it('falls back to roster top-level date when player has none', () => {
		const player = makePlayer();
		delete (player as any).tracking_start_date;
		const roster = makeRoster([], { tracking_start_date: '2026-02-01' });
		expect(getEffectiveStartDate(player, roster)).toBe('2026-02-01');
	});

	it('returns current date and logs warning when neither is set', () => {
		const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const player = makePlayer();
		delete (player as any).tracking_start_date;
		const roster = makeRoster();
		delete (roster as any).tracking_start_date;
		const result = getEffectiveStartDate(player, roster);
		expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(spy).toHaveBeenCalled();
		spy.mockRestore();
	});
});

// ── isWeekTracked ─────────────────────────────────────────────────────────────

describe('isWeekTracked', () => {
	const roster = makeRoster([], { tracking_start_date: '2026-03-17' });
	const player = makePlayer({ tracking_start_date: '2026-03-17' });

	it('returns true for weeks on or after start date', () => {
		// Week 13 of 2026 starts Mon Mar 23 — after tracking_start_date Mar 17
		expect(isWeekTracked('2026-13', player, roster)).toBe(true);
		expect(isWeekTracked('2026-20', player, roster)).toBe(true);
	});

	it('returns false for weeks before start date', () => {
		// Week 12 of 2026 starts Mon Mar 16 — before tracking_start_date Mar 17
		expect(isWeekTracked('2026-12', player, roster)).toBe(false);
		expect(isWeekTracked('2025-52', player, roster)).toBe(false);
	});
});

// ── validateClassSpec ─────────────────────────────────────────────────────────

describe('validateClassSpec', () => {
	it('returns true for all 39 valid Midnight class/spec combinations', () => {
		for (const [cls, specs] of Object.entries(CLASS_SPECS)) {
			for (const spec of Object.keys(specs)) {
				expect(isValidClassSpec(cls, spec)).toBe(true);
			}
		}
	});

	it('returns false for invalid combo (Paladin/Unholy)', () => {
		expect(isValidClassSpec('Paladin', 'Unholy')).toBe(false);
	});

	it('returns false for unknown class', () => {
		expect(isValidClassSpec('Gnome', 'Tinker')).toBe(false);
	});

	it('returns false for unknown spec on valid class', () => {
		expect(isValidClassSpec('Mage', 'Holy')).toBe(false);
	});

	it('all 13 class identifiers are exported as VALID_CLASSES', () => {
		expect(VALID_CLASSES).toHaveLength(13);
		expect(VALID_CLASSES).toContain('DeathKnight');
		expect(VALID_CLASSES).toContain('DemonHunter');
		expect(VALID_CLASSES).toContain('Warrior');
	});
});

// ── validateRoleForSpec ───────────────────────────────────────────────────────

describe('validateRoleForSpec', () => {
	it('returns true when role matches the canonical role', () => {
		expect(validateRoleForSpec('Paladin', 'Retribution', 'dps')).toBe(true);
		expect(validateRoleForSpec('Paladin', 'Holy', 'healer')).toBe(true);
		expect(validateRoleForSpec('Warrior', 'Protection', 'tank')).toBe(true);
	});

	it('returns false when role is inconsistent (Holy Paladin as dps)', () => {
		expect(validateRoleForSpec('Paladin', 'Holy', 'dps')).toBe(false);
	});

	it('returns false for invalid class/spec combination', () => {
		expect(validateRoleForSpec('Mage', 'Holy', 'healer')).toBe(false);
	});
});

// ── canonicalRole ─────────────────────────────────────────────────────────────

describe('canonicalRole', () => {
	it('returns correct role for Blood DK (tank)', () => {
		expect(canonicalRole('DeathKnight', 'Blood')).toBe('tank');
	});
	it('returns correct role for Preservation Evoker (healer)', () => {
		expect(canonicalRole('Evoker', 'Preservation')).toBe('healer');
	});
	it('returns null for unknown spec', () => {
		expect(canonicalRole('Mage', 'Holy')).toBeNull();
	});
});
