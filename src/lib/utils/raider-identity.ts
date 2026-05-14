import type { Player, Roster, Character } from '$lib/types/roster.js';

// ── ISO week / WoW reset helpers ──────────────────────────────────────────────

function isoYearWeek(date: Date): [number, number] {
	const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
	const dayNum = d.getUTCDay() || 7;
	d.setUTCDate(d.getUTCDate() + 4 - dayNum);
	const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
	const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
	return [d.getUTCFullYear(), week];
}

export function getResetStart(now: Date = new Date()): Date {
	const dayOfWeek = now.getUTCDay();
	const hourUTC = now.getUTCHours();

	let daysSinceWed = (dayOfWeek - 3 + 7) % 7;
	if (daysSinceWed === 0 && hourUTC < 7) daysSinceWed = 7;

	return new Date(
		Date.UTC(
			now.getUTCFullYear(),
			now.getUTCMonth(),
			now.getUTCDate() - daysSinceWed,
			7, 0, 0, 0,
		),
	);
}

export function getCurrentWoWWeek(now: Date = new Date()): string {
	const reset = getResetStart(now);
	const [year, week] = isoYearWeek(reset);
	return `${year}-${String(week).padStart(2, '0')}`;
}

export function dateToWoWWeek(isoDateString: string): string {
	const d = new Date(isoDateString + 'T12:00:00Z');
	return getCurrentWoWWeek(d);
}

// ── Player / character helpers ────────────────────────────────────────────────

export function getActiveCharacters(player: Player): Character[] {
	return (player.characters ?? []).filter((c) => {
		if (c.active === undefined || c.active === null) {
			console.warn(
				`[warn] Character "${c.name}" on ${player.display_name} is missing the "active" field — treating as inactive`,
			);
			return false;
		}
		return c.active === true;
	});
}

export function getEffectiveTrackingStart(player: Player, rosterTrackingStart: string): string {
	return player.tracking_start_date ?? rosterTrackingStart;
}

// ── Compliance streak computation ─────────────────────────────────────────────

export function computeCurrentStreak(weeks: Array<{ week: string; met: boolean }>): number {
	let streak = 0;
	for (const w of weeks) {
		if (w.met) streak++;
		else break;
	}
	return streak;
}

export function computeLongestStreak(weeks: Array<{ week: string; met: boolean }>): number {
	const sorted = [...weeks].sort((a, b) => a.week.localeCompare(b.week));
	let longest = 0;
	let current = 0;
	for (const w of sorted) {
		if (w.met) {
			current++;
			if (current > longest) longest = current;
		} else {
			current = 0;
		}
	}
	return longest;
}

interface WeekData {
	week: string;
	reset_start: string;
	count: number;
	total_dungeons: number;
	highest_key_level: number | null;
	met: boolean;
}

interface ComplianceEntry {
	current_streak: number;
	longest_streak: number;
	total_weeks_met: number;
	total_weeks_tracked: number;
	record_dungeons_week: { count: number; week: string } | null;
	record_highest_key: { level: number | null; week: string } | null;
	weeks: WeekData[];
}

export function upsertComplianceWeek(
	existing: ComplianceEntry | undefined,
	weekData: WeekData,
): ComplianceEntry {
	const prev: ComplianceEntry = existing ?? {
		current_streak: 0,
		longest_streak: 0,
		total_weeks_met: 0,
		total_weeks_tracked: 0,
		record_dungeons_week: null,
		record_highest_key: null,
		weeks: [],
	};

	const weeks = prev.weeks.filter((w) => w.week !== weekData.week);
	weeks.push(weekData);

	const sortedDesc = [...weeks].sort((a, b) => b.week.localeCompare(a.week));

	const total_weeks_met = weeks.filter((w) => w.met).length;
	const total_weeks_tracked = weeks.length;
	const current_streak = computeCurrentStreak(sortedDesc);
	const longest_streak = computeLongestStreak(weeks);

	const byDungeons = [...weeks].sort(
		(a, b) => b.total_dungeons - a.total_dungeons || b.week.localeCompare(a.week),
	);
	const record_dungeons_week = byDungeons[0]
		? { count: byDungeons[0].total_dungeons, week: byDungeons[0].week }
		: null;

	const withKeys = weeks.filter((w) => w.highest_key_level != null);
	const byKey = [...withKeys].sort(
		(a, b) =>
			(b.highest_key_level ?? 0) - (a.highest_key_level ?? 0) ||
			b.week.localeCompare(a.week),
	);
	const record_highest_key = byKey[0]
		? { level: byKey[0].highest_key_level, week: byKey[0].week }
		: null;

	return {
		current_streak,
		longest_streak,
		total_weeks_met,
		total_weeks_tracked,
		record_dungeons_week,
		record_highest_key,
		weeks: sortedDesc,
	};
}

// ── Changelog generation ──────────────────────────────────────────────────────

