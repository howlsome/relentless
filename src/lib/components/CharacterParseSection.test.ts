import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import CharacterParseSection from './CharacterParseSection.svelte';

const activeChar = {
	name: 'Howlsome',
	realm: 'Draenor',
	class: 'DeathKnight',
	spec: 'Unholy',
	role: 'dps',
	active: true,
	first_seen: '2026-03-17',
};
const inactiveChar = {
	name: 'Voidclaw',
	realm: 'Draenor',
	class: 'DemonHunter',
	spec: 'Havoc',
	role: 'dps',
	active: false,
	first_seen: '2026-01-01',
	last_seen: '2026-03-17',
};

describe('CharacterParseSection', () => {
	it('active character section has open attribute (expanded on load)', () => {
		const { container } = render(CharacterParseSection, {
			character: activeChar,
			parses: [],
			difficulty: 'mythic',
			isActive: true,
		});
		const details = container.querySelector('details');
		expect(details).toBeTruthy();
		expect(details?.hasAttribute('open')).toBe(true);
	});

	it('inactive character section does NOT have open attribute (collapsed on load)', () => {
		const { container } = render(CharacterParseSection, {
			character: inactiveChar,
			parses: [],
			difficulty: 'mythic',
			isActive: false,
			dateRange: '1 Jan 2026 → 17 Mar 2026',
			bestParseSummary: 'Best: 85%',
		});
		const details = container.querySelector('details');
		expect(details?.hasAttribute('open')).toBe(false);
	});

	it('active section header shows character name, class, spec', () => {
		const { container } = render(CharacterParseSection, {
			character: activeChar,
			parses: [],
			difficulty: 'mythic',
			isActive: true,
		});
		expect(container.textContent).toContain('Howlsome');
		expect(container.textContent).toContain('Unholy');
	});

	it('inactive section header shows date range without expanding', () => {
		const { container } = render(CharacterParseSection, {
			character: inactiveChar,
			parses: [],
			difficulty: 'mythic',
			isActive: false,
			dateRange: '1 Jan 2026 → 17 Mar 2026',
			bestParseSummary: 'Best: 85%',
		});
		// Date range visible in collapsed summary
		const summary = container.querySelector('summary');
		expect(summary?.textContent).toContain('1 Jan 2026');
	});

	it('inactive section header shows best parse summary', () => {
		const { container } = render(CharacterParseSection, {
			character: inactiveChar,
			parses: [],
			difficulty: 'mythic',
			isActive: false,
			dateRange: '1 Jan → 17 Mar',
			bestParseSummary: 'Best: 85%',
		});
		const summary = container.querySelector('summary');
		expect(summary?.textContent).toContain('Best: 85%');
	});

	it('uses <details>/<summary> elements (not JS-driven toggles)', () => {
		const { container } = render(CharacterParseSection, {
			character: activeChar,
			parses: [],
			difficulty: 'mythic',
			isActive: true,
		});
		expect(container.querySelector('details')).toBeTruthy();
		expect(container.querySelector('summary')).toBeTruthy();
	});

	it('summary tap target is min 44px height (CSS class applied)', () => {
		const { container } = render(CharacterParseSection, {
			character: inactiveChar,
			parses: [],
			difficulty: 'mythic',
			isActive: false,
		});
		const summary = container.querySelector('summary');
		// We verify the CSS class exists; computed style would need a browser
		expect(summary?.className).toContain('char-section__summary');
	});
});
