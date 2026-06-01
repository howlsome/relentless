/**
 * Unit tests for the changelog generation (cron diff) logic.
 * Tests generateChangelogEntries from raider-identity.mjs.
 */
import { describe, expect, it } from 'vitest';
import type { Roster } from '$lib/types/roster.js';
import { generateChangelogEntries } from './raider-identity.js';

const TS = '2026-05-13T06:01:00Z';
const WEEK = '2026-20';

function player(id: string, overrides: Record<string, unknown> = {}) {
	return {
		raider_id: id,
		display_name: `Player${id}`,
		status: 'active',
		team_designation: 'main',
		membership_history: [{ event: 'joined', date: '2026-03-17', note: 'Founder' }],
		characters: [
			{
				name: `Char${id}`,
				realm: 'Draenor',
				class: 'Rogue',
				spec: 'Subtlety',
				role: 'dps',
				active: true,
			},
		],
		role_history: [],
		...overrides,
	};
}

function roster(players: unknown[]) {
	return { players, tracking_start_date: '2026-01-01' } as unknown as Roster;
}

describe('generateChangelogEntries', () => {
	it('identical rosters → zero entries', () => {
		const r = roster([player('A')]);
		expect(generateChangelogEntries(r, r, TS, WEEK)).toHaveLength(0);
	});

	it('adding a new raider → joined entry', () => {
		const prev = roster([]);
		const cur = roster([player('A')]);
		const entries = generateChangelogEntries(cur, prev, TS, WEEK);
		expect(entries).toHaveLength(1);
		expect(entries[0].event).toBe('joined');
		expect(entries[0].raider_id).toBe('A');
	});

	it('setting status inactive → left entry', () => {
		const prev = roster([player('A')]);
		const cur = roster([
			player('A', {
				status: 'inactive',
				membership_history: [
					{ event: 'joined', date: '2026-03-17' },
					{ event: 'left', date: '2026-05-13', note: 'Break' },
				],
			}),
		]);
		const entries = generateChangelogEntries(cur, prev, TS, WEEK);
		expect(entries.some((e) => e.event === 'left')).toBe(true);
	});

	it('team_designation change + team_changed event → team_changed entry with reason', () => {
		const prev = roster([player('A', { team_designation: 'alt' })]);
		const cur = roster([
			player('A', {
				team_designation: 'main',
				membership_history: [
					{ event: 'joined', date: '2026-01-01' },
					{ event: 'team_changed', date: '2026-05-13', from: 'alt', to: 'main', reason: 'Strong perf' },
				],
			}),
		]);
		const entries = generateChangelogEntries(cur, prev, TS, WEEK);
		const tc = entries.find((e) => e.event === 'team_changed');
		expect(tc).toBeTruthy();
		const tcE = tc as Record<string, unknown>;
		expect(tcE.reason).toBe('Strong perf');
		expect(tcE.from).toBe('alt');
		expect(tcE.to).toBe('main');
	});

	it('team_changed with blank reason → "(no reason given)" recorded', () => {
		const prev = roster([player('A', { team_designation: 'alt' })]);
		const cur = roster([
			player('A', {
				team_designation: 'main',
				membership_history: [
					{ event: 'joined', date: '2026-01-01' },
					{ event: 'team_changed', date: '2026-05-13', from: 'alt', to: 'main', reason: '' },
				],
			}),
		]);
		const entries = generateChangelogEntries(cur, prev, TS, WEEK);
		const tc = entries.find((e) => e.event === 'team_changed');
		expect((tc as Record<string, unknown>)?.reason).toBe('(no reason given)');
	});

	it('swapping active character → rerolled entry', () => {
		const prev = roster([
			player('A', {
				characters: [
					{ name: 'OldChar', realm: 'D', class: 'Mage', spec: 'Fire', role: 'dps', active: true },
				],
			}),
		]);
		const cur = roster([
			player('A', {
				characters: [
					{ name: 'OldChar', realm: 'D', class: 'Mage', spec: 'Fire', role: 'dps', active: false },
					{ name: 'NewChar', realm: 'D', class: 'Rogue', spec: 'Subtlety', role: 'dps', active: true },
				],
			}),
		]);
		const entries = generateChangelogEntries(cur, prev, TS, WEEK);
		const r = entries.find((e) => e.event === 'rerolled');
		expect(r).toBeTruthy();
		const rE = r as Record<string, unknown>;
		expect(rE.from_character).toBe('OldChar');
		expect(rE.to_character).toBe('NewChar');
	});

	it('spec change with same role → spec_changed entry', () => {
		const prev = roster([
			player('A', {
				characters: [
					{ name: 'C', realm: 'D', class: 'Rogue', spec: 'Assassination', role: 'dps', active: true },
				],
			}),
		]);
		const cur = roster([
			player('A', {
				characters: [
					{ name: 'C', realm: 'D', class: 'Rogue', spec: 'Subtlety', role: 'dps', active: true },
				],
			}),
		]);
		const entries = generateChangelogEntries(cur, prev, TS, WEEK);
		expect(entries.some((e) => e.event === 'spec_changed')).toBe(true);
	});

	it('spec change with different role → role_changed entry', () => {
		const prev = roster([
			player('A', {
				characters: [
					{ name: 'C', realm: 'D', class: 'Warrior', spec: 'Arms', role: 'dps', active: true },
				],
			}),
		]);
		const cur = roster([
			player('A', {
				characters: [
					{ name: 'C', realm: 'D', class: 'Warrior', spec: 'Protection', role: 'tank', active: true },
				],
			}),
		]);
		const entries = generateChangelogEntries(cur, prev, TS, WEEK);
		expect(entries.some((e) => e.event === 'role_changed')).toBe(true);
	});

	it('each generated entry has a unique id', () => {
		const prev = roster([]);
		const cur = roster([player('A'), player('B')]);
		const entries = generateChangelogEntries(cur, prev, TS, WEEK);
		const ids = new Set(entries.map((e) => e.id));
		expect(ids.size).toBe(entries.length);
	});

	it('note from membership_history is copied into joined entry', () => {
		const prev = roster([]);
		const cur = roster([
			player('A', {
				membership_history: [
					{ event: 'joined', date: '2026-03-17', note: 'Returning after Season 1 break' },
				],
			}),
		]);
		const entries = generateChangelogEntries(cur, prev, TS, WEEK);
		expect((entries[0] as Record<string, unknown>)?.note).toBe('Returning after Season 1 break');
	});

	it('multiple changes → multiple independent entries', () => {
		const prev = roster([]);
		const cur = roster([player('X'), player('Y')]);
		const entries = generateChangelogEntries(cur, prev, TS, WEEK);
		expect(entries.length).toBeGreaterThanOrEqual(2);
	});

	it('null prevRoster (first run) → no entries generated', () => {
		const cur = roster([player('A')]);
		expect(generateChangelogEntries(cur, null, TS, WEEK)).toHaveLength(0);
	});
});
