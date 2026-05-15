const WCL_API_URL = 'https://www.warcraftlogs.com/api/v2/client';
const WCL_TOKEN_URL = 'https://www.warcraftlogs.com/oauth/token';

export const DIFFICULTY_IDS: Record<string, number> = { heroic: 4, mythic: 5 };

const BATCH_SIZE = 10;
const INTER_BATCH_DELAY_MS = 2_000;
const RETRY_DELAY_MS = 15_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Token ─────────────────────────────────────────────────────────────────────

export async function getWclToken(clientId: string, clientSecret: string): Promise<string> {
	const resp = await fetch(WCL_TOKEN_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			grant_type: 'client_credentials',
			client_id: clientId,
			client_secret: clientSecret,
		}),
	});
	if (!resp.ok) {
		const text = await resp.text().catch(() => '');
		throw new Error(`WCL token request failed (${resp.status}): ${text}`);
	}
	const json = (await resp.json()) as { access_token: string };
	return json.access_token;
}

// ── Core query ────────────────────────────────────────────────────────────────

export async function wclQuery(
	token: string,
	query: string,
): Promise<{ data: object; errors?: Array<{ message: string }> }> {
	const resp = await fetch(WCL_API_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({ query }),
	});

	const remaining = Number(resp.headers.get('X-RateLimit-Remaining') ?? Infinity);
	const resetAt = Number(resp.headers.get('X-RateLimit-Reset') ?? 0) * 1000;
	if (remaining < 50 && resetAt > Date.now()) {
		const pauseMs = resetAt - Date.now() + 1_000;
		console.warn(`[wcl] Rate limit low (${remaining} pts). Pausing ${Math.ceil(pauseMs / 1000)}s.`);
		await sleep(pauseMs);
	}

	if (resp.status === 429) {
		const err = Object.assign(new Error('WCL 429 Too Many Requests'), { status: 429 });
		throw err;
	}
	if (!resp.ok) {
		throw new Error(`WCL query failed (${resp.status})`);
	}
	return resp.json();
}

// ── Zone discovery ────────────────────────────────────────────────────────────

export async function fetchActiveRaidZones(
	token: string,
	expansionId: number,
): Promise<Array<{ id: number; name: string; encounters: object[]; difficulties: object[] }>> {
	const query = `
		{
			worldData {
				expansion(id: ${expansionId}) {
					zones {
						id
						name
						difficulties { id name }
						encounters { id name }
					}
				}
			}
		}
	`;

	const result = await wclQuery(token, query);
	if (result.errors?.length) {
		console.warn('[wcl] Errors fetching zones:', result.errors.map((e) => e.message).join(', '));
	}

	const data = result as { data?: { worldData?: { expansion?: { zones?: unknown[] } } } };
	const zones = (data.data?.worldData?.expansion?.zones ?? []) as Array<{
		id: number;
		name: string;
		encounters: object[];
		difficulties: object[];
	}>;
	if (zones.length === 0) {
		console.warn(`[wcl] No zones found for expansion ${expansionId}`);
	}
	return zones;
}

// ── Batched raid parse queries ────────────────────────────────────────────────

interface PlayerLike {
	raider_id: string;
	region?: string;
}
interface CharLike {
	name: string;
	realm: string;
	spec?: string;
}
interface ParseResult {
	player: PlayerLike;
	char: CharLike;
	parses: Record<string, unknown[]>;
	error: string | null;
}

export async function fetchRaidParses(
	token: string,
	items: Array<{ player: PlayerLike; char: CharLike }>,
	zoneId: number,
	difficulties: string[],
): Promise<Map<string, ParseResult[]>> {
	const results = new Map<string, ParseResult[]>();

	const diffPairs = difficulties
		.map((d): [string, number] => [d, DIFFICULTY_IDS[d]])
		.filter(([, id]) => id !== undefined);

	const chunks = chunkArray(items, BATCH_SIZE);

	for (let ci = 0; ci < chunks.length; ci++) {
		const chunk = chunks[ci];
		if (ci > 0) await sleep(INTER_BATCH_DELAY_MS);

		const batchResult = await fetchParseBatchWithRetry(token, chunk, zoneId, diffPairs);

		for (const item of batchResult) {
			const rid = item.player.raider_id;
			if (!results.has(rid)) results.set(rid, []);
			results.get(rid)?.push(item);
		}
	}

	return results;
}

async function fetchParseBatchWithRetry(
	token: string,
	items: Array<{ player: PlayerLike; char: CharLike }>,
	zoneId: number,
	diffPairs: Array<[string, number]>,
): Promise<ParseResult[]> {
	for (let attempt = 0; attempt < 2; attempt++) {
		if (attempt === 1) {
			console.warn(`[wcl] 429 received — waiting ${RETRY_DELAY_MS / 1000}s then retrying batch`);
			await sleep(RETRY_DELAY_MS);
		}
		try {
			return await executeParseBatch(token, items, zoneId, diffPairs);
		} catch (err) {
			const e = err as { status?: number };
			if (e.status === 429 && attempt === 0) continue;
			if (e.status === 429) {
				console.warn('[wcl] Second 429 in batch — marking players as rate-limited and continuing');
				return items.map(({ player, char }) => ({
					player,
					char,
					parses: {},
					error: 'wcl_rate_limited',
				}));
			}
			throw err;
		}
	}
	return items.map(({ player, char }) => ({ player, char, parses: {}, error: 'wcl_rate_limited' }));
}

