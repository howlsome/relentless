/**
 * One-off backfill script — populates a historical raid weeks file from WCL.
 *
 * Uses encounterRankings(timeframe: Historical) to get kills with timestamps,
 * then filters to the specific WoW week so each week file has accurate data.
 *
 * Usage:
 *   tsx --env-file=.env scripts/backfill.ts --week 2026-19
 *
 * What it writes:
 *   data/seasons/raid-{id}/weeks/{week}.json   ← one per active raid zone
 *
 * What it does NOT touch:
 *   snapshot.json, compliance.json, seasons/index.json,
 *   raider-history.json, changelog.json, any M+ files.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import {
	getWclToken,
	fetchActiveRaidZones,
	fetchHistoricalEncounterRankings,
	DIFFICULTY_IDS,
} from '../src/lib/utils/wcl.js';
import { getActiveCharacters } from '../src/lib/utils/raider-identity.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');

function loadJson(relPath: string) {
	return JSON.parse(readFileSync(join(dataDir, relPath), 'utf-8'));
}

function writeJson(relPath: string, data: object) {
	const full = join(dataDir, relPath);
	mkdirSync(dirname(full), { recursive: true });
	writeFileSync(full, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

// ── WoW week bounds ───────────────────────────────────────────────────────────
// EU reset: Wednesday 07:00 UTC. Returns epoch ms range for the week.
function getWeekBounds(isoWeek: string): { start: number; end: number } {
	const [year, week] = isoWeek.split('-').map(Number);
	// Find the Monday of ISO week N in the given year
	const jan4 = new Date(Date.UTC(year, 0, 4)); // Jan 4 is always in ISO week 1
	const dow = jan4.getUTCDay() || 7; // 1=Mon, 7=Sun
	const week1Mon = new Date(jan4.getTime() - (dow - 1) * 86_400_000);
	const weekMon = new Date(week1Mon.getTime() + (week - 1) * 7 * 86_400_000);
	// Wednesday 07:00 UTC = Mon + 2 days + 7 hours
	const start = weekMon.getTime() + 2 * 86_400_000 + 7 * 3_600_000;
	return { start, end: start + 7 * 86_400_000 };
}

// ── CLI arg parsing ───────────────────────────────────────────────────────────

const weekArg = process.argv[process.argv.indexOf('--week') + 1];
if (!weekArg || !/^\d{4}-\d{2}$/.test(weekArg)) {
	console.error('Usage: tsx --env-file=.env scripts/backfill.ts --week YYYY-WW');
	process.exit(1);
}

const targetWeek = weekArg;
const { start: weekStart, end: weekEnd } = getWeekBounds(targetWeek);
console.log(`[backfill] Week ${targetWeek}: ${new Date(weekStart).toISOString()} → ${new Date(weekEnd).toISOString()}`);

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
	const fetchedAt = new Date().toISOString();
	const roster = loadJson('roster.json');

	const clientId = process.env.WCL_CLIENT_ID;
	const clientSecret = process.env.WCL_CLIENT_SECRET;
	if (!clientId || !clientSecret) throw new Error('WCL credentials missing');

	console.log('[backfill] Obtaining WCL token…');
	const wclToken = await getWclToken(clientId, clientSecret);

	console.log('[backfill] Fetching raid zones…');
	const allZones = await fetchActiveRaidZones(wclToken, roster.wcl_expansion_id);
	const raidZones = allZones.filter((z: { name: string }) => !z.name.toLowerCase().includes('mythic+'));

	const activeItems: Array<{ player: object; char: object }> = [];
	for (const player of roster.players) {
		if (player.status !== 'active') continue;
		for (const char of getActiveCharacters(player)) {
			activeItems.push({ player, char });
		}
	}
	console.log(`[backfill] ${activeItems.length} character(s) across ${new Set(activeItems.map((i: any) => i.player.raider_id)).size} raider(s).`);

	const difficulties: string[] = roster.raid_difficulties ?? ['heroic', 'mythic'];
	const diffPairs = difficulties
		.map((d): [string, number] => [d, DIFFICULTY_IDS[d]])
		.filter(([, id]) => id !== undefined);

	for (const zone of raidZones) {
		const zoneId = zone.id;
		const prefix = `seasons/raid-${zoneId}`;
		const outPath = `${prefix}/weeks/${targetWeek}.json`;

		if (existsSync(join(dataDir, outPath))) {
			console.log(`[backfill] ${outPath} already exists — skipping (delete to re-run).`);
			continue;
		}

		const bossIds: number[] = (zone.encounters ?? []).map((e: { id: number }) => e.id);
		if (!bossIds.length) {
			console.log(`[backfill] Zone ${zone.name} has no encounters — skipping.`);
			continue;
		}

		console.log(`[backfill] Zone ${zone.name} (${zoneId}): fetching historical encounter rankings…`);
		const historical = await fetchHistoricalEncounterRankings(wclToken, activeItems, bossIds, diffPairs);

		const bossNames = new Map((zone.encounters ?? []).map((e: { id: number; name: string }) => [e.id, e.name]));

		const raiders = [];

		for (const player of roster.players) {
			if (player.status !== 'active') continue;
			const raiderMap = historical.get(player.raider_id);

			const raid_parses = bossIds.map((bossId) => {
				const bossName = bossNames.get(bossId) ?? `Boss ${bossId}`;
				const entry: Record<string, unknown> = {
					boss_id: bossId,
					boss_name: bossName,
					difficulties: {},
				};

				for (const [diffKey] of diffPairs) {
					const kills = raiderMap?.[bossId]?.[diffKey] ?? [];
					// Filter to kills that occurred within this WoW week
					const weekKills = kills.filter(
						(k) => k.startTime >= weekStart && k.startTime < weekEnd,
					);

					if (weekKills.length === 0) {
						(entry.difficulties as Record<string, unknown>)[diffKey] = {
							kill: false, parse_percentile: null, spec: null, dps: null,
						};
					} else {
						// Best parse from this week
						const best = weekKills.reduce(
							(a, b) => ((b.rankPercent ?? -1) > (a.rankPercent ?? -1) ? b : a),
						);
						(entry.difficulties as Record<string, unknown>)[diffKey] = {
							kill: true,
							parse_percentile: best.rankPercent != null ? Math.round(best.rankPercent * 10) / 10 : null,
							spec: best.spec || null,
							dps: best.amount || null,
							kill_time: null,
							kill_category: null,
							detected_session: null,
							wcl_report_code: best.reportCode ?? null,
							wcl_fight_id: best.fightId ?? null,
						};
					}
				}

				return entry;
			});

			const activeChar = getActiveCharacters(player)[0];
			raiders.push({
				raider_id: player.raider_id,
				display_name: player.display_name,
				team_designation: player.team_designation,
				active_character: (activeChar as any)?.name ?? '',
				realm: (activeChar as any)?.realm ?? '',
				class: (activeChar as any)?.class ?? '',
				spec: (activeChar as any)?.spec ?? '',
				role: (activeChar as any)?.role ?? '',
				raid_parses,
				lockout_warnings: [],
				safe_pug_kills: [],
				exempt_pug_kills: [],
			});
		}

		const metaPath = `${prefix}/meta.json`;
		const meta = existsSync(join(dataDir, metaPath)) ? loadJson(metaPath) : { bosses: [] };

		writeJson(outPath, {
			season_id: `raid-${zoneId}`,
			week: targetWeek,
			fetched_at: fetchedAt,
			raid_tier: { wcl_zone_id: zoneId, name: zone.name, bosses: meta.bosses ?? [] },
			raiders,
		});
		console.log(`[backfill] Wrote ${outPath} (${raiders.length} raider(s)).`);
	}

	console.log(`[backfill] Done.`);
}

main().catch((err) => {
	console.error('[backfill] Fatal error:', err);
	process.exit(1);
});
