import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import RoleIcon from './RoleIcon.svelte';

describe('RoleIcon', () => {
	it('renders emoji for tank', () => {
		const { container } = render(RoleIcon, { role: 'tank' });
		expect(container.textContent).toContain('🛡️');
		expect(container.querySelector('[aria-label="Tank"]')).toBeTruthy();
	});

	it('renders emoji for healer', () => {
		const { container } = render(RoleIcon, { role: 'healer' });
		expect(container.textContent).toContain('❤️');
		expect(container.querySelector('[aria-label="Healer"]')).toBeTruthy();
	});

	it('renders emoji for dps', () => {
		const { container } = render(RoleIcon, { role: 'dps' });
		expect(container.textContent).toContain('🗡️');
		expect(container.querySelector('[aria-label="DPS"]')).toBeTruthy();
	});

	it('each role has correct aria-label', () => {
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
