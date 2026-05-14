/**
 * Formatting helpers used across all pages and components.
 */

/** Format a Mythic+ key level in WoW keystone notation: "+12" or "—" if null. */
export function fmtKey(level: number | null | undefined): string {
	if (level == null) return '—';
	return `+${level}`;
}

/** Format a week-on-week delta as a coloured pill label: "▲ +3", "▼ −2", or "—". */
export function fmtDelta(current: number | null, previous: number | null): string {
	if (current == null || previous == null) return '—';
	const d = current - previous;
	if (d > 0) return `▲ +${d}`;
	if (d < 0) return `▼ ${d}`; // minus is already in the number
	return '—';
}

/** Class for the delta indicator: 'up', 'down', or 'neutral'. */
export function deltaClass(current: number | null, previous: number | null): 'up' | 'down' | 'neutral' {
	if (current == null || previous == null) return 'neutral';
	const d = current - previous;
	if (d > 0) return 'up';
	if (d < 0) return 'down';
	return 'neutral';
}

/**
 * Format an ISO week string ("2026-20") to a human label.
 * Uses the reset_start timestamp when available for the date portion.
 */
export function fmtWeekLabel(isoWeek: string | null | undefined, resetStart?: string | null): string {
	if (!isoWeek) return '—';
	const [, weekNum] = isoWeek.split('-');
	if (resetStart) {
		const d = new Date(resetStart);
		const day = d.getUTCDate();
		const month = d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
		return `Week ${Number(weekNum)} — ${day} ${month}`;
	}
	return `Week ${Number(weekNum)}`;
}

/**
 * Given an ISO week string ("2026-20") and a season start date ("2026-03-24"),
 * return which week of the season this is (1-based).
 * Returns null if inputs are invalid or the current week is before the season.
 */
export function getSeasonWeek(currentIsoWeek: string | null | undefined, seasonStartDate: string | null | undefined): number | null {
	if (!currentIsoWeek || !seasonStartDate) return null;
	try {
		const [curYearStr, curWeekStr] = currentIsoWeek.split('-');
		const curYear = Number(curYearStr);
		const curWeek = Number(curWeekStr);

		// ISO week number for the season start date
		const d = new Date(seasonStartDate + 'T12:00:00Z');
		const dayOfWeek = d.getUTCDay() || 7; // 1=Mon 7=Sun
		d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek); // move to Thursday of that week
		const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
		const startWeek = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
		const startYear = d.getUTCFullYear();

		const diff = (curYear - startYear) * 52 + (curWeek - startWeek) + 1;
		return diff > 0 ? diff : null;
	} catch {
		return null;
	}
}

/** Format a short date label from an ISO date string: "14 May 2026". */
export function fmtDate(iso: string | null | undefined): string {
	if (!iso) return '—';
	const d = new Date(iso);
	return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** Format a short date label from an ISO date string: "14 May". */
/** Round a number to one decimal place, or return "—" if null. */
export function fmtParse(n: number | null | undefined): string {
	if (n == null) return '—';
	return n.toFixed(1).replace(/\.0$/, '');
}

/** Format DPS/HPS numbers with k suffix: "1,284k". */
export function fmtAmount(n: number | null | undefined): string {
	if (n == null) return '—';
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
	if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
	return String(n);
}

/** Official WoW class colours. */
const CLASS_COLOURS: Record<string, string> = {
	DeathKnight:  '#C41E3A',
	DemonHunter:  '#A330C9',
	Druid:        '#FF7C0A',
	Evoker:       '#33937F',
	Hunter:       '#AAD372',
	Mage:         '#3FC7EB',
	Monk:         '#00FF98',
	Paladin:      '#F48CBA',
	Priest:       '#AAAAAA',
	Rogue:        '#FFF468',
	Shaman:       '#0070DD',
	Warlock:      '#8788EE',
	Warrior:      '#C69B3A',
};

export function getWowClassColor(className: string | null | undefined): string {
	return CLASS_COLOURS[className ?? ''] ?? 'var(--pico-primary)';
}

/** Average of an array of numbers, ignoring nulls. Returns null if no values. */
export function avg(nums: (number | null)[]): number | null {
	const valid = nums.filter((n): n is number => n != null);
	if (!valid.length) return null;
	return valid.reduce((a, b) => a + b, 0) / valid.length;
}
