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

	const seasonMeta =
		seasonsIndex.all_mplus_seasons.find((s) => s.season_id === params.season_id) ??
		seasonsIndex.all_raid_zones.find((z) => z.season_id === params.season_id) ??
		null;

	const sid = params.season_id ?? '';
	const snapshot = safeJson(join(dataDir, 'seasons', sid, 'snapshot.json'));
	const compliance = safeJson(join(dataDir, 'seasons', sid, 'compliance.json'));
	const meta = safeJson(join(dataDir, 'seasons', sid, 'meta.json'));

	return {
		season_id: params.season_id,
		seasonMeta,
		roster,
		snapshot,
		compliance,
		zoneMeta: meta
	};
}
