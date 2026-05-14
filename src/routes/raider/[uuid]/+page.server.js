export const prerender = true;

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/** @param {string} path */
function safeJson(path) {
	try {
		if (!existsSync(path)) return null;
		return JSON.parse(readFileSync(path, 'utf-8'));
	} catch (err) {
		console.warn(`[safeJson] Failed to read ${path}:`, err);
		return null;
	}
}

/** @type {import('@sveltejs/kit').Load} */
export function load({ params }) {
	const dataDir = join(process.cwd(), 'data');

	/** @type {import('$lib/types').Roster} */
	const roster = JSON.parse(readFileSync(join(dataDir, 'roster.json'), 'utf-8'));
	/** @type {import('$lib/types').SeasonsIndex} */
	const seasonsIndex = JSON.parse(readFileSync(join(dataDir, 'seasons', 'index.json'), 'utf-8'));

	const raider = roster.players.find((r) => r.raider_id === params.uuid) ?? null;

	const activeMplusSeasonId = seasonsIndex.active_mplus_season ?? '';
	const complianceFile = activeMplusSeasonId ? safeJson(join(dataDir, 'seasons', activeMplusSeasonId, 'compliance.json')) : null;
	const raiderCompliance = complianceFile?.raiders?.[/** @type {string} */ (params.uuid)] ?? null;

	const mplusSnapshotFile = activeMplusSeasonId ? safeJson(join(dataDir, 'seasons', activeMplusSeasonId, 'snapshot.json')) : null;
	const mplusSnapshot = mplusSnapshotFile?.raiders?.find((/** @type {any} */ r) => r.raider_id === params.uuid) ?? null;

	const allRaidSnapshots = [];
	for (const zone of seasonsIndex.all_raid_zones ?? []) {
		const meta = safeJson(join(dataDir, 'seasons', zone.season_id, 'meta.json'));
		const snapshotFile = safeJson(join(dataDir, 'seasons', zone.season_id, 'snapshot.json'));
		const raiderData = snapshotFile?.raiders?.find((/** @type {any} */ r) => r.raider_id === params.uuid) ?? null;
		if (meta) allRaidSnapshots.push({ meta, raiderData, season_id: zone.season_id });
	}

	// Pick the single live zone: exclude beta/composite, then take the one with the most bosses.
	const liveZones = allRaidSnapshots.filter((z) => {
		const name = (z.meta.name ?? '').toLowerCase();
		return !name.includes('beta') && !name.includes('complete');
	});
	const pool = liveZones.length ? liveZones : allRaidSnapshots;
	const primaryRaidZone = pool.sort((a, b) => (b.meta.bosses?.length ?? 0) - (a.meta.bosses?.length ?? 0))[0] ?? null;

	const raiderHistoryFile = safeJson(join(dataDir, 'raider-history.json'));
	const raiderHistory = raiderHistoryFile?.raiders?.[/** @type {string} */ (params.uuid)] ?? null;

	const activeSeason = roster.mplus_seasons.find((s) => !s.end_date) ?? null;

	// ── Filter lockout warnings: current week only + suppress if exemption exists ──
	// EU reset: Wednesday 07:00 UTC. Warnings from past weeks should not show.
	const now = new Date();
	const dow = now.getUTCDay(); // 0=Sun, 3=Wed
	const hourUTC = now.getUTCHours();
	let daysSinceWed = (dow - 3 + 7) % 7;
	if (daysSinceWed === 0 && hourUTC < 7) daysSinceWed = 7;
	const currentWeekStart = now.getTime() - daysSinceWed * 86_400_000 - (now.getTime() % 86_400_000) + 7 * 3_600_000;
	const currentWeekEnd = currentWeekStart + 7 * 86_400_000;

	// Weeks that the raider has an exemption for
	const exemptedWeeks = new Set((raider?.exemptions ?? []).map((/** @type {any} */ e) => e.week));

	/** Filter a lockout warning array to current-week kills not covered by an exemption.
	 * @param {Array<any>} warnings
	 */
	function filterWarnings(warnings) {
		return (warnings ?? []).filter((/** @type {any} */ w) => {
			if (!w.kill_time) return false;
			const ms = new Date(w.kill_time).getTime();
			if (ms < currentWeekStart || ms >= currentWeekEnd) return false;
			// Suppress if officer granted a retrospective exemption for that ISO week
			const killDate = new Date(w.kill_time);
			const dayOfWeek = killDate.getUTCDay() || 7;
			const thursday = new Date(killDate.getTime() + (4 - dayOfWeek) * 86_400_000);
			const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
			const killIsoWeek = `${thursday.getUTCFullYear()}-${String(Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)).padStart(2, '0')}`;
			if (exemptedWeeks.has(killIsoWeek)) return false;
			return true;
		});
	}

	// Patch primaryRaidZone raiderData with filtered warnings
	if (primaryRaidZone?.raiderData) {
		primaryRaidZone.raiderData.lockout_warnings = filterWarnings(primaryRaidZone.raiderData.lockout_warnings);
	}

	// ── Weekly parse history for boss charts ──────────────────────────────────
	// weeklyHistoryByDiff[difficulty][bossId] = [pct|null, ...] oldest→newest
	/** @type {Record<string, Record<number,(number|null)[]>>} */
	const weeklyHistoryByDiff = { heroic: {}, mythic: {} };
	/** @type {Record<string, Record<number,(string|null)[]>>} wowanalyzer URLs per diff/boss/week */
	const wowanalyzerByDiff = { heroic: {}, mythic: {} };

	if (primaryRaidZone) {
		const weeksDir = join(dataDir, 'seasons', primaryRaidZone.season_id, 'weeks');
		if (existsSync(weeksDir)) {
			const weekFiles = readdirSync(weeksDir)
				.filter((f) => f.endsWith('.json'))
				.sort(); // YYYY-WW.json sorts chronologically oldest→newest
			for (const file of weekFiles) {
				const weekData = safeJson(join(weeksDir, file));
				const raiderData = weekData?.raiders?.find((/** @type {any} */ r) => r.raider_id === params.uuid);
				if (!raiderData) continue;
				for (const diff of ['heroic', 'mythic']) {
					// Only include this week if the raider killed at least one boss WITH Relentless
					const attended = (raiderData.raid_parses ?? []).some((/** @type {any} */ bp) => {
						const d = bp.difficulties?.[diff];
						return d?.kill && (d.kill_category == null || d.kill_category === 'in_raid');
					});
					if (!attended) continue;
					for (const bp of raiderData.raid_parses ?? []) {
						if (!weeklyHistoryByDiff[diff][bp.boss_id]) weeklyHistoryByDiff[diff][bp.boss_id] = [];
						if (!wowanalyzerByDiff[diff][bp.boss_id]) wowanalyzerByDiff[diff][bp.boss_id] = [];
						const d = bp.difficulties?.[diff];
						// Only count Relentless kills (in_raid or unclassified legacy) in the chart
						const isRelentlessKill = d?.kill && (d.kill_category == null || d.kill_category === 'in_raid');
						weeklyHistoryByDiff[diff][bp.boss_id].push(isRelentlessKill ? (d.parse_percentile ?? null) : null);
						// Build WoWAnalyzer URL if report code is available
						const url = (isRelentlessKill && d?.wcl_report_code && d?.wcl_fight_id)
							? `https://www.wowanalyzer.com/report/${d.wcl_report_code}/${d.wcl_fight_id}`
							: null;
						wowanalyzerByDiff[diff][bp.boss_id].push(url);
					}
				}
			}
		}
	}

	return {
		raider,
		raiderCompliance,
		mplusSnapshot,
		primaryRaidZone,
		raiderHistory,
		activeSeason,
		weeklyMinimum: roster.mplus_weekly_minimum ?? 4,
		weeklyHistoryByDiff,
		wowanalyzerByDiff,
	};
}
