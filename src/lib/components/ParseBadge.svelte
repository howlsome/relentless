<script lang="ts">
	import { getBadgeBgColour, getBadgeTextColour, getParseTierLabel } from '$lib/utils/parse-colours.js';
	import { fmtParse } from '$lib/utils/format.js';

	let {
		percentile,
		size = 'md',
		showLabel = false
	}: {
		percentile: number | null | undefined;
		size?: 'sm' | 'md' | 'lg';
		showLabel?: boolean;
	} = $props();

	const bg = $derived(getBadgeBgColour(percentile));
	const color = $derived(getBadgeTextColour(percentile));
	const label = $derived(getParseTierLabel(percentile));
	const text = $derived(percentile != null ? fmtParse(percentile) : '—');

	const flavour: Record<string, string> = {
		Artifact: 'World-class. The absolute peak.',
		Legendary: 'Top 1% worldwide. Exceptional.',
		Epic: 'Elite performance. Outstanding.',
		Rare: 'High performer. Well above average.',
		Uncommon: 'Above average. Solid work.',
		Common: 'Below average. Room to grow.',
		Gray: 'Needs attention.'
	};
</script>

<span
	class="parse-badge parse-badge--{size}"
	style="background:{bg};color:{color}"
	title="{label} — {flavour[label] ?? ''}"
	aria-label="Parse {text}% — {label}"
>
	{text}
	{#if showLabel}<span class="parse-badge__label">{label}</span>{/if}
</span>

<style>
	.parse-badge--sm {
		font-size: 0.8rem;
		min-width: 2.2rem;
		padding: 0.15em 0.4em;
	}

	.parse-badge--md {
		font-size: 1rem;
	}

	.parse-badge--lg {
		font-size: 1.25rem;
		min-width: 3.5rem;
		padding: 0.3em 0.75em;
	}

	.parse-badge__label {
		margin-left: 0.4em;
		font-size: 0.75em;
		font-weight: 600;
		opacity: 0.85;
	}
</style>
