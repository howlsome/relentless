/**
 * Parse percentile colour utilities.
 *
 * Tier boundaries and badge colours follow the official WarcraftLogs scheme.
 * See src/lib/styles/parse-colours.css for the CSS variable definitions.
 */

export type ParseTier = 'gray' | 'green' | 'blue' | 'purple' | 'orange' | 'pink' | 'tan';

export interface ParseColourInfo {
	/** Internal tier name, matches CSS variable suffix */
	tier: ParseTier;
	/** Human-readable label (WCL terminology) */
	label: string;
	/** Canonical WCL chip background hex — used for parse badges */
	bgHex: string;
	/** Text colour that clears WCAG AA (4.5:1) against bgHex */
	textHex: '#000000' | '#ffffff';
	/** CSS variable reference for chart line stroke colour */
	cssVar: string;
}

// Ordered from highest to lowest tier for range checks
const TIERS: ParseColourInfo[] = [
	{ tier: 'tan',    label: 'Artifact',  bgHex: '#e5cc80', textHex: '#000000', cssVar: 'var(--parse-tan)'    }, // 100
	{ tier: 'pink',   label: 'Legendary', bgHex: '#e268a8', textHex: '#000000', cssVar: 'var(--parse-pink)'   }, // 99
	{ tier: 'orange', label: 'Epic',      bgHex: '#ff8000', textHex: '#000000', cssVar: 'var(--parse-orange)' }, // 95–98
	{ tier: 'purple', label: 'Rare',      bgHex: '#a335ee', textHex: '#ffffff', cssVar: 'var(--parse-purple)' }, // 75–94
	{ tier: 'blue',   label: 'Uncommon',  bgHex: '#0070ff', textHex: '#000000', cssVar: 'var(--parse-blue)'   }, // 50–74
	{ tier: 'green',  label: 'Common',    bgHex: '#1eff00', textHex: '#000000', cssVar: 'var(--parse-green)'  }, // 25–49
	{ tier: 'gray',   label: 'Gray',      bgHex: '#666666', textHex: '#ffffff', cssVar: 'var(--parse-gray)'   }, // 0–24
];

/**
 * Return the full colour info for a parse percentile.
 * Handles null/undefined gracefully — returns gray tier.
 */
export function getParseInfo(percentile: number | null | undefined): ParseColourInfo {
	if (percentile == null || percentile < 0) return TIERS[6]; // gray
	if (percentile >= 100) return TIERS[0]; // tan (Artifact)
	if (percentile >= 99)  return TIERS[1]; // pink (Legendary)
	if (percentile >= 95)  return TIERS[2]; // orange (Epic)
	if (percentile >= 75)  return TIERS[3]; // purple (Rare)
	if (percentile >= 50)  return TIERS[4]; // blue (Uncommon)
	if (percentile >= 25)  return TIERS[5]; // green (Common)
	return TIERS[6];                         // gray
}

/**
 * Return the CSS variable string for the chart line colour at this percentile.
 * e.g. getParseColour(74) === "var(--parse-blue)"
 */
export function getParseColour(percentile: number | null | undefined): string {
	return getParseInfo(percentile).cssVar;
}

/**
 * Return the badge chip background hex for this percentile.
 * This is the canonical WCL colour, theme-invariant.
 */
export function getBadgeBgColour(percentile: number | null | undefined): string {
	return getParseInfo(percentile).bgHex;
}

/**
 * Return the badge text colour ('#000000' or '#ffffff') that clears
 * WCAG AA (4.5:1) against the badge background for this percentile.
 */
export function getBadgeTextColour(percentile: number | null | undefined): string {
	return getParseInfo(percentile).textHex;
}

/**
 * Return the tier name for this percentile.
 */
export function getParseTier(percentile: number | null | undefined): ParseTier {
	return getParseInfo(percentile).tier;
}

/**
 * Return the tier label (e.g. "Rare", "Epic") for this percentile.
 */
export function getParseTierLabel(percentile: number | null | undefined): string {
	return getParseInfo(percentile).label;
}

/**
 * Return true if this percentile qualifies for the gold left-border accent
 * (Epic or above: 95+).
 */
export function isEpicOrAbove(percentile: number | null | undefined): boolean {
	return percentile != null && percentile >= 95;
}

/** All tiers, ordered highest to lowest — for legend rendering. */
export const ALL_TIERS: readonly ParseColourInfo[] = TIERS;
