<script lang="ts">
	import '@picocss/pico/css/pico.conditional.min.css';
	import '$lib/styles/parse-colours.css';
	import '$lib/styles/app.css';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { page } from '$app/stores';
	import type { SeasonsIndex } from '$lib/types/seasons.js';
	import type { Snippet } from 'svelte';

	let {
		data,
		children
	}: {
		data: { seasonsIndex: SeasonsIndex };
		children: Snippet;
	} = $props();

	const { seasonsIndex } = $derived(data);

	/** All seasons available in the selector (past M+ + raid zones). */
	const pastSeasons = $derived([
		...seasonsIndex.all_mplus_seasons.filter(
			(s) => s.season_id !== seasonsIndex.active_mplus_season
		),
		...seasonsIndex.all_raid_zones
	]);

	const currentPath = $derived($page.url.pathname);
</script>

<svelte:head>
	<meta name="description" content="Undaunted: Relentless — raid and M+ performance dashboard, EU-Draenor" />
</svelte:head>

<header class="site-header">
	<div class="container">
		<nav aria-label="Main navigation">
			<span class="nav-brand">
				<a href="/" aria-label="Undaunted: Relentless — Dashboard home">
					Undaunted: Relentless
				</a>
			</span>

			<ul class="nav-links">
				<li>
					<a href="/" aria-current={currentPath === '/' ? 'page' : undefined}>
						Dashboard
					</a>
				</li>
				<li>
					<a href="/changelog" aria-current={currentPath === '/changelog' ? 'page' : undefined}>
						Changelog
					</a>
				</li>
			</ul>

			<div class="nav-actions">
				{#if pastSeasons.length > 0}
					<label for="season-select" class="sr-only">Season archive</label>
					<select
						id="season-select"
						class="season-select"
						aria-label="Select season archive"
						onchange={(e) => {
							const id = (e.currentTarget as HTMLSelectElement).value;
							if (id) window.location.href = `/season/${id}`;
						}}
					>
						<option value="">Season archive…</option>
						{#each pastSeasons as season}
							<option value={season.season_id}>{season.label}</option>
						{/each}
					</select>
				{/if}

				<ThemeToggle />
			</div>
		</nav>
	</div>
</header>

<main class="container" id="main-content">
	{@render children()}
</main>

<footer class="container">
	<small>EU-Draenor &middot; Data refreshed daily at 06:00 UTC</small>
</footer>

<style>
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}

	a[aria-current='page'] {
		font-weight: 700;
		text-decoration: underline;
	}
</style>
