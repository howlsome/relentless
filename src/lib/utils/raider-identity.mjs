/**
 * Raider identity helpers:
 *  - EU WoW reset week computation
 *  - Active character resolution
 *  - Effective tracking start date
 *  - Compliance streak computation
 *  - Changelog generation (roster diff)
 *  - Raider history building
 */

// ── ISO week / WoW reset helpers ──────────────────────────────────────────────

/**
 * Return the ISO 8601 [year, weekNumber] for a given UTC date.
 * @param {Date} date
 * @returns {[number, number]}
 */
function isoYearWeek(date) {
	const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
	const dayNum = d.getUTCDay() || 7; // Sunday = 7
	d.setUTCDate(d.getUTCDate() + 4 - dayNum); // Move to Thursday of this week
	const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
	const week = Math.ceil(((d - yearStart) / 86_400_000 + 1) / 7);
	return [d.getUTCFullYear(), week];
}

/**
 * Return the Date of the start of the current EU WoW weekly reset.
 * EU reset: Wednesday 07:00 UTC.
 * @param {Date} [now]
 * @returns {Date}
 */
export function getResetStart(now = new Date()) {
	const dayOfWeek = now.getUTCDay(); // 0=Sun, 3=Wed
	const hourUTC = now.getUTCHours();

	// Days back to the most recent Wednesday at/after 07:00 UTC
	let daysSinceWed = (dayOfWeek - 3 + 7) % 7;
	if (daysSinceWed === 0 && hourUTC < 7) daysSinceWed = 7; // Before reset on Wednesday

	return new Date(
		Date.UTC(
			now.getUTCFullYear(),
			now.getUTCMonth(),
			now.getUTCDate() - daysSinceWed,
			7, 0, 0, 0
		)
	);
}

/**
 * Return the ISO week string ("YYYY-WW") for the current WoW EU weekly reset.
 * @param {Date} [now]
 * @returns {string}
 */
export function getCurrentWoWWeek(now = new Date()) {
	const reset = getResetStart(now);
	const [year, week] = isoYearWeek(reset);
	return `${year}-${String(week).padStart(2, '0')}`;
}

/**
 * Return the reset-week string for any arbitrary date (used for tracking_start_date).
 * @param {string} isoDateString  e.g. "2026-03-17"
 * @returns {string}  e.g. "2026-11"
 */
export function dateToWoWWeek(isoDateString) {
	const d = new Date(isoDateString + 'T12:00:00Z');
	return getCurrentWoWWeek(d);
}

// ── Player / character helpers ────────────────────────────────────────────────

/**
 * Return the characters with active === true for a player.
 * Characters with missing or false active field are excluded.
 * Logs a warning for characters missing the active field.
 *
 * @param {import('$lib/types').Player} player
 * @returns {import('$lib/types').Character[]}
 */
export function getActiveCharacters(player) {
	return (player.characters ?? []).filter((c) => {
		if (c.active === undefined || c.active === null) {
			console.warn(
				`[warn] Character "${c.name}" on ${player.display_name} is missing the "active" field — treating as inactive`
			);
			return false;
		}
		return c.active === true;
	});
}

/**
 * Return the effective tracking start date for a player.
 * Uses the per-player date if set; falls back to the roster top-level date.
 *
 * @param {import('$lib/types').Player} player
 * @param {string} rosterTrackingStart
 * @returns {string}
 */
export function getEffectiveTrackingStart(player, rosterTrackingStart) {
	return player.tracking_start_date ?? rosterTrackingStart;
}

// ── Compliance streak computation ─────────────────────────────────────────────

/**
 * Compute current_streak from a sorted (latest-first) weeks array.
 * Missing weeks (cron errors) are transparent — they don't break streaks.
 * A met:false week breaks the streak.
 *
 * @param {Array<{week: string, met: boolean}>} weeks  Sorted latest-first.
 * @returns {number}
 */
export function computeCurrentStreak(weeks) {
	let streak = 0;
	for (const w of weeks) {
		if (w.met) streak++;
		else break;
	}
	return streak;
}

