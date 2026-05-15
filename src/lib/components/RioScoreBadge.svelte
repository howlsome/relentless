<script lang="ts">
	import { getRioScoreStyle } from '$lib/utils/parse-colours.js';

	let {
		score,
		characterName = '',
	}: {
		score: number | null | undefined;
		characterName?: string;
	} = $props();

	const style = $derived(getRioScoreStyle(score));
</script>

<span
	class="rio-badge"
	style={score != null ? `background:${style.bgHex};color:${style.textHex}` : ''}
	aria-label="Raider.io score{characterName ? ' for ' + characterName : ''}: {score ??
		'unavailable'}"
	title="Raider.io score{score != null ? ` — ${style.label}` : ''}"
>
	{#if score != null}
		{score.toLocaleString()}
	{:else}
		<span class="rio-badge__empty">—</span>
	{/if}
</span>

<style>
	.rio-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.2em 0.55em;
		border-radius: 0.3em;
		font-weight: 700;
		font-size: 1rem;
		min-width: 2.8rem;
		line-height: 1.2;
	}

	.rio-badge__empty {
		opacity: 0.5;
	}
</style>
