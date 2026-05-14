<script lang="ts">
	import type { SeasonsIndex } from '$lib/types/seasons.js';
	import { fmtDate } from '$lib/utils/format.js';

	let {
		data
	}: {
		data: {
			season_id: string;
			seasonMeta: { label: string; start_date: string; end_date: string | null } | null;
			seasonsIndex: SeasonsIndex;
			snapshot: object | null;
			compliance: object | null;
			zoneMeta: object | null;
		};
	} = $props();

	const { season_id, seasonMeta, snapshot, zoneMeta } = $derived(data);
	const label = $derived(seasonMeta?.label ?? season_id);
	const isRaidZone = $derived(season_id.startsWith('raid-'));
</script>

<svelte:head>
	<title>{label} — Season Archive — Undaunted: Relentless</title>
</svelte:head>

<a href="/" class="back-link">← Back to dashboard</a>

<h1>Season Archive: {label}</h1>

{#if seasonMeta}
	<div class="season-banner" role="status" aria-label="Viewing historical season">
		<span aria-hidden="true">📅</span>
		Viewing: <strong>{label}</strong> — {fmtDate(seasonMeta.start_date)}
		{#if seasonMeta.end_date}to {fmtDate(seasonMeta.end_date)}{/if}
	</div>
{/if}

{#if !snapshot}
	<p class="muted">No data is available for this season yet. Data is written by the cron after each weekly reset.</p>
{:else if isRaidZone}
	<p>Raid tier historical data for <strong>{label}</strong>.</p>
	{#if zoneMeta}
		<p>Zone: {(zoneMeta as {name: string}).name}</p>
	{/if}
	<p class="muted">Full historical raid parse view coming in a future update.</p>
{:else}
	<p>M+ season historical data for <strong>{label}</strong>.</p>
	<p class="muted">Full historical M+ view coming in a future update.</p>
{/if}

<style>
	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		margin-block-end: 1rem;
		font-size: 0.9rem;
		color: var(--pico-muted-color);
		text-decoration: none;
		min-height: 44px;
	}

	.season-banner {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.6rem 1rem;
		border-radius: var(--pico-border-radius);
		border: 1px solid var(--pico-primary);
		background: color-mix(in srgb, var(--pico-primary) 10%, transparent);
		margin-block-end: 1.5rem;
		font-size: 0.9rem;
	}

	.muted {
		color: var(--pico-muted-color);
	}
</style>
