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

import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { getWclToken, fetchActiveRaidZones, fetchRaidParses } from '../src/lib/utils/wcl.mjs';
import {
	fetchRioBatch,
	extractRioScore,
	extractWeeklyHighestRuns,
	extractBestRuns,
	countTotalDungeonsThisWeek,
	countQualifyingRuns,
	highestKeyThisWeek
} from '../src/lib/utils/rio.mjs';
import { computeResilienceLevel, computeResilienceProgress } from '../src/lib/utils/resilience.mjs';
import {
	getCurrentWoWWeek,
	getResetStart,
	getActiveCharacters,
	getEffectiveTrackingStart,
	upsertComplianceWeek,
	generateChangelogEntries,
	buildRaiderHistory,
	dateToWoWWeek
} from '../src/lib/utils/raider-identity.mjs';

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
	writeFileSync(full, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

/** Read an existing JSON file or return a default value if it doesn't exist. */
function loadJsonOr(relPath, fallback) {
	const full = join(dataDir, relPath);
	if (!existsSync(full)) return fallback;
	return JSON.parse(readFileSync(full, 'utf-8'));
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

	console.log(`[fetch] Starting run. Week: ${currentWeek}  Reset start: ${resetStart.toISOString()}`);

	// ── 1. Load config files ──────────────────────────────────────────────────
	const roster = loadJson('roster.json');
	const changelogFile = loadJsonOr('changelog.json', {
		last_updated: null,
		roster_hash: null,
		prev_roster_snapshot: null,
		entries: []
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
	const raidZones = await fetchActiveRaidZones(wclToken, roster.wcl_expansion_id);
	console.log(`[fetch] Found ${raidZones.length} zone(s) for expansion ${roster.wcl_expansion_id}.`);

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
	console.log(`[fetch] ${activeItems.length} active character(s) across ${new Set(activeItems.map((i) => i.player.raider_id)).size} raider(s).`);

	// ── 5. Raider.io fetch (all active chars) ─────────────────────────────────
	console.log('[fetch] Fetching Raider.io profiles…');
	const rioResults = await fetchRioBatch(activeItems, roster.region);
	console.log('[fetch] Raider.io fetch complete.');

	// ── 6. M+ season processing ───────────────────────────────────────────────
	const activeMplusSeason = roster.mplus_seasons.find((s) => !s.end_date);
	if (activeMplusSeason) {
		await processMplusSeason({
			season: activeMplusSeason,
			activeItems,
			rioResults,
			currentWeek,
			fetchedAt,
			resetStart,
			roster
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
			roster
		});
	}

	// ── 8. seasons/index.json ─────────────────────────────────────────────────
	const seasonsIndex = {
		active_mplus_season: activeMplusSeason?.season_id ?? null,
		active_raid_zones: raidZones.map((z) => `raid-${z.id}`),
		all_mplus_seasons: roster.mplus_seasons.map(({ season_id, label, start_date, end_date }) => ({
			season_id, label, start_date, end_date
		})),
		all_raid_zones: raidZones.map((z) => ({
			season_id: `raid-${z.id}`,
			label: z.name,
			wcl_zone_id: z.id,
			start_date: new Date().toISOString().slice(0, 10),
			end_date: null
		}))
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
			entries: [...changelogFile.entries, ...newEntries]
		};
		writeJson('changelog.json', updatedChangelog);
	} else {
		changelogFile.last_updated = fetchedAt;
		writeJson('changelog.json', changelogFile);
	}

	console.log(`[fetch] Run complete. Week: ${currentWeek}`);
}

// ── M+ season ─────────────────────────────────────────────────────────────────

async function processMplusSeason({ season, activeItems, rioResults, currentWeek, fetchedAt, resetStart, roster }) {
	const { season_id, dungeon_count, dungeons } = season;
	const prefix = `seasons/${season_id}`;

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
		let allBestRuns = [];
		let hasError = null;

		for (const { char, profile, error } of charResults) {
			if (error) {
				hasError = error;
				continue;
			}
			const score = extractRioScore(profile);
			if (score != null && (rio_score == null || score > rio_score)) rio_score = score;

			const weeklyRuns = extractWeeklyHighestRuns(profile);
			mplus_runs_this_week = [
				...mplus_runs_this_week,
				...weeklyRuns.map((r) => ({
					dungeon: r.dungeon,
					level: r.mythic_level,
					timed: r.timed ?? (r.num_keystone_upgrades > 0),
					completed_at: r.completed_at
				}))
			];
			mplus_weekly_count += countQualifyingRuns(weeklyRuns, roster.mplus_minimum_key_level);
			mplus_total_dungeons += countTotalDungeonsThisWeek(profile, resetStart);
			const highest = highestKeyThisWeek(weeklyRuns);
			if (highest != null && (mplus_highest_key == null || highest > mplus_highest_key)) {
				mplus_highest_key = highest;
			}
			allBestRuns = [...allBestRuns, ...extractBestRuns(profile)];
		}

		const resilience_level = computeResilienceLevel(allBestRuns, dungeon_count);
		const resilience_progress = computeResilienceProgress(allBestRuns, dungeons);
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
			spec: activeChar?.spec ?? '',
			role: activeChar?.role ?? '',
			rio_score,
			mplus_runs_this_week,
			mplus_weekly_count_at_or_above_minimum: mplus_weekly_count,
			mplus_total_dungeons_this_week: mplus_total_dungeons,
			mplus_highest_key_this_week: mplus_highest_key,
			mplus_requirement_met,
			resilience_level,
			resilience_progress
		};
		if (hasError && !charResults.some((r) => !r.error)) {
			entry.error = hasError;
		}

		raiders.push(entry);

		// ── Update compliance.json ─────────────────────────────────────────────
		if (!hasError || charResults.some((r) => !r.error)) {
			const compliancePath = `${prefix}/compliance.json`;
			const compliance = loadJsonOr(compliancePath, { last_updated: null, raiders: {} });
			const existing = compliance.raiders[raiderId];
			compliance.raiders[raiderId] = upsertComplianceWeek(
				existing,
				{
					week: currentWeek,
					reset_start: resetStart.toISOString(),
					count: mplus_weekly_count,
					total_dungeons: mplus_total_dungeons,
					highest_key_level: mplus_highest_key,
					met: mplus_requirement_met
				},
				resilience_level
			);
			compliance.last_updated = fetchedAt;
			writeJson(compliancePath, compliance);
		}
	}

	const weeklyData = { season_id, week: currentWeek, fetched_at: fetchedAt, raiders };
	writeJson(`${prefix}/weeks/${currentWeek}.json`, weeklyData);
	writeJson(`${prefix}/snapshot.json`, weeklyData);

	console.log(`[fetch] M+ season ${season_id}: wrote ${raiders.length} raider(s).`);
}

