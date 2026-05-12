/**
 * Smoke tests for Stage 3 acceptance criteria (pure-function subset).
 * Run with: node scripts/smoke-test-fetch.mjs
 *
 * Tests covered:
 *  1. computeResilienceLevel — spec algorithm from PRD §10.4
 *  2. getCurrentWoWWeek     — EU reset (Wed 07:00 UTC) week computation
 *  3. generateChangelogEntries — roster diff detects joins, leaves, rerolls, team changes
 *  4. Inactive character filtering — inactive chars never enter the active item list
 *  5. computeCurrentStreak / computeLongestStreak — streak logic
 */

import { computeResilienceLevel, computeResilienceProgress } from '../src/lib/utils/resilience.mjs';
import {
	getCurrentWoWWeek,
	getResetStart,
	getActiveCharacters,
	generateChangelogEntries,
	computeCurrentStreak,
	computeLongestStreak
} from '../src/lib/utils/raider-identity.mjs';

let passed = 0;
let failed = 0;

function assert(condition, label, detail = '') {
	if (condition) {
		console.log(`  PASS ✓  ${label}`);
		passed++;
	} else {
		console.error(`  FAIL ✗  ${label}${detail ? ': ' + detail : ''}`);
		failed++;
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. computeResilienceLevel
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 1. computeResilienceLevel ──────────────────────────────────────');

const runs8dungeons = [
	{ dungeon: 'Windrunner Spire',           mythic_level: 15, timed: true },
	{ dungeon: 'Maisara Caverns',            mythic_level: 14, timed: true },
	{ dungeon: "Magisters' Terrace",          mythic_level: 13, timed: true },
	{ dungeon: 'Nexus-Point Xenas',          mythic_level: 13, timed: true },
	{ dungeon: "Algeth'ar Academy",           mythic_level: 16, timed: true },
	{ dungeon: 'Seat of the Triumvirate',    mythic_level: 13, timed: true },
	{ dungeon: 'Skyreach',                   mythic_level: 12, timed: true }, // lowest
	{ dungeon: 'Pit of Saron',               mythic_level: 14, timed: true }
];

assert(
	computeResilienceLevel(runs8dungeons, 8) === 12,
	'All 8 dungeons timed: Resilience = 12 (lowest key across all)',
	`got ${computeResilienceLevel(runs8dungeons, 8)}`
);

// All dungeons timed at 13+ except Skyreach (12): level = 12 (bottleneck)
const runsWithBottleneck = runs8dungeons.map((r) =>
	r.dungeon === 'Skyreach' ? { ...r, mythic_level: 12 } : r
);
assert(
	computeResilienceLevel(runsWithBottleneck, 8) === 12,
	'Skyreach at 12 is the bottleneck — level stays 12',
	`got ${computeResilienceLevel(runsWithBottleneck, 8)}`
);

// Only 7 of 8 dungeons: no Resilience
const runs7dungeons = runs8dungeons.slice(0, 7);
assert(
	computeResilienceLevel(runs7dungeons, 8) === null,
	'Only 7 of 8 dungeons timed → no Resilience',
	`got ${computeResilienceLevel(runs7dungeons, 8)}`
);

// Empty runs: no Resilience
assert(
	computeResilienceLevel([], 8) === null,
	'Empty best-runs → no Resilience'
);

// Untimed runs don't count
const untimedRuns = runs8dungeons.map((r) => ({ ...r, timed: false }));
assert(
	computeResilienceLevel(untimedRuns, 8) === null,
	'All runs untimed → no Resilience'
);

// 6-dungeon season
const runs6dungeons = runs8dungeons.slice(0, 6).map((r, i) => ({
	...r, mythic_level: 10 + i
}));
const lvl6 = computeResilienceLevel(runs6dungeons, 6);
assert(
	typeof lvl6 === 'number' && lvl6 >= 10,
	`6-dungeon season returns a level (${lvl6})`
);

// computeResilienceProgress
const progress = computeResilienceProgress(runs8dungeons, runs8dungeons.map((r) => r.dungeon));
assert(
	progress['Skyreach'] === 12 && progress["Algeth'ar Academy"] === 16,
	'computeResilienceProgress: per-dungeon best levels are correct'
);

// ─────────────────────────────────────────────────────────────────────────────
// 2. getCurrentWoWWeek — EU reset Wed 07:00 UTC
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 2. getCurrentWoWWeek ───────────────────────────────────────────');

// Wednesday 07:05 UTC — just past reset, new week
const wedAfterReset = new Date('2026-05-13T07:05:00Z'); // Wed
assert(
	getCurrentWoWWeek(wedAfterReset) === '2026-20',
	`Wed 07:05 UTC → week 2026-20 (got ${getCurrentWoWWeek(wedAfterReset)})`
);

// Wednesday 06:59 UTC — still old week
const wedBeforeReset = new Date('2026-05-13T06:59:00Z');
const wkBefore = getCurrentWoWWeek(wedBeforeReset);
assert(
	wkBefore === '2026-19',
	`Wed 06:59 UTC → week 2026-19 (got ${wkBefore})`
);

// Tuesday
const tue = new Date('2026-05-12T12:00:00Z');
assert(
	getCurrentWoWWeek(tue) === '2026-19',
	`Tuesday → still in week 2026-19 (got ${getCurrentWoWWeek(tue)})`
);

// Thursday after reset
const thu = new Date('2026-05-14T12:00:00Z');
assert(
	getCurrentWoWWeek(thu) === '2026-20',
	`Thursday → new week 2026-20 (got ${getCurrentWoWWeek(thu)})`
);

// Reset start should be the correct Wednesday
const resetStart = getResetStart(wedAfterReset);
assert(
	resetStart.getUTCDay() === 3 && resetStart.getUTCHours() === 7,
	`Reset start is a Wednesday at 07:00 UTC (got day=${resetStart.getUTCDay()} h=${resetStart.getUTCHours()})`
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. generateChangelogEntries
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 3. generateChangelogEntries ────────────────────────────────────');

const basePlayer = {
	raider_id: 'aaa-bbb-ccc',
	display_name: 'Testchar',
	status: 'active',
	team_designation: 'main',
	tracking_start_date: '2026-03-17',
	membership_history: [{ event: 'joined', date: '2026-03-17', note: 'Test' }],
	characters: [
		{ name: 'Testchar', realm: 'Draenor', class: 'Rogue', spec: 'Subtlety', role: 'dps', active: true }
	],
	role_history: []
};

const baseRoster = { players: [basePlayer], tracking_start_date: '2026-03-17' };

// ── 3a. New player (not in prev) → 'joined'
const emptyPrevRoster = { players: [] };
const newPlayerEntries = generateChangelogEntries(baseRoster, emptyPrevRoster, '2026-05-13T06:01:00Z', '2026-20');
assert(
	newPlayerEntries.length === 1 && newPlayerEntries[0].event === 'joined',
	`New player detected as 'joined' (got ${newPlayerEntries.length} entries, event=${newPlayerEntries[0]?.event})`
);

// ── 3b. Player left (active → inactive)
const inactiveRoster = {
	players: [{ ...basePlayer, status: 'inactive', membership_history: [
		{ event: 'joined', date: '2026-03-17' },
		{ event: 'left', date: '2026-05-13', note: 'Taking a break' }
	]}]
};
const leftEntries = generateChangelogEntries(inactiveRoster, baseRoster, '2026-05-13T06:01:00Z', '2026-20');
assert(
	leftEntries.length === 1 && leftEntries[0].event === 'left',
	`Player going inactive detected as 'left' (got ${leftEntries.length} entries, event=${leftEntries[0]?.event})`
);

// ── 3c. Team changed (main → alt)
const altRoster = {
	players: [{
		...basePlayer,
		team_designation: 'alt',
		membership_history: [
			{ event: 'joined', date: '2026-03-17' },
			{ event: 'team_changed', date: '2026-05-13', from: 'main', to: 'alt', reason: 'Schedule conflict' }
		]
	}]
};
const teamEntries = generateChangelogEntries(altRoster, baseRoster, '2026-05-13T06:01:00Z', '2026-20');
assert(
	teamEntries.length === 1 && teamEntries[0].event === 'team_changed',
	`Team change detected (event=${teamEntries[0]?.event})`
);
assert(
	teamEntries[0]?.reason === 'Schedule conflict',
	`team_changed entry has correct reason (got "${teamEntries[0]?.reason}")`
);

// ── 3d. Character reroll (old active:false, new active:true)
const rerolledRoster = {
	players: [{
		...basePlayer,
		characters: [
			{ name: 'Testchar', realm: 'Draenor', class: 'Rogue', spec: 'Subtlety', role: 'dps', active: false },
			{ name: 'Newchar', realm: 'Draenor', class: 'Mage', spec: 'Fire', role: 'dps', active: true }
		]
	}]
};
const rerollEntries = generateChangelogEntries(rerolledRoster, baseRoster, '2026-05-13T06:01:00Z', '2026-20');
assert(
	rerollEntries.length === 1 && rerollEntries[0].event === 'rerolled',
	`Character reroll detected (event=${rerollEntries[0]?.event})`
);
assert(
	rerollEntries[0]?.from_character === 'Testchar' && rerollEntries[0]?.to_character === 'Newchar',
	`Reroll maps correct from/to (${rerollEntries[0]?.from_character} → ${rerollEntries[0]?.to_character})`
);

// ── 3e. Spec changed (same role)
const specChangedRoster = {
	players: [{
		...basePlayer,
		characters: [
			{ name: 'Testchar', realm: 'Draenor', class: 'Rogue', spec: 'Outlaw', role: 'dps', active: true }
		]
	}]
};
const specEntries = generateChangelogEntries(specChangedRoster, baseRoster, '2026-05-13T06:01:00Z', '2026-20');
assert(
	specEntries.length === 1 && specEntries[0].event === 'spec_changed',
	`Spec change detected (event=${specEntries[0]?.event})`
);

// ── 3f. No change → no entries
const sameRoster = { players: [{ ...basePlayer }] };
const noChangeEntries = generateChangelogEntries(sameRoster, baseRoster, '2026-05-13T06:01:00Z', '2026-20');
assert(
	noChangeEntries.length === 0,
	`No change → no changelog entries (got ${noChangeEntries.length})`
);

// ── 3g. null prevRoster → no entries (first run)
const firstRunEntries = generateChangelogEntries(baseRoster, null, '2026-05-13T06:01:00Z', '2026-20');
assert(
	firstRunEntries.length === 0,
	`Null previous roster → no entries generated (got ${firstRunEntries.length})`
);

// ─────────────────────────────────────────────────────────────────────────────
// 4. Inactive character filtering
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 4. Inactive character filtering ───────────────────────────────');

const playerWithMixedChars = {
	...basePlayer,
	characters: [
		{ name: 'Active1', realm: 'Draenor', class: 'Rogue', spec: 'Subtlety', role: 'dps', active: true },
		{ name: 'Inactive1', realm: 'Draenor', class: 'Mage', spec: 'Fire', role: 'dps', active: false },
		{ name: 'MissingActive', realm: 'Draenor', class: 'Warrior', spec: 'Arms', role: 'dps' } // no active field
	]
};
const activeChars = getActiveCharacters(playerWithMixedChars);
assert(
	activeChars.length === 1 && activeChars[0].name === 'Active1',
	`Only active:true characters returned (got ${activeChars.map((c) => c.name).join(', ')})`
);
assert(
	!activeChars.some((c) => c.name === 'Inactive1'),
	'active:false character excluded'
);
assert(
	!activeChars.some((c) => c.name === 'MissingActive'),
	'Missing active field treated as inactive'
);

// Simulate building the active item list (the logic in fetch.mjs)
const activeItems = [];
const testRoster = {
	players: [
		{
			...basePlayer,
			raider_id: 'rid-1',
			status: 'active',
			characters: [
				{ name: 'Char1', realm: 'Draenor', class: 'Rogue', spec: 'Subtlety', role: 'dps', active: true },
				{ name: 'OldChar', realm: 'Draenor', class: 'Mage', spec: 'Fire', role: 'dps', active: false }
			]
		},
		{
			...basePlayer,
			raider_id: 'rid-2',
			status: 'inactive', // inactive raider — skip entirely
			characters: [
				{ name: 'InactiveRaiderChar', realm: 'Draenor', class: 'Warrior', spec: 'Arms', role: 'dps', active: true }
			]
		}
	]
};

for (const player of testRoster.players) {
	if (player.status !== 'active') continue;
	const chars = getActiveCharacters(player);
	for (const char of chars) {
		activeItems.push({ player, char });
	}
}

assert(
	activeItems.length === 1 && activeItems[0].char.name === 'Char1',
	`Active items list: only 1 item, Char1 (got ${activeItems.map((i) => i.char.name).join(', ')})`
);
assert(
	!activeItems.some((i) => i.char.name === 'OldChar'),
	'OldChar (active:false) not in active items'
);
assert(
	!activeItems.some((i) => i.player.raider_id === 'rid-2'),
	'Inactive raider entirely excluded'
);

// ─────────────────────────────────────────────────────────────────────────────
// 5. Streak computation
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 5. Streak computation ──────────────────────────────────────────');

// Latest-first weeks
const streakWeeks = [
	{ week: '2026-20', met: true },
	{ week: '2026-19', met: true },
	// 2026-18 missing (cron error)
	{ week: '2026-17', met: true },
	{ week: '2026-16', met: false },
	{ week: '2026-15', met: true }
];

assert(
	computeCurrentStreak(streakWeeks) === 3,
	`current_streak = 3 (true, true, [missing], true: missing is transparent, stop at false; got ${computeCurrentStreak(streakWeeks)})`
);

assert(
	computeLongestStreak(streakWeeks) === 3,
	`longest_streak = 3 (got ${computeLongestStreak(streakWeeks)})`
);

// All met
const allMet = [
	{ week: '2026-20', met: true },
	{ week: '2026-19', met: true },
	{ week: '2026-18', met: true }
];
assert(computeCurrentStreak(allMet) === 3, 'All met → streak = 3');
assert(computeLongestStreak(allMet) === 3, 'All met → longest = 3');

// First week failed
const firstFailed = [
	{ week: '2026-20', met: false },
	{ week: '2026-19', met: true },
	{ week: '2026-18', met: true }
];
assert(computeCurrentStreak(firstFailed) === 0, 'First week failed → streak = 0');
assert(computeLongestStreak(firstFailed) === 2, 'First week failed → longest = 2');

// Empty
assert(computeCurrentStreak([]) === 0, 'Empty weeks → streak = 0');
assert(computeLongestStreak([]) === 0, 'Empty weeks → longest = 0');

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
	console.error('Some tests FAILED.');
	process.exitCode = 1;
} else {
	console.log('All smoke tests PASSED.');
}
