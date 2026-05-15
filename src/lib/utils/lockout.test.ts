import { describe, expect, it } from 'vitest';
import type { Exemption, RaidSchedule } from '$lib/types/roster.js';
import { classifyKill } from './lockout.js';

// ── Fixture schedule ──────────────────────────────────────────────────────────
// sessions:         Mon 20:30–23:30 (+30min grace) → effective 20:00–24:00 server
//                   Wed 20:30–23:30 (+30min grace) → effective 20:00–24:00 server
// safe_pug_windows: Tue 00:00–23:59, Wed 00:00–05:59
// timezone:         Europe/Paris (CET/CEST)

const SCHEDULE: RaidSchedule = {
	timezone: 'Europe/Paris',
	sessions: [
		{ day: 'monday', start: '20:30', end: '23:30', grace_minutes: 30 },
		{ day: 'wednesday', start: '20:30', end: '23:30', grace_minutes: 30 },
	],
	safe_pug_windows: [
		{ day: 'tuesday', start: '00:00', end: '23:59' },
		{ day: 'wednesday', start: '00:00', end: '05:59' },
	],
};

// ── Helper — build a UTC ISO timestamp for a given server-time day/hour/min ──
// All times are in Europe/Paris server time (CET = UTC+1 in winter, CEST = UTC+2 in summer).
// Tests use dates in May 2026, which is CEST (UTC+2).
// So server 20:00 = UTC 18:00, server 06:00 = UTC 04:00, etc.

// Week of 2026-05-11 (Monday) – in CEST (+2 hours)
// Mon 2026-05-11, Tue 2026-05-12, Wed 2026-05-13, Thu 2026-05-14
// Fri 2026-05-15, Sat 2026-05-16, Sun 2026-05-17

function serverToUTC(isoDate: string, serverHour: number, serverMin = 0): string {
	// CEST = UTC+2, so UTC = server - 2h
	const utcHour = serverHour - 2;
	const date = new Date(`${isoDate}T00:00:00Z`);
	date.setUTCHours(utcHour, serverMin, 0, 0);
	return date.toISOString();
}

// ── in_raid cases ─────────────────────────────────────────────────────────────

describe('classifyKill — in_raid', () => {
	it('Mon 21:00 server kill → in_raid (mid-session)', () => {
		expect(classifyKill(serverToUTC('2026-05-11', 21), SCHEDULE)).toBe('in_raid');
	});

	it('Wed 22:30 server kill → in_raid (mid-session)', () => {
		expect(classifyKill(serverToUTC('2026-05-13', 22, 30), SCHEDULE)).toBe('in_raid');
	});

	it('Mon 23:55 server kill → in_raid (progression extension — inside grace 23:30→24:00)', () => {
		expect(classifyKill(serverToUTC('2026-05-11', 23, 55), SCHEDULE)).toBe('in_raid');
	});

	it('Wed 23:59 server kill → in_raid (last minute of grace)', () => {
		expect(classifyKill(serverToUTC('2026-05-13', 23, 59), SCHEDULE)).toBe('in_raid');
	});

	it('Mon 20:05 server kill → in_raid (within 30-min grace before 20:30 start)', () => {
		expect(classifyKill(serverToUTC('2026-05-11', 20, 5), SCHEDULE)).toBe('in_raid');
	});

	it('Mon 20:30 server kill → in_raid (exactly at session start)', () => {
		expect(classifyKill(serverToUTC('2026-05-11', 20, 30), SCHEDULE)).toBe('in_raid');
	});

	it('Mon 23:30 server kill → in_raid (exactly at session end, inside grace)', () => {
		expect(classifyKill(serverToUTC('2026-05-11', 23, 30), SCHEDULE)).toBe('in_raid');
	});

	it('Mon 23:59 server kill → in_raid (one minute before grace ends at 24:00)', () => {
		expect(classifyKill(serverToUTC('2026-05-11', 23, 59), SCHEDULE)).toBe('in_raid');
	});
});

// ── safe_pug cases ────────────────────────────────────────────────────────────

