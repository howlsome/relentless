/**
 * Milestone computation — runs at render time from static JSON data.
 * Returns a list of milestone objects to display as banners on the raider detail page.
 */

import type { RaiderCompliance, ComplianceWeek } from '$lib/types/compliance.js';
import type { BossParse } from '$lib/types/weekly.js';
import { fmtKey } from '$lib/utils/format.js';

export interface Milestone {
	key: string;
	text: string;
	emoji: string;
}

/**
 * Compute M+ milestones for a raider from their compliance data.
 * Compares current week against previous week and historical records.
 */
export function computeMplusMilestones(compliance: RaiderCompliance | null | undefined): Milestone[] {
	if (!compliance || compliance.weeks.length === 0) return [];

	const milestones: Milestone[] = [];
	// weeks are stored latest-first
	const [current, previous] = compliance.weeks;
	if (!current) return milestones;

	const prevCount = previous?.total_dungeons ?? null;
	const prevKey = previous?.highest_key_level ?? null;
	const prevRecord = compliance.record_dungeons_week;
	const prevKeyRecord = compliance.record_highest_key;

	// Dungeon record broken
	if (
		prevRecord &&
		current.total_dungeons > prevRecord.count &&
		current.week === prevRecord.week
	) {
		milestones.push({
			key: 'dungeon-record',
			emoji: '🏅',
			text: `New personal dungeon record — ${current.total_dungeons} this week!`
		});
	}

	// Key level record broken
	if (
		prevKeyRecord &&
		current.highest_key_level != null &&
		current.highest_key_level > prevKeyRecord.level &&
		current.week === prevKeyRecord.week
	) {
		milestones.push({
			key: 'key-record',
			emoji: '🗝️',
			text: `New highest key — ${fmtKey(current.highest_key_level)} this week!`
		});
	}

	// Dungeon volume big jump up (≥ 3 more than last week)
	if (prevCount != null && current.total_dungeons - prevCount >= 3) {
		milestones.push({
			key: 'volume-up',
			emoji: '⬆️',
			text: `Big week — ${current.total_dungeons} dungeons, up +${current.total_dungeons - prevCount} from last week!`
		});
	}

	// Dungeon volume big drop down (≥ 3 fewer than last week)
	if (prevCount != null && prevCount - current.total_dungeons >= 3) {
		milestones.push({
			key: 'volume-down',
			emoji: '⬇️',
			text: `Quieter week — ${current.total_dungeons} dungeons, down ${current.total_dungeons - prevCount} from last week.`
		});
	}

	return milestones;
}

/**
 * Compute raid parse milestones for a single boss, given its full parse history.
 * parsesDesc: array of parse percentiles, newest first (nulls for missed weeks).
 */
export function computeBossMilestones(
	bossName: string,
	parsesDesc: (number | null)[],
	difficulty: string
): Milestone[] {
	const milestones: Milestone[] = [];
	const [current, ...history] = parsesDesc;
	if (current == null) return milestones;

	const prevKills = history.filter((p): p is number => p != null);

	// First kill
	if (prevKills.length === 0) {
		milestones.push({
			key: `first-kill-${bossName}`,
			emoji: '🗡️',
			text: `First kill recorded on ${bossName}!`
		});
		return milestones; // First kill supersedes all other milestones
	}

	const prevBest = Math.max(...prevKills);

	// Personal best
	if (current > prevBest) {
		milestones.push({
			key: `pb-${bossName}`,
			emoji: '🏆',
			text: `New personal best on ${bossName}! (${current.toFixed(0)}%)`
		});
	}

	// First purple+ (75+) ever
	if (current >= 75 && prevKills.every((p) => p < 75)) {
		milestones.push({
			key: `first-purple-${bossName}`,
			emoji: '💜',
			text: `First Rare parse on ${bossName}!`
		});
	}

	// First orange+ (95+) ever
	if (current >= 95 && prevKills.every((p) => p < 95)) {
		milestones.push({
			key: `first-orange-${bossName}`,
			emoji: '🔥',
			text: `First Epic parse on ${bossName}!`
		});
	}

	// 3 consecutive weeks of improvement
	if (prevKills.length >= 3) {
		const [p1, p2, p3] = prevKills;
		if (current > p1 && p1 > p2 && p2 > p3) {
			milestones.push({
				key: `3-improve-${bossName}`,
				emoji: '📈',
				text: `Three weeks of improvement on ${bossName}!`
			});
		}
	}

	return milestones;
}


/**
 * Extract the parse history for a boss across all compliance weeks.
 * Returns array of percentiles newest-first, with nulls for weeks with no kill.
 */
export function extractBossParseHistory(
	bossId: number,
	difficulty: string,
	weeklySnapshots: Array<{ week: string; raiders: Array<{ raider_id: string; raid_parses: BossParse[] }> }>,
	raiderId: string
): (number | null)[] {
	return weeklySnapshots.map((snap) => {
		const raider = snap.raiders.find((r) => r.raider_id === raiderId);
		if (!raider) return null;
		const parse = raider.raid_parses.find((p) => p.boss_id === bossId);
		if (!parse) return null;
		const diff = parse.difficulties[difficulty as keyof typeof parse.difficulties];
		if (!diff?.kill) return null;
		return diff.parse_percentile;
	});
}

/**
 * Determine whether this week is the most recent week in the compliance data.
 * If the most recent entry's `met` is false, the missed-week callout should show.
 */
export function shouldShowMissedWeekCallout(compliance: RaiderCompliance | null | undefined): {
	show: boolean;
	count: number;
	required: number;
} {
	if (!compliance || compliance.weeks.length === 0) return { show: false, count: 0, required: 4 };
	const latest = compliance.weeks[0]; // latest-first
	return {
		show: !latest.met,
		count: latest.count,
		required: 4 // from roster config; passed separately in real use
	};
}