export function generateChangelogEntries(
	currentRoster: Roster,
	prevRoster: Roster | null,
	fetchedAt: string,
	currentWeek: string,
): object[] {
	if (!prevRoster) return [];

	const entries: object[] = [];
	const prevMap = new Map((prevRoster.players ?? []).map((p) => [p.raider_id, p]));

	for (const current of currentRoster.players) {
		const id = current.raider_id;
		const prev = prevMap.get(id);

		if (!prev && current.status === 'active') {
			const char = getActiveCharacters(current)[0];
			entries.push({
				id: crypto.randomUUID(),
				timestamp: fetchedAt,
				week: currentWeek,
				team: current.team_designation,
				event: 'joined',
				raider_id: id,
				display_name: current.display_name,
				character: char?.name ?? '',
				class: char?.class ?? '',
				spec: char?.spec ?? '',
				role: char?.role ?? '',
				note: latestMembershipNote(current, 'joined'),
			});
			continue;
		}

		if (!prev) continue;

		if (prev.status === 'active' && current.status === 'inactive') {
			const char = getActiveCharacters(prev)[0] ?? prev.characters?.[0];
			entries.push({
				id: crypto.randomUUID(),
				timestamp: fetchedAt,
				week: currentWeek,
				team: prev.team_designation,
				event: 'left',
				raider_id: id,
				display_name: current.display_name,
				character: char?.name ?? '',
				class: char?.class ?? '',
				spec: char?.spec ?? '',
				role: char?.role ?? '',
				note: latestMembershipNote(current, 'left') ?? '',
			});
		}

		if (prev.status === 'inactive' && current.status === 'active') {
			const char = getActiveCharacters(current)[0];
			entries.push({
				id: crypto.randomUUID(),
				timestamp: fetchedAt,
				week: currentWeek,
				team: current.team_designation,
				event: 'joined',
				raider_id: id,
				display_name: current.display_name,
				character: char?.name ?? '',
				class: char?.class ?? '',
				spec: char?.spec ?? '',
				role: char?.role ?? '',
				note: latestMembershipNote(current, 'joined') ?? '',
			});
		}

		if (prev.team_designation !== current.team_designation) {
			const teamEvent = latestMembershipEvent(current, 'team_changed');
			if (!teamEvent) {
				console.warn(
					`[warn] team_designation changed for ${current.display_name} without a corresponding team_changed event in membership_history`,
				);
			}
			const reason = (teamEvent as { reason?: string })?.reason;
			if (!reason) {
				console.warn(
					`[warn] team_changed event for ${current.display_name} is missing a reason — recording "(no reason given)"`,
				);
			}
			const char = getActiveCharacters(current)[0];
			entries.push({
				id: crypto.randomUUID(),
				timestamp: fetchedAt,
				week: currentWeek,
				team: current.team_designation,
				event: 'team_changed',
				raider_id: id,
				display_name: current.display_name,
				character: char?.name ?? '',
				from: prev.team_designation,
				to: current.team_designation,
				reason: reason || '(no reason given)',
			});
		}

		if (current.status !== 'active') continue;

		const prevActiveNames = new Set(
			(prev.characters ?? []).filter((c) => c.active).map((c) => c.name),
		);
		const currActiveNames = new Set(getActiveCharacters(current).map((c) => c.name));
		const deactivated = [...prevActiveNames].filter((n) => !currActiveNames.has(n));
		const activated = [...currActiveNames].filter((n) => !prevActiveNames.has(n));

		if (activated.length > 0 && deactivated.length > 0) {
			for (const newName of activated) {
				const oldName = deactivated[0];
				const oldChar = prev.characters.find((c) => c.name === oldName);
				const newChar = current.characters.find((c) => c.name === newName);
				if (oldChar && newChar) {
					entries.push({
						id: crypto.randomUUID(),
						timestamp: fetchedAt,
						week: currentWeek,
						team: current.team_designation,
						event: 'rerolled',
						raider_id: id,
						display_name: current.display_name,
						from_character: oldChar.name,
						from_class: oldChar.class,
						from_spec: oldChar.spec,
						to_character: newChar.name,
						to_class: newChar.class,
						to_spec: newChar.spec,
						role: newChar.role,
						note: '',
					});
				}
			}
			continue;
		}

		for (const currChar of getActiveCharacters(current)) {
			const prevChar = (prev.characters ?? []).find((c) => c.name === currChar.name && c.active);
			if (!prevChar) continue;

			if (prevChar.role !== currChar.role) {
				entries.push({
					id: crypto.randomUUID(),
					timestamp: fetchedAt,
					week: currentWeek,
					team: current.team_designation,
					event: 'role_changed',
					raider_id: id,
					display_name: current.display_name,
					character: currChar.name,
					from_spec: prevChar.spec,
					from_role: prevChar.role,
					to_spec: currChar.spec,
					to_role: currChar.role,
					note: '',
				});
			} else if (prevChar.spec !== currChar.spec) {
				entries.push({
					id: crypto.randomUUID(),
					timestamp: fetchedAt,
					week: currentWeek,
					team: current.team_designation,
					event: 'spec_changed',
					raider_id: id,
					display_name: current.display_name,
					character: currChar.name,
					from_spec: prevChar.spec,
					to_spec: currChar.spec,
					note: '',
				});
			}
		}
	}

	return entries;
}

