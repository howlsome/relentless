/**
 * Daily data-fetch script — run by GitHub Actions cron at 06:00 UTC.
 *
 * What it does:
 *  1. Load roster.json and changelog.json.
 *  2. Obtain a WarcraftLogs OAuth token (reused for the whole run).
 *  3. Discover active raid zones from WarcraftLogs.
 *  4. Filter to active raiders + active characters only.
 *  5. Fetch Raider.io data for all active characters (M+ scores, weekly runs, best runs).
 *  6. Write M+ season weekly file, snapshot, and compliance.json.
 *  7. Fetch WCL raid parse data for each active zone.
 *  8. Write raid zone weekly file, snapshot, and meta.json.
 *  9. Update data/seasons/index.json.
 * 10. Sync raider-history.json from roster.json.
 * 11. Generate changelog entries by diffing current vs. previous roster.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyKill, formatLocalTime, getIsoWeekForTimestamp } from '../src/lib/utils/lockout.js';
import {
	buildRaiderHistory,
	dateToWoWWeek,
	generateChangelogEntries,
	getActiveCharacters,
	getCurrentWoWWeek,
	getEffectiveTrackingStart,
	getResetStart,
	upsertComplianceWeek,
} from '../src/lib/utils/raider-identity.js';
import {
	countQualifyingRuns,
	extractRioScore,
	fetchRioBatch,
	highestKeyThisWeek,
	mergeWeeklyRuns,
} from '../src/lib/utils/rio.js';
import {
	DIFFICULTY_IDS,
	fetchActiveRaidZones,
	fetchHistoricalEncounterRankings,
	fetchRaidParses,
	getWclToken,
} from '../src/lib/utils/wcl.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');

// ── JSON helpers ──────────────────────────────────────────────────────────────

/** @param {string} relPath */
function loadJson(relPath) {
	return JSON.parse(readFileSync(join(dataDir, relPath), 'utf-8'));
}

/**
 * Write JSON to a file under dataDir, creating parent directories as needed.
 * @param {string} relPath
 * @param {object} data
 */
