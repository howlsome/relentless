import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import LockoutCallout from './LockoutCallout.svelte';

const BASE_RAIDER = {
	raider_id: 'r1',
	display_name: 'Hxwl',
	lockout_warnings: [] as object[],
	safe_pug_kills: [] as object[],
	exempt_pug_kills: [] as object[],
	exemptions: [] as object[],
};

const BLOCKING_WARNING = {
	boss_id: 1,
	boss_name: 'Solanar the Dawnbreaker',
	difficulty: 'mythic',
	kill_time: '2026-05-14T14:22:00Z',
	detected_local_time: 'Thursday 16:22 server (15:22 BST)',
	reason: 'Outside all configured raid sessions',
	prior_blocks_last_4_weeks: 0,
};

const SAFE_PUG = {
	boss_id: 2,
	boss_name: 'Veluna the Skyrender',
	difficulty: 'mythic',
	kill_time: '2026-05-12T21:14:00Z',
	detected_local_time: 'Tuesday 23:14 server (22:14 BST)',
};

const EXEMPT_KILL = {
	boss_id: 3,
	boss_name: 'Helya the Twiceborn',
	difficulty: 'mythic',
	kill_time: '2026-05-11T19:00:00Z',
	detected_local_time: 'Monday 21:00 server',
	exemption_reason: 'Family wedding',
	exemption_granted_by: 'OfficerName',
};

// ── ProgressionBlockingCallout ────────────────────────────────────────────────

describe('LockoutCallout — blocking pug', () => {
	it('renders nothing when lockout_warnings is empty', () => {
		const { container } = render(LockoutCallout, { props: { raider: BASE_RAIDER } });
		expect(container.querySelector('[data-blocking-callout]')).toBeNull();
	});

	it('renders a red callout when lockout_warnings is non-empty', () => {
		render(LockoutCallout, {
			props: { raider: { ...BASE_RAIDER, lockout_warnings: [BLOCKING_WARNING] } },
		});
		expect(screen.getByTestId('blocking-callout')).toBeTruthy();
	});

	it('lists each blocking_pug kill with detected_local_time', () => {
		render(LockoutCallout, {
			props: { raider: { ...BASE_RAIDER, lockout_warnings: [BLOCKING_WARNING] } },
		});
		expect(screen.getByText(/Solanar the Dawnbreaker/i)).toBeTruthy();
		expect(screen.getByText(/Thursday 16:22 server/i)).toBeTruthy();
	});

	it('does NOT show escalation phrase when prior_blocks_last_4_weeks is 0', () => {
		render(LockoutCallout, {
			props: {
				raider: {
					...BASE_RAIDER,
					lockout_warnings: [{ ...BLOCKING_WARNING, prior_blocks_last_4_weeks: 0 }],
				},
			},
		});
		expect(screen.queryByText(/removal from/i)).toBeNull();
	});

	it('shows escalation phrase when prior_blocks_last_4_weeks >= 1', () => {
		render(LockoutCallout, {
			props: {
				raider: {
					...BASE_RAIDER,
					lockout_warnings: [{ ...BLOCKING_WARNING, prior_blocks_last_4_weeks: 1 }],
				},
			},
		});
		expect(screen.getByText(/removal from/i)).toBeTruthy();
	});

	it('renders [Log officer review] clipboard helper', () => {
		render(LockoutCallout, {
			props: { raider: { ...BASE_RAIDER, lockout_warnings: [BLOCKING_WARNING] } },
		});
		expect(screen.getByText(/log officer review/i)).toBeTruthy();
	});

	it('renders [Add retrospective exemption] clipboard helper', () => {
		render(LockoutCallout, {
			props: { raider: { ...BASE_RAIDER, lockout_warnings: [BLOCKING_WARNING] } },
		});
		expect(screen.getByText(/retrospective exemption/i)).toBeTruthy();
	});
});

// ── SafePugCallout ────────────────────────────────────────────────────────────

describe('LockoutCallout — safe pug', () => {
	it('renders nothing when safe_pug_kills is empty', () => {
		const { container } = render(LockoutCallout, { props: { raider: BASE_RAIDER } });
		expect(container.querySelector('[data-safe-pug-callout]')).toBeNull();
	});

	it('renders a green callout when safe_pug_kills is non-empty', () => {
		render(LockoutCallout, {
			props: { raider: { ...BASE_RAIDER, safe_pug_kills: [SAFE_PUG] } },
		});
		expect(screen.getByTestId('safe-pug-callout')).toBeTruthy();
	});

	it('lists each safe_pug kill with local time', () => {
		render(LockoutCallout, {
			props: { raider: { ...BASE_RAIDER, safe_pug_kills: [SAFE_PUG] } },
		});
		expect(screen.getByText(/Veluna the Skyrender/i)).toBeTruthy();
		expect(screen.getByText(/Tuesday 23:14 server/i)).toBeTruthy();
	});
});

// ── ExemptPugCallout ──────────────────────────────────────────────────────────

describe('LockoutCallout — exempt pug', () => {
	it('renders nothing when exempt_pug_kills is empty', () => {
		const { container } = render(LockoutCallout, { props: { raider: BASE_RAIDER } });
		expect(container.querySelector('[data-exempt-callout]')).toBeNull();
	});

	it('renders a neutral callout when exempt_pug_kills is non-empty', () => {
		render(LockoutCallout, {
			props: { raider: { ...BASE_RAIDER, exempt_pug_kills: [EXEMPT_KILL] } },
		});
		expect(screen.getByTestId('exempt-callout')).toBeTruthy();
	});

	it('shows exemption reason and granter', () => {
		render(LockoutCallout, {
			props: { raider: { ...BASE_RAIDER, exempt_pug_kills: [EXEMPT_KILL] } },
		});
		expect(screen.getByText(/Family wedding/i)).toBeTruthy();
		expect(screen.getByText(/OfficerName/i)).toBeTruthy();
	});
});

// ── Both callouts simultaneously ──────────────────────────────────────────────

describe('LockoutCallout — combined', () => {
	it('renders both blocking and safe-pug callouts when both are present', () => {
		render(LockoutCallout, {
			props: {
				raider: {
					...BASE_RAIDER,
					lockout_warnings: [BLOCKING_WARNING],
					safe_pug_kills: [SAFE_PUG],
				},
			},
		});
		expect(screen.getByTestId('blocking-callout')).toBeTruthy();
		expect(screen.getByTestId('safe-pug-callout')).toBeTruthy();
	});
});