/**
 * Compute longest_streak from the full weeks array (any order).
 * Missing weeks are transparent.
 *
 * @param {Array<{week: string, met: boolean}>} weeks
 * @returns {number}
 */
export function computeLongestStreak(weeks) {
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

/**
 * Upsert the current week's compliance entry for a raider and recompute
 * all aggregate fields. Returns the updated per-raider compliance object.
 *
 * @param {object|undefined} existing  Current per-raider compliance object.
 * @param {{
 *   week: string,
 *   reset_start: string,
 *   count: number,
 *   total_dungeons: number,
 *   highest_key_level: number|null,
 *   met: boolean
 * }} weekData
 * @param {number|null} resilienceLevel
 * @returns {object}
 */
export function upsertComplianceWeek(existing, weekData, resilienceLevel) {
	const prev = existing ?? {
		current_streak: 0,
		longest_streak: 0,
		total_weeks_met: 0,
		total_weeks_tracked: 0,
		record_dungeons_week: null,
		record_highest_key: null,
		resilience_level: null,
		resilience_history: [],
		weeks: []
	};

	// Upsert this week (replace if exists, else append)
	const weeks = prev.weeks.filter((w) => w.week !== weekData.week);
	weeks.push(weekData);

	// Sort latest-first for streak computation
	const sortedDesc = [...weeks].sort((a, b) => b.week.localeCompare(a.week));

	// Aggregates
	const total_weeks_met = weeks.filter((w) => w.met).length;
	const total_weeks_tracked = weeks.length;
	const current_streak = computeCurrentStreak(sortedDesc);
	const longest_streak = computeLongestStreak(weeks);

	// Record dungeons week (highest total_dungeons; latest wins tie)
	const byDungeons = [...weeks].sort(
		(a, b) => b.total_dungeons - a.total_dungeons || b.week.localeCompare(a.week)
	);
	const record_dungeons_week = byDungeons[0]
		? { count: byDungeons[0].total_dungeons, week: byDungeons[0].week }
		: null;

	// Record highest key (latest wins tie)
	const withKeys = weeks.filter((w) => w.highest_key_level != null);
	const byKey = [...withKeys].sort(
		(a, b) =>
			(b.highest_key_level ?? 0) - (a.highest_key_level ?? 0) ||
			b.week.localeCompare(a.week)
	);
	const record_highest_key = byKey[0]
		? { level: byKey[0].highest_key_level, week: byKey[0].week }
		: null;

	// Resilience: append to history if level increased
	let resilience_history = [...(prev.resilience_history ?? [])];
	const prevResilienceLevel = prev.resilience_level ?? null;
	if (
		resilienceLevel != null &&
		(prevResilienceLevel == null || resilienceLevel > prevResilienceLevel)
	) {
		resilience_history.push({ level: resilienceLevel, achieved_week: weekData.week });
	}

	return {
		current_streak,
		longest_streak,
		total_weeks_met,
		total_weeks_tracked,
		record_dungeons_week,
		record_highest_key,
		resilience_level: resilienceLevel ?? prevResilienceLevel,
		resilience_history,
		weeks: sortedDesc // store latest-first
	};
}

// ── Changelog generation ──────────────────────────────────────────────────────

/**
 * Diff currentRoster against prevRoster and generate changelog entries.
 *
 * @param {import('$lib/types').Roster} currentRoster
 * @param {import('$lib/types').Roster|null} prevRoster
 * @param {string} fetchedAt  ISO timestamp
 * @param {string} currentWeek  "YYYY-WW"
 * @returns {object[]}
 */
export function generateChangelogEntries(currentRoster, prevRoster, fetchedAt, currentWeek) {
	if (!prevRoster) return [];

	const entries = [];
	const prevMap = new Map((prevRoster.players ?? []).map((p) => [p.raider_id, p]));

	for (const current of currentRoster.players) {
		const id = current.raider_id;
		const prev = prevMap.get(id);

		// ── New raider (joined) ──────────────────────────────────────────────────
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
				note: latestMembershipNote(current, 'joined')
			});
			continue;
		}

		if (!prev) continue;

		// ── Left (active → inactive) ─────────────────────────────────────────────
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
				note: latestMembershipNote(current, 'left') ?? ''
			});
		}

		// ── Rejoined (inactive → active) ─────────────────────────────────────────
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
				note: latestMembershipNote(current, 'joined') ?? ''
			});
		}

		// ── Team designation changed ──────────────────────────────────────────────
		if (prev.team_designation !== current.team_designation) {
			const teamEvent = latestMembershipEvent(current, 'team_changed');
			if (!teamEvent) {
				console.warn(
					`[warn] team_designation changed for ${current.display_name} without a corresponding team_changed event in membership_history`
				);
			}
			const reason = teamEvent?.reason;
			if (!reason) {
				console.warn(
					`[warn] team_changed event for ${current.display_name} is missing a reason — recording "(no reason given)"`
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
				reason: reason || '(no reason given)'
			});
		}

		if (current.status !== 'active') continue;

		// ── Character reroll ──────────────────────────────────────────────────────
		const prevActiveNames = new Set((prev.characters ?? []).filter((c) => c.active).map((c) => c.name));
		const currActiveNames = new Set(getActiveCharacters(current).map((c) => c.name));
		const deactivated = [...prevActiveNames].filter((n) => !currActiveNames.has(n));
		const activated = [...currActiveNames].filter((n) => !prevActiveNames.has(n));

		if (activated.length > 0 && deactivated.length > 0) {
			for (const newName of activated) {
				const oldName = deactivated[0]; // pair first deactivated with first activated
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
						note: ''
					});
				}
			}
			continue; // reroll supersedes spec/role change detection
		}

		// ── Spec or role change on the same active character ──────────────────────
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
					note: ''
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
					note: ''
				});
			}
		}
	}

	return entries;
}

