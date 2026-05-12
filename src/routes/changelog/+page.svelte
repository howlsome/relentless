<script lang="ts">
	import type { ChangelogFile, ChangelogEntry } from '$lib/types/changelog.js';
	import type { SeasonsIndex } from '$lib/types/seasons.js';
	import ChangelogEntryComp from '$lib/components/ChangelogEntry.svelte';
	import ChangelogFilter from '$lib/components/ChangelogFilter.svelte';
	import { fmtWeekLabel } from '$lib/utils/format.js';

	let {
		data
	}: {
		data: { changelog: ChangelogFile; seasonsIndex: SeasonsIndex };
	} = $props();

	// Filter state — bound to ChangelogFilter
	let teamFilter = $state('all');
	let eventTypeFilter = $state('all');
	let seasonFilter = $state('all');

	const seasonsIndex = $derived(data.seasonsIndex);

	// Season date ranges for the date filter
	const seasonRanges = $derived(
		new Map(
			seasonsIndex.all_mplus_seasons.map((s) => [
				s.season_id,
				{ start: s.start_date, end: s.end_date ?? null }
			])
		)
	);

	function entryInSeason(entry: ChangelogEntry, seasonId: string): boolean {
		const range = seasonRanges.get(seasonId);
		if (!range) return true;
		const ts = entry.timestamp.slice(0, 10);
		if (ts < range.start) return false;
		if (range.end && ts > range.end) return false;
		return true;
	}

	const filteredEntries = $derived((): ChangelogEntry[] => {
		return (data.changelog.entries ?? []).filter((e) => {
			if (teamFilter !== 'all' && e.team !== teamFilter) return false;
			if (eventTypeFilter !== 'all' && e.event !== eventTypeFilter) return false;
			if (seasonFilter !== 'all' && !entryInSeason(e, seasonFilter)) return false;
			return true;
		});
	});

	// Group by ISO week, newest first
	const grouped = $derived((): Map<string, ChangelogEntry[]> => {
		const map = new Map<string, ChangelogEntry[]>();
		for (const entry of filteredEntries()) {
			const week = entry.week;
			if (!map.has(week)) map.set(week, []);
			map.get(week)!.push(entry);
		}
		// Sort by week descending
		return new Map([...map.entries()].sort((a, b) => b[0].localeCompare(a[0])));
	});
</script>

<svelte:head>
	<title>Changelog — Undaunted: Relentless</title>
</svelte:head>

<h1>Team Changelog</h1>

<ChangelogFilter
	bind:team={teamFilter}
	bind:eventType={eventTypeFilter}
	bind:seasonId={seasonFilter}
	{seasonsIndex}
/>

{#if filteredEntries().length === 0}
	<p class="empty-state">No changes found for the selected filters.</p>
{:else}
	{#each grouped() as [week, entries]}
		<section class="week-group" aria-label="Events in {fmtWeekLabel(week)}">
			<h2 class="week-heading sticky-heading">{fmtWeekLabel(week)}</h2>
			<div role="list" aria-label="Changelog entries for {fmtWeekLabel(week)}">
				{#each entries as entry (entry.id)}
					<ChangelogEntryComp {entry} />
				{/each}
			</div>
		</section>
	{/each}
{/if}

<style>
	.empty-state {
		padding: 2rem;
		text-align: center;
		color: var(--pico-muted-color);
		border: 1px dashed var(--pico-muted-border-color);
		border-radius: var(--pico-border-radius);
	}

	.week-group {
		margin-block-end: 1.5rem;
	}

	.week-heading {
		font-size: 1rem;
		font-weight: 700;
		padding-block: 0.4rem;
		border-bottom: 2px solid var(--pico-muted-border-color);
		margin-block-end: 0.5rem;
		background: var(--pico-background-color);
	}

	.sticky-heading {
		position: sticky;
		top: 60px;
		z-index: 10;
	}
</style>
