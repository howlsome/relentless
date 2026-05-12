<script lang="ts">
	import type { Roster } from '$lib/types/roster.js';
	import type { SeasonsIndex } from '$lib/types/seasons.js';
	import type { MplusWeeklyFile, MplusRaiderEntry } from '$lib/types/weekly.js';
	import RoleIcon from './RoleIcon.svelte';
	import TeamDesignationBadge from './TeamDesignationBadge.svelte';
	import { fmtKey, fmtWeekLabel } from '$lib/utils/format.js';

	let {
		roster,
		seasonsIndex,
		snapshot = null
	}: {
		roster: Roster;
		seasonsIndex: SeasonsIndex;
		snapshot?: MplusWeeklyFile | null;
	} = $props();

	const activeSeason = $derived(
		seasonsIndex.all_mplus_seasons.find((s) => s.season_id === seasonsIndex.active_mplus_season)
	);
	const weekLabel = $derived(snapshot ? fmtWeekLabel(snapshot.week) : 'Current');

	// Filters — client-side
	let designation = $state<'all' | 'main' | 'alt'>('all');
	let roleFilter = $state<'all' | 'tank' | 'healer' | 'dps'>('all');

	const raiderEntries = $derived((): (MplusRaiderEntry & { _trackingStart?: string })[] => {
		if (!snapshot) return [];
		return snapshot.raiders.filter((r) => {
			const player = roster.players.find((p) => p.raider_id === r.raider_id);
			if (!player || player.status !== 'active') return false;
			if (designation !== 'all' && r.team_designation !== designation) return false;
			if (roleFilter !== 'all' && r.role !== roleFilter) return false;
			return true;
		}).sort((a, b) => (b.rio_score ?? 0) - (a.rio_score ?? 0));
	});

	const inactivePlayers = $derived(roster.players.filter((p) => p.status !== 'active'));
</script>

