import { describe, it, expect } from 'vitest';
import {
	getParseColour,
	getBadgeTextColour,
	getBadgeBgColour,
	ALL_TIERS
} from './parse-colours.js';

describe('getParseColour', () => {
	it('0 → gray', () => expect(getParseColour(0)).toBe('var(--parse-gray)'));
	it('24 → gray', () => expect(getParseColour(24)).toBe('var(--parse-gray)'));
	it('25 → green', () => expect(getParseColour(25)).toBe('var(--parse-green)'));
	it('49 → green', () => expect(getParseColour(49)).toBe('var(--parse-green)'));
	it('50 → blue', () => expect(getParseColour(50)).toBe('var(--parse-blue)'));
	it('74 → blue', () => expect(getParseColour(74)).toBe('var(--parse-blue)'));
	it('75 → purple', () => expect(getParseColour(75)).toBe('var(--parse-purple)'));
	it('94 → purple', () => expect(getParseColour(94)).toBe('var(--parse-purple)'));
	it('95 → orange', () => expect(getParseColour(95)).toBe('var(--parse-orange)'));
	it('98 → orange', () => expect(getParseColour(98)).toBe('var(--parse-orange)'));
	it('99 → pink', () => expect(getParseColour(99)).toBe('var(--parse-pink)'));
	it('100 → tan', () => expect(getParseColour(100)).toBe('var(--parse-tan)'));
	it('null → gray (no kill)', () => expect(getParseColour(null)).toBe('var(--parse-gray)'));
	it('negative → gray', () => expect(getParseColour(-1)).toBe('var(--parse-gray)'));
});

describe('getBadgeTextColour', () => {
	it('#0070ff (blue / Uncommon) → black passes AA', () => {
		const tier = ALL_TIERS.find((t) => t.tier === 'blue');
		expect(tier?.bgHex).toBe('#0070ff');
		expect(getBadgeTextColour(60)).toBe('#000000');
	});

	it('#a335ee (purple / Rare) → white passes AA', () => {
		const tier = ALL_TIERS.find((t) => t.tier === 'purple');
		expect(tier?.bgHex).toBe('#a335ee');
		expect(getBadgeTextColour(80)).toBe('#ffffff');
	});

	it('gray (0-24) → white', () => expect(getBadgeTextColour(10)).toBe('#ffffff'));
	it('green (25-49) → black', () => expect(getBadgeTextColour(30)).toBe('#000000'));
	it('orange (95-98) → black', () => expect(getBadgeTextColour(96)).toBe('#000000'));
	it('pink (99) → black', () => expect(getBadgeTextColour(99)).toBe('#000000'));
	it('tan (100) → black', () => expect(getBadgeTextColour(100)).toBe('#000000'));
});

describe('WCL canonical hex codes', () => {
	it('all 7 tiers export named constants matching official WCL values', () => {
		const expected: Record<string, string> = {
			tan:    '#e5cc80',
			pink:   '#e268a8',
			orange: '#ff8000',
			purple: '#a335ee',
			blue:   '#0070ff',
			green:  '#1eff00',
			gray:   '#666666'
		};
		for (const tier of ALL_TIERS) {
			expect(tier.bgHex).toBe(expected[tier.tier]);
		}
	});
});

describe('WCAG contrast — badge backgrounds', () => {
	// Verify each badge bg passes 4.5:1 against its text colour
	function relativeLuminance(hex: string): number {
		const r = parseInt(hex.slice(1, 3), 16) / 255;
		const g = parseInt(hex.slice(3, 5), 16) / 255;
		const b = parseInt(hex.slice(5, 7), 16) / 255;
		const lin = (c: number) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
		return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
	}
	function contrastRatio(hex1: string, hex2: string): number {
		const l1 = relativeLuminance(hex1);
		const l2 = relativeLuminance(hex2);
		const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
		return (lighter + 0.05) / (darker + 0.05);
	}

	for (const tier of ALL_TIERS) {
		it(`${tier.label} (${tier.bgHex}) passes WCAG AA 4.5:1 with ${tier.textHex}`, () => {
			const ratio = contrastRatio(tier.bgHex, tier.textHex);
			expect(ratio).toBeGreaterThanOrEqual(4.5);
		});
	}
});

describe('WCAG non-text contrast — chart line colours', () => {
	// Per spec, all chart line colours must pass 3:1 against their theme background
	// Light bg ≈ #ffffff, Dark bg ≈ #11191f (PicoCSS dark)
	function relativeLuminance(hex: string): number {
		const r = parseInt(hex.slice(1, 3), 16) / 255;
		const g = parseInt(hex.slice(3, 5), 16) / 255;
		const b = parseInt(hex.slice(5, 7), 16) / 255;
		const lin = (c: number) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
		return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
	}
	function contrastRatio(hex1: string, hex2: string): number {
		const l1 = relativeLuminance(hex1);
		const l2 = relativeLuminance(hex2);
		const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
		return (lighter + 0.05) / (darker + 0.05);
	}

	// Light mode chart colours (spec-defined, darkened for contrast)
	const lightModeColours: Record<string, string> = {
		gray:   '#666666',
		green:  '#14ac00',
		blue:   '#0070ff',
		purple: '#a335ee',
		orange: '#e87500',
		pink:   '#e268a8',
		tan:    '#a5935d'
	};
	// Dark mode chart colours (original WCL values)
	const darkModeColours: Record<string, string> = {
		gray:   '#666666',
		green:  '#1eff00',
		blue:   '#0070ff',
		purple: '#a335ee',
		orange: '#ff8000',
		pink:   '#e268a8',
		tan:    '#e5cc80'
	};

	const lightBg = '#ffffff';
	const darkBg  = '#11191f'; // approximate PicoCSS dark background

	for (const [tier, hex] of Object.entries(lightModeColours)) {
		it(`light mode --parse-${tier} (${hex}) passes 3:1 non-text contrast`, () => {
			expect(contrastRatio(hex, lightBg)).toBeGreaterThanOrEqual(3.0);
		});
	}

	for (const [tier, hex] of Object.entries(darkModeColours)) {
		it(`dark mode --parse-${tier} (${hex}) passes 3:1 non-text contrast`, () => {
			expect(contrastRatio(hex, darkBg)).toBeGreaterThanOrEqual(3.0);
		});
	}
});
