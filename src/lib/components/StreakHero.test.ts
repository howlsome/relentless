import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import StreakHero from './StreakHero.svelte';

function compliance(overrides = {}) {
	return {
		current_streak: 3,
		longest_streak: 7,
		total_weeks_met: 10,
		total_weeks_tracked: 12,
		record_dungeons_week: { count: 14, week: '2026-17' },
		record_highest_key: { level: 16, week: '2026-16' },
		resilience_level: 13,
		resilience_history: [],
		weeks: [{ week: '2026-19', reset_start: '', count: 5, total_dungeons: 8, highest_key_level: 14, met: true }],
		...overrides
	};
}

describe('StreakHero', () => {
	it('renders flame emoji when current_streak >= 3', () => {
		const { container } = render(StreakHero, { compliance: compliance({ current_streak: 3 }) });
		expect(container.textContent).toContain('🔥');
	});

	it('renders flame emoji when current_streak = 5', () => {
		const { container } = render(StreakHero, { compliance: compliance({ current_streak: 5 }) });
		expect(container.textContent).toContain('🔥');
	});

	it('renders seedling emoji when current_streak = 1', () => {
		const { container } = render(StreakHero, { compliance: compliance({ current_streak: 1 }) });
		expect(container.textContent).toContain('🌱');
	});

	it('displays longest_streak correctly', () => {
		const { container } = render(StreakHero, { compliance: compliance({ longest_streak: 7 }) });
		expect(container.textContent).toContain('7');
	});

	it('displays lifetime completion percentage', () => {
		// 10/12 = 83%
		const { container } = render(StreakHero, { compliance: compliance({ total_weeks_met: 10, total_weeks_tracked: 12 }) });
		expect(container.textContent).toContain('10/12');
	});

	it('shows missed-week callout when most recent week is not met', () => {
		const c = compliance({
			current_streak: 0,
			weeks: [{ week: '2026-19', reset_start: '', count: 3, total_dungeons: 4, highest_key_level: 11, met: false }]
		});
		const { container } = render(StreakHero, { compliance: c, weeklyMinimum: 4 });
		expect(container.textContent).toContain('missed') || expect(container.textContent).toContain('Requirement');
	});

	it('does not show missed-week callout when most recent week is met', () => {
		const { container } = render(StreakHero, { compliance: compliance() });
		expect(container.querySelector('[role="alert"]')).toBeNull();
	});
});
