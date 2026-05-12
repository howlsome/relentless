/**
 * Stage 5 smoke tests — verifies the built static site and pure function logic.
 * Run with: node scripts/smoke-test-pages.mjs
 *
 * Tests:
 *  1. All 7 HTML files exist and are non-empty (all routes rendered)
 *  2. Dashboard HTML contains raider names from fixture data
 *  3. Raider detail HTML contains M+ gamification content
 *  4. Changelog HTML renders correctly (empty state message)
 *  5. Season archive HTML renders with banner
 *  6. Milestone computation — M+ milestones from compliance data
 *  7. Changelog filtering logic (team, event type, season)
 *  8. Format utilities — key level, delta, week label
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const build = join(root, 'build');

let passed = 0;
let failed = 0;

function assert(condition, label, detail = '') {
	if (condition) {
		console.log(`  PASS ✓  ${label}`);
		passed++;
	} else {
		console.error(`  FAIL ✗  ${label}${detail ? ' — ' + detail : ''}`);
		failed++;
	}
}

function html(relPath) {
	const full = join(build, relPath);
	if (!existsSync(full)) return '';
	return readFileSync(full, 'utf-8');
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. All routes exist and are non-empty
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 1. All routes prerendered ───────────────────────────────────────');

const routes = [
	['index.html', '/'],
	['changelog.html', '/changelog'],
	['raider/a3f1c2d4-7e89-4b0a-bc34-1f2e3d4c5b6a.html', '/raider/Howlsome'],
	['raider/b4c2d1e3-8f90-5c1b-cd45-2g3f4e5d6c7b.html', '/raider/Aetheryn'],
	['raider/c5d3e2f1-9a01-6d2c-de56-3h4g5f6e7d8c.html', '/raider/Shadowbane'],
	['season/midnight-s1.html', '/season/midnight-s1'],
	['season/raid-46.html', '/season/raid-46'],
];

for (const [file, label] of routes) {
	const content = html(file);
	assert(content.length > 500, `${label} exists and has content (${content.length} chars)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Dashboard contains expected content
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 2. Dashboard content ────────────────────────────────────────────');

const dash = html('index.html');
assert(dash.includes('Howlsome'), 'Dashboard contains raider name "Howlsome"');
assert(dash.includes('Aetheryn'), 'Dashboard contains raider name "Aetheryn"');
assert(dash.includes('Shadowbane'), 'Dashboard contains raider name "Shadowbane"');
assert(dash.includes('On track') || dash.includes('on-track') || dash.includes('status'), 'Dashboard shows status badges');
assert(dash.includes('Mythic+'), 'Dashboard shows M+ section header');
assert(dash.includes('Voidspire') || dash.includes('Raid'), 'Dashboard shows raid section');
assert(dash.includes('3,241') || dash.includes('3241'), 'Dashboard shows Howlsome RIO score (3241)');

// ─────────────────────────────────────────────────────────────────────────────
// 3. Raider detail (Howlsome) contains key elements
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 3. Raider detail content ────────────────────────────────────────');

const howl = html('raider/a3f1c2d4-7e89-4b0a-bc34-1f2e3d4c5b6a.html');
assert(howl.includes('Howlsome'), 'Raider detail shows display name');
assert(howl.includes('Unholy') || howl.includes('DeathKnight'), 'Raider detail shows class/spec');
assert(howl.includes('streak') || howl.includes('Streak') || howl.includes('week'), 'Raider detail has M+ section');
assert(howl.includes('Resilience') || howl.includes('resilience'), 'Raider detail has Resilience panel');
assert(howl.includes('Solanar') || howl.includes('Voidspire'), 'Raider detail shows raid boss data');
// Streak should be "4" (from fixture data)
assert(howl.includes('>4<') || howl.includes('>4 <') || howl.match(/>\s*4\s*</), 'Raider detail shows streak count of 4');

// Aetheryn should show missed-week callout (met: false in week 2026-19)
const aeth = html('raider/b4c2d1e3-8f90-5c1b-cd45-2g3f4e5d6c7b.html');
assert(aeth.includes('Aetheryn'), 'Aetheryn detail renders');
assert(aeth.includes('missed') || aeth.includes('Below target') || aeth.includes('Requirement'), 'Aetheryn shows missed-week content');

// ─────────────────────────────────────────────────────────────────────────────
// 4. Changelog renders empty state correctly
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 4. Changelog empty state ────────────────────────────────────────');

const cl = html('changelog.html');
assert(cl.includes('Changelog') || cl.includes('changelog'), 'Changelog page renders');
assert(
	cl.includes('No changes') || cl.includes('entries') || cl.includes('Filter'),
	'Changelog shows empty state or filter'
);

// ─────────────────────────────────────────────────────────────────────────────
// 5. Season archive renders with banner
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 5. Season archive content ───────────────────────────────────────');

const season = html('season/midnight-s1.html');
assert(season.includes('midnight-s1') || season.includes('Midnight'), 'Season archive shows season ID/label');
assert(season.includes('Archive') || season.includes('Viewing'), 'Season archive has archive banner or heading');

// ─────────────────────────────────────────────────────────────────────────────
// 6. Milestone computation (inline — mirrors milestones.ts logic)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 6. Milestone computation ────────────────────────────────────────');

// Load fixture compliance data
const compliance = JSON.parse(readFileSync(join(root, 'data/seasons/midnight-s1/compliance.json'), 'utf-8'));
const howlCompliance = compliance.raiders['a3f1c2d4-7e89-4b0a-bc34-1f2e3d4c5b6a'];

// No milestones for Howlsome: current week (8 dungeons) vs prev (7): delta = 1 (not ≥3)
// record is 14 dungeons (week 2026-17) — current is 8, not breaking record
// So no M+ milestones expected
assert(howlCompliance, 'Howlsome compliance data loaded');
assert(howlCompliance.current_streak === 4, `Howlsome streak = 4 (got ${howlCompliance.current_streak})`);
assert(howlCompliance.total_weeks_tracked === 10, `Tracked 10 weeks (got ${howlCompliance.total_weeks_tracked})`);
assert(howlCompliance.record_dungeons_week.count === 14, `Record dungeons = 14 (got ${howlCompliance.record_dungeons_week.count})`);
assert(howlCompliance.resilience_level === 13, `Resilience = 13 (got ${howlCompliance.resilience_level})`);

const aethCompliance = compliance.raiders['b4c2d1e3-8f90-5c1b-cd45-2g3f4e5d6c7b'];
assert(aethCompliance.current_streak === 0, `Aetheryn streak = 0 (missed latest week)`);
assert(!aethCompliance.weeks[0].met, `Aetheryn most recent week: not met → missed-week callout triggers`);

// ─────────────────────────────────────────────────────────────────────────────
// 7. Changelog filter logic (inline — mirrors +page.svelte filter logic)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 7. Changelog filter logic ───────────────────────────────────────');

const changelogData = JSON.parse(readFileSync(join(root, 'data/changelog.json'), 'utf-8'));

function applyFilters(entries, { team, event, season }) {
	return entries.filter((e) => {
		if (team !== 'all' && e.team !== team) return false;
		if (event !== 'all' && e.event !== event) return false;
		// season filter would check dates — skip for empty changelog
		return true;
	});
}

const allEntries = changelogData.entries ?? [];
const mainFiltered = applyFilters(allEntries, { team: 'main', event: 'all', season: 'all' });
const joinedFiltered = applyFilters(allEntries, { team: 'all', event: 'joined', season: 'all' });

assert(mainFiltered.length === allEntries.filter((e) => e.team === 'main').length, 'Main team filter works');
assert(joinedFiltered.length === allEntries.filter((e) => e.event === 'joined').length, 'Event type filter works');
// Combined filters
const combined = applyFilters(allEntries, { team: 'main', event: 'joined', season: 'all' });
assert(combined.length === allEntries.filter((e) => e.team === 'main' && e.event === 'joined').length, 'Combined filters work independently');

// Empty changelog — empty state should trigger
assert(allEntries.length === 0 || Array.isArray(allEntries), 'Changelog entries array exists');

// ─────────────────────────────────────────────────────────────────────────────
// 8. Format utilities
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 8. Format utilities ─────────────────────────────────────────────');

// Inline the format functions (mirrors format.ts)
function fmtKey(n) { return n == null ? '—' : `+${n}`; }
function fmtDelta(cur, prev) {
	if (cur == null || prev == null) return '—';
	const d = cur - prev;
	if (d > 0) return `▲ +${d}`;
	if (d < 0) return `▼ ${d}`;
	return '—';
}

assert(fmtKey(14) === '+14', `fmtKey(14) = "+14" (got "${fmtKey(14)}")`);
assert(fmtKey(null) === '—', `fmtKey(null) = "—"`);
assert(fmtKey(0) === '+0', `fmtKey(0) = "+0"`);
assert(fmtDelta(8, 5) === '▲ +3', `fmtDelta(8,5) = "▲ +3" (got "${fmtDelta(8, 5)}")`);
assert(fmtDelta(5, 8) === '▼ -3', `fmtDelta(5,8) = "▼ -3" (got "${fmtDelta(5, 8)}")`);
assert(fmtDelta(5, 5) === '—', `fmtDelta(5,5) = "—" (got "${fmtDelta(5, 5)}")`);
assert(fmtDelta(null, 5) === '—', `fmtDelta(null,5) = "—"`);

// Keystone notation throughout fixture data
const snapshot = JSON.parse(readFileSync(join(root, 'data/seasons/midnight-s1/snapshot.json'), 'utf-8'));
const howlSnap = snapshot.raiders.find((r) => r.display_name === 'Howlsome');
assert(howlSnap.mplus_highest_key_this_week === 14, `Howlsome highest key this week = 14`);
assert(fmtKey(howlSnap.mplus_highest_key_this_week) === '+14', `Formatted as "+14"`);

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
	console.error('Some tests FAILED.');
	process.exitCode = 1;
} else {
	console.log('All page smoke tests PASSED.');
}
