import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import ChangelogEntry from './ChangelogEntry.svelte';

function entry(overrides: Record<string, unknown> = {}) {
	return {
		id: 'test-id',
		timestamp: '2026-03-17T06:01:00Z',
		week: '2026-11',
		team: 'main',
		raider_id: 'uuid-1',
		display_name: 'Howlsome',
		event: 'joined',
		character: 'Howlsome',
		class: 'DeathKnight',
		spec: 'Unholy',
		role: 'dps',
		note: '',
		...overrides,
	};
}

describe('ChangelogEntry', () => {
	it('renders joined entry with green icon', () => {
		const { container } = render(ChangelogEntry, { entry: entry() });
		expect(container.textContent).toContain('🟢');
	});

	it('renders "Joined the main team"', () => {
		const { container } = render(ChangelogEntry, { entry: entry() });
		expect(container.textContent).toContain('Joined');
	});

	it('renders left entry with red icon', () => {
		const { container } = render(ChangelogEntry, { entry: entry({ event: 'left', team: 'main' }) });
		expect(container.textContent).toContain('🔴');
	});

	it('renders team_changed entry with reason in italics', () => {
		const { container } = render(ChangelogEntry, {
			entry: entry({
				event: 'team_changed',
				from: 'alt',
				to: 'main',
				reason: 'Strong performance',
				character: 'Howlsome',
			}),
		});
		expect(container.textContent).toContain('Strong performance');
		expect(container.textContent).toContain('→');
	});

	it('renders rerolled entry with old and new character', () => {
		const { container } = render(ChangelogEntry, {
			entry: entry({
				event: 'rerolled',
				from_character: 'OldChar',
				from_class: 'Mage',
				from_spec: 'Fire',
				to_character: 'NewChar',
				to_class: 'Rogue',
				to_spec: 'Subtlety',
				role: 'dps',
			}),
		});
		expect(container.textContent).toContain('OldChar');
		expect(container.textContent).toContain('NewChar');
	});

	it('renders role_changed entry', () => {
		const { container } = render(ChangelogEntry, {
			entry: entry({
				event: 'role_changed',
				from_spec: 'Protection',
				from_role: 'tank',
				to_spec: 'Retribution',
				to_role: 'dps',
				character: 'C',
			}),
		});
		expect(container.textContent).toContain('Role change');
	});

	it('renders spec_changed entry', () => {
		const { container } = render(ChangelogEntry, {
			entry: entry({
				event: 'spec_changed',
				from_spec: 'Assassination',
				to_spec: 'Subtlety',
				character: 'C',
			}),
		});
		expect(container.textContent).toContain('Spec change');
	});

	it('raider display name is a link to /raider/[uuid]', () => {
		const { container } = render(ChangelogEntry, { entry: entry() });
		const link = container.querySelector(`a[href="/raider/uuid-1"]`);
		expect(link).toBeTruthy();
		expect(link?.textContent).toContain('Howlsome');
	});

	it('a note renders beneath the description', () => {
		const { container } = render(ChangelogEntry, { entry: entry({ note: 'Returning after break' }) });
		expect(container.textContent).toContain('Returning after break');
	});

	it('no note renders cleanly with no blank space issues', () => {
		const { container } = render(ChangelogEntry, { entry: entry({ note: '' }) });
		// No empty note element visible
		const notes = container.querySelectorAll('.changelog-entry__note');
		const emptyNotes = [...notes].filter((n) => !n.textContent?.trim());
		expect(emptyNotes.length).toBe(0);
	});

	it('team designation badge is shown', () => {
		const { container } = render(ChangelogEntry, { entry: entry() });
		expect(container.querySelector('.designation-badge')).toBeTruthy();
	});
});