function writeJson(relPath, data) {
	const full = join(dataDir, relPath);
	mkdirSync(dirname(full), { recursive: true });
	writeFileSync(full, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
}

/** Read an existing JSON file or return a default value if it doesn't exist. */
function loadJsonOr(relPath, fallback) {
	const full = join(dataDir, relPath);
	if (!existsSync(full)) return fallback;
	return JSON.parse(readFileSync(full, 'utf-8'));
}

/** Load the most-recent weeks/*.json for a season, or null if none exist. */
function loadLatestWeek(seasonRelPath) {
	const weeksDir = join(dataDir, seasonRelPath, 'weeks');
	if (!existsSync(weeksDir)) return null;
	const files = readdirSync(weeksDir)
		.filter((f) => f.endsWith('.json'))
		.sort();
	if (!files.length) return null;
	return loadJsonOr(`${seasonRelPath}/weeks/${files[files.length - 1]}`, null);
}

/** SHA-256 hash of an object (deterministic JSON). */
function hashRoster(roster) {
	return createHash('sha256').update(JSON.stringify(roster)).digest('hex');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
	const now = new Date();
	const fetchedAt = now.toISOString();
	const currentWeek = getCurrentWoWWeek(now);
	const resetStart = getResetStart(now);

	console.log(
		`[fetch] Starting run. Week: ${currentWeek}  Reset start: ${resetStart.toISOString()}`,
	);

	// ── 1. Load config files ──────────────────────────────────────────────────
	const roster = loadJson('roster.json');
	const changelogFile = loadJsonOr('changelog.json', {
		last_updated: null,
		roster_hash: null,
		prev_roster_snapshot: null,
		entries: [],
	});

	// ── 2. WCL OAuth token ────────────────────────────────────────────────────
	const clientId = process.env.WCL_CLIENT_ID;
	const clientSecret = process.env.WCL_CLIENT_SECRET;
	if (!clientId || !clientSecret) {
		throw new Error('WCL_CLIENT_ID and WCL_CLIENT_SECRET environment variables are required');
	}
	console.log('[fetch] Obtaining WCL token…');
	const wclToken = await getWclToken(clientId, clientSecret);
	console.log('[fetch] WCL token obtained.');

	// ── 3. Active zones from WCL ──────────────────────────────────────────────
	console.log('[fetch] Fetching active raid zones…');
	const allZones = await fetchActiveRaidZones(wclToken, roster.wcl_expansion_id);
	const allowedZoneIds: Set<number> = new Set(roster.wcl_zone_ids ?? []);
	const raidZones = allZones.filter((z) =>
		allowedZoneIds.size > 0 ? allowedZoneIds.has(z.id) : !z.name.toLowerCase().includes('mythic+'),
	);
	console.log(
		`[fetch] Found ${raidZones.length} raid zone(s) (filtered to IDs: ${[...allowedZoneIds].join(', ')}) for expansion ${roster.wcl_expansion_id}.`,
	);

	// ── 4. Build active {player, char} list ──────────────────────────────────
	/** @type {Array<{player: object, char: object}>} */
	const activeItems = [];
	for (const player of roster.players) {
		if (player.status !== 'active') continue;

		const startWeek = dateToWoWWeek(getEffectiveTrackingStart(player, roster.tracking_start_date));
		if (startWeek > currentWeek) {
			console.log(`[fetch] ${player.display_name}: tracking starts ${startWeek}, skipping.`);
			continue;
		}

		const chars = getActiveCharacters(player);
		if (chars.length === 0) {
			console.warn(`[warn] ${player.display_name} has no active characters — skipping`);
			continue;
		}
		for (const char of chars) {
			activeItems.push({ player, char });
		}
	}
	console.log(
		`[fetch] ${activeItems.length} active character(s) across ${new Set(activeItems.map((i) => i.player.raider_id)).size} raider(s).`,
	);

	// ── 5. Raider.io fetch (all active chars) ─────────────────────────────────
	console.log('[fetch] Fetching Raider.io profiles…');
	const rioResults = await fetchRioBatch(activeItems, roster.region);
	console.log('[fetch] Raider.io fetch complete.');

	// ── 6. M+ season processing ───────────────────────────────────────────────
	const activeMplusSeason = roster.mplus_seasons.find((s) => !s.end_date);
	if (activeMplusSeason) {
		await processMplusSeason({
			season: activeMplusSeason,
			rioResults,
			currentWeek,
			fetchedAt,
			resetStart,
			roster,
		});
	} else {
		console.warn('[fetch] No active M+ season found in roster.json — skipping M+ data.');
	}

	// ── 7. Raid zone processing ───────────────────────────────────────────────
	for (const zone of raidZones) {
		await processRaidZone({
			zone,
			wclToken,
			activeItems,
			currentWeek,
			fetchedAt,
			roster,
			resetStart,
		});
	}

	// ── 8. seasons/index.json ─────────────────────────────────────────────────
	const seasonsIndex = {
		active_mplus_season: activeMplusSeason?.season_id ?? null,
		active_raid_zones: raidZones.map((z) => `raid-${z.id}`),
		all_mplus_seasons: roster.mplus_seasons.map(({ season_id, label, start_date, end_date }) => ({
			season_id,
			label,
			start_date,
			end_date,
		})),
		all_raid_zones: raidZones.map((z) => ({
			season_id: `raid-${z.id}`,
			label: z.name,
			wcl_zone_id: z.id,
			start_date: new Date().toISOString().slice(0, 10),
			end_date: null,
		})),
	};
	writeJson('seasons/index.json', seasonsIndex);
	console.log('[fetch] seasons/index.json updated.');

	// ── 9. raider-history.json ────────────────────────────────────────────────
	writeJson('raider-history.json', buildRaiderHistory(roster, now));
	console.log('[fetch] raider-history.json updated.');

	// ── 10. Changelog ─────────────────────────────────────────────────────────
	const currentHash = hashRoster(roster);
	const prevHash = changelogFile.roster_hash;
	const prevRoster = changelogFile.prev_roster_snapshot ?? null;

	if (currentHash !== prevHash) {
		console.log('[fetch] Roster changed — generating changelog entries…');
		const newEntries = generateChangelogEntries(roster, prevRoster, fetchedAt, currentWeek);
		console.log(`[fetch] Generated ${newEntries.length} changelog entry/entries.`);

		const updatedChangelog = {
			last_updated: fetchedAt,
			roster_hash: currentHash,
			prev_roster_snapshot: roster,
			entries: [...changelogFile.entries, ...newEntries],
		};
		writeJson('changelog.json', updatedChangelog);
	} else {
		changelogFile.last_updated = fetchedAt;
		writeJson('changelog.json', changelogFile);
	}

	console.log(`[fetch] Run complete. Week: ${currentWeek}`);
}

// ── M+ season ─────────────────────────────────────────────────────────────────

async function processMplusSeason({
	season,
	rioResults,
	currentWeek,
	fetchedAt,
	resetStart,
	roster,
}) {
	const { season_id } = season;
	const prefix = `seasons/${season_id}`;

	const existingMplusSnapshot = loadLatestWeek(prefix);
	const prevMplusSnapByRaider = new Map(
		(existingMplusSnapshot?.raiders ?? []).map((r) => [r.raider_id, r]),
	);

	const raiders = [];

	for (const [raiderId, charResults] of rioResults) {
		const player = roster.players.find((p) => p.raider_id === raiderId);
		if (!player) continue;

		// Merge across multiple active characters (rare, e.g. two characters raiding)
		let rio_score = null;
		let mplus_runs_this_week = [];
		let mplus_weekly_count = 0;
		let mplus_total_dungeons = 0;
		let mplus_highest_key = null;
		let hasError = null;

		for (const { profile, error } of charResults) {
			if (error) {
				hasError = error;
				continue;
			}
			const score = extractRioScore(profile);
			if (score != null && (rio_score == null || score > rio_score)) rio_score = score;

			const weeklyRuns = mergeWeeklyRuns(profile, resetStart);
			mplus_runs_this_week = [
				...mplus_runs_this_week,
				...weeklyRuns.map((r) => ({
					dungeon: r.dungeon,
					level: r.mythic_level,
					timed: r.num_keystone_upgrades > 0,
					completed_at: r.completed_at,
				})),
			];
			mplus_weekly_count += countQualifyingRuns(weeklyRuns, roster.mplus_minimum_key_level);
			mplus_total_dungeons += weeklyRuns.length;
			const highest = highestKeyThisWeek(weeklyRuns);
			if (highest != null && (mplus_highest_key == null || highest > mplus_highest_key)) {
				mplus_highest_key = highest;
			}
		}
		const mplus_requirement_met = mplus_weekly_count >= roster.mplus_weekly_minimum;

		const activeChar = charResults.find((r) => !r.error)?.char ?? charResults[0]?.char;

		/** @type {object} */
		const entry = {
			raider_id: raiderId,
			display_name: player.display_name,
			team_designation: player.team_designation,
			active_character: activeChar?.name ?? '',
			realm: activeChar?.realm ?? '',
			class: activeChar?.class ?? '',
			spec: activeChar ? (getPrimarySpecName(activeChar) ?? '') : '',
			role: activeChar ? getPrimarySpecRole(activeChar) : '',
			rio_score,
			mplus_runs_this_week,
			mplus_weekly_count_at_or_above_minimum: mplus_weekly_count,
			mplus_total_dungeons_this_week: mplus_total_dungeons,
			mplus_highest_key_this_week: mplus_highest_key,
			mplus_requirement_met,
		};
		if (hasError && !charResults.some((r) => !r.error)) {
			entry.error = hasError;
		}

		// Carry forward previous-character M+ data (RaiderIO score) on character switch
		const prevMplus = prevMplusSnapByRaider.get(raiderId);
		if (prevMplus && prevMplus.active_character !== entry.active_character) {
			entry.previous_characters = [
				{
					name: prevMplus.active_character,
					realm: prevMplus.realm,
					class: prevMplus.class,
					spec: prevMplus.spec,
					role: prevMplus.role,
					rio_score: prevMplus.rio_score ?? null,
				},
				...(prevMplus.previous_characters ?? []),
			];
		}

		raiders.push(entry);

		// ── Update compliance.json ─────────────────────────────────────────────
		if (!hasError || charResults.some((r) => !r.error)) {
			const compliancePath = `${prefix}/compliance.json`;
			const compliance = loadJsonOr(compliancePath, { last_updated: null, raiders: {} });
			const existing = compliance.raiders[raiderId];
			compliance.raiders[raiderId] = upsertComplianceWeek(existing, {
				week: currentWeek,
				reset_start: resetStart.toISOString(),
				count: mplus_weekly_count,
				total_dungeons: mplus_total_dungeons,
				highest_key_level: mplus_highest_key,
				met: mplus_requirement_met,
			});
			compliance.last_updated = fetchedAt;
			writeJson(compliancePath, compliance);
		}
	}

	const weeklyData = { season_id, week: currentWeek, fetched_at: fetchedAt, raiders };
	writeJson(`${prefix}/weeks/${currentWeek}.json`, weeklyData);

	console.log(`[fetch] M+ season ${season_id}: wrote ${raiders.length} raider(s).`);
}

// ── Spec helpers ──────────────────────────────────────────────────────────────

function getPrimarySpecName(char) {
	if (char.specs?.length) {
		return (char.specs.find((s) => s.primary) ?? char.specs[0]).spec;
	}
	return char.spec ?? null;
}

function getPrimarySpecRole(char) {
	if (char.specs?.length) {
		return (char.specs.find((s) => s.primary) ?? char.specs[0]).role;
	}
	return char.role ?? 'dps';
}

function getCharOffspecs(char) {
	if (char.specs?.length) {
		return char.specs.filter((s) => !s.primary && s.wcl_active);
	}
	return [];
}

// ── Lockout helpers ────────────────────────────────────────────────────────────

function loadRecentWeeks(weeksDir, count, currentWeek) {
	const weeks = [];
	try {
		const _allFiles = existsSync(join(dataDir, weeksDir))
			? [] // we'll load by known week keys below
			: [];
		// Load up to `count` most recent weeks before currentWeek
		const [curYear, curWeekNum] = currentWeek.split('-').map(Number);
		for (let i = 1; i <= count; i++) {
			let wn = curWeekNum - i;
			let wy = curYear;
			if (wn <= 0) {
				wy -= 1;
				wn += 52;
			}
			const key = `${wy}-${String(wn).padStart(2, '0')}`;
			const path = `${weeksDir}/${key}.json`;
			const data = loadJsonOr(path, null);
			if (data) weeks.push(data);
		}
	} catch {
		/* no weeks dir yet */
	}
	return weeks;
}

function countPriorBlocks(recentWeeks, raiderId) {
	let count = 0;
	for (const week of recentWeeks) {
		const raider = (week.raiders ?? []).find((r) => r.raider_id === raiderId);
		if (raider?.lockout_warnings?.length > 0) count++;
	}
	return count;
}

function describeMatchingSession(killTimeUtc, schedule) {
	const date = new Date(killTimeUtc);
	const fmt = new Intl.DateTimeFormat('en-GB', {
		timeZone: schedule.timezone,
		weekday: 'long',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
	});
	const parts = fmt.formatToParts(date);
	const dayName = parts.find((p) => p.type === 'weekday')?.value.toLowerCase() ?? '';
	const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
	const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
	const localMinutes = hour * 60 + minute;

	for (const session of schedule.sessions) {
		if (session.day !== dayName) continue;
		const start = session.start.split(':').map(Number);
		const end = session.end.split(':').map(Number);
		const grace = session.grace_minutes ?? 0;
		const effStart = start[0] * 60 + start[1] - grace;
		const effEnd = end[0] * 60 + end[1] + grace;
		if (localMinutes >= effStart && localMinutes <= Math.min(effEnd, 24 * 60 - 1)) {
			return `${session.day} ${session.start}–${session.end} server`;
		}
	}
	return null;
}

// ── Raid zone ──────────────────────────────────────────────────────────────────

async function processRaidZone({
	zone,
	wclToken,
	activeItems,
	currentWeek,
	fetchedAt,
	roster,
	resetStart,
}) {
	const zoneId = zone.id;
	const prefix = `seasons/raid-${zoneId}`;

	// Write/update meta.json
	const meta = {
		wcl_zone_id: zoneId,
		name: zone.name,
		bosses: (zone.encounters ?? []).map((e) => ({ id: e.id, name: e.name })),
		difficulties: (zone.difficulties ?? []).map((d) => ({ id: d.id, name: d.name })),
	};
	writeJson(`${prefix}/meta.json`, meta);

	const bossNames = new Map((zone.encounters ?? []).map((e) => [e.id, e.name]));
	const difficulties = roster.raid_difficulties ?? ['heroic', 'mythic'];

	// Read existing latest week to detect character switches on this run
	const existingRaidSnapshot = loadLatestWeek(prefix);
	const prevRaidSnapByRaider = new Map(
		(existingRaidSnapshot?.raiders ?? []).map((r) => [r.raider_id, r]),
	);

	console.log(
		`[fetch] Raid zone ${zone.name} (${zoneId}): fetching parses for ${difficulties.join(', ')}…`,
	);
	const parseResults = await fetchRaidParses(wclToken, activeItems, zoneId, difficulties);

	// ── Offspec fetching ──────────────────────────────────────────────────────
	// Build per-spec item lists for players who have wcl_active offspecs
	/** @type {Map<string, Array<{player: object, char: object}>>} specName → items */
	const offspecItemsBySpec = new Map();
	for (const { player, char } of activeItems) {
		for (const offspec of getCharOffspecs(char)) {
			if (!offspecItemsBySpec.has(offspec.spec)) offspecItemsBySpec.set(offspec.spec, []);
			offspecItemsBySpec.get(offspec.spec).push({
				player,
				char: { ...char, spec: offspec.spec, role: offspec.role },
			});
		}
	}

	/** @type {Map<string, Map<string, object[]>>} specName → parseResults */
	const offspecParseResultsBySpec = new Map();
	for (const [specName, items] of offspecItemsBySpec) {
		console.log(`[fetch] Fetching offspec parses for ${specName} (${items.length} raider(s))…`);
		offspecParseResultsBySpec.set(
			specName,
			await fetchRaidParses(wclToken, items, zoneId, difficulties),
		);
	}

	const raiders = [];

	for (const player of roster.players) {
		if (player.status !== 'active') continue;
		const charResults = parseResults.get(player.raider_id);
		if (!charResults) continue;

		// Build per-boss parse data, merging across active characters if needed
		// (take best percentile per boss per difficulty across characters)
		/** @type {Map<number, object>} boss_id → parse entry */
		const bossParsesMap = new Map();

		for (const { char, parses, error } of charResults) {
			if (error && !parses) {
				// Whole character errored — we'll store the error at player level
				continue;
			}
			for (const [diffKey, rankings] of Object.entries(parses)) {
				for (const ranking of rankings) {
					const bossId = ranking.encounter?.id;
					const bossName = ranking.encounter?.name ?? bossNames.get(bossId) ?? `Boss ${bossId}`;
					if (!bossId) continue;

					if (!bossParsesMap.has(bossId)) {
						bossParsesMap.set(bossId, { boss_id: bossId, boss_name: bossName, difficulties: {} });
					}
					const bossEntry = bossParsesMap.get(bossId);
					const killCount = ranking.totalKills ?? ranking.kills?.total ?? 0;
					const kill = killCount > 0;

					const existing = bossEntry.difficulties[diffKey];
					const rankPercent = ranking.rankPercent ?? null;

					// zoneRankings scalar does not expose individual kill timestamps
					const kill_time = null;

					// Take best (highest) parse across multiple characters
					if (
						!existing ||
						(kill && (!existing.kill || rankPercent > (existing.parse_percentile ?? 0)))
					) {
						bossEntry.difficulties[diffKey] = {
							kill,
							parse_percentile: kill ? Math.round(rankPercent * 10) / 10 : null,
							spec: kill ? (ranking.spec ?? char.spec) : null,
							dps: kill ? (ranking.bestAmount ?? null) : null,
							kill_time: kill ? kill_time : null,
							kill_category: null,
							detected_session: null,
						};
					}
				}
			}
		}

		// Ensure all known bosses appear in the output (with null if not killed)
		for (const [encId, encName] of bossNames) {
			if (!bossParsesMap.has(encId)) {
				const entry = { boss_id: encId, boss_name: encName, difficulties: {} };
				for (const diff of difficulties) {
					entry.difficulties[diff] = { kill: false, parse_percentile: null, spec: null, dps: null };
				}
				bossParsesMap.set(encId, entry);
			} else {
				// Fill missing difficulties
				for (const diff of difficulties) {
					if (!bossParsesMap.get(encId).difficulties[diff]) {
						bossParsesMap.get(encId).difficulties[diff] = {
							kill: false,
							parse_percentile: null,
							spec: null,
							dps: null,
						};
					}
				}
			}
		}

		const raid_parses = [...bossParsesMap.values()].sort((a, b) => a.boss_id - b.boss_id);
		const activeChar = charResults.find((r) => !r.error)?.char ?? charResults[0]?.char;
		const hasError = charResults.every((r) => r.error) ? charResults[0].error : null;

		// ── Build offspec boss parse maps ───────────────────────────────────────
		/** @type {Record<string, object[]>} specName → BossParse[] */
		const offspec_parses = {};
		for (const [specName, offspecParseResults] of offspecParseResultsBySpec) {
			const offspecCharResults = offspecParseResults.get(player.raider_id);
			if (!offspecCharResults) continue;

			const offspecBossMap = new Map();
			for (const { char, parses, error } of offspecCharResults) {
				if (error && !parses) continue;
				for (const [diffKey, rankings] of Object.entries(parses)) {
					for (const ranking of rankings) {
						const bossId = ranking.encounter?.id;
						const bossName = ranking.encounter?.name ?? bossNames.get(bossId) ?? `Boss ${bossId}`;
						if (!bossId) continue;

						if (!offspecBossMap.has(bossId)) {
							offspecBossMap.set(bossId, { boss_id: bossId, boss_name: bossName, difficulties: {} });
						}
						const bossEntry = offspecBossMap.get(bossId);
						const killCount = ranking.totalKills ?? ranking.kills?.total ?? 0;
						const kill = killCount > 0;
						const existing = bossEntry.difficulties[diffKey];
						const rankPercent = ranking.rankPercent ?? null;

						if (
							!existing ||
							(kill && (!existing.kill || rankPercent > (existing.parse_percentile ?? 0)))
						) {
							bossEntry.difficulties[diffKey] = {
								kill,
								parse_percentile: kill ? Math.round(rankPercent * 10) / 10 : null,
								spec: kill ? (ranking.spec ?? char.spec) : null,
								dps: kill ? (ranking.bestAmount ?? null) : null,
								kill_time: null,
								kill_category: null,
								detected_session: null,
							};
						}
					}
				}
			}

			// Fill missing bosses
			for (const [encId, encName] of bossNames) {
				if (!offspecBossMap.has(encId)) {
					const entry = { boss_id: encId, boss_name: encName, difficulties: {} };
					for (const diff of difficulties) {
						entry.difficulties[diff] = { kill: false, parse_percentile: null, spec: null, dps: null };
					}
					offspecBossMap.set(encId, entry);
				} else {
					for (const diff of difficulties) {
						if (!offspecBossMap.get(encId).difficulties[diff]) {
							offspecBossMap.get(encId).difficulties[diff] = {
								kill: false,
								parse_percentile: null,
								spec: null,
								dps: null,
							};
						}
					}
				}
			}

			offspec_parses[specName] = [...offspecBossMap.values()].sort((a, b) => a.boss_id - b.boss_id);
		}

		// ── Lockout detection ───────────────────────────────────────────────────
		const raidSchedule = roster.raid_schedule;
		const exemptions = player.exemptions ?? [];
		const lockout_warnings = [];
		const safe_pug_kills = [];
		const exempt_pug_kills = [];

		const zoneKey = `raid-${zoneId}`;
		const mythicStartDate = roster.raid_difficulty_status?.[zoneKey]?.mythic_start_date ?? null;

		if (raidSchedule?.sessions?.length > 0 && mythicStartDate != null) {
			// Load history to compute prior_blocks_last_4_weeks
			const historyPath = `${prefix}/weeks`;
			const recentWeeks = loadRecentWeeks(historyPath, 4, currentWeek);
			const priorBlockCount = countPriorBlocks(recentWeeks, player.raider_id);
			const mythicStartMs = new Date(mythicStartDate).getTime();

			for (const bossEntry of raid_parses) {
				const mythicParse = bossEntry.difficulties.mythic;
				if (!mythicParse?.kill || !mythicParse.kill_time) continue;
				// Skip kills that happened before the guild started mythic
				if (new Date(mythicParse.kill_time).getTime() < mythicStartMs) continue;

				const category = classifyKill(mythicParse.kill_time, raidSchedule, exemptions, 'mythic');
				mythicParse.kill_category = category;

				if (category === 'in_raid') {
					mythicParse.detected_session = describeMatchingSession(mythicParse.kill_time, raidSchedule);
					continue;
				}

				const localTime = formatLocalTime(mythicParse.kill_time, raidSchedule.timezone);

				if (category === 'blocking_pug') {
					lockout_warnings.push({
						boss_id: bossEntry.boss_id,
						boss_name: bossEntry.boss_name,
						difficulty: 'mythic',
						kill_time: mythicParse.kill_time,
						detected_local_time: localTime,
						reason:
							'Outside all configured raid sessions and not in a safe-pug window — this kill locks the raider out of an upcoming Relentless raid',
						prior_blocks_last_4_weeks: priorBlockCount,
					});
				} else if (category === 'safe_pug') {
					safe_pug_kills.push({
						boss_id: bossEntry.boss_id,
						boss_name: bossEntry.boss_name,
						difficulty: 'mythic',
						kill_time: mythicParse.kill_time,
						detected_local_time: localTime,
					});
				} else if (category === 'exempt_pug') {
					const killWeek = getIsoWeekForTimestamp(mythicParse.kill_time, raidSchedule.timezone);
					const weekExemptions = exemptions.filter((e) => e.week === killWeek);
					const latest = weekExemptions.sort((a, b) => b.granted_at.localeCompare(a.granted_at))[0];
					exempt_pug_kills.push({
						boss_id: bossEntry.boss_id,
						boss_name: bossEntry.boss_name,
						difficulty: 'mythic',
						kill_time: mythicParse.kill_time,
						detected_local_time: localTime,
						exemption_reason: latest?.reason ?? '',
						exemption_granted_by: latest?.granted_by ?? '',
					});
				}
			}
		} else if (raidSchedule && !raidSchedule.sessions?.length) {
			console.warn(
				`[lockout] raid_schedule present but sessions is empty — lockout detection disabled`,
			);
		}

		/** @type {object} */
		const raiderEntry = {
			raider_id: player.raider_id,
			display_name: player.display_name,
			team_designation: player.team_designation,
			active_character: activeChar?.name ?? '',
			realm: activeChar?.realm ?? '',
			class: activeChar?.class ?? '',
			spec: getPrimarySpecName(activeChar) ?? '',
			role: getPrimarySpecRole(activeChar),
			raid_parses,
			...(Object.keys(offspec_parses).length > 0 ? { offspec_parses } : {}),
			lockout_warnings,
			safe_pug_kills,
			exempt_pug_kills,
		};
		if (hasError) raiderEntry.error = hasError;

		raiders.push(raiderEntry);
	}

	// ── Patch kill/parse data and report codes via encounterRankings ──────────
	// zoneRankings returns all-time bests with no date filter. We override kill
	// status, parse percentile, and report codes using encounterRankings filtered
	// to each raider's tracking_start_date so pre-tracking kills are excluded.
	const weekStartMs = roster.raid_schedule ? resetStart.getTime() : 0;
	const weekEndMs = weekStartMs + 7 * 86_400_000;

	const diffPairs = difficulties
		.map((d): [string, number] => [d, DIFFICULTY_IDS[d]])
		.filter(([, id]) => id !== undefined);

	// Per-player tracking start so a raider who joined later only gets their kills
	const playerTrackingStarts = new Map(
		roster.players.map((p) => [
			p.raider_id,
			new Date(p.tracking_start_date ?? roster.tracking_start_date).getTime(),
		]),
	);
	// Use the roster-wide (earliest) tracking start as the API-level filter
	const rosterTrackingStartMs = new Date(roster.tracking_start_date).getTime();

	const bossIds = (zone.encounters ?? []).map((e) => e.id);
	if (bossIds.length > 0 && activeItems.length > 0) {
		try {
			console.log(
				`[fetch] Fetching encounter data for ${zone.name} (since ${roster.tracking_start_date})…`,
			);
			const historical = await fetchHistoricalEncounterRankings(
				wclToken,
				activeItems,
				bossIds,
				diffPairs,
				rosterTrackingStartMs,
			);
			for (const raiderEntry of raiders) {
				const raiderMap = historical.get(raiderEntry.raider_id);
				const playerStartMs = playerTrackingStarts.get(raiderEntry.raider_id) ?? rosterTrackingStartMs;
				const primarySpecName = raiderEntry.spec || null;
				const player = roster.players.find((p) => p.raider_id === raiderEntry.raider_id);
				const playerExemptions = player?.exemptions ?? [];
				const raidSchedule = roster.raid_schedule;
				const hasSchedule = raidSchedule?.sessions?.length > 0;

				// ── Patch primary spec parses ───────────────────────────────────────
				for (const bp of raiderEntry.raid_parses) {
					for (const [diffKey] of diffPairs) {
						const diff = bp.difficulties?.[diffKey];
						if (!diff) continue;

						// Filter to this player's tracking start AND primary spec only
						const allKills = (raiderMap?.[bp.boss_id]?.[diffKey] ?? []).filter(
							(k) => k.startTime >= playerStartMs && (!primarySpecName || k.spec === primarySpecName),
						);

						// Raid-session filtering only applies to mythic (where lockout matters).
						// For heroic and below, all kills within the tracking window count — heroic
						// has no lockout and can be cleared on any night without consequence.
						const inRaidKills =
							hasSchedule && diffKey === 'mythic'
								? allKills.filter(
										(k) =>
											classifyKill(
												new Date(k.startTime).toISOString(),
												raidSchedule,
												playerExemptions,
												diffKey,
											) === 'in_raid',
									)
								: allKills;

						if (inRaidKills.length > 0) {
							const bestKill = inRaidKills.reduce((best, k) =>
								(k.rankPercent ?? 0) > (best.rankPercent ?? 0) ? k : best,
							);
							diff.kill = true;
							diff.parse_percentile =
								bestKill.rankPercent != null ? Math.round(bestKill.rankPercent * 10) / 10 : null;
							diff.spec = bestKill.spec || diff.spec;
							diff.dps = bestKill.amount || diff.dps;
							diff.kill_category = 'in_raid';
						} else {
							diff.kill = false;
							diff.parse_percentile = null;
						}

						const weekKills = inRaidKills
							.filter((k) => k.startTime >= weekStartMs && k.startTime < weekEndMs)
							.sort((a, b) => (b.rankPercent ?? 0) - (a.rankPercent ?? 0));
						if (weekKills.length > 0) {
							diff.wcl_report_code = weekKills[0].reportCode ?? null;
							diff.wcl_fight_id = weekKills[0].fightId ?? null;
							diff.kill_time = new Date(weekKills[0].startTime).toISOString();
						}

						// Historical best: best parse before this raider's tracking_start_date
						// (includes pugs, any location — pre-guild history)
						const preTrackingKills = (raiderMap?.[bp.boss_id]?.[diffKey] ?? []).filter(
							(k) => k.startTime < playerStartMs && (!primarySpecName || k.spec === primarySpecName),
						);
						if (preTrackingKills.length > 0) {
							const best = preTrackingKills.reduce((b, k) =>
								(k.rankPercent ?? 0) > (b.rankPercent ?? 0) ? k : b,
							);
							diff.historical_best_parse =
								best.rankPercent != null ? Math.round(best.rankPercent * 10) / 10 : null;
						}
					}
				}

				// ── Patch offspec parses with historical data ────────────────────────
				for (const [specName, bossParsesForSpec] of Object.entries(raiderEntry.offspec_parses ?? {})) {
					for (const bp of bossParsesForSpec) {
						for (const [diffKey] of diffPairs) {
							const diff = bp.difficulties?.[diffKey];
							if (!diff) continue;

							const allKills = (raiderMap?.[bp.boss_id]?.[diffKey] ?? []).filter(
								(k) => k.startTime >= playerStartMs && k.spec === specName,
							);

							const inRaidKills =
								hasSchedule && diffKey === 'mythic'
									? allKills.filter(
											(k) =>
												classifyKill(
													new Date(k.startTime).toISOString(),
													raidSchedule,
													playerExemptions,
													diffKey,
												) === 'in_raid',
										)
									: allKills;

							if (inRaidKills.length > 0) {
								const bestKill = inRaidKills.reduce((best, k) =>
									(k.rankPercent ?? 0) > (best.rankPercent ?? 0) ? k : best,
								);
								diff.kill = true;
								diff.parse_percentile =
									bestKill.rankPercent != null ? Math.round(bestKill.rankPercent * 10) / 10 : null;
								diff.spec = specName;
								diff.dps = bestKill.amount || diff.dps;
								diff.kill_category = 'in_raid';
							} else {
								diff.kill = false;
								diff.parse_percentile = null;
							}

							const weekKills = inRaidKills
								.filter((k) => k.startTime >= weekStartMs && k.startTime < weekEndMs)
								.sort((a, b) => (b.rankPercent ?? 0) - (a.rankPercent ?? 0));
							if (weekKills.length > 0) {
								diff.wcl_report_code = weekKills[0].reportCode ?? null;
								diff.wcl_fight_id = weekKills[0].fightId ?? null;
								diff.kill_time = new Date(weekKills[0].startTime).toISOString();
							}
						}
					}
				}
			}
		} catch (err) {
			console.warn(`[fetch] Could not fetch encounter data for ${zone.name}:`, err);
		}
	}

	// ── Carry forward previous-character data when active character switches ────
	for (const raiderEntry of raiders) {
		const prev = prevRaidSnapByRaider.get(raiderEntry.raider_id);
		if (!prev || prev.active_character === raiderEntry.active_character) continue;
		raiderEntry.previous_characters = [
			{
				name: prev.active_character,
				realm: prev.realm,
				class: prev.class,
				spec: prev.spec,
				role: prev.role,
				raid_parses: prev.raid_parses ?? [],
				...(prev.offspec_parses ? { offspec_parses: prev.offspec_parses } : {}),
			},
			...(prev.previous_characters ?? []),
		];
		console.log(
			`[fetch] ${raiderEntry.display_name}: character switched ${prev.active_character} → ${raiderEntry.active_character}, carrying forward historical parse data.`,
		);
	}

	const weeklyData = {
		season_id: `raid-${zoneId}`,
		week: currentWeek,
		fetched_at: fetchedAt,
		raid_tier: { wcl_zone_id: zoneId, name: zone.name, bosses: meta.bosses },
		raiders,
	};

	// Preserve kill_time / wcl_report_code / wcl_fight_id captured in an earlier
	// fetch of this same week. WCL's encounterRankings may later settle on a
	// pre-week best-parse, setting kill_time back to null even though the raider
	// did kill the boss this week. Once a this-week kill is confirmed, keep it.
	const existingWeek = loadJsonOr(`${prefix}/weeks/${currentWeek}.json`, null);
	if (existingWeek) {
		const existingByRaider = new Map(
			(existingWeek.raiders ?? []).map((r: { raider_id: string }) => [r.raider_id, r]),
		);
		for (const raider of weeklyData.raiders) {
			const prev = existingByRaider.get(raider.raider_id) as
				| {
						raid_parses?: Array<{
							boss_id: number;
							difficulties: Record<
								string,
								{ kill_time?: string | null; wcl_report_code?: string | null; wcl_fight_id?: number | null }
							>;
						}>;
				  }
				| undefined;
			if (!prev) continue;
			const prevByBoss = new Map((prev.raid_parses ?? []).map((bp) => [bp.boss_id, bp]));
			for (const bp of raider.raid_parses ?? []) {
				const prevBp = prevByBoss.get(bp.boss_id);
				if (!prevBp) continue;
				for (const diff of Object.keys(bp.difficulties ?? {})) {
					const d = bp.difficulties[diff];
					const prevD = prevBp.difficulties?.[diff];
					if (d && prevD && d.kill_time == null && prevD.kill_time != null) {
						d.kill_time = prevD.kill_time;
						d.wcl_report_code = prevD.wcl_report_code ?? d.wcl_report_code;
						d.wcl_fight_id = prevD.wcl_fight_id ?? d.wcl_fight_id;
					}
				}
			}
		}
	}

	writeJson(`${prefix}/weeks/${currentWeek}.json`, weeklyData);

	console.log(`[fetch] Raid zone ${zone.name}: wrote ${raiders.length} raider(s).`);
}

// ── Entry point ───────────────────────────────────────────────────────────────

main().catch((err) => {
	console.error('[fetch] Fatal error:', err);
	process.exit(1);
});
