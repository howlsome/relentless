import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import RoleIcon from './RoleIcon.svelte';

describe('RoleIcon', () => {
	it('renders shield icon for tank', () => {
		const { container } = render(RoleIcon, { role: 'tank' });
		expect(container.querySelector('svg')).toBeTruthy();
		expect(container.querySelector('[aria-label="Tank"]')).toBeTruthy();
	});

	it('renders cross icon for healer', () => {
		const { container } = render(RoleIcon, { role: 'healer' });
		expect(container.querySelector('[aria-label="Healer"]')).toBeTruthy();
	});

	it('renders sword icon for dps', () => {
		const { container } = render(RoleIcon, { role: 'dps' });
		expect(container.querySelector('[aria-label="DPS"]')).toBeTruthy();
	});

	it('each icon has correct aria-label', () => {
		for (const [role, label] of [['tank', 'Tank'], ['healer', 'Healer'], ['dps', 'DPS']] as const) {
			const { container } = render(RoleIcon, { role });
			expect(container.querySelector(`[aria-label="${label}"]`)).toBeTruthy();
		}
	});

	it('each icon has role="img"', () => {
		const { container } = render(RoleIcon, { role: 'dps' });
		expect(container.querySelector('[role="img"]')).toBeTruthy();
	});
});
