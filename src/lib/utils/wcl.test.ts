import { describe, expect, it } from 'vitest';
import { chunkArray, DIFFICULTY_IDS } from './wcl.js';

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
