<script lang="ts">
	import type { Roster } from '$lib/types/roster.js';
	import type { SeasonsIndex } from '$lib/types/seasons.js';
	import type { MplusWeeklyFile, RaidWeeklyFile } from '$lib/types/weekly.js';
	import type { ComplianceFile } from '$lib/types/compliance.js';
	import MplusStatus from '$lib/components/MplusStatus.svelte';
	import RosterTable from '$lib/components/RosterTable.svelte';

	let {
		data
	}: {
		data: {
			roster: Roster;
			seasonsIndex: SeasonsIndex;
			mplusSnapshot: MplusWeeklyFile | null;
			mplusCompliance: ComplianceFile | null;
			raidZones: Array<{ meta: object; snapshot: RaidWeeklyFile | null; season_id: string; label: string }>;
		};
	} = $props();

	const { roster, seasonsIndex, mplusSnapshot, raidZones } = $derived(data);
	const firstRaidZone = $derived(raidZones[0] ?? null);

	// Summary stats
	const activePlayers = $derived(roster.players.filter((p) => p.status === 'active'));
	const onTrackCount = $derived(
		mplusSnapshot
			? mplusSnapshot.raiders.filter((r) => r.mplus_requirement_met).length
			: 0
	);
	const topRio = $derived(
		mplusSnapshot
			? mplusSnapshot.raiders.reduce(
					(best, r) => (r.rio_score ?? 0) > (best?.rio_score ?? 0) ? r : best,
					mplusSnapshot.raiders[0]
				)
			: null
	);
	const topResilience = $derived(
		mplusSnapshot
			? mplusSnapshot.raiders.reduce(
					(best, r) =>
						(r.resilience_level ?? -1) > (best?.resilience_level ?? -1) ? r : best,
					null as (typeof mplusSnapshot.raiders)[0] | null
				)
			: null
	);
</script>

<svelte:head>
	<title>Dashboard — Undaunted: Relentless</title>
</svelte:head>

<h1>Dashboard</h1>

<!-- Summary stat row -->
{#if mplusSnapshot}
	<div class="summary-row" role="list" aria-label="Team summary statistics">
		<div class="stat-card {onTrackCount === activePlayers.length ? 'stat-card--good' : 'stat-card--warn'}" role="listitem">
			<div class="stat-card__label">On track this week</div>
			<div class="stat-card__value">{onTrackCount} / {activePlayers.length}</div>
		</div>
		<div class="stat-card" role="listitem">
			<div class="stat-card__label">Top RIO this week</div>
			<div class="stat-card__value">{topRio?.rio_score?.toLocaleString() ?? '—'}</div>
			{#if topRio}<div class="stat-card__sub">{topRio.display_name}</div>{/if}
		</div>
		<div class="stat-card" role="listitem">
			<div class="stat-card__label">Highest key this week</div>
			<div class="stat-card__value">
				{mplusSnapshot.raiders.reduce((best, r) => Math.max(best, r.mplus_highest_key_this_week ?? 0), 0) || '—'}
			</div>
		</div>
		<div class="stat-card {topResilience?.resilience_level != null ? 'stat-card--gold' : ''}" role="listitem">
			<div class="stat-card__label">Top Resilience</div>
			<div class="stat-card__value">
				{#if topResilience?.resilience_level != null}
					🛡️ {topResilience.resilience_level}
				{:else}
					—
				{/if}
			</div>
			{#if topResilience?.resilience_level != null}
				<div class="stat-card__sub">{topResilience.display_name}</div>
			{/if}
		</div>
	</div>
{/if}

<MplusStatus {roster} {seasonsIndex} snapshot={mplusSnapshot} />

{#if firstRaidZone?.snapshot}
	<RosterTable {roster} raidSnapshot={firstRaidZone.snapshot} />
{:else}
	<section>
		<h2>Raid Parses</h2>
		<p class="muted">Raid data will appear here after the first cron run.</p>
	</section>
{/if}

<style>
	.summary-row {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.75rem;
		margin-block-end: 1.5rem;
	}

	@media (max-width: 639px) {
		.summary-row {
			grid-template-columns: 1fr 1fr;
		}
	}

	.stat-card {
		padding: 0.75rem 1rem;
		border-radius: var(--pico-border-radius);
		border: 1px solid var(--pico-muted-border-color);
		background: var(--pico-card-background-color);
	}

	.stat-card--good {
		border-color: color-mix(in srgb, #14ac00 40%, transparent);
		background: color-mix(in srgb, #14ac00 8%, var(--pico-card-background-color));
	}

	.stat-card--warn {
		border-color: color-mix(in srgb, orange 40%, transparent);
		background: color-mix(in srgb, orange 8%, var(--pico-card-background-color));
	}

	.stat-card--gold {
		border-color: color-mix(in srgb, #e5cc80 50%, transparent);
		background: color-mix(in srgb, #e5cc80 12%, var(--pico-card-background-color));
	}

	.stat-card__label {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--pico-muted-color);
		font-weight: 600;
		margin-block-end: 0.25rem;
	}

	.stat-card__value {
		font-size: 1.5rem;
		font-weight: 800;
		line-height: 1.1;
	}

	.stat-card__sub {
		font-size: 0.8rem;
		color: var(--pico-muted-color);
		margin-top: 0.15rem;
	}

	.muted {
		color: var(--pico-muted-color);
	}
</style>
