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
export function load() {
	const dataDir = join(process.cwd(), 'data');

	/** @type {import('$lib/types').Roster} */
	const roster = JSON.parse(readFileSync(join(dataDir, 'roster.json'), 'utf-8'));
	/** @type {import('$lib/types').SeasonsIndex} */
	const seasonsIndex = JSON.parse(readFileSync(join(dataDir, 'seasons', 'index.json'), 'utf-8'));

	const activeMplusSeasonId = seasonsIndex.active_mplus_season ?? '';
	const mplusSnapshot = activeMplusSeasonId ? safeJson(join(dataDir, 'seasons', activeMplusSeasonId, 'snapshot.json')) : null;
	const mplusCompliance = activeMplusSeasonId ? safeJson(join(dataDir, 'seasons', activeMplusSeasonId, 'compliance.json')) : null;

	const raidZones = [];
	for (const zone of seasonsIndex.all_raid_zones ?? []) {
		const meta = safeJson(join(dataDir, 'seasons', zone.season_id, 'meta.json'));
		const snapshot = safeJson(join(dataDir, 'seasons', zone.season_id, 'snapshot.json'));
		if (meta) raidZones.push({ meta, snapshot, season_id: zone.season_id, label: zone.label });
	}

	return { roster, mplusSnapshot, mplusCompliance, raidZones };
}
