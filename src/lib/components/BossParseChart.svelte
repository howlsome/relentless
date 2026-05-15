<script lang="ts">
	import { getBadgeBgColour } from '$lib/utils/parse-colours.js';

	let {
		points,
		bossName = '',
		characterName = '',
	}: {
		points: (number | null)[];
		bossName?: string;
		characterName?: string;
	} = $props();

	const W = 200;
	const H = 80;
	const PAD = 4;
	const GAP = 3;

	// Use last 8 weeks maximum
	const recent = $derived(points.slice(-8));
	const n = $derived(Math.max(recent.length, 1));
	const barW = $derived((W - PAD * 2 - GAP * (n - 1)) / n);

	const nonNull = $derived(recent.filter((p): p is number => p != null));
	const bestPct = $derived(nonNull.length ? Math.max(...nonNull) : null);
	const avgPct = $derived(
		nonNull.length ? nonNull.reduce((a, b) => a + b, 0) / nonNull.length : null,
	);

	const innerH = $derived(H - PAD * 2);

	const bgColor = $derived(bestPct != null ? getBadgeBgColour(bestPct) : null);

	const bars = $derived(
		recent.map((pct, i) => {
			const x = PAD + i * (barW + GAP);
			if (pct == null) {
				// No kill that week — tiny ghost stub
				return { x, pct: null, barH: 3, y: H - PAD - 3, opacity: 0.2 };
			}
			const barH = Math.max(4, (pct / 100) * innerH);
			const y = H - PAD - barH;
			return { x, pct, barH, y, opacity: 0.55 };
		}),
	);

	const avgY = $derived(avgPct != null ? H - PAD - (avgPct / 100) * innerH : null);

	const ariaLabel = $derived(
		`${bossName ? `${bossName} ` : ''}parse history for ${characterName}` +
			(avgPct != null ? `, average ${avgPct.toFixed(0)}%` : ', no kill data'),
	);
</script>

<figure class="parse-chart" aria-label={ariaLabel}>
	<svg viewBox="0 0 {W} {H}" width="100%" role="img" aria-label={ariaLabel}>
		<title>{ariaLabel}</title>

		<!-- Background tinted by best parse -->
		{#if bgColor}
			<rect x="0" y="0" width={W} height={H} fill={bgColor} fill-opacity="0.25" rx="3" />
		{/if}

		<!-- Bars — currentColor inherits black/white from the card for guaranteed contrast -->
		{#each bars as bar}
			<rect
				x={bar.x}
				y={bar.y}
				width={barW}
				height={bar.barH}
				fill="currentColor"
				fill-opacity={bar.opacity}
				rx="2"
				aria-hidden="true"
			/>
		{/each}

		<!-- Average line — white so it stands out clearly over bars -->
		{#if avgY != null}
			<line
				x1={PAD}
				y1={avgY}
				x2={W - PAD}
				y2={avgY}
				stroke="#ffffff"
				stroke-opacity="1"
				stroke-width="2.5"
				stroke-dasharray="5 3"
				stroke-linecap="round"
				aria-hidden="true"
			/>
		{/if}
	</svg>
</figure>

<style>
	.parse-chart {
		margin: 0;
		width: 100%;
	}
</style>
