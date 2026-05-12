<script lang="ts">
	let {
		score,
		characterName = ''
	}: {
		score: number | null | undefined;
		characterName?: string;
	} = $props();
</script>

<span
	class="rio-badge"
	aria-label="Raider.io score{characterName ? ' for ' + characterName : ''}: {score ?? 'unavailable'}"
	title="Raider.io overall score"
>
	{#if score != null}
		<span class="rio-badge__score">{score.toLocaleString()}</span>
	{:else}
		<span class="rio-badge__empty">—</span>
	{/if}
</span>

<style>
	.rio-badge {
		display: inline-flex;
		align-items: center;
		padding: 0.2em 0.6em;
		border-radius: 0.3em;
		font-weight: 700;
		font-size: 0.9rem;
		background: color-mix(in srgb, var(--pico-primary) 15%, transparent);
		border: 1px solid color-mix(in srgb, var(--pico-primary) 30%, transparent);
		color: var(--pico-color);
	}

	.rio-badge__empty {
		opacity: 0.5;
	}
</style>
