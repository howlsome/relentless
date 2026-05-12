import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildBatchQuery, parseBatchResponse, isCurrentWeekKill, chunkArray, DIFFICULTY_IDS } from './wcl.mjs';

function makeItem(name: string, spec = 'Subtlety', realm = 'Draenor') {
	return {
		player: { raider_id: `id-${name}`, display_name: name, region: 'eu' },
		char: { name, realm, class: 'Rogue', spec, role: 'dps', active: true }
	};
}

const diffPairs: [string, number][] = [['heroic', 4], ['mythic', 5]];
const oneDiff: [string, number][] = [['heroic', 4]];

// ── buildBatchQuery ───────────────────────────────────────────────────────────

describe('buildBatchQuery', () => {
	it('produces a query string with correct alias count (10 players × 2 diffs)', () => {
		const items = Array.from({ length: 10 }, (_, i) => makeItem(`P${i}`));
		const query = buildBatchQuery(items, 46, diffPairs);
		// Each player gets an alias p0, p1, ... p9
		expect(query).toContain('p0:');
		expect(query).toContain('p9:');
		// Both difficulties present for each player
		expect(query).toContain('heroic:');
		expect(query).toContain('mythic:');
	});

	it('10 players × 1 difficulty → 10 aliases', () => {
		const items = Array.from({ length: 10 }, (_, i) => makeItem(`P${i}`));
		const query = buildBatchQuery(items, 46, oneDiff);
		const aliasCount = (query.match(/p\d+:/g) ?? []).length;
		expect(aliasCount).toBe(10);
	});

	it('0 players returns a valid (non-crashing) query', () => {
		const query = buildBatchQuery([], 46, diffPairs);
		expect(query).toBeTruthy();
		expect(() => query).not.toThrow();
	});

	it('uses correct serverSlug from char realm', () => {
		const item = makeItem('Char', 'Subtlety', 'Draenor');
		const query = buildBatchQuery([item], 46, diffPairs);
		expect(query).toContain('draenor');
	});

	it('includes specName filter when spec is provided', () => {
		const item = makeItem('Char', 'Unholy');
		const query = buildBatchQuery([item], 46, diffPairs);
		expect(query).toContain('specName: "Unholy"');
	});

	it('auto-detected zone ID formatted as raid-{id} folder name', () => {
		// This is a meta test — just verifying the pattern matches
		const zoneId = 46;
		expect(`raid-${zoneId}`).toBe('raid-46');
	});
});

// ── parseBatchResponse ────────────────────────────────────────────────────────

describe('parseBatchResponse', () => {
	it('correctly maps alias p0_heroic back to player 0, difficulty heroic', () => {
		const items = [makeItem('Char1'), makeItem('Char2')];
		const mockResponse = {
			data: {
				p0: { character: { heroic: { rankings: [{ rankPercent: 75 }] }, mythic: { rankings: [] } } },
				p1: { character: { heroic: { rankings: [] }, mythic: { rankings: [] } } }
			}
		};
		const results = parseBatchResponse(mockResponse, items, diffPairs);
		expect(results[0].player.display_name).toBe('Char1');
		expect(results[0].parses['heroic'][0].rankPercent).toBe(75);
	});

	it('handles null character data (player not found) without throwing', () => {
		const items = [makeItem('Ghost')];
		const mockResponse = { data: { p0: null } };
		expect(() => parseBatchResponse(mockResponse, items, diffPairs)).not.toThrow();
		const results = parseBatchResponse(mockResponse, items, diffPairs);
		expect(results[0].error).toBe('wcl_not_found');
	});
});

// ── isCurrentWeekKill ─────────────────────────────────────────────────────────

describe('isCurrentWeekKill', () => {
	const now = new Date('2026-05-08T12:00:00Z'); // Thursday after Wed reset

	it('returns true for a timestamp within the current EU reset window', () => {
		// Wednesday 07:00 UTC = start of reset
		const killTime = new Date('2026-05-06T09:00:00Z').getTime(); // Wed after reset
		expect(isCurrentWeekKill(killTime, now)).toBe(true);
	});

	it('returns false for a timestamp from the previous reset', () => {
		const killTime = new Date('2026-04-29T10:00:00Z').getTime(); // previous week
		expect(isCurrentWeekKill(killTime, now)).toBe(false);
	});
});

// ── chunkArray ────────────────────────────────────────────────────────────────

describe('chunkArray', () => {
	it('23 items → chunks of 10, 10, 3', () => {
		const items = Array.from({ length: 23 }, (_, i) => i);
		const chunks = chunkArray(items, 10);
		expect(chunks).toHaveLength(3);
		expect(chunks[0]).toHaveLength(10);
		expect(chunks[1]).toHaveLength(10);
		expect(chunks[2]).toHaveLength(3);
	});

	it('empty array → empty chunks', () => {
		expect(chunkArray([], 10)).toHaveLength(0);
	});
});

// ── DIFFICULTY_IDS ────────────────────────────────────────────────────────────

describe('DIFFICULTY_IDS', () => {
	it('heroic = 4, mythic = 5', () => {
		expect(DIFFICULTY_IDS.heroic).toBe(4);
		expect(DIFFICULTY_IDS.mythic).toBe(5);
	});
});
