import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import ChangelogFilter from './ChangelogFilter.svelte';

const seasonsIndex = {
	active_mplus_season: 'midnight-s1',
	active_raid_zones: [],
	all_mplus_seasons: [
		{
			season_id: 'midnight-s1',
			label: 'Midnight Season 1',
			start_date: '2026-03-24',
			end_date: null,
		},
	],
	all_raid_zones: [],
};

async function openPanel(container: HTMLElement) {
	const toggle = container.querySelector('.filter-toggle') as HTMLElement;
	await fireEvent.click(toggle);
}

describe('ChangelogFilter', () => {
	it('renders the toggle button', () => {
		const { container } = render(ChangelogFilter, {
			team: 'all',
			eventType: 'all',
			seasonId: 'all',
			seasonsIndex,
		});
		expect(container.querySelector('.filter-toggle')).toBeTruthy();
	});

	it('panel is hidden initially', () => {
		const { container } = render(ChangelogFilter, {
			team: 'all',
			eventType: 'all',
			seasonId: 'all',
			seasonsIndex,
		});
		expect(container.querySelector('.filter-panel')).toBeNull();
	});

	it('panel opens on toggle click', async () => {
		const { container } = render(ChangelogFilter, {
			team: 'all',
			eventType: 'all',
			seasonId: 'all',
			seasonsIndex,
		});
		await openPanel(container);
		expect(container.querySelector('.filter-panel')).toBeTruthy();
	});

	it('renders team filter buttons when open', async () => {
		const { getByText, container } = render(ChangelogFilter, {
			team: 'all',
			eventType: 'all',
			seasonId: 'all',
			seasonsIndex,
		});
		await openPanel(container);
		expect(getByText('All')).toBeTruthy();
		expect(getByText('Main')).toBeTruthy();
		expect(getByText('Alt')).toBeTruthy();
	});

	it('renders event type dropdown when open', async () => {
		const { container } = render(ChangelogFilter, {
			team: 'all',
			eventType: 'all',
			seasonId: 'all',
			seasonsIndex,
		});
		await openPanel(container);
		expect(container.querySelector('#filter-event')).toBeTruthy();
	});

	it('clicking Main team filter updates active state', async () => {
		const { getByText, container } = render(ChangelogFilter, {
			team: 'all',
			eventType: 'all',
			seasonId: 'all',
			seasonsIndex,
		});
		await openPanel(container);
		const mainBtn = getByText('Main');
		await fireEvent.click(mainBtn);
		expect(mainBtn.getAttribute('aria-pressed')).toBe('true');
	});

	it('shows active filter count badge when filters are applied', async () => {
		const { getByText, container } = render(ChangelogFilter, {
			team: 'all',
			eventType: 'all',
			seasonId: 'all',
			seasonsIndex,
		});
		await openPanel(container);
		await fireEvent.click(getByText('Main'));
		const badge = container.querySelector('.filter-count');
		expect(badge?.textContent?.trim()).toBe('1');
	});

	it('no filter count badge when no active filters', () => {
		const { container } = render(ChangelogFilter, {
			team: 'all',
			eventType: 'all',
			seasonId: 'all',
			seasonsIndex,
		});
		expect(container.querySelector('.filter-count')).toBeNull();
	});

	it('season dropdown includes "All time" option when open', async () => {
		const { container } = render(ChangelogFilter, {
			team: 'all',
			eventType: 'all',
			seasonId: 'all',
			seasonsIndex,
		});
		await openPanel(container);
		const options = [...container.querySelectorAll('#filter-season option')].map((o) =>
			o.textContent?.trim(),
		);
		expect(options).toContain('All time');
	});
});
