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

/** Format a short date label from an ISO date string: "14 May 2026". */
export function fmtDate(iso: string | null | undefined): string {
	if (!iso) return '—';
	const d = new Date(iso);
	return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** Format a short date label from an ISO date string: "14 May". */
export function fmtShortDate(iso: string | null | undefined): string {
	if (!iso) return '—';
	const d = new Date(iso);
	return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

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

/** Average of an array of numbers, ignoring nulls. Returns null if no values. */
export function avg(nums: (number | null)[]): number | null {
	const valid = nums.filter((n): n is number => n != null);
	if (!valid.length) return null;
	return valid.reduce((a, b) => a + b, 0) / valid.length;
}
