import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ChangelogFilter from './ChangelogFilter.svelte';

const seasonsIndex = {
	active_mplus_season: 'midnight-s1',
	active_raid_zones: [],
	all_mplus_seasons: [{ season_id: 'midnight-s1', label: 'Midnight Season 1', start_date: '2026-03-24', end_date: null }],
	all_raid_zones: []
};

describe('ChangelogFilter', () => {
	it('renders team filter buttons', () => {
		const { getByText } = render(ChangelogFilter, { team: 'all', eventType: 'all', seasonId: 'all', seasonsIndex });
		expect(getByText('All')).toBeTruthy();
		expect(getByText('Main')).toBeTruthy();
		expect(getByText('Alt')).toBeTruthy();
	});

	it('renders event type dropdown', () => {
		const { container } = render(ChangelogFilter, { team: 'all', eventType: 'all', seasonId: 'all', seasonsIndex });
		const select = container.querySelector('#filter-event');
		expect(select).toBeTruthy();
	});

	it('clicking Main team filter updates active state', async () => {
		const { getByText, container } = render(ChangelogFilter, { team: 'all', eventType: 'all', seasonId: 'all', seasonsIndex });
		const mainBtn = getByText('Main');
		await fireEvent.click(mainBtn);
		expect(mainBtn.getAttribute('aria-pressed')).toBe('true');
	});

	it('shows active filter count badge when filters are applied', async () => {
		const { getByText, container } = render(ChangelogFilter, { team: 'all', eventType: 'all', seasonId: 'all', seasonsIndex });
		await fireEvent.click(getByText('Main'));
		// After clicking main, count = 1
		const badge = container.querySelector('.filter-count');
		expect(badge?.textContent?.trim()).toBe('1');
	});

	it('no filter count badge when all default (no active filters)', () => {
		const { container } = render(ChangelogFilter, { team: 'all', eventType: 'all', seasonId: 'all', seasonsIndex });
		expect(container.querySelector('.filter-count')).toBeNull();
	});

	it('season dropdown includes "All time" option', () => {
		const { container } = render(ChangelogFilter, { team: 'all', eventType: 'all', seasonId: 'all', seasonsIndex });
		const options = [...container.querySelectorAll('#filter-season option')].map((o) => o.textContent?.trim());
		expect(options).toContain('All time');
	});
});
