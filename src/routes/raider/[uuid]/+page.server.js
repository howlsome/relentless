export const prerender = true;

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** @param {string} path */
function safeJson(path) {
	try {
		if (!existsSync(path)) return null;
		return JSON.parse(readFileSync(path, 'utf-8'));
	} catch {
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

	const raidSnapshots = [];
	for (const zone of seasonsIndex.all_raid_zones ?? []) {
		const meta = safeJson(join(dataDir, 'seasons', zone.season_id, 'meta.json'));
		const snapshotFile = safeJson(join(dataDir, 'seasons', zone.season_id, 'snapshot.json'));
		const raiderData = snapshotFile?.raiders?.find((/** @type {any} */ r) => r.raider_id === params.uuid) ?? null;
		if (meta) raidSnapshots.push({ meta, raiderData, season_id: zone.season_id });
	}

	const raiderHistoryFile = safeJson(join(dataDir, 'raider-history.json'));
	const raiderHistory = raiderHistoryFile?.raiders?.[/** @type {string} */ (params.uuid)] ?? null;

	const activeSeason = roster.mplus_seasons.find((s) => !s.end_date) ?? null;

	return {
		raider,
		raiderCompliance,
		mplusSnapshot,
		raidSnapshots,
		raiderHistory,
		activeSeason,
		weeklyMinimum: roster.mplus_weekly_minimum ?? 4
	};
}
