export const prerender = true;

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

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
export function load() {
	const dataDir = join(process.cwd(), 'data');

	/** @type {import('$lib/types').Roster} */
	const roster = JSON.parse(readFileSync(join(dataDir, 'roster.json'), 'utf-8'));
	/** @type {import('$lib/types').SeasonsIndex} */
	const seasonsIndex = JSON.parse(readFileSync(join(dataDir, 'seasons', 'index.json'), 'utf-8'));

	const activeMplusSeasonId = seasonsIndex.active_mplus_season ?? '';
	const mplusSnapshot = activeMplusSeasonId
		? safeJson(join(dataDir, 'seasons', activeMplusSeasonId, 'snapshot.json'))
		: null;
	const mplusCompliance = activeMplusSeasonId
		? safeJson(join(dataDir, 'seasons', activeMplusSeasonId, 'compliance.json'))
		: null;

	const raidZones = [];
	for (const zone of seasonsIndex.all_raid_zones ?? []) {
		const meta = safeJson(join(dataDir, 'seasons', zone.season_id, 'meta.json'));
		const snapshot = safeJson(join(dataDir, 'seasons', zone.season_id, 'snapshot.json'));
		if (meta) raidZones.push({ meta, snapshot, season_id: zone.season_id, label: zone.label });
	}

	// Derive default difficulty from mythic_start_date of the primary raid zone.
	// Primary zone = live (non-beta, non-composite) zone with the most bosses.
	const primaryZone = (() => {
		const live = raidZones.filter((z) => {
			const l = z.label.toLowerCase();
			return !l.includes('beta') && !l.includes('complete');
		});
		const pool = live.length ? live : raidZones;
		return (
			[...pool].sort((a, b) => (b.meta?.bosses?.length ?? 0) - (a.meta?.bosses?.length ?? 0))[0] ??
			null
		);
	})();
	const mythicStartDate = primaryZone
		? (roster.raid_difficulty_status?.[primaryZone.season_id]?.mythic_start_date ?? null)
		: null;
	const today = new Date().toISOString().slice(0, 10);
	const primaryRaidDifficulty =
		mythicStartDate && today >= mythicStartDate
			? /** @type {'mythic'} */ ('mythic')
			: /** @type {'heroic'} */ (roster.primary_raid_difficulty ?? 'heroic');

	return {
		roster,
		mplusSnapshot,
		mplusCompliance,
		raidZones,
		primaryRaidDifficulty,
	};
}
