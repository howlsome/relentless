/**
 * Resilience achievement level computation.
 *
 * Resilience = completing all N season dungeons timed at a given key level.
 * Computed from `mythic_plus_best_runs` returned by the Raider.io profile endpoint.
 */

/**
 * Compute the player's current Resilience level.
 *
 * @param {Array<{dungeon: string, mythic_level: number, timed: boolean}>} bestRuns
 * @param {number} seasonDungeonCount  Number of unique dungeons in the season (default 8).
 * @returns {number|null} Resilience level or null if not yet achieved.
 */
export function computeResilienceLevel(bestRuns, seasonDungeonCount = 8) {
	const timed = (bestRuns ?? []).filter((r) => r.timed);
	if (timed.length === 0) return null;

	// Collect all distinct levels present in timed runs, sorted descending
	const levels = [...new Set(timed.map((r) => r.mythic_level))].sort((a, b) => b - a);

	for (const level of levels) {
		// Count unique dungeons where the best timed run is at or above this level
		const dungeonsAtOrAbove = new Set(
			timed.filter((r) => r.mythic_level >= level).map((r) => r.dungeon)
		);
		if (dungeonsAtOrAbove.size >= seasonDungeonCount) {
			return level;
		}
	}
	return null;
}

/**
 * Compute per-dungeon progress toward the next Resilience level.
 * Returns an object mapping each dungeon name to the highest timed key level achieved.
 * Dungeons in `seasonDungeons` that have no timed run are mapped to 0.
 *
 * @param {Array<{dungeon: string, mythic_level: number, timed: boolean}>} bestRuns
 * @param {string[]} seasonDungeons  Canonical dungeon list from the active M+ season.
 * @returns {Record<string, number>}
 */
export function computeResilienceProgress(bestRuns, seasonDungeons) {
	/** @type {Record<string, number>} */
	const progress = {};

	for (const dungeon of seasonDungeons ?? []) {
		progress[dungeon] = 0;
	}

	for (const run of bestRuns ?? []) {
		if (!run.timed) continue;
		const current = progress[run.dungeon] ?? 0;
		if (run.mythic_level > current) {
			progress[run.dungeon] = run.mythic_level;
		}
	}

	return progress;
}

/**
 * Return per-dungeon progress toward a specific target Resilience level.
 * For each dungeon: includes best timed level, whether it meets target, and shortfall.
 *
 * @param {Array<{dungeon: string, mythic_level: number, timed: boolean}>} bestRuns
 * @param {number} targetLevel
 * @returns {Array<{dungeon: string, best: number, ready: boolean, shortfall: number}>}
 */
export function getResilienceProgress(bestRuns, targetLevel) {
	/** @type {Map<string, number>} */
	const bestMap = new Map();
	for (const run of bestRuns ?? []) {
		if (!run.timed) continue;
		const cur = bestMap.get(run.dungeon) ?? 0;
		if (run.mythic_level > cur) bestMap.set(run.dungeon, run.mythic_level);
	}
	return [...bestMap.entries()].map(([dungeon, best]) => ({
		dungeon,
		best,
		ready: best >= targetLevel,
		shortfall: Math.max(0, targetLevel - best)
	}));
}
