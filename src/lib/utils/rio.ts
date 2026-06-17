const RIO_BASE = 'https://raider.io/api/v1';

const RIO_FIELDS = [
	'mythic_plus_scores_by_season:current',
	'mythic_plus_weekly_highest_level_runs',
	'mythic_plus_best_runs',
	'mythic_plus_recent_runs',
].join(',');

const MAX_CONCURRENT = 5;
const RIO_RETRY_DELAY_MS = 15_000;
const RIO_INTER_BATCH_DELAY_MS = 1_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function getRioProfile(
	region: string,
	realm: string,
	name: string,
	fields = RIO_FIELDS,
	attempt = 0,
): Promise<object | null> {
	const params = new URLSearchParams({ region, realm, name, fields });
	const url = `${RIO_BASE}/characters/profile?${params}`;

	const resp = await fetch(url);
	if (resp.status === 404) return null;
	if (resp.status === 429) {
		if (attempt < 2) {
			console.warn(
				`[rio] 429 rate-limited for ${name}-${realm} — waiting ${RIO_RETRY_DELAY_MS / 1000}s then retrying`,
			);
			await sleep(RIO_RETRY_DELAY_MS);
			return getRioProfile(region, realm, name, fields, attempt + 1);
		}
		throw new Error(`Raider.io rate limit exceeded after retries for ${name}-${realm}`);
	}
	if (!resp.ok) {
		throw new Error(
			`Raider.io request failed (${resp.status}) for ${name}-${realm}: ${await resp.text().catch(() => '')}`,
		);
	}
	return resp.json();
}

interface PlayerLike {
	raider_id: string;
	display_name?: string;
	region?: string;
}
interface CharLike {
	name: string;
	realm: string;
}

interface RioResult {
	char: CharLike;
	profile: object | null;
	error: string | null;
}

export async function fetchRioBatch(
	items: Array<{ player: PlayerLike; char: CharLike }>,
	defaultRegion = 'eu',
): Promise<Map<string, RioResult[]>> {
	const results = new Map<string, RioResult[]>();

	for (let i = 0; i < items.length; i += MAX_CONCURRENT) {
		if (i > 0) await sleep(RIO_INTER_BATCH_DELAY_MS);
		const chunk = items.slice(i, i + MAX_CONCURRENT);

		const settled = await Promise.allSettled(
			chunk.map(({ player, char }) => fetchRioForChar(player, char, defaultRegion)),
		);

		for (let j = 0; j < chunk.length; j++) {
			const { player, char } = chunk[j];
			const rid = player.raider_id;
			if (!results.has(rid)) results.set(rid, []);

			const outcome = settled[j];
			if (outcome.status === 'fulfilled') {
				results.get(rid)?.push(outcome.value);
			} else {
				const reason = outcome.reason as Error;
				console.warn(`[rio] Error fetching ${char.name}-${char.realm}: ${reason?.message ?? reason}`);
				results.get(rid)?.push({ char, profile: null, error: 'rio_error' });
			}
		}
	}

	return results;
}

async function fetchRioForChar(
	player: PlayerLike,
	char: CharLike,
	defaultRegion: string,
): Promise<RioResult> {
	const region = player.region ?? defaultRegion;
	const realm = char.realm.toLowerCase().replace(/\s+/g, '-').replace(/'/g, '');

	const profile = await getRioProfile(region, realm, char.name);
	if (profile === null) {
		console.warn(`[rio] Not found: ${char.name}-${char.realm} (${region})`);
		return { char, profile: null, error: 'rio_not_found' };
	}
	return { char, profile, error: null };
}

// ── Data extractors ───────────────────────────────────────────────────────────

type RioProfile = Record<string, unknown>;

export interface MplusRun {
	dungeon: string;
	mythic_level: number;
	num_keystone_upgrades: number;
	completed_at: string;
	keystone_run_id: number | null;
}

export function extractRioScore(profile: RioProfile | null): number | null {
	if (!profile) return null;
	const season = ((profile.mythic_plus_scores_by_season as Array<{ scores: { all: number } }>) ??
		[])[0];
	return season?.scores?.all ?? null;
}

/**
 * Merges mythic_plus_weekly_highest_level_runs (top 10 by level) and
 * mythic_plus_recent_runs (most recent 10 globally), deduplicates by
 * keystone_run_id, and filters to the current WoW reset window.
 *
 * Raider.io caps each field at 10 entries. Merging both fields gives up to
 * ~20 unique runs, improving accuracy for raiders who complete more than 10
 * keys per week.
 */
export function mergeWeeklyRuns(profile: RioProfile | null, resetStart: Date): MplusRun[] {
	if (!profile) return [];
	const weekly = (profile.mythic_plus_weekly_highest_level_runs as MplusRun[]) ?? [];
	const recent = (profile.mythic_plus_recent_runs as MplusRun[]) ?? [];

	console.log(
		`[rio] Raw weekly runs: ${weekly.length}, recent runs: ${recent.length}, resetStart: ${resetStart.toISOString()}`,
	);
	for (const r of [...weekly, ...recent]) {
		const afterReset = new Date(r.completed_at) >= resetStart;
		console.log(
			`[rio]   ${r.dungeon} +${r.mythic_level} at ${r.completed_at} (id=${r.keystone_run_id}, afterReset=${afterReset})`,
		);
	}

	const seen = new Set<number>();
	const merged: MplusRun[] = [];

	for (const run of [...weekly, ...recent]) {
		if (new Date(run.completed_at) < resetStart) continue;
		const id = run.keystone_run_id;
		if (id != null) {
			if (seen.has(id)) continue;
			seen.add(id);
		}
		merged.push(run);
	}

	console.log(`[rio] Merged result: ${merged.length} runs after dedup + reset filter`);
	return merged;
}

export function countQualifyingRuns(
	weeklyRuns: Array<{ mythic_level: number }>,
	minKeyLevel: number,
): number {
	return weeklyRuns.filter((r) => r.mythic_level >= minKeyLevel).length;
}

export function highestKeyThisWeek(weeklyRuns: Array<{ mythic_level: number }>): number | null {
	if (!weeklyRuns.length) return null;
	return Math.max(...weeklyRuns.map((r) => r.mythic_level));
}
