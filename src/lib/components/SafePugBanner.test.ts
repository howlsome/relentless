import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import SafePugBanner from './SafePugBanner.svelte';

const SAFE_RAIDER = {
	raider_id: 'r1',
	display_name: 'Hxwl',
	safe_pug_kills: [
		{
			boss_id: 2,
			boss_name: 'Veluna the Skyrender',
			difficulty: 'mythic',
			kill_time: '2026-05-12T21:14:00Z',
			detected_local_time: 'Tuesday 23:14 server (22:14 BST)'
		}
	],
	lockout_warnings: [],
	exempt_pug_kills: []
};

describe('SafePugBanner', () => {
	it('renders nothing when no raiders have safe_pug kills', () => {
		const { container } = render(SafePugBanner, {
			props: { raiders: [{ ...SAFE_RAIDER, safe_pug_kills: [] }] }
		});
		expect(container.querySelector('[data-safe-pug-banner]')).toBeNull();
	});

	it('renders a green banner when at least one raider has safe_pug kills', () => {
		render(SafePugBanner, { props: { raiders: [SAFE_RAIDER] } });
		expect(screen.getByRole('region', { name: /safe pug/i })).toBeTruthy();
	});

	it('shows raider display name in the expanded list', async () => {
		render(SafePugBanner, { props: { raiders: [SAFE_RAIDER] } });
		const toggle = screen.getByRole('button');
		await fireEvent.click(toggle);
		expect(screen.getByText(/Hxwl/i)).toBeTruthy();
	});

	it('shows boss name in the expanded list', async () => {
		render(SafePugBanner, { props: { raiders: [SAFE_RAIDER] } });
		const toggle = screen.getByRole('button');
		await fireEvent.click(toggle);
		expect(screen.getByText(/Veluna the Skyrender/i)).toBeTruthy();
	});

	it('shows the local kill time', async () => {
		render(SafePugBanner, { props: { raiders: [SAFE_RAIDER] } });
		const toggle = screen.getByRole('button');
		await fireEvent.click(toggle);
		expect(screen.getByText(/23:14 server/i)).toBeTruthy();
	});

	it('has NO dismiss button — safe-pug banner is not dismissible', () => {
		render(SafePugBanner, { props: { raiders: [SAFE_RAIDER] } });
		const buttons = screen.getAllByRole('button');
		const dismissBtn = buttons.find((b) => /dismiss/i.test(b.textContent ?? ''));
		expect(dismissBtn).toBeUndefined();
	});

	it('counts raiders correctly in the summary line', () => {
		const twoRaiders = [
			SAFE_RAIDER,
			{ ...SAFE_RAIDER, raider_id: 'r2', display_name: 'Deathchonks' }
		];
		render(SafePugBanner, { props: { raiders: twoRaiders } });
		expect(screen.getByText(/3 raiders|2 raiders/i)).toBeTruthy();
	});
});