// ── Raider history ────────────────────────────────────────────────────────────

export function buildRaiderHistory(roster: Roster, now: Date): object {
	const raiders: Record<string, object> = {};

	for (const player of roster.players) {
		const chars = (player.characters ?? []).map((c) => {
			const roleEntry = (player.role_history ?? []).find((rh) => rh.character === c.name);
			return {
				name: c.name,
				realm: c.realm,
				class: c.class,
				spec: c.spec,
				role: c.role,
				active: c.active === true,
				first_seen: roleEntry?.from ?? roster.tracking_start_date,
				...(c.active === true ? {} : { last_seen: roleEntry?.to ?? undefined }),
			};
		});

		raiders[player.raider_id] = {
			display_name: player.display_name,
			team_designation: player.team_designation,
			membership_history: player.membership_history ?? [],
			characters: chars,
			role_history: player.role_history ?? [],
		};
	}

	return { last_updated: now.toISOString(), raiders };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function latestMembershipNote(player: Player, eventType: string): string {
	const events = (player.membership_history ?? []).filter((e) => e.event === eventType);
	return (events.at(-1) as { note?: string })?.note ?? '';
}

function latestMembershipEvent(player: Player, eventType: string): object | null {
	const events = (player.membership_history ?? []).filter((e) => e.event === eventType);
	return events.at(-1) ?? null;
}

// ── Additional query exports ──────────────────────────────────────────────────

export function getCurrentRole(player: Player) {
	return (player.role_history ?? []).find((r) => r.to === null) ?? null;
}

export function getRoleAtDate(player: Player, isoDate: string) {
	return (
		(player.role_history ?? []).find(
			(r) => r.from <= isoDate && (r.to === null || r.to >= isoDate),
		) ?? null
	);
}

export function getCharacterAtDate(player: Player, isoDate: string): string | null {
	const entry = getRoleAtDate(player, isoDate);
	return entry?.character ?? null;
}

export function buildRoleSummary(player: Player) {
	return [...(player.role_history ?? [])].sort((a, b) => a.from.localeCompare(b.from));
}

export function mergeComplianceAcrossCharacters(
	weekRuns: Array<{
		mplus_weekly_count_at_or_above_minimum: number;
		mplus_total_dungeons_this_week: number;
	}>,
) {
	return {
		count: weekRuns.reduce((s, r) => s + (r.mplus_weekly_count_at_or_above_minimum ?? 0), 0),
		total_dungeons: weekRuns.reduce((s, r) => s + (r.mplus_total_dungeons_this_week ?? 0), 0),
	};
}

export function getMembershipStatus(player: Player): 'active' | 'inactive' {
	const history = player.membership_history ?? [];
	if (history.length === 0) return 'active';
	const last = history[history.length - 1];
	if (last.event === 'joined') return 'active';
	if (last.event === 'left') return 'inactive';
	return player.status ?? 'active';
}

interface TimelineEvent {
	date: string;
	type: string;
	description: string;
	note?: string;
}

export function buildMergedTimeline(player: Player): TimelineEvent[] {
	const events: TimelineEvent[] = [];

	for (const e of player.membership_history ?? []) {
		if (e.event === 'joined')
			events.push({ date: e.date, type: 'joined', description: 'Joined Relentless', note: (e as { note?: string }).note });
		else if (e.event === 'left')
			events.push({ date: e.date, type: 'left', description: 'Left team', note: (e as { note?: string }).note });
		else if (e.event === 'team_changed')
			events.push({
				date: e.date,
				type: 'team_changed',
				description: `Moved from ${(e as { from: string }).from} → ${(e as { to: string }).to} team`,
				note: (e as { reason: string }).reason,
			});
	}

	const roleHistory = buildRoleSummary(player);
	for (let i = 1; i < roleHistory.length; i++) {
		const cur = roleHistory[i];
		const prev = roleHistory[i - 1];
		if (cur.character !== prev.character || cur.class !== prev.class) {
			events.push({
				date: cur.from,
				type: 'rerolled',
				description: `Rerolled: ${prev.spec} ${prev.class} → ${cur.spec} ${cur.class}`,
			});
		} else if (cur.spec !== prev.spec || cur.role !== prev.role) {
			events.push({ date: cur.from, type: 'spec_changed', description: `Spec change: ${prev.spec} → ${cur.spec}` });
		}
	}

	events.sort((a, b) => a.date.localeCompare(b.date));

	if (events.length <= 1 && events[0]?.type === 'joined') return [];
	return events;
}

export function getDesignationForSeason(player: Player, seasonId: string) {
	const history = (player as unknown as { designation_history?: Array<{ season_id: string; designation: string }> })
		.designation_history ?? [];
	const entry = history.find((h) => h.season_id === seasonId);
	return entry?.designation ?? player.team_designation;
}
