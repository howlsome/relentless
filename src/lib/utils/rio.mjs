/**
 * Raider.io REST API v1 helpers.
 *
 * Key behaviours:
 *  - No documented rate limit for the profile endpoint; still limits concurrency to 5.
 *  - Returns null on 404 (character not found) — caller writes error: 'rio_not_found'.
 *  - URL-encodes character names (handles accented EU names).
 */

const RIO_BASE = 'https://raider.io/api/v1';

const RIO_FIELDS = [
	'mythic_plus_scores_by_season:current',
	'mythic_plus_weekly_highest_level_runs',
	'mythic_plus_best_runs',
	'mythic_plus_recent_runs'
].join(',');

const MAX_CONCURRENT = 5;

/** @param {number} ms */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Core fetch ────────────────────────────────────────────────────────────────

/**
 * Fetch a single character's Raider.io profile.
 * Returns null if the character is not found (HTTP 404).
 * Throws on other HTTP errors.
 *
 * @param {string} region
 * @param {string} realm
 * @param {string} name
 * @param {string} [fields]
 * @returns {Promise<object|null>}
 */
export async function getRioProfile(region, realm, name, fields = RIO_FIELDS) {
	const params = new URLSearchParams({ region, realm, name, fields });
	const url = `${RIO_BASE}/characters/profile?${params}`;

	const resp = await fetch(url);
	if (resp.status === 404) return null;
	if (!resp.ok) {
		throw new Error(`Raider.io request failed (${resp.status}) for ${name}-${realm}: ${await resp.text().catch(() => '')}`);
	}
	return resp.json();
}

// ── Batched fetch ─────────────────────────────────────────────────────────────

/**
 * Fetch Raider.io profiles for all {player, char} items, up to MAX_CONCURRENT in parallel.
 * Returns a Map from raider_id to array of {char, profile, error} objects.
 *
 * @param {Array<{player: object, char: object}>} items
 * @param {string} defaultRegion  Fallback region (e.g. 'eu').
 * @returns {Promise<Map<string, object[]>>}
 */
export async function fetchRioBatch(items, defaultRegion = 'eu') {
	/** @type {Map<string, object[]>} raider_id → [{char, profile, error}] */
	const results = new Map();

	// Process in groups of MAX_CONCURRENT using Promise.allSettled
	for (let i = 0; i < items.length; i += MAX_CONCURRENT) {
		const chunk = items.slice(i, i + MAX_CONCURRENT);

		const settled = await Promise.allSettled(
			chunk.map(({ player, char }) =>
				fetchRioForChar(player, char, defaultRegion)
			)
		);

		for (let j = 0; j < chunk.length; j++) {
			const { player, char } = chunk[j];
			const rid = player.raider_id;
			if (!results.has(rid)) results.set(rid, []);

			const outcome = settled[j];
			if (outcome.status === 'fulfilled') {
				results.get(rid).push(outcome.value);
			} else {
				console.warn(`[rio] Error fetching ${char.name}-${char.realm}: ${outcome.reason?.message ?? outcome.reason}`);
				results.get(rid).push({ char, profile: null, error: 'rio_error' });
			}
		}
	}

	return results;
}

// ── Internal ──────────────────────────────────────────────────────────────────

/**
 * Fetch Raider.io data for a single character.
 * @param {object} player
 * @param {object} char
 * @param {string} defaultRegion
 * @returns {Promise<{char: object, profile: object|null, error: string|null}>}
 */
async function fetchRioForChar(player, char, defaultRegion) {
	const region = player.region ?? defaultRegion;
	const realm = char.realm.toLowerCase().replace(/\s+/g, '-').replace(/'/g, '');

	try {
		const profile = await getRioProfile(region, realm, char.name);
		if (profile === null) {
			console.warn(`[rio] Not found: ${char.name}-${char.realm} (${region})`);
			return { char, profile: null, error: 'rio_not_found' };
		}
		return { char, profile, error: null };
	} catch (err) {
		throw err; // let Promise.allSettled handle it
	}
}

// ── Data extractors ───────────────────────────────────────────────────────────

/**
 * Extract the current overall Raider.io score from a profile.
 * @param {object|null} profile
 * @returns {number|null}
 */
export function extractRioScore(profile) {
	if (!profile) return null;
	const season = (profile.mythic_plus_scores_by_season ?? [])[0];
	return season?.scores?.all ?? null;
}

/**
 * Extract the weekly highest-level runs from a profile.
 * Each entry: {dungeon, mythic_level, timed, completed_at, ...}
 * @param {object|null} profile
 * @returns {object[]}
 */
export function extractWeeklyHighestRuns(profile) {
	return profile?.mythic_plus_weekly_highest_level_runs ?? [];
}

/**
 * Extract all-time best runs (for Resilience computation).
 * Each entry: {dungeon, mythic_level, timed, ...}
 * @param {object|null} profile
 * @returns {object[]}
 */
export function extractBestRuns(profile) {
	return profile?.mythic_plus_best_runs ?? [];
}

/**
 * Count recent runs that completed at or after resetStart.
 * Uses mythic_plus_recent_runs, filtered to the current week.
 * @param {object|null} profile
 * @param {Date} resetStart
 * @returns {number}
 */
export function countTotalDungeonsThisWeek(profile, resetStart) {
	const runs = profile?.mythic_plus_recent_runs ?? [];
	return runs.filter((r) => {
		const completedAt = new Date(r.completed_at);
		return completedAt >= resetStart;
	}).length;
}

/**
 * Count qualifying runs (at or above the key level minimum) this week.
 * Uses mythic_plus_weekly_highest_level_runs (best per dungeon this week).
 * @param {object[]} weeklyRuns
 * @param {number} minKeyLevel
 * @returns {number}
 */
export function countQualifyingRuns(weeklyRuns, minKeyLevel) {
	return weeklyRuns.filter((r) => r.mythic_level >= minKeyLevel).length;
}

/**
 * Find the highest key level completed this week.
 * @param {object[]} weeklyRuns
 * @returns {number|null}
 */
export function highestKeyThisWeek(weeklyRuns) {
	if (!weeklyRuns.length) return null;
	return Math.max(...weeklyRuns.map((r) => r.mythic_level));
}

/**
 * Count all runs regardless of key level.
 * @param {object[]} runs
 * @returns {number}
 */
export function countAllRuns(runs) {
	return (runs ?? []).length;
}

/**
 * Alias: count runs at or above minimum. Same as countQualifyingRuns — exported under spec name.
 * @param {object[]} runs
 * @param {number} minLevel
 * @returns {number}
 */
export function countWeeklyRuns(runs, minLevel) {
	return countQualifyingRuns(runs, minLevel);
}

/**
 * Return the week-on-week delta for a given field between two compliance week entries.
 * @param {{[key: string]: any}|null} currentWeek
 * @param {{[key: string]: any}|null} previousWeek
 * @param {string} field  e.g. 'total_dungeons' or 'highest_key_level'
 * @returns {number|null}
 */
export function getWeekOnWeekDelta(currentWeek, previousWeek, field) {
	if (!currentWeek || !previousWeek) return null;
	const cur = currentWeek[field];
	const prev = previousWeek[field];
	if (cur == null || prev == null) return null;
	return cur - prev;
}
