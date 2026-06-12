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

	const today = new Date().toISOString().slice(0, 10);

	const raidZones = [];
	for (const zone of seasonsIndex.all_raid_zones ?? []) {
		const meta = safeJson(join(dataDir, 'seasons', zone.season_id, 'meta.json'));
		const snapshot = safeJson(join(dataDir, 'seasons', zone.season_id, 'snapshot.json'));
		if (meta) raidZones.push({ meta, snapshot, season_id: zone.season_id, label: zone.label });
	}

	// Merge extra raid zones into the base zone once their start_date is reached.
	// This combines boss columns and raider parse data into a single unified view.
	const zoneCombination = roster.zone_combination;
	if (zoneCombination && today >= zoneCombination.start_date) {
		const baseIdx = raidZones.findIndex((z) => z.season_id === `raid-${zoneCombination.base_id}`);
		if (baseIdx >= 0) {
			const base = raidZones[baseIdx];
			const extraSeasonIds = new Set((zoneCombination.extra_ids ?? []).map((id) => `raid-${id}`));
			const extras = raidZones.filter((z) => extraSeasonIds.has(z.season_id));
			for (const extra of extras) {
				base.meta = {
					...base.meta,
					name: zoneCombination.label,
					bosses: [...(base.meta?.bosses ?? []), ...(extra.meta?.bosses ?? [])],
				};
				if (base.snapshot) {
					const extraRaiders = new Map((extra.snapshot?.raiders ?? []).map((r) => [r.raider_id, r]));
					base.snapshot = {
						...base.snapshot,
						raid_tier: {
							...base.snapshot.raid_tier,
							name: zoneCombination.label,
							bosses: base.meta.bosses,
						},
						raiders: (base.snapshot.raiders ?? []).map((r) => ({
							...r,
							raid_parses: [
								...(r.raid_parses ?? []),
								...(extraRaiders.get(r.raider_id)?.raid_parses ?? []),
							],
						})),
					};
				}
			}
			// Remove extra zones — absorbed into base
			raidZones.splice(
				0,
				raidZones.length,
				...raidZones.filter((z) => !extraSeasonIds.has(z.season_id)),
			);
		}
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
	// Only default to mythic once the date has passed AND kills exist — avoids
	// showing blank parses when mythic_start_date is set for lockout-detection
	// purposes before the guild has any actual mythic kills recorded.
	const hasMythicKills = primaryZone?.snapshot?.raiders?.some((r) =>
		r.raid_parses?.some((bp) => bp.difficulties?.mythic?.kill),
	);
	const primaryRaidDifficulty =
		mythicStartDate && today >= mythicStartDate && hasMythicKills
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
