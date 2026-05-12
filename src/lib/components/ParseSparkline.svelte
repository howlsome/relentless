<script lang="ts">
	import { getParseColour } from '$lib/utils/parse-colours.js';

	let {
		points,
		bossName = '',
		characterName = ''
	}: {
		/** Array of parse percentiles (null = no kill that week), newest last */
		points: (number | null)[];
		bossName?: string;
		characterName?: string;
	} = $props();

	const W = 120;
	const H = 32;
	const PAD = 2;

	interface PlotPoint {
		x: number;
		y: number;
		pct: number;
		index: number;
	}

	const plotted = $derived((): PlotPoint[] => {
		const n = points.length;
		return points
			.map((pct, i) => {
				if (pct == null) return null;
				const x = n <= 1 ? W / 2 : PAD + (i / (n - 1)) * (W - PAD * 2);
				const y = PAD + (1 - pct / 100) * (H - PAD * 2);
				return { x, y, pct, index: i };
			})
			.filter((p): p is PlotPoint => p != null);
	});

	/** Build connected path segments, breaking at gaps (null values). */
	const segments = $derived((): PlotPoint[][] => {
		const pts = plotted();
		if (!pts.length) return [];
		const segs: PlotPoint[][] = [];
		let cur: PlotPoint[] = [pts[0]];
		for (let i = 1; i < pts.length; i++) {
			// If the index is consecutive, keep in the same segment
			if (pts[i].index === pts[i - 1].index + 1) {
				cur.push(pts[i]);
			} else {
				segs.push(cur);
				cur = [pts[i]];
			}
		}
		segs.push(cur);
		return segs;
	});

	const latestPct = $derived(plotted().at(-1)?.pct ?? null);
	const strokeColour = $derived(getParseColour(latestPct));

	const totalWeeks = $derived(points.length);
	const latestLabel = $derived(latestPct != null ? `${latestPct.toFixed(0)}%` : 'no recent kill');

	const ariaLabel = $derived(
		`${bossName ? bossName + ' ' : ''}parse sparkline for ${characterName} — ${totalWeeks} weeks of data, latest ${latestLabel}`
	);
</script>

<svg
	viewBox="0 0 {W} {H}"
	width="100%"
	style="max-width:{W}px"
	role="img"
	aria-label={ariaLabel}
	class="sparkline"
>
	<title>{ariaLabel}</title>
	<desc>Line chart showing parse history over the last {totalWeeks} weeks.</desc>

	{#each segments() as seg}
		{#if seg.length === 1}
			<!-- Single isolated point — draw a dot -->
			<circle
				cx={seg[0].x}
				cy={seg[0].y}
				r="2"
				fill={strokeColour}
				stroke="none"
				aria-hidden="true"
			/>
		{:else}
			<polyline
				points={seg.map((p) => `${p.x},${p.y}`).join(' ')}
				fill="none"
				stroke={strokeColour}
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			/>
		{/if}
	{/each}
</svg>

<style>
	.sparkline {
		display: block;
		overflow: visible;
	}
</style>