async function executeParseBatch(
	token: string,
	items: Array<{ player: PlayerLike; char: CharLike }>,
	zoneId: number,
	diffPairs: Array<[string, number]>,
): Promise<ParseResult[]> {
	const aliases = items.map(({ player, char }, idx) => {
		const specFilter = char.spec ? `, specName: "${char.spec.replace(/"/g, '')}"` : '';
		const serverSlug = char.realm.toLowerCase().replace(/\s+/g, '-').replace(/'/g, '');
		const region = player.region ?? 'eu';
		const charName = char.name.replace(/"/g, '');

		const diffFields = diffPairs
			.map(
				([diffKey, diffId]) =>
					`${diffKey}: zoneRankings(zoneID: ${zoneId}, difficulty: ${diffId}${specFilter})`,
			)
			.join('\n');

		return `
			p${idx}: characterData {
				character(name: "${charName}", serverSlug: "${serverSlug}", serverRegion: "${region}") {
					${diffFields}
				}
			}`;
	});

	const query = `{ ${aliases.join('\n')} }`;
	const result = await wclQuery(token, query);

	if (result.errors?.length) {
		console.warn('[wcl] Partial errors in batch:', result.errors.map((e) => e.message).join('; '));
	}

	return items.map(({ player, char }, idx) => {
		const data = result as Record<string, unknown>;
		const dataObj = data.data as Record<string, { character?: Record<string, unknown> }> | undefined;
		const charData = dataObj?.[`p${idx}`]?.character;
		if (!charData) {
			console.warn(`[wcl] No data for ${char.name}-${char.realm}`);
			return { player, char, parses: {}, error: 'wcl_not_found' };
		}

		const parses: Record<string, unknown[]> = {};
		for (const [diffKey] of diffPairs) {
			const rankings = charData[diffKey] as { rankings?: unknown[] } | undefined;
			parses[diffKey] = rankings?.rankings ?? [];
		}
		return { player, char, parses, error: null };
	});
}

// ── Historical encounter rankings (week-specific) ─────────────────────────────
// Uses encounterRankings(timeframe: Historical) which returns every individual
// kill with a report.startTime, allowing filtering by WoW week date range.

export interface EncounterKill {
	rankPercent: number | null;
	/** Epoch ms of the specific kill's fight start */
	startTime: number;
	spec: string;
	amount: number;
	reportCode: string | null;
	fightId: number | null;
}

export type HistoricalRankings = Map<
	string, // raider_id
	Record<number, Record<string, EncounterKill[]>> // bossId → difficulty → kills[]
>;

export async function fetchHistoricalEncounterRankings(
	token: string,
	items: Array<{ player: PlayerLike; char: CharLike }>,
	bossIds: number[],
	diffPairs: Array<[string, number]>,
): Promise<HistoricalRankings> {
	const results: HistoricalRankings = new Map();

	// One query per player — each query fetches all encounters × difficulties
	for (let i = 0; i < items.length; i += BATCH_SIZE) {
		const chunk = items.slice(i, i + BATCH_SIZE);
		if (i > 0) await sleep(INTER_BATCH_DELAY_MS);

		const aliases = chunk.map(({ player, char }, idx) => {
			const serverSlug = char.realm.toLowerCase().replace(/\s+/g, '-').replace(/'/g, '');
			const region = player.region ?? 'eu';
			const charName = char.name.replace(/"/g, '');
			const encounterFields = bossIds
				.flatMap((bossId) =>
					diffPairs.map(
						([diffKey, diffId]) =>
							`b${bossId}_${diffKey}: encounterRankings(encounterID: ${bossId}, difficulty: ${diffId}, timeframe: Historical)`,
					),
				)
				.join('\n');
			return `p${idx}: characterData {
				character(name: "${charName}", serverSlug: "${serverSlug}", serverRegion: "${region}") {
					${encounterFields}
				}
			}`;
		});

		const query = `{ ${aliases.join('\n')} }`;
		const result = await wclQuery(token, query);
		if (result.errors?.length) {
			console.warn(
				'[wcl] Partial errors in historical batch:',
				result.errors.map((e) => e.message).join('; '),
			);
		}

		const dataObj = (result as Record<string, unknown>).data as
			| Record<string, { character?: Record<string, unknown> }>
			| undefined;

		for (let j = 0; j < chunk.length; j++) {
			const { player, char } = chunk[j];
			const rid = player.raider_id;
			if (!results.has(rid)) results.set(rid, {});
			const raiderMap = results.get(rid)!;

			const charData = dataObj?.[`p${j}`]?.character;
			if (!charData) {
				console.warn(`[wcl] No historical data for ${char.name}-${char.realm}`);
				continue;
			}

			for (const bossId of bossIds) {
				if (!raiderMap[bossId]) raiderMap[bossId] = {};
				for (const [diffKey] of diffPairs) {
					const field = `b${bossId}_${diffKey}`;
					// encounterRankings returns { ranks: [...] } not { data: [...] }
					const raw = charData[field] as { ranks?: unknown[] } | null;
					raiderMap[bossId][diffKey] = (raw?.ranks ?? []).map((entry: unknown) => {
						const e = entry as Record<string, unknown>;
						const report = e.report as Record<string, unknown> | undefined;
						return {
							rankPercent: typeof e.rankPercent === 'number' ? e.rankPercent : null,
							startTime: typeof e.startTime === 'number' ? e.startTime : 0,
							spec: typeof e.spec === 'string' ? e.spec : '',
							amount: typeof e.amount === 'number' ? e.amount : 0,
							reportCode: typeof report?.code === 'string' ? report.code : null,
							fightId: typeof report?.fightID === 'number' ? report.fightID : null,
						} as EncounterKill;
					});
				}
			}
		}
	}

	return results;
}

// ── Exported pure helpers ─────────────────────────────────────────────────────

export function chunkArray<T>(arr: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < arr.length; i += size) {
		chunks.push(arr.slice(i, i + size));
	}
	return chunks;
}