// ── Raid zone ──────────────────────────────────────────────────────────────────

async function processRaidZone({ zone, wclToken, activeItems, currentWeek, fetchedAt, roster }) {
	const zoneId = zone.id;
	const prefix = `seasons/raid-${zoneId}`;

	// Write/update meta.json
	const meta = {
		wcl_zone_id: zoneId,
		name: zone.name,
		bosses: (zone.encounters ?? []).map((e) => ({ id: e.id, name: e.name })),
		difficulties: (zone.difficulties ?? []).map((d) => ({ id: d.id, name: d.name }))
	};
	writeJson(`${prefix}/meta.json`, meta);

	const bossNames = new Map((zone.encounters ?? []).map((e) => [e.id, e.name]));
	const difficulties = roster.raid_difficulties ?? ['heroic', 'mythic'];

	console.log(`[fetch] Raid zone ${zone.name} (${zoneId}): fetching parses for ${difficulties.join(', ')}…`);
	const parseResults = await fetchRaidParses(wclToken, activeItems, zoneId, difficulties);

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
					const killCount = ranking.kills?.total ?? 0;
					const kill = killCount > 0;

					const existing = bossEntry.difficulties[diffKey];
					const rankPercent = ranking.rankPercent ?? null;

					// Take best (highest) parse across multiple characters
					if (!existing || (kill && (!existing.kill || rankPercent > (existing.parse_percentile ?? 0)))) {
						bossEntry.difficulties[diffKey] = {
							kill,
							parse_percentile: kill ? (Math.round(rankPercent * 10) / 10) : null,
							spec: kill ? (ranking.spec ?? char.spec) : null,
							dps: kill ? (ranking.bestAmount ?? null) : null
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
							kill: false, parse_percentile: null, spec: null, dps: null
						};
					}
				}
			}
		}

		const raid_parses = [...bossParsesMap.values()].sort((a, b) => a.boss_id - b.boss_id);
		const activeChar = charResults.find((r) => !r.error)?.char ?? charResults[0]?.char;
		const hasError = charResults.every((r) => r.error) ? charResults[0].error : null;

		/** @type {object} */
		const raiderEntry = {
			raider_id: player.raider_id,
			display_name: player.display_name,
			team_designation: player.team_designation,
			active_character: activeChar?.name ?? '',
			realm: activeChar?.realm ?? '',
			class: activeChar?.class ?? '',
			spec: activeChar?.spec ?? '',
			role: activeChar?.role ?? '',
			raid_parses
		};
		if (hasError) raiderEntry.error = hasError;

		raiders.push(raiderEntry);
	}

	const weeklyData = {
		season_id: `raid-${zoneId}`,
		week: currentWeek,
		fetched_at: fetchedAt,
		raid_tier: { wcl_zone_id: zoneId, name: zone.name, bosses: meta.bosses },
		raiders
	};

	writeJson(`${prefix}/weeks/${currentWeek}.json`, weeklyData);
	writeJson(`${prefix}/snapshot.json`, weeklyData);

	console.log(`[fetch] Raid zone ${zone.name}: wrote ${raiders.length} raider(s).`);
}

// ── Entry point ───────────────────────────────────────────────────────────────

main().catch((err) => {
	console.error('[fetch] Fatal error:', err);
	process.exit(1);
});
