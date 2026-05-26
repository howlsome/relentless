/**
 * Smoke test for Stage 2 acceptance criteria:
 *   1. data/roster.json validates against the schema (no errors)
 *   2. An invalid class/spec combination is correctly rejected (Holy Mage)
 *   3. A role mismatch produces a warning but is not a hard error
 *
 * Run with: node scripts/validate-roster.mjs
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// ─── Inline class/spec table (mirrors src/lib/utils/roster.ts) ────────────────
const CLASS_SPECS = {
	DeathKnight: { Blood: 'tank', Frost: 'dps', Unholy: 'dps' },
	DemonHunter: { Havoc: 'dps', Vengeance: 'tank', Devourer: 'dps' },
	Druid: { Balance: 'dps', Feral: 'dps', Guardian: 'tank', Restoration: 'healer' },
	Evoker: { Devastation: 'dps', Preservation: 'healer', Augmentation: 'dps' },
	Hunter: { 'Beast Mastery': 'dps', Marksmanship: 'dps', Survival: 'dps' },
	Mage: { Arcane: 'dps', Fire: 'dps', Frost: 'dps' },
	Monk: { Brewmaster: 'tank', Mistweaver: 'healer', Windwalker: 'dps' },
	Paladin: { Holy: 'healer', Protection: 'tank', Retribution: 'dps' },
	Priest: { Discipline: 'healer', Holy: 'healer', Shadow: 'dps' },
	Rogue: { Assassination: 'dps', Outlaw: 'dps', Subtlety: 'dps' },
	Shaman: { Elemental: 'dps', Enhancement: 'dps', Restoration: 'healer' },
	Warlock: { Affliction: 'dps', Demonology: 'dps', Destruction: 'dps' },
	Warrior: { Arms: 'dps', Fury: 'dps', Protection: 'tank' },
};

function isValidClassSpec(cls, spec) {
	const specs = CLASS_SPECS[cls];
	if (!specs) return false;
	return spec in specs;
}

function canonicalRole(cls, spec) {
	return CLASS_SPECS[cls]?.[spec] ?? null;
}

function validateCharacter(char, raiderName) {
	const errors = [];
	const warnings = [];
	const label = `${raiderName} / ${char.name ?? '(unnamed)'}`;

	if (!char.name) errors.push(`${label}: missing character name`);
	if (!char.realm) errors.push(`${label}: missing realm`);
	if (!char.class) errors.push(`${label}: missing class`);
	if (char.active === undefined || char.active === null) {
		warnings.push(`${label}: "active" field is missing — treated as inactive`);
	}

	// Support both legacy flat spec/role and new specs[] array format
	const specsToCheck = char.specs?.length
		? char.specs
		: char.spec && char.role
			? [{ spec: char.spec, role: char.role, primary: true }]
			: [];

	if (specsToCheck.length === 0) {
		errors.push(`${label}: missing spec/role (neither flat spec/role nor specs[] found)`);
	}

	for (const { spec, role } of specsToCheck) {
		if (!isValidClassSpec(char.class, spec)) {
			errors.push(`${label}: INVALID class/spec "${char.class} / ${spec}"`);
		} else if (role) {
			const canonical = canonicalRole(char.class, spec);
			if (canonical && canonical !== role) {
				warnings.push(`${label}: spec "${spec}" is a ${canonical} spec but role is "${role}"`);
			}
		}
	}

	return { valid: errors.length === 0, errors, warnings };
}

function validateRoster(roster) {
	const errors = [];
	const warnings = [];

	if (!roster.app_name) errors.push('Missing app_name');
	if (!roster.realm) errors.push('Missing realm');
	if (!roster.region) errors.push('Missing region');
	if (typeof roster.mplus_weekly_minimum !== 'number')
		errors.push('mplus_weekly_minimum must be a number');
	if (typeof roster.mplus_minimum_key_level !== 'number')
		errors.push('mplus_minimum_key_level must be a number');
	if (!roster.tracking_start_date) errors.push('Missing tracking_start_date');
	if (!Array.isArray(roster.mplus_seasons) || roster.mplus_seasons.length === 0)
		errors.push('mplus_seasons must be non-empty');
	if (!Array.isArray(roster.players)) errors.push('players must be an array');

	const seenIds = new Set();
	for (const player of roster.players ?? []) {
		if (player.raider_id && seenIds.has(player.raider_id))
			errors.push(`Duplicate raider_id: ${player.raider_id}`);
		seenIds.add(player.raider_id);

		const label = player.display_name || player.raider_id;
		if (!player.raider_id) errors.push(`${label}: missing raider_id`);
		if (!player.display_name) errors.push(`${label}: missing display_name`);
		if (player.status !== 'active' && player.status !== 'inactive')
			errors.push(`${label}: invalid status "${player.status}"`);
		if (player.team_designation !== 'main' && player.team_designation !== 'alt')
			errors.push(`${label}: invalid team_designation "${player.team_designation}"`);

		for (const char of player.characters ?? []) {
			const r = validateCharacter(char, label);
			errors.push(...r.errors);
			warnings.push(...r.warnings);
		}

		for (const event of player.membership_history ?? []) {
			if (event.event === 'team_changed' && !event.reason) {
				warnings.push(`${label}: team_changed event on ${event.date} is missing a reason`);
			}
		}
	}
	return { valid: errors.length === 0, errors, warnings };
}

// ─── Test 1: validate the actual roster.json ─────────────────────────────────
console.log('=== Test 1: data/roster.json validates against the schema ===');
const roster = JSON.parse(readFileSync(join(root, 'data/roster.json'), 'utf-8'));
const result1 = validateRoster(roster);

if (result1.warnings.length > 0) {
	console.log('Warnings:');
	for (const w of result1.warnings) console.log('  ⚠', w);
}
if (!result1.valid) {
	console.error('FAIL — errors:');
	for (const e of result1.errors) console.error('  ✗', e);
	process.exitCode = 1;
} else {
	console.log('PASS ✓ — roster.json is valid');
}

// ─── Test 2: invalid class/spec (Holy Mage) is rejected ──────────────────────
console.log('\n=== Test 2: Holy Mage is rejected ===');
const invalidRoster = structuredClone(roster);
invalidRoster.players.push({
	raider_id: crypto.randomUUID(),
	display_name: 'HolyMage',
	status: 'active',
	team_designation: 'main',
	membership_history: [{ event: 'joined', date: '2026-03-17' }],
	characters: [
		{
			name: 'Holymagebad',
			realm: 'Draenor',
			class: 'Mage',
			spec: 'Holy',
			role: 'healer',
			active: true,
		},
	],
	role_history: [],
});
const result2 = validateRoster(invalidRoster);
const hasBadComboError = result2.errors.some((e) => e.includes('Mage') && e.includes('Holy'));
if (hasBadComboError) {
	console.log(
		'PASS ✓ — Holy Mage correctly rejected:',
		result2.errors.find((e) => e.includes('Mage')),
	);
} else {
	console.error('FAIL — Holy Mage was not rejected');
	process.exitCode = 1;
}

// ─── Test 3: role mismatch is a warning, not an error ────────────────────────
console.log('\n=== Test 3: Holy Paladin listed as DPS → warning, not error ===');
const mismatchRoster = structuredClone(roster);
mismatchRoster.players.push({
	raider_id: crypto.randomUUID(),
	display_name: 'MismatchPally',
	status: 'active',
	team_designation: 'main',
	membership_history: [{ event: 'joined', date: '2026-03-17' }],
	characters: [
		{ name: 'Pallydps', realm: 'Draenor', class: 'Paladin', spec: 'Holy', role: 'dps', active: true },
	],
	role_history: [],
});
const result3 = validateRoster(mismatchRoster);
const hasMismatchWarning = result3.warnings.some(
	(w) => w.includes('Pallydps') || w.includes('Holy'),
);
const hasMismatchError = result3.errors.some((e) => e.includes('Pallydps'));
if (hasMismatchWarning && !hasMismatchError) {
	console.log(
		'PASS ✓ — role mismatch is a warning, not an error:',
		result3.warnings.find((w) => w.includes('Holy')),
	);
} else {
	console.error('FAIL — role mismatch not handled correctly');
	console.error(
		'  errors:',
		result3.errors.filter((e) => e.includes('Pallydps')),
	);
	console.error(
		'  warnings:',
		result3.warnings.filter((w) => w.includes('Holy')),
	);
	process.exitCode = 1;
}

console.log('\nSmoke tests complete.');