// ── Raider history ────────────────────────────────────────────────────────────

/**
 * Build a fresh raider-history.json structure from the current roster.
 * The caller is responsible for writing the result to disk.
 *
 * @param {import('$lib/types').Roster} roster
 * @param {Date} now
 * @returns {object}
 */
export function buildRaiderHistory(roster, now) {
	/** @type {Record<string, object>} */
	const raiders = {};

	for (const player of roster.players) {
		const chars = (player.characters ?? []).map((c) => {
			const roleEntry = (player.role_history ?? []).find(
				(rh) => rh.character === c.name
			);
			return {
				name: c.name,
				realm: c.realm,
				class: c.class,
				spec: c.spec,
				role: c.role,
				active: c.active === true,
				first_seen: roleEntry?.from ?? roster.tracking_start_date,
				...(c.active === true ? {} : { last_seen: roleEntry?.to ?? undefined })
			};
		});

		raiders[player.raider_id] = {
			display_name: player.display_name,
			team_designation: player.team_designation,
			membership_history: player.membership_history ?? [],
			characters: chars,
			role_history: player.role_history ?? []
		};
	}

	return { last_updated: now.toISOString(), raiders };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** @param {import('$lib/types').Player} player  @param {string} eventType */
function latestMembershipNote(player, eventType) {
	const events = (player.membership_history ?? []).filter((e) => e.event === eventType);
	return events.at(-1)?.note ?? '';
}

/** @param {import('$lib/types').Player} player  @param {string} eventType */
function latestMembershipEvent(player, eventType) {
	const events = (player.membership_history ?? []).filter((e) => e.event === eventType);
	return events.at(-1) ?? null;
}

// ── Additional query exports ───────────────────────────────────────────────────

/**
 * Get the currently active role_history entry (where to === null).
 * @param {import('$lib/types').Player} player
 */
export function getCurrentRole(player) {
	return (player.role_history ?? []).find((r) => r.to === null) ?? null;
}

/**
 * Get the role_history entry active at a given ISO date string.
 * @param {import('$lib/types').Player} player
 * @param {string} isoDate
 */
export function getRoleAtDate(player, isoDate) {
	return (
		(player.role_history ?? []).find(
			(r) => r.from <= isoDate && (r.to === null || r.to >= isoDate)
		) ?? null
	);
}

/**
 * Get the character name active at a given ISO date string.
 * @param {import('$lib/types').Player} player
 * @param {string} isoDate
 */
export function getCharacterAtDate(player, isoDate) {
	const entry = getRoleAtDate(player, isoDate);
	return entry?.character ?? null;
}

/**
 * Return all role_history entries sorted oldest-first.
 * @param {import('$lib/types').Player} player
 */
export function buildRoleSummary(player) {
	return [...(player.role_history ?? [])].sort((a, b) => a.from.localeCompare(b.from));
}

/**
 * Merge M+ runs from multiple active characters in a single week.
 * Returns combined count of qualifying runs and total dungeons.
 * @param {Array<{mplus_weekly_count_at_or_above_minimum: number, mplus_total_dungeons_this_week: number}>} weekRuns
 */
export function mergeComplianceAcrossCharacters(weekRuns) {
	return {
		count: weekRuns.reduce((s, r) => s + (r.mplus_weekly_count_at_or_above_minimum ?? 0), 0),
		total_dungeons: weekRuns.reduce((s, r) => s + (r.mplus_total_dungeons_this_week ?? 0), 0)
	};
}

/**
 * Derive the raider's current membership status from their membership_history.
 * Returns 'active' when the last event is 'joined'; 'inactive' when 'left'.
 * @param {import('$lib/types').Player} player
 */
export function getMembershipStatus(player) {
	const history = player.membership_history ?? [];
	if (history.length === 0) return 'active';
	const last = history[history.length - 1];
	if (last.event === 'joined') return 'active';
	if (last.event === 'left') return 'inactive';
	return player.status ?? 'active';
}

/**
 * Build a merged chronological timeline of all notable events for a raider.
 * Returns [] when the raider has only a single join event.
 * @param {import('$lib/types').Player} player
 * @returns {Array<{date: string, type: string, description: string, note?: string}>}
 */
export function buildMergedTimeline(player) {
	const events = [];

	for (const e of player.membership_history ?? []) {
		if (e.event === 'joined') events.push({ date: e.date, type: 'joined', description: 'Joined Relentless', note: e.note });
		else if (e.event === 'left') events.push({ date: e.date, type: 'left', description: 'Left team', note: e.note });
		else if (e.event === 'team_changed') events.push({ date: e.date, type: 'team_changed', description: `Moved from ${e.from} → ${e.to} team`, note: e.reason });
	}

	const roleHistory = buildRoleSummary(player);
	for (let i = 1; i < roleHistory.length; i++) {
		const cur = roleHistory[i];
		const prev = roleHistory[i - 1];
		if (cur.character !== prev.character || cur.class !== prev.class) {
			events.push({ date: cur.from, type: 'rerolled', description: `Rerolled: ${prev.spec} ${prev.class} → ${cur.spec} ${cur.class}` });
		} else if (cur.spec !== prev.spec || cur.role !== prev.role) {
			events.push({ date: cur.from, type: 'spec_changed', description: `Spec change: ${prev.spec} → ${cur.spec}` });
		}
	}

	events.sort((a, b) => a.date.localeCompare(b.date));

	// Hide timeline when only a single join event exists
	if (events.length <= 1 && events[0]?.type === 'joined') return [];
	return events;
}

/**
 * Get the team designation for a specific season from designation_history.
 * Falls back to current team_designation when no history entry exists.
 * @param {import('$lib/types').Player} player
 * @param {string} seasonId
 */
export function getDesignationForSeason(player, seasonId) {
	const history = player.designation_history ?? [];
	const entry = history.find((h) => h.season_id === seasonId);
	return entry?.designation ?? player.team_designation;
}
