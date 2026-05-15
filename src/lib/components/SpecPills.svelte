<script lang="ts">
	import type { SpecEntry } from '$lib/types/roster.js';

	let { specs }: { specs: SpecEntry[] } = $props();
</script>

<ul class="spec-pills" role="list">
	{#each specs as entry}
		<li
			class="spec-pill {entry.primary ? 'spec-pill--primary' : ''} {!entry.wcl_active
				? 'spec-pill--inactive'
				: ''}"
			data-testid="spec-pill-{entry.spec}"
			data-primary={entry.primary ? 'true' : 'false'}
			aria-label="{entry.spec} ({entry.role}){entry.primary ? ' — primary' : ''}{!entry.wcl_active
				? ' — not tracked'
				: ''}"
		>
			{#if entry.primary}
				<span class="spec-pill__star" aria-hidden="true">★</span>
			{/if}
			<span class="spec-pill__name">{entry.spec}</span>
			<span class="spec-pill__role">({entry.role})</span>
			{#if !entry.wcl_active}
				<span class="spec-pill__note">(not tracked)</span>
			{/if}
		</li>
	{/each}
</ul>

<style>
	.spec-pills {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.spec-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.125rem 0.5rem;
		border-radius: 1rem;
		font-size: 0.8125rem;
		background: var(--pico-muted-background, #f0f0f0);
		border: 1px solid var(--pico-muted-border, #ccc);
	}

	.spec-pill--primary {
		background: var(--pico-primary-background, #dbeafe);
		border-color: var(--pico-primary, #3b82f6);
	}

	.spec-pill--inactive {
		opacity: 0.6;
	}

	.spec-pill__star {
		color: var(--pico-primary, #3b82f6);
	}

	.spec-pill__note {
		font-style: italic;
		opacity: 0.7;
		font-size: 0.75rem;
	}
</style>