describe('classifyKill — safe_pug', () => {
	it('Tue 00:00 server kill → safe_pug (first minute of Tuesday)', () => {
		expect(classifyKill(serverToUTC('2026-05-12', 0, 0), SCHEDULE)).toBe('safe_pug');
	});

	it('Tue 03:00 server kill → safe_pug (early morning Tuesday)', () => {
		expect(classifyKill(serverToUTC('2026-05-12', 3), SCHEDULE)).toBe('safe_pug');
	});

	it('Tue 12:00 server kill → safe_pug (mid-Tuesday)', () => {
		expect(classifyKill(serverToUTC('2026-05-12', 12), SCHEDULE)).toBe('safe_pug');
	});

	it('Tue 21:00 server kill → safe_pug (Tuesday evening)', () => {
		expect(classifyKill(serverToUTC('2026-05-12', 21), SCHEDULE)).toBe('safe_pug');
	});

	it('Tue 23:59 server kill → safe_pug (last minute of Tuesday)', () => {
		expect(classifyKill(serverToUTC('2026-05-12', 23, 59), SCHEDULE)).toBe('safe_pug');
	});

	it('Wed 00:00 server kill → safe_pug (first minute of Wednesday — before 06:00 reset)', () => {
		expect(classifyKill(serverToUTC('2026-05-13', 0, 0), SCHEDULE)).toBe('safe_pug');
	});

	it('Wed 02:30 server kill → safe_pug (degenerate hours — Wed early morning, before reset)', () => {
		expect(classifyKill(serverToUTC('2026-05-13', 2, 30), SCHEDULE)).toBe('safe_pug');
	});

	it('Wed 05:59 server kill → safe_pug (one minute before reset)', () => {
		expect(classifyKill(serverToUTC('2026-05-13', 5, 59), SCHEDULE)).toBe('safe_pug');
	});
});

// ── blocking_pug cases ────────────────────────────────────────────────────────

describe('classifyKill — blocking_pug', () => {
	it('Mon 15:00 server kill → blocking_pug (before session, before grace)', () => {
		expect(classifyKill(serverToUTC('2026-05-11', 15), SCHEDULE)).toBe('blocking_pug');
	});

	it('Mon 19:59 server kill → blocking_pug (one minute before grace starts at 20:00)', () => {
		expect(classifyKill(serverToUTC('2026-05-11', 19, 59), SCHEDULE)).toBe('blocking_pug');
	});

	it('Wed 06:00 server kill → blocking_pug (exactly at reset — kills Wed evening raid)', () => {
		expect(classifyKill(serverToUTC('2026-05-13', 6, 0), SCHEDULE)).toBe('blocking_pug');
	});

	it('Wed 12:00 server kill → blocking_pug (Wed afternoon, before Wed raid)', () => {
		expect(classifyKill(serverToUTC('2026-05-13', 12), SCHEDULE)).toBe('blocking_pug');
	});

	it('Wed 19:59 server kill → blocking_pug (one minute before Wed grace starts)', () => {
		expect(classifyKill(serverToUTC('2026-05-13', 19, 59), SCHEDULE)).toBe('blocking_pug');
	});

	it('Thu 03:00 server kill → blocking_pug (locks out next Mon raid)', () => {
		expect(classifyKill(serverToUTC('2026-05-14', 3), SCHEDULE)).toBe('blocking_pug');
	});

	it('Thu 21:00 server kill → blocking_pug (no session, no safe-pug window)', () => {
		expect(classifyKill(serverToUTC('2026-05-14', 21), SCHEDULE)).toBe('blocking_pug');
	});

	it('Fri 12:00 server kill → blocking_pug', () => {
		expect(classifyKill(serverToUTC('2026-05-15', 12), SCHEDULE)).toBe('blocking_pug');
	});

	it('Sat 22:00 server kill → blocking_pug', () => {
		expect(classifyKill(serverToUTC('2026-05-16', 22), SCHEDULE)).toBe('blocking_pug');
	});

	it('Sun 21:00 server kill → blocking_pug', () => {
		expect(classifyKill(serverToUTC('2026-05-17', 21), SCHEDULE)).toBe('blocking_pug');
	});
});

// ── Crucial boundary: Wed 05:59 → 06:00 ─────────────────────────────────────

