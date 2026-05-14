import type { RaidSchedule, Exemption, KillCategory } from '$lib/types/roster.js';


const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// ── Time helpers ──────────────────────────────────────────────────────────────

/** Parse "HH:MM" → total minutes since midnight. */
function hmToMinutes(hm: string): number {
	const [h, m] = hm.split(':').map(Number);
	return h * 60 + m;
}

/**
 * Convert a UTC ISO timestamp to local {dayName, totalMinutes} in the given IANA timezone.
 * Uses Intl.DateTimeFormat to handle CET/CEST transitions automatically.
 */
function toLocalDayTime(utcIso: string, timezone: string): { day: string; minutes: number } {
	const date = new Date(utcIso);
	const fmt = new Intl.DateTimeFormat('en-GB', {
		timeZone: timezone,
		weekday: 'long',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
	});
	const parts = fmt.formatToParts(date);
	const dayName = parts.find((p) => p.type === 'weekday')?.value.toLowerCase() ?? '';
	const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
	const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
	return { day: dayName, minutes: hour * 60 + minute };
}

/**
 * Format a UTC ISO timestamp as a human-readable local-time string.
 * e.g. "Thursday 16:22 server (15:22 BST)"
 */
export function formatLocalTime(utcIso: string, serverTimezone: string): string {
	const date = new Date(utcIso);

	const serverFmt = new Intl.DateTimeFormat('en-GB', {
		timeZone: serverTimezone,
		weekday: 'long',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
	});

	const bstFmt = new Intl.DateTimeFormat('en-GB', {
		timeZone: 'Europe/London',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
	});

	const serverStr = serverFmt.format(date);
	const bstStr = bstFmt.format(date);
	return `${serverStr} server (${bstStr} BST)`;
}

// ── ISO week computation ──────────────────────────────────────────────────────

/** Return "YYYY-WW" ISO week for a UTC timestamp, using the server timezone's local date. */
export function getIsoWeekForTimestamp(utcIso: string, timezone: string): string {
	const date = new Date(utcIso);
	// Get local date parts
	const localFmt = new Intl.DateTimeFormat('en-CA', {
		timeZone: timezone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	});
	const localDate = localFmt.format(date); // "YYYY-MM-DD"
	const d = new Date(localDate + 'T12:00:00Z');
	const dayNum = d.getUTCDay() || 7;
	d.setUTCDate(d.getUTCDate() + 4 - dayNum);
	const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
	const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
	return `${d.getUTCFullYear()}-${String(week).padStart(2, '0')}`;
}

// ── Session window check ──────────────────────────────────────────────────────

function isInSessionWindow(
	localDay: string,
	localMinutes: number,
	schedule: RaidSchedule,
): { matched: boolean; sessionLabel: string } {
	for (const session of schedule.sessions) {
		if (session.day !== localDay) continue;

		const sessionStart = hmToMinutes(session.start);
		const sessionEnd = hmToMinutes(session.end);
		const grace = session.grace_minutes ?? 0;
		const effectiveStart = sessionStart - grace;
		const effectiveEnd = sessionEnd + grace;

		if (localMinutes >= effectiveStart && localMinutes <= Math.min(effectiveEnd, 24 * 60 - 1)) {
			return {
				matched: true,
				sessionLabel: `${session.day} ${session.start}–${session.end} server`,
			};
		}
	}
	return { matched: false, sessionLabel: '' };
}

// ── Safe-pug window check ─────────────────────────────────────────────────────

function isInSafePugWindow(localDay: string, localMinutes: number, schedule: RaidSchedule): boolean {
	for (const window of schedule.safe_pug_windows ?? []) {
		if (window.day !== localDay) continue;

		const winStart = hmToMinutes(window.start);
		const winEnd = hmToMinutes(window.end);

		if (winStart >= winEnd) {
			console.warn(`[lockout] Safe-pug window ${window.day} ${window.start}–${window.end} has start >= end — ignoring`);
			continue;
		}

		if (localMinutes >= winStart && localMinutes <= winEnd) {
			return true;
		}
	}
	return false;
}

// ── Exemption check ───────────────────────────────────────────────────────────

function findActiveExemption(
	killIsoWeek: string,
	exemptions: Exemption[],
	schedule: RaidSchedule,
): Exemption | null {
	const forWeek = exemptions.filter((e) => e.week === killIsoWeek);
	if (forWeek.length === 0) return null;

	// Most recent by granted_at
	const sorted = [...forWeek].sort((a, b) => b.granted_at.localeCompare(a.granted_at));
	const latest = sorted[0];

	if (!latest.raid_nights_excused || latest.raid_nights_excused.length === 0) return null;

	// Verify at least one raid night in that week matches a session day
	const sessionDays = new Set(schedule.sessions.map((s) => s.day));
	const hasMatchingNight = latest.raid_nights_excused.some((n) => sessionDays.has(n));
	if (!hasMatchingNight) return null;

	return latest;
}

// ── Main classifier ───────────────────────────────────────────────────────────

/**
 * Classify a Mythic boss kill into one of four categories.
 *
 * @param killTimeUtc  ISO 8601 UTC timestamp of the kill
 * @param schedule     RaidSchedule from roster.json (may be undefined when feature is disabled)
 * @param exemptions   Optional raider exemptions for this season
 * @param difficulty   Defaults to 'mythic'. Non-mythic difficulties return null.
 * @returns Category string, or null for non-Mythic difficulties
 */
export function classifyKill(
	killTimeUtc: string,
	schedule: RaidSchedule | undefined,
	exemptions: Exemption[] = [],
	difficulty = 'mythic',
): KillCategory | null {
	// Normal kills are never classified
	if (difficulty === 'normal') return null;

	// Feature disabled: empty or missing schedule → all kills are in_raid
	if (!schedule || schedule.sessions.length === 0) return 'in_raid';

	const { day, minutes } = toLocalDayTime(killTimeUtc, schedule.timezone);

	// 1. Check in_raid first (session window + grace)
	const sessionCheck = isInSessionWindow(day, minutes, schedule);
	if (sessionCheck.matched) return 'in_raid';

	// 2. Check safe_pug (safe-pug windows — no grace)
	if (isInSafePugWindow(day, minutes, schedule)) return 'safe_pug';

	// 3. Check exempt_pug (active exemption for this week)
	const killWeek = getIsoWeekForTimestamp(killTimeUtc, schedule.timezone);
	const exemption = findActiveExemption(killWeek, exemptions, schedule);
	if (exemption) return 'exempt_pug';

	// 4. Fallback: blocking_pug
	return 'blocking_pug';
}

