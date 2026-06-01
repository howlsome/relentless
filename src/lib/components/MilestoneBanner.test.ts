import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import type { ComplianceWeek } from '$lib/types/compliance.js';
import { computeBossMilestones, computeMplusMilestones } from '$lib/utils/milestones.js';
import MilestoneBanner from './MilestoneBanner.svelte';

describe('MilestoneBanner', () => {
	it('renders nothing when no milestones', () => {
		const { container } = render(MilestoneBanner, { milestones: [] });
		expect(container.querySelector('.milestones')).toBeNull();
	});

	it('renders all milestones when multiple are present', () => {
		const milestones = [
			{ key: 'a', emoji: '🏆', text: 'First milestone' },
			{ key: 'b', emoji: '🗡️', text: 'Second milestone' },
		];
		const { container } = render(MilestoneBanner, { milestones });
		expect(container.querySelectorAll('.milestone-banner').length).toBe(2);
	});
});

describe('computeBossMilestones', () => {
	it('shows first kill banner when only one parse exists', () => {
		const milestones = computeBossMilestones('Solanar', [74], 'mythic');
		expect(milestones.some((m) => m.key.includes('first-kill'))).toBe(true);
	});

	it('shows personal best banner when current exceeds previous', () => {
		const milestones = computeBossMilestones('Solanar', [90, 74], 'mythic');
		expect(milestones.some((m) => m.key.includes('pb'))).toBe(true);
	});

	it('shows first purple banner when parse ≥ 75 for first time', () => {
		const milestones = computeBossMilestones('Solanar', [80, 60, 50], 'mythic');
		expect(milestones.some((m) => m.key.includes('first-purple'))).toBe(true);
	});

	it('shows first orange banner when parse ≥ 95 for first time', () => {
		const milestones = computeBossMilestones('Solanar', [95, 70, 60], 'mythic');
		expect(milestones.some((m) => m.key.includes('first-orange'))).toBe(true);
	});

	it('shows 3-weeks-improvement banner when 3 consecutive weeks ascending', () => {
		const milestones = computeBossMilestones('Solanar', [90, 85, 80, 75], 'mythic');
		expect(milestones.some((m) => m.key.includes('3-improve'))).toBe(true);
	});

	it('does not show 3-week banner with fewer than 4 data points', () => {
		const milestones = computeBossMilestones('Solanar', [90, 85, 80], 'mythic');
		expect(milestones.some((m) => m.key.includes('3-improve'))).toBe(false);
	});

	it('no banner when no milestone triggered', () => {
		// Same parse, no improvement, not first kill
		const milestones = computeBossMilestones('Solanar', [60, 70, 65, 60], 'mythic');
		// No PB (60 < 70), no first kill (has history), no 3 improvement (60,65,70,60 not strictly ascending)
		expect(
			milestones.filter((m) => m.key.includes('pb') || m.key.includes('3-improve')),
		).toHaveLength(0);
	});
});

describe('computeMplusMilestones', () => {
	function compliance(
		weeks: ComplianceWeek[],
		record = { count: 14, week: '2026-17' },
		recordKey = { level: 18, week: '2026-15' },
	) {
		return {
			current_streak: 3,
			longest_streak: 5,
			total_weeks_met: 9,
			total_weeks_tracked: 10,
			record_dungeons_week: record,
			record_highest_key: recordKey,
			weeks,
		};
	}

	it('shows "big week" banner when total_dungeons increased by ≥ 3', () => {
		const c = compliance([
			{
				week: '2026-19',
				count: 5,
				total_dungeons: 11,
				highest_key_level: 14,
				met: true,
				reset_start: '',
			},
			{
				week: '2026-18',
				count: 4,
				total_dungeons: 8,
				highest_key_level: 12,
				met: true,
				reset_start: '',
			},
		]);
		expect(computeMplusMilestones(c).some((m) => m.key === 'volume-up')).toBe(true);
	});

	it('does not show volume banner when delta < 3', () => {
		const c = compliance([
			{
				week: '2026-19',
				count: 5,
				total_dungeons: 9,
				highest_key_level: 14,
				met: true,
				reset_start: '',
			},
			{
				week: '2026-18',
				count: 4,
				total_dungeons: 8,
				highest_key_level: 12,
				met: true,
				reset_start: '',
			},
		]);
		expect(computeMplusMilestones(c).some((m) => m.key === 'volume-up')).toBe(false);
	});

	it('no milestones when compliance is null', () => {
		expect(computeMplusMilestones(null)).toHaveLength(0);
	});
});
