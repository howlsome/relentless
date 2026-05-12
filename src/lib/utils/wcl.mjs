/**
 * WarcraftLogs GraphQL API v2 helpers.
 *
 * Key behaviours:
 *  - OAuth2 client-credentials token obtained once, reused for the whole run.
 *  - Multi-character aliased batch queries (up to 10 characters per request).
 *  - 429 retry: wait 15 s, retry once; on second failure mark players as rate-limited.
 *  - X-RateLimit-Remaining monitoring: pause if < 50 points remaining.
 *  - 2-second inter-batch delay for courteous pacing.
 */

const WCL_API_URL = 'https://www.warcraftlogs.com/api/v2/client';
const WCL_TOKEN_URL = 'https://www.warcraftlogs.com/oauth/token';

/** WCL difficulty IDs for the difficulties we care about. */
export const DIFFICULTY_IDS = { heroic: 4, mythic: 5 };

const BATCH_SIZE = 10;
const INTER_BATCH_DELAY_MS = 2_000;
const RETRY_DELAY_MS = 15_000;

/** @param {number} ms */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Token ─────────────────────────────────────────────────────────────────────

/**
 * Obtain an OAuth2 client-credentials token from WarcraftLogs.
 * Token is valid for 24 hours; cache it in the calling scope.
 *
 * @param {string} clientId
 * @param {string} clientSecret
 * @returns {Promise<string>} Bearer token
 */
export async function getWclToken(clientId, clientSecret) {
	const resp = await fetch(WCL_TOKEN_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			grant_type: 'client_credentials',
			client_id: clientId,
			client_secret: clientSecret
		})
	});
	if (!resp.ok) {
		const text = await resp.text().catch(() => '');
		throw new Error(`WCL token request failed (${resp.status}): ${text}`);
	}
	const json = await resp.json();
	return json.access_token;
}

// ── Core query ────────────────────────────────────────────────────────────────

/**
 * Execute a raw GraphQL query against the WCL API.
 * Returns the full response body.
 * Throws on HTTP errors (caller handles 429 separately).
 *
 * @param {string} token
 * @param {string} query
 * @returns {Promise<{data: object, errors?: object[]}>}
 */
export async function wclQuery(token, query) {
	const resp = await fetch(WCL_API_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify({ query })
	});

	// Monitor rate-limit budget
	const remaining = Number(resp.headers.get('X-RateLimit-Remaining') ?? Infinity);
	const resetAt = Number(resp.headers.get('X-RateLimit-Reset') ?? 0) * 1000;
	if (remaining < 50 && resetAt > Date.now()) {
		const pauseMs = resetAt - Date.now() + 1_000;
		console.warn(`[wcl] Rate limit low (${remaining} pts). Pausing ${Math.ceil(pauseMs / 1000)}s.`);
		await sleep(pauseMs);
	}

	if (resp.status === 429) {
		// Signal to caller to retry
		const err = new Error('WCL 429 Too Many Requests');
		err.status = 429;
		throw err;
	}
	if (!resp.ok) {
		throw new Error(`WCL query failed (${resp.status})`);
	}
	return resp.json();
}

// ── Zone discovery ────────────────────────────────────────────────────────────

/**
 * Fetch all raid zones for the configured WCL expansion.
 * Returns an array of zone objects with id, name, encounters, and difficulties.
 *
 * @param {string} token
 * @param {number} expansionId  From roster.json wcl_expansion_id
 * @returns {Promise<Array<{id: number, name: string, encounters: object[], difficulties: object[]}>>}
 */
export async function fetchActiveRaidZones(token, expansionId) {
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

	const zones = result?.data?.worldData?.expansion?.zones ?? [];
	if (zones.length === 0) {
		console.warn(`[wcl] No zones found for expansion ${expansionId}`);
	}
	return zones;
}

// ── Batched raid parse queries ────────────────────────────────────────────────

/**
 * Fetch raid parse rankings for a batch of {player, char} items.
 * Sends them in groups of BATCH_SIZE characters per HTTP request.
 * Uses aliased multi-character queries.
 *
 * @param {string} token
 * @param {Array<{player: object, char: object}>} items
 * @param {number} zoneId
 * @param {string[]} difficulties  e.g. ['heroic', 'mythic']
 * @returns {Promise<Map<string, object>>}
 *   Map from `raider_id` to {char, parses: Record<difficulty, rankings[]>}[]
 */
export async function fetchRaidParses(token, items, zoneId, difficulties) {
	/** @type {Map<string, object[]>} raider_id → array of char parse results */
	const results = new Map();

	const diffPairs = difficulties
		.map((d) => [d, DIFFICULTY_IDS[d]])
		.filter(([, id]) => id !== undefined);

	// Process in chunks of BATCH_SIZE
	const chunks = chunkArray(items, BATCH_SIZE);

	for (let ci = 0; ci < chunks.length; ci++) {
		const chunk = chunks[ci];

		if (ci > 0) await sleep(INTER_BATCH_DELAY_MS);

		const batchResult = await fetchParseBatchWithRetry(token, chunk, zoneId, diffPairs);

		// Merge into results map
		for (const { player, char, parses, error } of batchResult) {
			const rid = player.raider_id;
			if (!results.has(rid)) results.set(rid, []);
			results.get(rid).push({ char, parses, error });
		}
	}

	return results;
}

/**
 * Execute one batch query, retrying once on 429.
 * On second 429, marks each item with error: 'wcl_rate_limited'.
 */
