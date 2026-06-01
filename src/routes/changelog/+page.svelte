<script lang="ts">
	import ChangelogEntryComp from '$lib/components/ChangelogEntry.svelte';
	import ChangelogFilter from '$lib/components/ChangelogFilter.svelte';
	import type { ChangelogEntry, ChangelogFile } from '$lib/types/changelog.js';
	import type { SeasonsIndex } from '$lib/types/seasons.js';
	import { fmtDate, fmtWeekLabel } from '$lib/utils/format.js';

	type BlockingPugEntry = Extract<ChangelogEntry, { event: 'blocking_pug' }>;

	let {
		data,
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
				{ start: s.start_date, end: s.end_date ?? null },
			]),
		),
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
	// Within each week, blocking_pug entries are further grouped per raider into one block
	const grouped = $derived(
		(): Map<
			string,
			{ others: ChangelogEntry[]; blockingGroups: Map<string, BlockingPugEntry[]> }
		> => {
			const map = new Map<
				string,
				{ others: ChangelogEntry[]; blockingGroups: Map<string, BlockingPugEntry[]> }
			>();
			for (const entry of filteredEntries()) {
				const week = entry.week;
				if (!map.has(week)) map.set(week, { others: [], blockingGroups: new Map() });
				const bucket = map.get(week)!;
				if (entry.event === 'blocking_pug') {
					const key = entry.raider_id;
					if (!bucket.blockingGroups.has(key)) bucket.blockingGroups.set(key, []);
					bucket.blockingGroups.get(key)?.push(entry as BlockingPugEntry);
				} else {
					bucket.others.push(entry);
				}
			}
			const sorted = new Map([...map.entries()].sort((a, b) => b[0].localeCompare(a[0])));
			for (const bucket of sorted.values()) {
				bucket.others.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
			}
			return sorted;
		},
	);
</script>

<svelte:head>
	<title>Changelog — Undaunted: Relentless</title>
</svelte:head>

<div class="changelog-header">
	<h1 class="changelog-title">Team Changelog</h1>
	<ChangelogFilter
		bind:team={teamFilter}
		bind:eventType={eventTypeFilter}
		bind:seasonId={seasonFilter}
		{seasonsIndex}
	/>
</div>

{#if filteredEntries().length === 0}
	<p class="empty-state">No changes found for the selected filters.</p>
{:else}
	{#each grouped() as [week, { others, blockingGroups }]}
		<section class="week-group" aria-label="Events in {fmtWeekLabel(week)}">
			<h2 class="week-heading sticky-heading">{week.split('-')[0]} — {fmtWeekLabel(week)}</h2>
			<div role="list" aria-label="Changelog entries for {fmtWeekLabel(week)}">
				<!-- Blocking pug groups — one block per raider, matching raider page style -->
				{#each blockingGroups as [, kills]}
					{@const first = kills[0]}
					<div class="blocking-pug-group" role="listitem">
						<span class="bpg__icon" aria-hidden="true">🚨</span>
						<div class="bpg__body">
							<div class="bpg__header">
								<a href="/raider/{first.raider_id}" class="bpg__raider">{first.display_name}</a>
								<span class="muted bpg__char">— {first.character} ({first.class}/{first.spec})</span>
							</div>
							<p class="bpg__title">
								Progression-blocking pug{kills.length > 1 ? 's' : ''} this reset — locked out for the entirety
								of this reset.
							</p>
							<ul class="bpg__list">
								{#each kills as k}
									<li>
										{k.difficulty.charAt(0).toUpperCase() + k.difficulty.slice(1)} — {k.boss_name}{#if k.wcl_report_code}&nbsp;&mdash;
											<a
												href="https://www.warcraftlogs.com/reports/{k.wcl_report_code}#fight={k.wcl_fight_id ??
													'last'}"
												target="_blank"
												rel="noopener noreferrer"
												class="bpg__wcl">Logs</a
											>{/if}
									</li>
								{/each}
							</ul>
							<time class="muted bpg__date" datetime={first.kill_time}>{fmtDate(first.kill_time)}</time>
						</div>
					</div>
				{/each}

				<!-- All other entries -->
				{#each others as entry (entry.id)}
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

	.changelog-header {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-block-end: 1.5rem;
	}

	.changelog-title {
		margin: 0;
	}

	@media (min-width: 640px) {
		.changelog-header {
			flex-direction: row;
			align-items: center;
			justify-content: space-between;
		}
	}

	.week-group {
		margin-block-end: 1.5rem;
	}

	.blocking-pug-group {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		margin-block-end: 0.5rem;
		background: color-mix(in srgb, red 10%, transparent);
		border: 1px solid color-mix(in srgb, red 30%, transparent);
		border-radius: var(--pico-border-radius);
		font-size: 0.9rem;
	}

	.bpg__icon {
		font-size: 1.1rem;
		flex-shrink: 0;
		margin-top: 0.1rem;
	}

	.bpg__body {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
	}

	.bpg__header {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.bpg__raider {
		font-weight: 700;
	}

	.bpg__char {
		font-size: 0.85rem;
	}

	.bpg__title {
		margin: 0.15rem 0 0.25rem;
		font-weight: 600;
		color: color-mix(in srgb, red 70%, var(--pico-color));
	}

	.bpg__list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.bpg__list li {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.3rem;
	}

	.bpg__wcl {
		font-size: 0.8rem;
		font-weight: 600;
		color: color-mix(in srgb, red 70%, var(--pico-color));
	}

	.bpg__date {
		font-size: 0.75rem;
		margin-top: 0.2rem;
	}

	@media (max-width: 639px) {
		.blocking-pug-group {
			padding: 0.65rem 0.75rem;
			gap: 0.5rem;
		}

		.bpg__char {
			display: none;
		}

		.bpg__title {
			font-size: 0.85rem;
		}
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
