import { describe, expect, it } from 'vitest';
import type { Roster } from '$lib/types/roster.js';
import { checkDesignationParity, validateTeamChange } from './team-change-validation.js';

function makeRoster(players: any[] = []): Roster {
	return {
		app_name: 'Test',
		realm: 'D',
		region: 'eu',
		mplus_weekly_minimum: 4,
		mplus_minimum_key_level: 10,
		tracking_start_date: '2026-01-01',
		mplus_seasons: [],
		raid_difficulties: [],
		wcl_expansion_id: 11,
		players,
	} as Roster;
}

describe('validateTeamChange', () => {
	it('returns error when reason is missing on team_changed event', () => {
		const event = {
			event: 'team_changed' as const,
			date: '2026-03-17',
			from: 'alt' as const,
			to: 'main' as const,
			reason: '',
		};
		const warnings = validateTeamChange(event);
		expect(warnings).toHaveLength(1);
		expect(warnings[0].level).toBe('warning');
	});

	it('returns error when reason is whitespace only', () => {
		const event = {
			event: 'team_changed' as const,
			date: '2026-03-17',
			from: 'alt' as const,
			to: 'main' as const,
			reason: '   ',
		};
		expect(validateTeamChange(event)).toHaveLength(1);
	});

	it('returns valid when reason is non-empty', () => {
		const event = {
			event: 'team_changed' as const,
			date: '2026-03-17',
			from: 'alt' as const,
			to: 'main' as const,
			reason: 'Strong performance',
		};
		expect(validateTeamChange(event)).toHaveLength(0);
	});

	it('returns valid for joined event regardless of reason', () => {
		const event = { event: 'joined' as const, date: '2026-01-01' };
		expect(validateTeamChange(event)).toHaveLength(0);
	});

	it('returns valid for left event regardless of reason', () => {
		const event = { event: 'left' as const, date: '2026-01-01', note: '' };
		expect(validateTeamChange(event)).toHaveLength(0);
	});
});

describe('checkDesignationParity', () => {
	it('returns warning when team_designation changed but no team_changed event exists', () => {
		const prev = makeRoster([
			{
				raider_id: 'x',
				display_name: 'X',
				status: 'active',
				team_designation: 'alt',
				membership_history: [{ event: 'joined', date: '2026-01-01' }],
				characters: [],
				role_history: [],
			},
		]);
		const current = makeRoster([
			{
				raider_id: 'x',
				display_name: 'X',
				status: 'active',
				team_designation: 'main', // changed
				membership_history: [{ event: 'joined', date: '2026-01-01' }], // no team_changed
				characters: [],
				role_history: [],
			},
		]);
		const warnings = checkDesignationParity(current, prev);
		expect(warnings.some((w) => w.message.includes('without a corresponding'))).toBe(true);
	});

	it('returns no warning when both team_designation and team_changed event are present', () => {
		const prev = makeRoster([
			{
				raider_id: 'x',
				display_name: 'X',
				status: 'active',
				team_designation: 'alt',
				membership_history: [{ event: 'joined', date: '2026-01-01' }],
				characters: [],
				role_history: [],
			},
		]);
		const current = makeRoster([
			{
				raider_id: 'x',
				display_name: 'X',
				status: 'active',
				team_designation: 'main',
				membership_history: [
					{ event: 'joined', date: '2026-01-01' },
					{ event: 'team_changed', date: '2026-03-17', from: 'alt', to: 'main', reason: 'Promoted' },
				],
				characters: [],
				role_history: [],
			},
		]);
		const warnings = checkDesignationParity(current, prev);
		expect(warnings.filter((w) => w.message.includes('without a corresponding'))).toHaveLength(0);
	});

	it('returns no warning when neither changed', () => {
		const roster = makeRoster([
			{
				raider_id: 'x',
				display_name: 'X',
				status: 'active',
				team_designation: 'main',
				membership_history: [{ event: 'joined', date: '2026-01-01' }],
				characters: [],
				role_history: [],
			},
		]);
		expect(checkDesignationParity(roster, roster)).toHaveLength(0);
	});
});
