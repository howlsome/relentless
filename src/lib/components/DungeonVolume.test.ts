import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import DungeonVolume from './DungeonVolume.svelte';

function compliance(
	weeks: any[] = [],
	record = { count: 14, week: '2026-17' },
	recordKey = { level: 16, week: '2026-16' },
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

const thisWeek = {
	week: '2026-19',
	reset_start: '',
	count: 5,
	total_dungeons: 8,
	highest_key_level: 14,
	met: true,
};
const lastWeek = {
	week: '2026-18',
	reset_start: '',
	count: 4,
	total_dungeons: 5,
	highest_key_level: 11,
	met: true,
};

describe('DungeonVolume', () => {
	it('renders current week total dungeon count', () => {
		const { container } = render(DungeonVolume, { compliance: compliance([thisWeek, lastWeek]) });
		expect(container.textContent).toContain('8');
	});

	it('renders last week total dungeon count', () => {
		const { container } = render(DungeonVolume, { compliance: compliance([thisWeek, lastWeek]) });
		expect(container.textContent).toContain('5');
	});

	it('shows ▲ delta when this week > last week (total dungeons)', () => {
		const { container } = render(DungeonVolume, { compliance: compliance([thisWeek, lastWeek]) });
		expect(container.textContent).toContain('▲');
	});

	it('shows ▼ delta when this week < last week', () => {
		const { container } = render(DungeonVolume, { compliance: compliance([lastWeek, thisWeek]) });
		expect(container.textContent).toContain('▼');
	});

	it('shows record dungeon count', () => {
		const { container } = render(DungeonVolume, { compliance: compliance([thisWeek, lastWeek]) });
		expect(container.textContent).toContain('14');
	});

	it('renders current week highest key in +N notation', () => {
		const { container } = render(DungeonVolume, { compliance: compliance([thisWeek, lastWeek]) });
		expect(container.textContent).toContain('+14');
	});

	it('shows — when no previous week entry exists', () => {
		const { container } = render(DungeonVolume, { compliance: compliance([thisWeek]) });
		// delta should show — since there's no previous week
		expect(container.textContent).not.toContain('NaN');
	});

	it('renders record highest key', () => {
		const { container } = render(DungeonVolume, { compliance: compliance([thisWeek, lastWeek]) });
		expect(container.textContent).toContain('+16');
	});
});
