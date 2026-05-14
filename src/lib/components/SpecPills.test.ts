import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import SpecPills from './SpecPills.svelte';
import type { SpecEntry } from '$lib/types/roster.js';

const BALANCE: SpecEntry = { spec: 'Balance', role: 'dps', primary: true, wcl_active: true };
const RESTO: SpecEntry = { spec: 'Restoration', role: 'healer', primary: false, wcl_active: true };
const INACTIVE: SpecEntry = { spec: 'Guardian', role: 'tank', primary: false, wcl_active: false };

describe('SpecPills', () => {
	it('renders one pill per spec in the array', () => {
		render(SpecPills, { props: { specs: [BALANCE, RESTO] } });
		expect(screen.getByText(/Balance/i)).toBeTruthy();
		expect(screen.getByText(/Restoration/i)).toBeTruthy();
	});

	it('marks the primary spec visually (star or "primary" text)', () => {
		render(SpecPills, { props: { specs: [BALANCE, RESTO] } });
		const primaryPill = screen.getByTestId('spec-pill-Balance');
		expect(primaryPill.getAttribute('data-primary')).toBe('true');
	});

	it('shows wcl_active: false specs with a "(not tracked)" annotation', () => {
		render(SpecPills, { props: { specs: [BALANCE, INACTIVE] } });
		expect(screen.getByText(/not tracked/i)).toBeTruthy();
	});

	it('renders a single spec with no extras label', () => {
		render(SpecPills, { props: { specs: [BALANCE] } });
		expect(screen.getByText(/Balance/i)).toBeTruthy();
		expect(screen.queryByText(/\+\d/)).toBeNull();
	});
});

// ── Dashboard +N indicator ────────────────────────────────────────────────────

import SpecIndicator from './SpecIndicator.svelte';

describe('SpecIndicator', () => {
	it('shows primary spec name for a single-spec raider', () => {
		render(SpecIndicator, { props: { specs: [BALANCE], charClass: 'Druid' } });
		expect(screen.getByText(/Balance/i)).toBeTruthy();
		expect(screen.queryByText(/\+/)).toBeNull();
	});

	it('shows primary spec + "+1" when raider has two active specs', () => {
		render(SpecIndicator, { props: { specs: [BALANCE, RESTO], charClass: 'Druid' } });
		expect(screen.getByText(/Balance/i)).toBeTruthy();
		expect(screen.getByText(/\+1/i)).toBeTruthy();
	});

	it('shows primary spec + "+2" when raider has three active specs', () => {
		const FERAL: SpecEntry = { spec: 'Feral', role: 'dps', primary: false, wcl_active: true };
		render(SpecIndicator, { props: { specs: [BALANCE, RESTO, FERAL], charClass: 'Druid' } });
		expect(screen.getByText(/\+2/i)).toBeTruthy();
	});

	it('excludes wcl_active: false specs from the +N count', () => {
		render(SpecIndicator, { props: { specs: [BALANCE, INACTIVE], charClass: 'Druid' } });
		// INACTIVE is wcl_active: false, so count is 1 active spec → no +N shown
		expect(screen.queryByText(/\+/)).toBeNull();
	});
});
