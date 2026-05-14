<script lang="ts">
	import type { Player } from '$lib/types/roster.js';
	import { fmtDate } from '$lib/utils/format.js';

	let { player }: { player: Player } = $props();

	const isActive = $derived(player.status === 'active');

	const joinedEvent = $derived(
		[...(player.membership_history ?? [])].reverse().find((e) => e.event === 'joined')
	);
	const leftEvent = $derived(
		[...(player.membership_history ?? [])].reverse().find((e) => e.event === 'left')
	);
	const joinedCount = $derived(
		(player.membership_history ?? []).filter((e) => e.event === 'joined').length
	);

	const label = $derived(() => {
		if (isActive) {
			const since = joinedEvent?.date ?? null;
			return `Active member since ${fmtDate(since)}`;
		}
		const from = joinedEvent?.date ?? null;
		const to = leftEvent?.date ?? null;
		return `${fmtDate(from)} – ${fmtDate(to)}`;
	});
</script>

<span class="membership-status membership-status--{isActive ? 'active' : 'inactive'}">
	{isActive ? '✓' : ''}
	{label()}
	{#if joinedCount > 1}
		<span class="membership-rejoined" aria-label="Has rejoined the team">
			(rejoined)
		</span>
	{/if}
</span>

<style>
	.membership-status {
		display: inline-flex;
		align-items: center;
		gap: 0.4em;
		font-size: 0.875rem;
		padding: 0.2em 0.6em;
		border-radius: 999px;
	}

	.membership-status--active {
		background: color-mix(in srgb, #4aff2f 20%, transparent);
		color: color-mix(in srgb, #4aff2f 80%, var(--pico-color));
		border: 1px solid color-mix(in srgb, #4aff2f 40%, transparent);
	}

	.membership-status--inactive {
		background: color-mix(in srgb, var(--pico-muted-color) 15%, transparent);
		color: var(--pico-muted-color);
		border: 1px solid color-mix(in srgb, var(--pico-muted-color) 30%, transparent);
	}

	.membership-rejoined {
		font-style: italic;
		opacity: 0.8;
	}
</style>
