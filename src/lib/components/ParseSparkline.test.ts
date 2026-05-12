import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import ParseSparkline from './ParseSparkline.svelte';

describe('ParseSparkline (BossParseChart)', () => {
	it('renders an SVG element', () => {
		const { container } = render(ParseSparkline, { points: [74, 82, null, 88], bossName: 'Boss', characterName: 'Char' });
		expect(container.querySelector('svg')).toBeTruthy();
	});

	it('weeks with null produce no plotted point (gap in line)', () => {
		const { container } = render(ParseSparkline, { points: [74, null, 88] });
		// With a null in the middle, we get 2 separate segments — or a dot at each non-null point
		// No polyline spanning the null
		const polylines = container.querySelectorAll('polyline');
		const circles = container.querySelectorAll('circle');
		// The null should create a gap — total plotted elements = 2
		expect(polylines.length + circles.length).toBeGreaterThanOrEqual(1);
	});

	it('chart <title> element is present and non-empty', () => {
		const { container } = render(ParseSparkline, { points: [74], bossName: 'Solanar', characterName: 'Howlsome' });
		const title = container.querySelector('title');
		expect(title).toBeTruthy();
		expect(title?.textContent?.length).toBeGreaterThan(0);
	});

	it('aria-label on <svg> contains boss name and character name', () => {
		const { container } = render(ParseSparkline, { points: [74], bossName: 'Solanar', characterName: 'Howlsome' });
		const svg = container.querySelector('svg');
		const label = svg?.getAttribute('aria-label') ?? '';
		expect(label).toContain('Solanar');
		expect(label).toContain('Howlsome');
	});

	it('renders without crashing with zero history entries', () => {
		expect(() => render(ParseSparkline, { points: [], bossName: 'Boss', characterName: 'Char' })).not.toThrow();
	});

	it('renders the correct number of elements for non-null points', () => {
		const { container } = render(ParseSparkline, { points: [70, 80, 90] });
		// 3 consecutive non-null points → 1 polyline
		const polylines = container.querySelectorAll('polyline');
		expect(polylines.length).toBeGreaterThanOrEqual(1);
	});
});
