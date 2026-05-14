<script lang="ts">
	import type { Milestone } from '$lib/utils/milestones.js';

	let { milestones }: { milestones: Milestone[] } = $props();
</script>

{#if milestones.length > 0}
	<div class="milestones" role="status" aria-label="Achievement milestones">
		{#each milestones as m (m.key)}
			<div class="milestone-banner">
				<span class="milestone-emoji" aria-hidden="true">{m.emoji}</span>
				<span class="milestone-text">{m.text}</span>
			</div>
		{/each}
	</div>
{/if}

<style>
	.milestones {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-block-end: 1rem;
	}

	.milestone-banner {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.6rem 1rem;
		border-radius: var(--pico-border-radius);
		background: color-mix(in srgb, var(--pico-primary-background) 15%, transparent);
		border: 1px solid color-mix(in srgb, var(--pico-primary) 30%, transparent);
		font-weight: 600;
	}

	.milestone-emoji {
		font-size: 1.2em;
		flex-shrink: 0;
	}
</style>
