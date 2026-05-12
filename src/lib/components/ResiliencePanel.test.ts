import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import ResiliencePanel from './ResiliencePanel.svelte';

const DUNGEONS = ['Windrunner Spire', "Maisara Caverns", "Magisters' Terrace", 'Nexus-Point Xenas',
	"Algeth'ar Academy", 'Seat of the Triumvirate', 'Skyreach', 'Pit of Saron'];

function compliance(level: number | null, history: any[] = []) {
	return {
		current_streak: 3, longest_streak: 5, total_weeks_met: 9, total_weeks_tracked: 10,
		record_dungeons_week: null, record_highest_key: null,
		resilience_level: level,
		resilience_history: history,
		weeks: []
	};
}

const goodProgress: Record<string, number> = {};
DUNGEONS.forEach((d, i) => { goodProgress[d] = 13 + i; }); // all ≥ 13

const badProgress: Record<string, number> = {};
DUNGEONS.forEach((d, i) => { badProgress[d] = i < 2 ? 10 : 14; }); // first two at +10

describe('ResiliencePanel', () => {
	it('renders gold badge with level number when resilience_level is set', () => {
		const { container } = render(ResiliencePanel, { compliance: compliance(13), dungeons: DUNGEONS, progress: goodProgress });
		expect(container.textContent).toContain('Resilience 13');
		expect(container.querySelector('.level--achieved')).toBeTruthy();
	});

	it('renders grey "Not yet achieved" badge when resilience_level is null', () => {
		const { container } = render(ResiliencePanel, { compliance: compliance(null), dungeons: DUNGEONS, progress: {} });
		expect(container.textContent).toContain('Not yet achieved');
		expect(container.querySelector('.level--none')).toBeTruthy();
	});

	it('renders a row per dungeon in the progress table', () => {
		const { container } = render(ResiliencePanel, { compliance: compliance(13), dungeons: DUNGEONS, progress: goodProgress });
		const rows = container.querySelectorAll('tbody tr');
		expect(rows.length).toBe(DUNGEONS.length);
	});

	it('dungeons meeting next target level show ✅', () => {
		// level = 13, next target = 14; goodProgress has levels ≥ 13, some < 14
		const { container } = render(ResiliencePanel, { compliance: compliance(13), dungeons: DUNGEONS.slice(0, 1), progress: { 'Windrunner Spire': 14 } });
		expect(container.textContent).toContain('✅');
	});

	it('dungeons below target show ❌', () => {
		const { container } = render(ResiliencePanel, { compliance: compliance(13), dungeons: ['A'], progress: { A: 10 } });
		expect(container.textContent).toContain('❌');
	});

	it('renders without crashing when resilience_history is empty', () => {
		expect(() => render(ResiliencePanel, { compliance: compliance(null, []), dungeons: DUNGEONS, progress: {} })).not.toThrow();
	});

	it('achievement history renders one entry per resilience_history item', () => {
		const history = [{ level: 10, achieved_week: '2026-10' }, { level: 13, achieved_week: '2026-16' }];
		const { container } = render(ResiliencePanel, { compliance: compliance(13, history), dungeons: [], progress: {} });
		const historyItems = container.querySelectorAll('.history-entry');
		expect(historyItems.length).toBe(2);
	});
});
