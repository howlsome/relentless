<script lang="ts">
	import type { SpecEntry } from '$lib/types/roster.js';

	let { specs, charClass }: { specs: SpecEntry[]; charClass: string } = $props();

	const activeSpecs = $derived(specs.filter((s) => s.wcl_active));
	const primary = $derived(specs.find((s) => s.primary) ?? specs[0] ?? null);
	const extraCount = $derived(activeSpecs.length - 1);
</script>

<span class="spec-indicator">
	{#if primary}
		<span class="spec-indicator__primary">{charClass} — {primary.spec} ({primary.role})</span>
	{/if}
	{#if extraCount > 0}
		<span
			class="spec-indicator__extra"
			title={activeSpecs
				.slice(1)
				.map((s) => s.spec)
				.join(', ')}
		>
			+{extraCount}
		</span>
	{/if}
</span>

<style>
	.spec-indicator {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}

	.spec-indicator__extra {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--pico-muted-background, #f0f0f0);
		border: 1px solid var(--pico-muted-border, #ccc);
		border-radius: 1rem;
		font-size: 0.75rem;
		padding: 0 0.4rem;
		cursor: default;
	}
</style>
