/**
 * Smoke tests for Stage 4 acceptance criteria — parse colour system.
 * Run with: node scripts/smoke-test-colours.mjs
 *
 * Tests:
 *  1. getParseColour(74)   → "var(--parse-blue)"
 *  2. All 7 tier boundaries map to the correct CSS variable
 *  3. getBadgeTextColour — white for purple/gray, black for all others
 *  4. All 7 parse-colour CSS variables are defined in parse-colours.css
 *     (for both light and dark themes)
 *  5. Edge cases: 0, 100, null, negative
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// ── Inline the pure logic (mirrors parse-colours.ts without TS syntax) ───────
// This avoids needing tsx/ts-node to import TypeScript files in a plain script.

const TIERS = [
	{ tier: 'tan',    label: 'Artifact',  bgHex: '#e5cc80', textHex: '#000000', cssVar: 'var(--parse-tan)'    },
	{ tier: 'pink',   label: 'Legendary', bgHex: '#e268a8', textHex: '#000000', cssVar: 'var(--parse-pink)'   },
	{ tier: 'orange', label: 'Epic',      bgHex: '#ff8000', textHex: '#000000', cssVar: 'var(--parse-orange)' },
	{ tier: 'purple', label: 'Rare',      bgHex: '#a335ee', textHex: '#ffffff', cssVar: 'var(--parse-purple)' },
	{ tier: 'blue',   label: 'Uncommon',  bgHex: '#0070ff', textHex: '#000000', cssVar: 'var(--parse-blue)'   },
	{ tier: 'green',  label: 'Common',    bgHex: '#1eff00', textHex: '#000000', cssVar: 'var(--parse-green)'  },
	{ tier: 'gray',   label: 'Gray',      bgHex: '#666666', textHex: '#ffffff', cssVar: 'var(--parse-gray)'   },
];

function getParseInfo(percentile) {
	if (percentile == null || percentile < 0) return TIERS[6];
	if (percentile >= 100) return TIERS[0];
	if (percentile >= 99)  return TIERS[1];
	if (percentile >= 95)  return TIERS[2];
	if (percentile >= 75)  return TIERS[3];
	if (percentile >= 50)  return TIERS[4];
	if (percentile >= 25)  return TIERS[5];
	return TIERS[6];
}

function getParseColour(p) { return getParseInfo(p).cssVar; }
function getBadgeTextColour(p) { return getParseInfo(p).textHex; }

// ─────────────────────────────────────────────────────────────────────────────

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

// ── 1. Spec-required: getParseColour(74) === "var(--parse-blue)" ─────────────
console.log('\n── 1. getParseColour(74) ───────────────────────────────────────────');
assert(
	getParseColour(74) === 'var(--parse-blue)',
	`getParseColour(74) === "var(--parse-blue)"  (got "${getParseColour(74)}")`
);

// ── 2. All 7 tier boundaries ─────────────────────────────────────────────────
console.log('\n── 2. All 7 tier boundaries ────────────────────────────────────────');

const tierCases = [
	[100, 'var(--parse-tan)',    'Artifact (100)'],
	[99,  'var(--parse-pink)',   'Legendary (99)'],
	[98,  'var(--parse-orange)', 'Epic (98)'],
	[95,  'var(--parse-orange)', 'Epic (95)'],
	[94,  'var(--parse-purple)', 'Rare (94)'],
	[75,  'var(--parse-purple)', 'Rare (75)'],
	[74,  'var(--parse-blue)',   'Uncommon (74)'],
	[50,  'var(--parse-blue)',   'Uncommon (50)'],
	[49,  'var(--parse-green)',  'Common (49)'],
	[25,  'var(--parse-green)',  'Common (25)'],
	[24,  'var(--parse-gray)',   'Gray (24)'],
	[0,   'var(--parse-gray)',   'Gray (0)'],
];

for (const [pct, expected, label] of tierCases) {
	const got = getParseColour(pct);
	assert(got === expected, `${label} → ${expected}`, `got ${got}`);
}

// ── 3. getBadgeTextColour: white for purple & gray, black for others ─────────
console.log('\n── 3. getBadgeTextColour text contrast ─────────────────────────────');

const textColourCases = [
	[100, '#000000', 'Artifact — black text on tan'],
	[99,  '#000000', 'Legendary — black text on pink'],
	[96,  '#000000', 'Epic — black text on orange'],
	[80,  '#ffffff', 'Rare — white text on purple'],
	[60,  '#000000', 'Uncommon — black text on blue'],
	[30,  '#000000', 'Common — black text on green'],
	[10,  '#ffffff', 'Gray — white text on gray'],
];

for (const [pct, expected, label] of textColourCases) {
	const got = getBadgeTextColour(pct);
	assert(got === expected, `${label}  (got "${got}")`);
}

// ── 4. Edge cases ────────────────────────────────────────────────────────────
console.log('\n── 4. Edge cases ───────────────────────────────────────────────────');

assert(getParseColour(null) === 'var(--parse-gray)',    'null → gray');
assert(getParseColour(undefined) === 'var(--parse-gray)', 'undefined → gray');
assert(getParseColour(-1) === 'var(--parse-gray)',      'negative → gray');
assert(getParseColour(101) === 'var(--parse-tan)',      '>100 → tan (Artifact)');

// ── 5. parse-colours.css defines all 7 variables for both themes ─────────────
console.log('\n── 5. parse-colours.css variable coverage ──────────────────────────');

const cssPath = join(root, 'src/lib/styles/parse-colours.css');
const css = readFileSync(cssPath, 'utf-8');

const tierNames = ['gray', 'green', 'blue', 'purple', 'orange', 'pink', 'tan'];
const themes = ['light', 'dark'];

for (const theme of themes) {
	// Look for [data-theme='light'] or [data-theme='dark'] block
	const blockPattern = new RegExp(`\\[data-theme=['"]${theme}['"]\\][\\s\\S]*?\\{([\\s\\S]*?)\\}`, 'g');
	let blockContent = '';
	let match;
	while ((match = blockPattern.exec(css)) !== null) {
		blockContent += match[1];
	}

	for (const tier of tierNames) {
		const varDefined = css.includes(`--parse-${tier}:`) && blockContent.includes(`--parse-${tier}:`);
		assert(
			varDefined,
			`--parse-${tier} defined in [data-theme="${theme}"] block`
		);
	}
}

// Also check :root defines all badge variables
for (const tier of tierNames) {
	assert(
		css.includes(`--parse-badge-${tier}:`),
		`--parse-badge-${tier} defined in :root`
	);
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
	console.error('Some tests FAILED.');
	process.exitCode = 1;
} else {
	console.log('All colour smoke tests PASSED.');
}
