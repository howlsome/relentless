<script lang="ts">
	import '@picocss/pico/css/pico.conditional.min.css';
	import '$lib/styles/parse-colours.css';
	import '$lib/styles/app.css';
	import type { Snippet } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import RaidingBreakBanner from '$lib/components/RaidingBreakBanner.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import type { SeasonsIndex } from '$lib/types/seasons.js';

	let {
		data,
		children,
	}: {
		data: { seasonsIndex: SeasonsIndex };
		children: Snippet;
	} = $props();

	const { seasonsIndex } = $derived(data);

	const currentPath = $derived($page.url.pathname);
</script>

<svelte:head>
	<meta
		name="description"
		content="Undaunted: Relentless — raid and M+ performance dashboard, EU-Draenor"
	/>
</svelte:head>

<header class="site-header">
	<div class="container">
		<nav aria-label="Main navigation">
			<span class="nav-brand">
				<a href="/" aria-label="Undaunted: Relentless — Dashboard home"> Undaunted: Relentless </a>
			</span>

			<div class="nav-actions">
				{#if currentPath.startsWith('/raider/') || currentPath === '/changelog'}
					<a href="/" class="nav-back">← Dashboard</a>
				{/if}
				{#if browser}
					<ThemeToggle />
				{/if}
			</div>
		</nav>
	</div>
</header>

<main class="container" id="main-content">
	{#if seasonsIndex.raiding_break?.active}
		<RaidingBreakBanner
			message={seasonsIndex.raiding_break.message}
			note={seasonsIndex.raiding_break.note}
		/>
	{/if}
	{@render children()}
</main>

<footer class="site-footer container">
	<small class="site-footer__made">Made with ♥ by howlsome</small>
	<small class="site-footer__refresh">Data refreshed twice a day</small>
</footer>

<style>
	/* Back link — only shown on desktop in the header */
	.nav-back {
		font-size: 0.85rem;
		color: var(--pico-muted-color);
		text-decoration: none;
		white-space: nowrap;
	}

	.nav-back:hover {
		color: var(--pico-color);
	}

	@media (max-width: 639px) {
		.nav-back {
			display: none;
		}
	}

	.site-footer {
		border-top: 3px solid var(--pico-muted-border-color);
		padding-block: 1rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 0.25rem;
	}

	@media (min-width: 640px) {
		.site-footer {
			flex-direction: row;
			justify-content: space-between;
			align-items: center;
			text-align: left;
		}
	}
</style>
