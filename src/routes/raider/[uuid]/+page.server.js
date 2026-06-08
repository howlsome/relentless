export const prerender = true;

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const E2E_FIXTURES =
	process.env.E2E_FIXTURES === 'true'
		? JSON.parse(readFileSync(join(process.cwd(), 'e2e/fixtures/roster-entries.json'), 'utf-8'))
		: [];

/** Tell SvelteKit to prerender fixture UUIDs when E2E_FIXTURES is set. */
export function entries() {
	return E2E_FIXTURES.map((/** @type {any} */ f) => ({ uuid: f.raider_id }));
}

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

	const allPlayers = [...roster.players, ...E2E_FIXTURES];
	const raider = allPlayers.find((r) => r.raider_id === params.uuid) ?? null;

	const activeMplusSeasonId = seasonsIndex.active_mplus_season ?? '';
	const complianceFile = activeMplusSeasonId
		? safeJson(join(dataDir, 'seasons', activeMplusSeasonId, 'compliance.json'))
		: null;
	const raiderCompliance = complianceFile?.raiders?.[/** @type {string} */ (params.uuid)] ?? null;

	const mplusSnapshotFile = activeMplusSeasonId
		? safeJson(join(dataDir, 'seasons', activeMplusSeasonId, 'snapshot.json'))
		: null;
	const mplusSnapshot =
		mplusSnapshotFile?.raiders?.find((/** @type {any} */ r) => r.raider_id === params.uuid) ?? null;

	const allRaidSnapshots = [];
	for (const zone of seasonsIndex.all_raid_zones ?? []) {
		const meta = safeJson(join(dataDir, 'seasons', zone.season_id, 'meta.json'));
		const snapshotFile = safeJson(join(dataDir, 'seasons', zone.season_id, 'snapshot.json'));
		const raiderData =
			snapshotFile?.raiders?.find((/** @type {any} */ r) => r.raider_id === params.uuid) ?? null;
		if (meta) allRaidSnapshots.push({ meta, raiderData, season_id: zone.season_id });
	}

	// Pick the single live zone: exclude beta/composite, then take the one with the most bosses.
	const liveZones = allRaidSnapshots.filter((z) => {
		const name = (z.meta.name ?? '').toLowerCase();
		return !name.includes('beta') && !name.includes('complete');
	});
	const pool = liveZones.length ? liveZones : allRaidSnapshots;
	const primaryRaidZone =
		pool.sort((a, b) => (b.meta.bosses?.length ?? 0) - (a.meta.bosses?.length ?? 0))[0] ?? null;

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
	const currentWeekStart =
		now.getTime() - daysSinceWed * 86_400_000 - (now.getTime() % 86_400_000) + 7 * 3_600_000;
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
		primaryRaidZone.raiderData.lockout_warnings = filterWarnings(
			primaryRaidZone.raiderData.lockout_warnings,
		);
	}

	// ── Weekly parse history for boss charts ──────────────────────────────────
	// weeklyHistoryByDiff[difficulty][bossId] = [pct|null, ...] oldest→newest

	/** @param {string} dateStr */
	function dateToWowWeek(dateStr) {
		const d = new Date(`${dateStr}T12:00:00Z`);
		const dayOfWeek = d.getUTCDay() || 7;
		let daysSinceWed = (dayOfWeek - 3 + 7) % 7;
		if (daysSinceWed === 0 && d.getUTCHours() < 7) daysSinceWed = 7;
		const reset = new Date(
			Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysSinceWed, 7, 0, 0, 0),
		);
		const thursday = new Date(
			Date.UTC(reset.getUTCFullYear(), reset.getUTCMonth(), reset.getUTCDate()),
		);
		const dayNum = thursday.getUTCDay() || 7;
		thursday.setUTCDate(thursday.getUTCDate() + 4 - dayNum);
		const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
		const week = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
		return `${thursday.getUTCFullYear()}-${String(week).padStart(2, '0')}`;
	}

	const raiderTrackingStart = raider?.tracking_start_date ?? roster.tracking_start_date;
	const raiderTrackingWeek = dateToWowWeek(raiderTrackingStart);

	/** @type {Record<string, Record<number,(number|null)[]>>} */
	const weeklyHistoryByDiff = { heroic: {}, mythic: {} };
	/** @type {Record<string, Record<number,(string|null)[]>>} wowanalyzer URLs per diff/boss/week */
	const wowanalyzerByDiff = { heroic: {}, mythic: {} };
	/** @type {Record<string, Record<string, Record<number,(number|null)[]>>>} specName → diff → bossId → history */
	const offspecWeeklyHistoryByDiff = {};
	/** @type {Record<string, Record<string, Record<number,(string|null)[]>>>} specName → diff → bossId → urls */
	const offspecWowanalyzerByDiff = {};

	if (primaryRaidZone) {
		const weeksDir = join(dataDir, 'seasons', primaryRaidZone.season_id, 'weeks');
		if (existsSync(weeksDir)) {
			const weekFiles = readdirSync(weeksDir)
				.filter((f) => f.endsWith('.json'))
				.sort();
			for (const file of weekFiles) {
				const weekData = safeJson(join(weeksDir, file));
				const raiderData = weekData?.raiders?.find(
					(/** @type {any} */ r) => r.raider_id === params.uuid,
				);
				if (!raiderData) continue;

				// Skip weeks that predate this raider's tracking start
				if (weekData.week && weekData.week < raiderTrackingWeek) continue;

				// Primary spec weekly history
				for (const diff of ['heroic', 'mythic']) {
					// Use kill_time (set only for current-week kills) to determine attendance.
					// Using `kill` would miscount weeks where the raider has historical kills
					// carried over in snapshot data but wasn't present in the raid that week.
					const attended = (raiderData.raid_parses ?? []).some((/** @type {any} */ bp) => {
						const d = bp.difficulties?.[diff];
						return d?.kill_time != null && (d.kill_category == null || d.kill_category === 'in_raid');
					});
					if (!attended) continue;
					for (const bp of raiderData.raid_parses ?? []) {
						if (!weeklyHistoryByDiff[diff][bp.boss_id]) weeklyHistoryByDiff[diff][bp.boss_id] = [];
						if (!wowanalyzerByDiff[diff][bp.boss_id]) wowanalyzerByDiff[diff][bp.boss_id] = [];
						const d = bp.difficulties?.[diff];
						const isRelentlessKill =
							d?.kill_time != null && (d.kill_category == null || d.kill_category === 'in_raid');
						weeklyHistoryByDiff[diff][bp.boss_id].push(
							isRelentlessKill ? (d.parse_percentile ?? null) : null,
						);
						const url =
							isRelentlessKill && d?.wcl_report_code && d?.wcl_fight_id
								? `https://www.wowanalyzer.com/report/${d.wcl_report_code}/${d.wcl_fight_id}`
								: null;
						wowanalyzerByDiff[diff][bp.boss_id].push(url);
					}
				}

				// Offspec weekly history — one structure per spec name
				for (const [specName, bossParsesForSpec] of Object.entries(raiderData.offspec_parses ?? {})) {
					if (!offspecWeeklyHistoryByDiff[specName]) {
						offspecWeeklyHistoryByDiff[specName] = { heroic: {}, mythic: {} };
						offspecWowanalyzerByDiff[specName] = { heroic: {}, mythic: {} };
					}
					for (const diff of ['heroic', 'mythic']) {
						const attended = /** @type {any[]} */ (bossParsesForSpec).some((/** @type {any} */ bp) => {
							const d = bp.difficulties?.[diff];
							return d?.kill_time != null;
						});
						if (!attended) continue;
						for (const bp of /** @type {any[]} */ (bossParsesForSpec)) {
							const hist = offspecWeeklyHistoryByDiff[specName][diff];
							const urls = offspecWowanalyzerByDiff[specName][diff];
							if (!hist[bp.boss_id]) hist[bp.boss_id] = [];
							if (!urls[bp.boss_id]) urls[bp.boss_id] = [];
							const d = bp.difficulties?.[diff];
							hist[bp.boss_id].push(d?.kill ? (d.parse_percentile ?? null) : null);
							const url =
								d?.kill && d?.wcl_report_code && d?.wcl_fight_id
									? `https://www.wowanalyzer.com/report/${d.wcl_report_code}/${d.wcl_fight_id}`
									: null;
							urls[bp.boss_id].push(url);
						}
					}
				}
			}
		}
	}

	// Derive default difficulty from mythic_start_date of the primary raid zone.
	const mythicStartDate = primaryRaidZone
		? (roster.raid_difficulty_status?.[primaryRaidZone.season_id]?.mythic_start_date ?? null)
		: null;
	const today = new Date().toISOString().slice(0, 10);
	const primaryRaidDifficulty =
		mythicStartDate && today >= mythicStartDate
			? /** @type {'mythic'} */ ('mythic')
			: /** @type {'heroic'} */ (roster.primary_raid_difficulty ?? 'heroic');

	return {
		raider,
		raiderCompliance,
		mplusSnapshot,
		primaryRaidZone,
		raiderHistory,
		activeSeason,
		weeklyMinimum: roster.mplus_weekly_minimum ?? 4,
		primaryRaidDifficulty,
		weeklyHistoryByDiff,
		wowanalyzerByDiff,
		offspecWeeklyHistoryByDiff,
		offspecWowanalyzerByDiff,
	};
}