async function fetchParseBatchWithRetry(token, items, zoneId, diffPairs) {
	for (let attempt = 0; attempt < 2; attempt++) {
		if (attempt === 1) {
			console.warn(`[wcl] 429 received — waiting ${RETRY_DELAY_MS / 1000}s then retrying batch`);
			await sleep(RETRY_DELAY_MS);
		}
		try {
			return await executeParseBatch(token, items, zoneId, diffPairs);
		} catch (err) {
			if (err.status === 429 && attempt === 0) continue;
			if (err.status === 429) {
				console.warn('[wcl] Second 429 in batch — marking players as rate-limited and continuing');
				return items.map(({ player, char }) => ({
					player, char, parses: {}, error: 'wcl_rate_limited'
				}));
			}
			throw err;
		}
	}
}

/**
 * Build and execute a single aliased batch query.
 * Returns an array of {player, char, parses, error} objects.
 */
async function executeParseBatch(token, items, zoneId, diffPairs) {
	const aliases = items.map(({ player, char }, idx) => {
		const specFilter = char.spec ? `, specName: "${char.spec.replace(/"/g, '')}"` : '';
		const serverSlug = char.realm.toLowerCase().replace(/\s+/g, '-').replace(/'/g, '');
		const region = player.region ?? 'eu';
		const charName = char.name.replace(/"/g, '');

		const diffFields = diffPairs
			.map(
				([diffKey, diffId]) => `
				${diffKey}: zoneRankings(zoneID: ${zoneId}, difficulty: ${diffId}${specFilter}) {
					rankings {
						encounter { id name }
						rankPercent
						bestAmount
						spec
						kills { total }
					}
				}`
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
		// GraphQL partial errors — log but continue
		console.warn('[wcl] Partial errors in batch:', result.errors.map((e) => e.message).join('; '));
	}

	return items.map(({ player, char }, idx) => {
		const charData = result?.data?.[`p${idx}`]?.character;
		if (!charData) {
			console.warn(`[wcl] No data for ${char.name}-${char.realm}`);
			return { player, char, parses: {}, error: 'wcl_not_found' };
		}

		/** @type {Record<string, Array>} */
		const parses = {};
		for (const [diffKey] of diffPairs) {
			const rankings = charData[diffKey]?.rankings ?? [];
			parses[diffKey] = rankings;
		}
		return { player, char, parses, error: null };
	});
}

// ── Exported pure helpers ─────────────────────────────────────────────────────

/**
 * Split an array into chunks of at most `size`.
 * @template T
 * @param {T[]} arr
 * @param {number} size
 * @returns {T[][]}
 */
export function chunkArray(arr, size) {
	const chunks = [];
	for (let i = 0; i < arr.length; i += size) {
		chunks.push(arr.slice(i, i + size));
	}
	return chunks;
}

/**
 * Build an aliased batch GraphQL query string for multiple characters.
 * @param {Array<{player: object, char: object}>} items
 * @param {number} zoneId
 * @param {Array<[string, number]>} diffPairs  e.g. [['heroic', 4], ['mythic', 5]]
 * @returns {string} GraphQL query string
 */
export function buildBatchQuery(items, zoneId, diffPairs) {
	if (items.length === 0) return '{ __typename }';
	const aliases = items.map(({ player, char }, idx) => {
		const specFilter = char.spec ? `, specName: "${char.spec.replace(/"/g, '')}"` : '';
		const serverSlug = char.realm.toLowerCase().replace(/\s+/g, '-').replace(/'/g, '');
		const region = player.region ?? 'eu';
		const charName = char.name.replace(/"/g, '');
		const diffFields = diffPairs
			.map(
				([diffKey, diffId]) => `
				${diffKey}: zoneRankings(zoneID: ${zoneId}, difficulty: ${diffId}${specFilter}) {
					rankings { encounter { id name } rankPercent bestAmount spec kills { total } }
				}`
			)
			.join('\n');
		return `p${idx}: characterData {
			character(name: "${charName}", serverSlug: "${serverSlug}", serverRegion: "${region}") {
				${diffFields}
			}
		}`;
	});
	return `{ ${aliases.join('\n')} }`;
}

/**
 * Parse the aliased batch response back into per-player parse results.
 * @param {object} response  WCL API response body
 * @param {Array<{player: object, char: object}>} items
 * @param {Array<[string, number]>} diffPairs
 * @returns {Array<{player: object, char: object, parses: object, error: string|null}>}
 */
export function parseBatchResponse(response, items, diffPairs) {
	return items.map(({ player, char }, idx) => {
		const charData = response?.data?.[`p${idx}`]?.character;
		if (!charData) return { player, char, parses: {}, error: 'wcl_not_found' };
		const parses = {};
		for (const [diffKey] of diffPairs) {
			parses[diffKey] = charData[diffKey]?.rankings ?? [];
		}
		return { player, char, parses, error: null };
	});
}

/**
 * Return true if a WCL log timestamp (ms) falls within the current EU weekly reset window.
 * EU reset: Wednesday 07:00 UTC.
 * @param {number} timestampMs
 * @param {Date} [now]
 */
export function isCurrentWeekKill(timestampMs, now = new Date()) {
	// Find the start of the current EU reset (Wednesday 07:00 UTC)
	const dayOfWeek = now.getUTCDay(); // 0=Sun, 3=Wed
	const hourUTC = now.getUTCHours();
	let daysSinceWed = (dayOfWeek - 3 + 7) % 7;
	if (daysSinceWed === 0 && hourUTC < 7) daysSinceWed = 7;
	const resetStart = new Date(Date.UTC(
		now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceWed, 7, 0, 0, 0
	));
	return timestampMs >= resetStart.getTime() && timestampMs <= now.getTime();
}
