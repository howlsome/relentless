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
			console.warn(`[rio] 429 rate-limited for ${name}-${realm} — waiting ${RIO_RETRY_DELAY_MS / 1000}s then retrying`);
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
				results.get(rid)!.push(outcome.value);
			} else {
				const reason = outcome.reason as Error;
				console.warn(`[rio] Error fetching ${char.name}-${char.realm}: ${reason?.message ?? reason}`);
				results.get(rid)!.push({ char, profile: null, error: 'rio_error' });
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

export function extractRioScore(profile: RioProfile | null): number | null {
	if (!profile) return null;
	const season = (profile.mythic_plus_scores_by_season as Array<{ scores: { all: number } }> ?? [])[0];
	return season?.scores?.all ?? null;
}

export function extractWeeklyHighestRuns(profile: RioProfile | null): object[] {
	return (profile?.mythic_plus_weekly_highest_level_runs as object[]) ?? [];
}

export function countTotalDungeonsThisWeek(
	profile: RioProfile | null,
	resetStart: Date,
): number {
	const runs = (profile?.mythic_plus_recent_runs as Array<{ completed_at: string }>) ?? [];
	return runs.filter((r) => new Date(r.completed_at) >= resetStart).length;
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