describe('classifyKill — Wed 05:59 / 06:00 boundary', () => {
	it('Wed 05:59 server → safe_pug (lockout will clear at reset)', () => {
		expect(classifyKill(serverToUTC('2026-05-13', 5, 59), SCHEDULE)).toBe('safe_pug');
	});

	it('Wed 06:00 server → blocking_pug (reset cleared; new kill blocks Wed evening raid)', () => {
		expect(classifyKill(serverToUTC('2026-05-13', 6, 0), SCHEDULE)).toBe('blocking_pug');
	});
});

// ── Exemption cases ───────────────────────────────────────────────────────────

describe('classifyKill — exempt_pug', () => {
	const exemptions: Exemption[] = [
		{
			week: '2026-20',
			raid_nights_excused: ['monday'],
			reason: 'Family event',
			granted_by: 'OfficerName',
			granted_at: '2026-05-10T12:00:00Z',
		},
	];

	it('Mon kill + active exemption for that week excusing Monday → exempt_pug', () => {
		// 2026-05-11 is week 20 (Monday of that week)
		expect(classifyKill(serverToUTC('2026-05-11', 15), SCHEDULE, exemptions)).toBe('exempt_pug');
	});

	it('Any kill in exempt week + at least one excused raid night → exempt_pug', () => {
		// Wednesday kill in week 20, exemption covers Monday — still exempt
		expect(classifyKill(serverToUTC('2026-05-13', 15), SCHEDULE, exemptions)).toBe('exempt_pug');
	});

	it('Kill in week with no exemption → blocking_pug', () => {
		// Week 21 kill (2026-05-18 Monday)
		expect(classifyKill(serverToUTC('2026-05-18', 15), SCHEDULE, exemptions)).toBe('blocking_pug');
	});

	it('Kill with exemption but empty raid_nights_excused → blocking_pug', () => {
		const emptyExemptions: Exemption[] = [
			{
				week: '2026-20',
				raid_nights_excused: [],
				reason: 'No nights listed',
				granted_by: 'Officer',
				granted_at: '2026-05-10T12:00:00Z',
			},
		];
		expect(classifyKill(serverToUTC('2026-05-11', 15), SCHEDULE, emptyExemptions)).toBe(
			'blocking_pug',
		);
	});

	it('Most recent exemption by granted_at wins when multiple exist for same week', () => {
		const multiExemptions: Exemption[] = [
			{
				week: '2026-20',
				raid_nights_excused: [],
				reason: 'Old — superseded',
				granted_by: 'Officer',
				granted_at: '2026-05-08T12:00:00Z',
			},
			{
				week: '2026-20',
				raid_nights_excused: ['monday'],
				reason: 'Newer — active',
				granted_by: 'Officer',
				granted_at: '2026-05-10T12:00:00Z',
			},
		];
		// Most recent exemption has monday excused → exempt_pug
		expect(classifyKill(serverToUTC('2026-05-11', 15), SCHEDULE, multiExemptions)).toBe('exempt_pug');
	});

	it('Most recent exemption with empty raid_nights_excused wins even if older entry covers nights → blocking_pug', () => {
		const multiExemptions: Exemption[] = [
			{
				week: '2026-20',
				raid_nights_excused: ['monday'],
				reason: 'Old with nights',
				granted_by: 'Officer',
				granted_at: '2026-05-08T12:00:00Z',
			},
			{
				week: '2026-20',
				raid_nights_excused: [],
				reason: 'Newer — no nights',
				granted_by: 'Officer',
				granted_at: '2026-05-10T12:00:00Z',
			},
		];
		expect(classifyKill(serverToUTC('2026-05-11', 15), SCHEDULE, multiExemptions)).toBe(
			'blocking_pug',
		);
	});
});

// ── Priority and edge cases ───────────────────────────────────────────────────

