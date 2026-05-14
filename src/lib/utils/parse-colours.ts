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

/** All tiers, ordered highest to lowest — for legend rendering. */
export const ALL_TIERS: readonly ParseColourInfo[] = TIERS;

// ── Raider.io score colour system ─────────────────────────────────────────────
// Text-only colouring — no badge background. CSS variables handle the
// per-theme contrast adjustments (see parse-colours.css).

export interface RioScoreStyle {
	/** CSS custom property — used for key level text colouring (theme-aware) */
	textVar: string;
	/** WoW quality hex for badge background (theme-invariant) */
	bgHex: string;
	/** Black or white — whichever clears WCAG AA against bgHex */
	textHex: '#000000' | '#ffffff';
	label: string;
}

// Raider.io EU Midnight S1 percentile cutoffs (verified 2026-05-14 from
// raider.io/mythic-plus/cutoffs/season-mn-1/eu).
// top 0.1% = 3891, top 1% = 3677, top 10% = 3284, top 25% = 3006, top 40% = 2719.
const RIO_TIERS: Array<{ min: number; style: RioScoreStyle }> = [
	{ min: 3891, style: { textVar: 'var(--rio-gold)',   bgHex: '#e5cc80', textHex: '#000000', label: 'Top 0.1%' } },
	{ min: 3677, style: { textVar: 'var(--rio-orange)', bgHex: '#ff8000', textHex: '#000000', label: 'Top 1%'   } },
	{ min: 3284, style: { textVar: 'var(--rio-purple)', bgHex: '#a335ee', textHex: '#ffffff', label: 'Top 10%'  } },
	{ min: 3006, style: { textVar: 'var(--rio-blue)',   bgHex: '#0070dd', textHex: '#ffffff', label: 'Top 25%'  } },
	{ min: 2719, style: { textVar: 'var(--rio-green)',  bgHex: '#1eff00', textHex: '#000000', label: 'Top 40%'  } },
	{ min:    0, style: { textVar: 'var(--rio-gray)',   bgHex: '#666666', textHex: '#ffffff', label: 'Unranked' } },
];

export function getRioScoreStyle(score: number | null | undefined): RioScoreStyle {
	if (score == null) return RIO_TIERS[RIO_TIERS.length - 1].style;
	return (RIO_TIERS.find((t) => score >= t.min) ?? RIO_TIERS[RIO_TIERS.length - 1]).style;
}

// Key level colour tiers — same WoW quality colour palette as score tiers.
// Thresholds tuned for Midnight S1 key scaling.
const KEY_TIERS: Array<{ min: number; style: RioScoreStyle }> = [
	{ min: 14, style: { textVar: 'var(--rio-gold)',   bgHex: '#e5cc80', textHex: '#000000', label: '+14' } },
	{ min: 12, style: { textVar: 'var(--rio-orange)', bgHex: '#ff8000', textHex: '#000000', label: '+12' } },
	{ min: 10, style: { textVar: 'var(--rio-purple)', bgHex: '#a335ee', textHex: '#ffffff', label: '+10' } },
	{ min:  7, style: { textVar: 'var(--rio-blue)',   bgHex: '#0070dd', textHex: '#ffffff', label: '+7'  } },
	{ min:  0, style: { textVar: 'var(--rio-green)',  bgHex: '#1eff00', textHex: '#000000', label: 'Low' } },
];

const KEY_LEVEL_NONE: RioScoreStyle = {
	textVar: 'var(--rio-gray)', bgHex: '#666666', textHex: '#ffffff', label: 'None'
};

export function getKeyLevelStyle(level: number | null | undefined): RioScoreStyle {
	if (level == null || level === 0) return KEY_LEVEL_NONE;
	return (KEY_TIERS.find((t) => level >= t.min) ?? KEY_TIERS[KEY_TIERS.length - 1]).style;
}