<section class="mplus-section" aria-label="Mythic+ weekly status">
	<h2>Mythic+ — {weekLabel}</h2>

	<!-- Filters -->
	<div class="mplus-filters" role="group" aria-label="Roster filters">
		<div class="btn-group" role="group" aria-label="Filter by designation">
			{#each ['all', 'main', 'alt'] as opt}
				<button
					type="button"
					class="filter-btn {designation === opt ? 'filter-btn--active' : ''}"
					onclick={() => (designation = opt as typeof designation)}
					aria-pressed={designation === opt}
				>
					{opt === 'all' ? 'All' : opt.charAt(0).toUpperCase() + opt.slice(1)}
				</button>
			{/each}
		</div>

		<div class="btn-group" role="group" aria-label="Filter by role">
			{#each [['all', 'All'], ['tank', 'Tank'], ['healer', 'Healer'], ['dps', 'DPS']] as [val, label]}
				<button
					type="button"
					class="filter-btn {roleFilter === val ? 'filter-btn--active' : ''}"
					onclick={() => (roleFilter = val as typeof roleFilter)}
					aria-pressed={roleFilter === val}
				>
					{label}
				</button>
			{/each}
		</div>
	</div>

	{#if !snapshot}
		<p class="muted">M+ data will appear here after the first cron run.</p>
	{:else}
		<div class="parse-table-wrapper">
			<table class="mplus-table" aria-label="M+ weekly status per raider">
				<thead>
					<tr>
						<th scope="col">Raider</th>
						<th scope="col">Class / Spec</th>
						<th scope="col">RIO</th>
						<th scope="col">Keys ≥ 10</th>
						<th scope="col">Total runs</th>
						<th scope="col">Highest key</th>
						<th scope="col">Resilience</th>
						<th scope="col">Status</th>
					</tr>
				</thead>
				<tbody>
					{#each raiderEntries() as raider}
						{@const met = raider.mplus_requirement_met}
						<tr>
							<td data-label="Raider">
								<div class="raider-cell">
									<RoleIcon role={raider.role} />
									<div>
										<a href="/raider/{raider.raider_id}" class="raider-name">
											{raider.display_name}
										</a>
										<TeamDesignationBadge designation={raider.team_designation} />
										<div class="char-subtitle muted">{raider.active_character} — {raider.spec}</div>
									</div>
								</div>
							</td>
							<td data-label="Class/Spec">{raider.class} {raider.spec}</td>
							<td data-label="RIO">{raider.rio_score?.toLocaleString() ?? '—'}</td>
							<td data-label="Keys ≥ 10">{raider.mplus_weekly_count_at_or_above_minimum}</td>
							<td data-label="Total runs">{raider.mplus_total_dungeons_this_week}</td>
							<td data-label="Highest key">{fmtKey(raider.mplus_highest_key_this_week)}</td>
							<td data-label="Resilience">
								{raider.resilience_level != null ? `🛡️ ${raider.resilience_level}` : '—'}
							</td>
							<td data-label="Status">
								{#if met}
									<span class="status-badge status-badge--met" aria-label="On track">On track</span>
								{:else}
									<span class="status-badge status-badge--missed" aria-label="Below target">Below target</span>
								{/if}
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="8" class="muted">No raiders match the current filters.</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	<!-- Inactive section -->
	{#if inactivePlayers.length > 0}
		<details class="inactive-section">
			<summary class="inactive-toggle">
				Show {inactivePlayers.length} inactive raider{inactivePlayers.length > 1 ? 's' : ''}
			</summary>
			<ul class="inactive-list">
				{#each inactivePlayers as player}
					{@const char = player.characters.find((c) => c.active) ?? player.characters[0]}
					<li class="inactive-item">
						<a href="/raider/{player.raider_id}">{player.display_name}</a>
						{#if char}
							<span class="muted">— {char.class} {char.spec}</span>
						{/if}
						<span class="status-badge status-badge--inactive" aria-label="Inactive">Inactive</span>
					</li>
				{/each}
			</ul>
		</details>
	{/if}
</section>

<style>
	.mplus-section {
		margin-block-end: 2rem;
	}

	.mplus-filters {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-block-end: 1rem;
	}

	.btn-group {
		display: flex;
		border-radius: var(--pico-border-radius);
		overflow: hidden;
		border: 1px solid var(--pico-muted-border-color);
	}

	.filter-btn {
		background: none;
		border: none;
		border-radius: 0;
		padding: 0.4rem 0.8rem;
		min-height: 44px;
		cursor: pointer;
		font-size: 0.85rem;
		color: var(--pico-color);
		border-right: 1px solid var(--pico-muted-border-color);
	}

	.filter-btn:last-child {
		border-right: none;
	}

	.filter-btn--active {
		background: var(--pico-primary);
		color: var(--pico-primary-inverse);
		font-weight: 700;
	}

	.filter-btn:hover:not(.filter-btn--active) {
		background: var(--pico-secondary-hover-background);
	}

	.raider-cell {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.raider-name {
		font-weight: 700;
	}

	.char-subtitle {
		font-size: 0.8rem;
	}

	.status-badge {
		display: inline-block;
		padding: 0.2em 0.6em;
		border-radius: 999px;
		font-size: 0.8rem;
		font-weight: 700;
	}

	.status-badge--met {
		background: color-mix(in srgb, #14ac00 20%, transparent);
		color: color-mix(in srgb, #14ac00 80%, var(--pico-color));
	}

	.status-badge--missed {
		background: color-mix(in srgb, red 20%, transparent);
		color: color-mix(in srgb, red 70%, var(--pico-color));
	}

	.status-badge--inactive {
		background: var(--pico-muted-border-color);
		color: var(--pico-muted-color);
	}

	.inactive-section {
		margin-top: 1rem;
	}

	.inactive-toggle {
		cursor: pointer;
		font-size: 0.9rem;
		color: var(--pico-muted-color);
		min-height: 44px;
		display: flex;
		align-items: center;
		list-style: none;
	}

	.inactive-toggle::-webkit-details-marker {
		display: none;
	}

	.inactive-list {
		list-style: none;
		padding: 0.5rem 0 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.inactive-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.muted {
		color: var(--pico-muted-color);
	}
</style>
