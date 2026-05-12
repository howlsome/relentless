<script lang="ts">
	import { onMount } from 'svelte';

	let {
		difficulties = ['heroic', 'mythic'],
		value = $bindable<string>('mythic'),
		onchange
	}: {
		difficulties?: string[];
		value?: string;
		onchange?: (d: string) => void;
	} = $props();

	onMount(() => {
		const stored = localStorage.getItem('raid-difficulty');
		if (stored && difficulties.includes(stored)) {
			value = stored;
		}
	});

	function select(d: string) {
		value = d;
		localStorage.setItem('raid-difficulty', d);
		onchange?.(d);
	}
</script>

{#if difficulties.length > 1}
	<div role="group" aria-label="Select difficulty" class="difficulty-toggle">
		{#each difficulties as d}
			<button
				type="button"
				aria-pressed={value === d}
				class="toggle-btn {value === d ? 'toggle-btn--active' : ''}"
				onclick={() => select(d)}
			>
				{d.charAt(0).toUpperCase() + d.slice(1)}
			</button>
		{/each}
	</div>
{:else if difficulties.length === 1}
	<span class="difficulty-label">{difficulties[0].charAt(0).toUpperCase() + difficulties[0].slice(1)}</span>
{/if}

<style>
	.difficulty-toggle {
		display: flex;
		border-radius: var(--pico-border-radius);
		overflow: hidden;
		border: 1px solid var(--pico-muted-border-color);
		width: fit-content;
	}

	.toggle-btn {
		background: none;
		border: none;
		border-right: 1px solid var(--pico-muted-border-color);
		padding: 0.4rem 1rem;
		min-height: 44px;
		cursor: pointer;
		font-size: 0.9rem;
		color: var(--pico-color);
	}

	.toggle-btn:last-child {
		border-right: none;
	}

	.toggle-btn--active {
		background: var(--pico-primary);
		color: var(--pico-primary-inverse);
		font-weight: 700;
	}

	.difficulty-label {
		font-weight: 600;
	}
</style>
