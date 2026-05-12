import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import TeamDesignationBadge from './TeamDesignationBadge.svelte';

describe('TeamDesignationBadge', () => {
	it('renders "Main" for main designation', () => {
		const { getByText } = render(TeamDesignationBadge, { designation: 'main' });
		expect(getByText('Main')).toBeTruthy();
	});

	it('renders "Alt" for alt designation', () => {
		const { getByText } = render(TeamDesignationBadge, { designation: 'alt' });
		expect(getByText('Alt')).toBeTruthy();
	});

	it('has correct aria-label for main', () => {
		const { container } = render(TeamDesignationBadge, { designation: 'main' });
		expect(container.querySelector('[aria-label="Main team"]')).toBeTruthy();
	});

	it('has correct aria-label for alt', () => {
		const { container } = render(TeamDesignationBadge, { designation: 'alt' });
		expect(container.querySelector('[aria-label="Alt team"]')).toBeTruthy();
	});
});
