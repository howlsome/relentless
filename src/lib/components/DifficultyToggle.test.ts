import { fireEvent, render } from '@testing-library/svelte';
import { beforeEach, describe, expect, it } from 'vitest';
import DifficultyToggle from './DifficultyToggle.svelte';

beforeEach(() => {
	localStorage.clear();
});

describe('DifficultyToggle', () => {
	it('renders Heroic and Mythic tabs', () => {
		const { getByText } = render(DifficultyToggle, {
			difficulties: ['heroic', 'mythic'],
			value: 'mythic',
		});
		expect(getByText('Heroic')).toBeTruthy();
		expect(getByText('Mythic')).toBeTruthy();
	});

	it('selected tab has aria-pressed=true', () => {
		const { container } = render(DifficultyToggle, {
			difficulties: ['heroic', 'mythic'],
			value: 'mythic',
		});
		const mythicBtn = Array.from(container.querySelectorAll('button')).find(
			(b) => b.textContent?.trim() === 'Mythic',
		);
		expect(mythicBtn?.getAttribute('aria-pressed')).toBe('true');
	});

	it('persists selected difficulty to localStorage on change', async () => {
		const { getByText } = render(DifficultyToggle, {
			difficulties: ['heroic', 'mythic'],
			value: 'mythic',
		});
		await fireEvent.click(getByText('Heroic'));
		expect(localStorage.getItem('raid-difficulty')).toBe('heroic');
	});

	it('falls back to default when localStorage value is invalid', () => {
		localStorage.setItem('raid-difficulty', 'invalid');
		const { container } = render(DifficultyToggle, {
			difficulties: ['heroic', 'mythic'],
			value: 'mythic',
		});
		// Should not crash and should show both buttons
		expect(container.querySelectorAll('button').length).toBe(2);
	});

	it('a single configured difficulty renders a static label (no toggle)', () => {
		const { container } = render(DifficultyToggle, { difficulties: ['heroic'], value: 'heroic' });
		const buttons = container.querySelectorAll('button');
		expect(buttons.length).toBe(0);
		expect(container.textContent).toContain('Heroic');
	});

	it('renders no toggle when difficulties is empty', () => {
		const { container } = render(DifficultyToggle, { difficulties: [], value: 'mythic' });
		expect(container.querySelectorAll('button').length).toBe(0);
	});
});
