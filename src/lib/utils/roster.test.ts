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

// ── validateRaidSchedule ──────────────────────────────────────────────────────

describe('validateRoster — raid_schedule validation', () => {
	it('passes when raid_schedule is absent (feature disabled)', () => {
		const roster = makeRoster([makePlayer()]);
		const result = validateRoster(roster);
		expect(result.valid).toBe(true);
		expect(result.warnings).not.toContain(expect.stringMatching(/raid_schedule/));
	});

	it('passes with a valid raid_schedule', () => {
		const roster = makeRoster([makePlayer()], {
			raid_schedule: {
				timezone: 'Europe/Paris',
				sessions: [{ day: 'monday', start: '20:30', end: '23:30', grace_minutes: 30 }],
				safe_pug_windows: [{ day: 'tuesday', start: '00:00', end: '23:59' }],
			},
		});
		const result = validateRoster(roster);
		expect(result.valid).toBe(true);
	});

	it('warns when raid_schedule has an empty sessions array', () => {
		const roster = makeRoster([makePlayer()], {
			raid_schedule: { timezone: 'Europe/Paris', sessions: [], safe_pug_windows: [] },
		});
		const result = validateRoster(roster);
		expect(result.warnings.some((w) => /raid_schedule.*sessions/i.test(w))).toBe(true);
	});

	it('errors when raid_schedule is missing a timezone', () => {
		const roster = makeRoster([makePlayer()], {
			// @ts-ignore testing invalid shape
			raid_schedule: { sessions: [{ day: 'monday', start: '20:30', end: '23:30', grace_minutes: 30 }], safe_pug_windows: [] },
		});
		const result = validateRoster(roster);
		expect(result.errors.some((e) => /timezone/i.test(e))).toBe(true);
	});

	it('warns on a safe_pug_window with start >= end', () => {
		const roster = makeRoster([makePlayer()], {
			raid_schedule: {
				timezone: 'Europe/Paris',
				sessions: [{ day: 'monday', start: '20:30', end: '23:30', grace_minutes: 30 }],
				safe_pug_windows: [{ day: 'tuesday', start: '23:00', end: '12:00' }],
			},
		});
		const result = validateRoster(roster);
		expect(result.warnings.some((w) => /start.*>=.*end|start >= end/i.test(w))).toBe(true);
	});
});

// ── Stage 8: multi-spec helpers ───────────────────────────────────────────────

import {
	getActiveSpecs,
	getPrimarySpec,
	getRolesPlayed,
	validateSpecsArray
} from './roster.js';
import type { SpecEntry } from '$lib/types/roster.js';

const BALANCE_SPEC: SpecEntry = { spec: 'Balance', role: 'dps', primary: true, wcl_active: true };
const RESTO_SPEC: SpecEntry = { spec: 'Restoration', role: 'healer', primary: false, wcl_active: true };
const INACTIVE_SPEC: SpecEntry = { spec: 'Guardian', role: 'tank', primary: false, wcl_active: false };

function makeMultiSpecChar(specs: SpecEntry[]) {
	return { name: 'Druidchar', realm: 'Draenor', class: 'Druid' as const, active: true, specs };
}

describe('getActiveSpecs', () => {
	it('returns only specs with wcl_active: true', () => {
		const char = makeMultiSpecChar([BALANCE_SPEC, RESTO_SPEC, INACTIVE_SPEC]);
		const active = getActiveSpecs(char);
		expect(active).toHaveLength(2);
		expect(active.map(s => s.spec)).not.toContain('Guardian');
	});

	it('returns all specs when all are wcl_active', () => {
		const char = makeMultiSpecChar([BALANCE_SPEC, RESTO_SPEC]);
		expect(getActiveSpecs(char)).toHaveLength(2);
	});

	it('returns empty array when all specs are inactive', () => {
		const char = makeMultiSpecChar([INACTIVE_SPEC]);
		expect(getActiveSpecs(char)).toHaveLength(0);
	});
});

describe('getPrimarySpec', () => {
	it('returns the spec with primary: true', () => {
		const char = makeMultiSpecChar([BALANCE_SPEC, RESTO_SPEC]);
		expect(getPrimarySpec(char)?.spec).toBe('Balance');
	});

	it('falls back to first entry when no primary is set', () => {
		const noPrimary = [{ ...BALANCE_SPEC, primary: false }, RESTO_SPEC];
		const char = makeMultiSpecChar(noPrimary);
		expect(getPrimarySpec(char)?.spec).toBe('Balance');
	});
});

describe('getRolesPlayed', () => {
	it('returns deduplicated roles across all active specs', () => {
		const char = makeMultiSpecChar([BALANCE_SPEC, RESTO_SPEC]);
		const roles = getRolesPlayed(char);
		expect(roles).toContain('dps');
		expect(roles).toContain('healer');
		expect(roles).toHaveLength(2);
	});

	it('excludes roles from wcl_active: false specs', () => {
		const char = makeMultiSpecChar([BALANCE_SPEC, INACTIVE_SPEC]);
		const roles = getRolesPlayed(char);
		expect(roles).not.toContain('tank');
	});

	it('a Druid with Balance (DPS) and Restoration (healer) returns {dps, healer}', () => {
		const char = makeMultiSpecChar([BALANCE_SPEC, RESTO_SPEC]);
		const roles = getRolesPlayed(char);
		expect(new Set(roles)).toEqual(new Set(['dps', 'healer']));
	});
});

describe('validateSpecsArray', () => {
	it('passes a valid specs array with exactly one primary', () => {
		const result = validateSpecsArray([BALANCE_SPEC, RESTO_SPEC], 'Druid', 'TestRaider/Char');
		expect(result.errors).toHaveLength(0);
	});

	it('rejects zero entries', () => {
		const result = validateSpecsArray([], 'Druid', 'TestRaider/Char');
		expect(result.errors.some(e => /empty|at least one/i.test(e))).toBe(true);
	});

	it('warns when multiple primary: true entries exist', () => {
		const dualPrimary = [BALANCE_SPEC, { ...RESTO_SPEC, primary: true }];
		const result = validateSpecsArray(dualPrimary, 'Druid', 'TestRaider/Char');
		expect(result.warnings.some(w => /multiple.*primary|primary.*multiple/i.test(w))).toBe(true);
	});

	it('warns when no primary: true entry exists', () => {
		const noPrimary = [{ ...BALANCE_SPEC, primary: false }, RESTO_SPEC];
		const result = validateSpecsArray(noPrimary, 'Druid', 'TestRaider/Char');
		expect(result.warnings.some(w => /no.*primary|primary.*not set/i.test(w))).toBe(true);
	});

	it('errors on invalid class/spec combination', () => {
		const badSpec: SpecEntry = { spec: 'Holy', role: 'healer', primary: true, wcl_active: true };
		const result = validateSpecsArray([badSpec], 'Druid', 'TestRaider/Char');
		expect(result.errors.some(e => /invalid.*class\/spec|invalid.*spec/i.test(e))).toBe(true);
	});
});
