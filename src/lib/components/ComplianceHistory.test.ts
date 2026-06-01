import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import type { ComplianceWeek } from '$lib/types/compliance.js';
import ComplianceHistory from './ComplianceHistory.svelte';

function compliance(weeks: ComplianceWeek[]) {
	return {
		current_streak: 2,
		longest_streak: 5,
		total_weeks_met: 8,
		total_weeks_tracked: 10,
		record_dungeons_week: null,
		record_highest_key: null,
		weeks,
	};
}

const week = (w: string, met: boolean, count = 4, total = 6, key = 12) => ({
	week: w,
	reset_start: '2026-01-01T07:00:00Z',
	count,
	total_dungeons: total,
	highest_key_level: key,
	met,
});

describe('ComplianceHistory', () => {
	it('renders one row per tracked week', () => {
		const c = compliance([week('2026-19', true), week('2026-18', false), week('2026-17', true)]);
		const { container } = render(ComplianceHistory, { compliance: c });
		const rows = container.querySelectorAll('tbody tr');
		expect(rows.length).toBe(3);
	});

	it('met:true rows show green tick', () => {
		const c = compliance([week('2026-19', true)]);
		const { container } = render(ComplianceHistory, { compliance: c });
		expect(container.textContent).toContain('✅');
	});

	it('met:false rows show red cross and count', () => {
		const c = compliance([week('2026-19', false, 3, 4, 11)]);
		const { container } = render(ComplianceHistory, { compliance: c, weeklyMinimum: 4 });
		expect(container.textContent).toContain('❌');
		expect(container.textContent).toContain('3/4');
	});

	it('empty weeks shows "No compliance data yet"', () => {
		const { container } = render(ComplianceHistory, { compliance: compliance([]) });
		expect(container.textContent).toContain('No compliance data');
	});

	it('highest key column is present for every row', () => {
		const c = compliance([week('2026-19', true, 5, 8, 14), week('2026-18', true, 4, 6, 12)]);
		const { container } = render(ComplianceHistory, { compliance: c });
		// Each row should show the key with + prefix
		expect(container.textContent).toContain('+14');
		expect(container.textContent).toContain('+12');
	});

	it('null compliance renders no crash', () => {
		expect(() => render(ComplianceHistory, { compliance: null })).not.toThrow();
	});
});
