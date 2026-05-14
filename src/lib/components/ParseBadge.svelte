<script lang="ts">
	import { getBadgeBgColour, getBadgeTextColour, getParseTierLabel } from '$lib/utils/parse-colours.js';
	import { fmtParse } from '$lib/utils/format.js';

	let {
		percentile,
		size = 'md',
		showLabel = false,
		href = null
	}: {
		percentile: number | null | undefined;
		size?: 'sm' | 'md' | 'lg';
		showLabel?: boolean;
		href?: string | null;
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

{#if href}
	<a
		{href}
		target="_blank"
		rel="noopener noreferrer"
		class="parse-badge parse-badge--{size}"
		style="background:{bg};color:{color}"
		title="{label} — {flavour[label] ?? ''}"
		aria-label="Parse {text}% — {label}, opens Warcraft Logs"
	>
		{text}
		{#if showLabel}<span class="parse-badge__label">{label}</span>{/if}
	</a>
{:else}
	<span
		class="parse-badge parse-badge--{size}"
		style="background:{bg};color:{color}"
		title="{label} — {flavour[label] ?? ''}"
		aria-label="Parse {text}% — {label}"
	>
		{text}
		{#if showLabel}<span class="parse-badge__label">{label}</span>{/if}
	</span>
{/if}

<style>
	a.parse-badge {
		text-decoration: none;
		display: inline-block;
	}

	a.parse-badge:hover {
		filter: brightness(1.1);
	}

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
