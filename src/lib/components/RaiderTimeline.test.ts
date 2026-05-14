import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import RaiderTimeline from './RaiderTimeline.svelte';

describe('RaiderTimeline', () => {
	it('hidden for raider with only a single join event', () => {
		const { container } = render(RaiderTimeline, {
			membershipHistory: [{ event: 'joined', date: '2026-01-01', note: '' }],
			roleHistory: []
		});
		expect(container.querySelector('.raider-timeline')).toBeNull();
	});

	it('shows toggle when 2+ notable events exist', () => {
		const { container } = render(RaiderTimeline, {
			membershipHistory: [
				{ event: 'joined', date: '2026-01-01' },
				{ event: 'left',   date: '2026-03-01', note: 'Break' }
			],
			roleHistory: []
		});
		expect(container.querySelector('details')).toBeTruthy();
		expect(container.textContent).toContain('team history');
	});

	it('membership "joined" events have 🚪 icon', () => {
		const { container } = render(RaiderTimeline, {
			membershipHistory: [
				{ event: 'joined', date: '2026-01-01' },
				{ event: 'left',   date: '2026-03-01' }
			],
			roleHistory: []
		});
		expect(container.textContent).toContain('🚪');
	});

	it('membership "left" events have 💤 icon', () => {
		const { container } = render(RaiderTimeline, {
			membershipHistory: [
				{ event: 'joined', date: '2026-01-01' },
				{ event: 'left',   date: '2026-03-01' }
			],
			roleHistory: []
		});
		expect(container.textContent).toContain('💤');
	});

	it('team_changed events show reason in muted text', () => {
		const { container } = render(RaiderTimeline, {
			membershipHistory: [
				{ event: 'joined', date: '2026-01-01' },
				{ event: 'team_changed', date: '2026-03-17', from: 'alt', to: 'main', reason: 'Strong performance' }
			],
			roleHistory: []
		});
		expect(container.textContent).toContain('Strong performance');
	});

	it('events are sorted oldest-first', () => {
		const { container } = render(RaiderTimeline, {
			membershipHistory: [
				{ event: 'joined', date: '2026-01-01' },
				{ event: 'left',   date: '2026-06-01' }
			],
			roleHistory: []
		});
		const entries = container.querySelectorAll('.timeline-entry');
		const texts = [...entries].map((e) => e.textContent ?? '');
		const joinIdx = texts.findIndex((t) => t.includes('Joined'));
		const leftIdx = texts.findIndex((t) => t.includes('Left'));
		expect(joinIdx).toBeLessThan(leftIdx);
	});
});
