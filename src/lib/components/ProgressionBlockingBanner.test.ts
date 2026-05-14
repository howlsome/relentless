import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ProgressionBlockingBanner from './ProgressionBlockingBanner.svelte';

const BLOCKING_RAIDER = {
	raider_id: 'r1',
	display_name: 'Hxwl',
	lockout_warnings: [
		{
			boss_id: 1,
			boss_name: 'Solanar the Dawnbreaker',
			difficulty: 'mythic',
			kill_time: '2026-05-14T14:22:00Z',
			detected_local_time: 'Thursday 16:22 server (15:22 BST)',
			reason: 'Outside all configured raid sessions',
			prior_blocks_last_4_weeks: 0
		}
	],
	safe_pug_kills: [],
	exempt_pug_kills: []
};

describe('ProgressionBlockingBanner', () => {
	beforeEach(() => {
		sessionStorage.clear();
	});

	it('renders nothing when no raiders have blocking_pug kills', () => {
		const { container } = render(ProgressionBlockingBanner, {
			props: { raiders: [{ ...BLOCKING_RAIDER, lockout_warnings: [] }] }
		});
		expect(container.querySelector('[data-lockout-banner]')).toBeNull();
	});

	it('renders a red warning banner when at least one raider has blocking_pug kills', () => {
		render(ProgressionBlockingBanner, { props: { raiders: [BLOCKING_RAIDER] } });
		expect(screen.getByRole('region', { name: /progression.blocking/i })).toBeTruthy();
	});

	it('shows the raider display name in the expanded list', async () => {
		render(ProgressionBlockingBanner, { props: { raiders: [BLOCKING_RAIDER] } });
		const toggle = screen.getByRole('button', { name: /toggle progression/i });
		await fireEvent.click(toggle);
		expect(screen.getByText(/Hxwl/)).toBeTruthy();
	});

	it('shows the boss name in the expanded list', async () => {
		render(ProgressionBlockingBanner, { props: { raiders: [BLOCKING_RAIDER] } });
		const toggle = screen.getByRole('button', { name: /toggle progression/i });
		await fireEvent.click(toggle);
		expect(screen.getByText(/Solanar the Dawnbreaker/i)).toBeTruthy();
	});

	it('shows the local kill time in the expanded list', async () => {
		render(ProgressionBlockingBanner, { props: { raiders: [BLOCKING_RAIDER] } });
		const toggle = screen.getByRole('button', { name: /toggle progression/i });
		await fireEvent.click(toggle);
		expect(screen.getByText(/16:22 server/i)).toBeTruthy();
	});

	it('has a dismiss button that hides the banner', async () => {
		render(ProgressionBlockingBanner, { props: { raiders: [BLOCKING_RAIDER] } });
		const dismissBtn = screen.getByRole('button', { name: /dismiss/i });
		await fireEvent.click(dismissBtn);
		expect(screen.queryByRole('region', { name: /progression.blocking/i })).toBeNull();
	});

	it('stores dismissal in sessionStorage', async () => {
		render(ProgressionBlockingBanner, { props: { raiders: [BLOCKING_RAIDER] } });
		await fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
		expect(sessionStorage.getItem('lockout-banner-dismissed')).toBeTruthy();
	});

	it('starts dismissed when sessionStorage key is set', () => {
		sessionStorage.setItem('lockout-banner-dismissed', '1');
		const { container } = render(ProgressionBlockingBanner, {
			props: { raiders: [BLOCKING_RAIDER] }
		});
		expect(container.querySelector('[data-lockout-banner]')).toBeNull();
	});

	it('counts raiders correctly in the summary line', () => {
		const twoRaiders = [
			BLOCKING_RAIDER,
			{ ...BLOCKING_RAIDER, raider_id: 'r2', display_name: 'Deathchonks' }
		];
		render(ProgressionBlockingBanner, { props: { raiders: twoRaiders } });
		expect(screen.getByText(/2 raiders/i)).toBeTruthy();
	});
});