describe('classifyKill — priority and edge cases', () => {
	it('Normal difficulty → returns null (never classified)', () => {
		expect(classifyKill(serverToUTC('2026-05-14', 21), SCHEDULE, [], 'normal')).toBeNull();
	});

	it('Heroic difficulty → returns a category (blocking_pug for out-of-session kill)', () => {
		expect(classifyKill(serverToUTC('2026-05-14', 21), SCHEDULE, [], 'heroic')).toBe('blocking_pug');
	});

	it('Mythic difficulty is classified (default difficulty)', () => {
		expect(classifyKill(serverToUTC('2026-05-14', 21), SCHEDULE)).toBe('blocking_pug');
	});

	it('Feature disabled: empty sessions array → returns in_raid for all kills', () => {
		const disabledSchedule: RaidSchedule = {
			timezone: 'Europe/Paris',
			sessions: [],
			safe_pug_windows: [],
		};
		expect(classifyKill(serverToUTC('2026-05-14', 21), disabledSchedule)).toBe('in_raid');
	});

	it('Feature disabled: undefined schedule → returns in_raid for all kills', () => {
		expect(classifyKill(serverToUTC('2026-05-14', 21), undefined)).toBe('in_raid');
	});

	it('Empty safe_pug_windows: all out-of-session kills → blocking_pug', () => {
		const noSafePug: RaidSchedule = { ...SCHEDULE, safe_pug_windows: [] };
		expect(classifyKill(serverToUTC('2026-05-12', 12), noSafePug)).toBe('blocking_pug');
	});

	it('Grace minutes applied to both start and end of session window', () => {
		// Grace = 30 min. Session 20:30–23:30. Effective: 20:00–24:00.
		// 20:00 on the dot → in_raid (start grace)
		expect(classifyKill(serverToUTC('2026-05-11', 20, 0), SCHEDULE)).toBe('in_raid');
		// 24:00 = next day 00:00 — we test 23:59 which is still in_raid
		expect(classifyKill(serverToUTC('2026-05-11', 23, 59), SCHEDULE)).toBe('in_raid');
	});

	it('Grace minutes NOT applied to safe-pug windows — exact boundary respected', () => {
		// safe_pug_windows: Wed 00:00–05:59
		// 06:00 is NOT inside the window (no grace)
		expect(classifyKill(serverToUTC('2026-05-13', 6, 0), SCHEDULE)).toBe('blocking_pug');
	});

	it('Multiple safe_pug windows on same day: kill in any → safe_pug', () => {
		const multiWindows: RaidSchedule = {
			...SCHEDULE,
			safe_pug_windows: [
				{ day: 'tuesday', start: '10:00', end: '14:00' },
				{ day: 'tuesday', start: '20:00', end: '23:00' },
			],
		};
		expect(classifyKill(serverToUTC('2026-05-12', 12), multiWindows)).toBe('safe_pug');
		expect(classifyKill(serverToUTC('2026-05-12', 22), multiWindows)).toBe('safe_pug');
		// Between windows → blocking_pug
		expect(classifyKill(serverToUTC('2026-05-12', 17), multiWindows)).toBe('blocking_pug');
	});

	it('Safe-pug window with start >= end → window ignored, kills are blocking_pug', () => {
		const badWindow: RaidSchedule = {
			...SCHEDULE,
			safe_pug_windows: [{ day: 'tuesday', start: '23:00', end: '12:00' }],
		};
		expect(classifyKill(serverToUTC('2026-05-12', 15), badWindow)).toBe('blocking_pug');
	});

	it('Sessions and safe_pug_windows overlap: session wins (in_raid)', () => {
		// A Monday 21:00 kill is in_raid even if a hypothetical Mon safe_pug_window also exists
		const overlap: RaidSchedule = {
			...SCHEDULE,
			safe_pug_windows: [
				...SCHEDULE.safe_pug_windows,
				{ day: 'monday', start: '20:00', end: '23:59' },
			],
		};
		expect(classifyKill(serverToUTC('2026-05-11', 21), overlap)).toBe('in_raid');
	});

	it('CET/CEST transition: Mon 21:00 CEST = 19:00 UTC classifies as in_raid', () => {
		// This is the same as our normal May test — CEST is UTC+2
		// server 21:00 = UTC 19:00, which is mid-session → in_raid
		const utcTs = '2026-05-11T19:00:00.000Z';
		expect(classifyKill(utcTs, SCHEDULE)).toBe('in_raid');
	});
});
