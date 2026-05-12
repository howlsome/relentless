<script lang="ts">
	import type { Roster } from '$lib/types/roster.js';
	import type { RaidWeeklyFile } from '$lib/types/weekly.js';
	import type { WowClass } from '$lib/types/roster.js';
	import RoleIcon from './RoleIcon.svelte';
	import TeamDesignationBadge from './TeamDesignationBadge.svelte';
	import ParseBadge from './ParseBadge.svelte';
	import { isEpicOrAbove } from '$lib/utils/parse-colours.js';

	let {
		roster,
		raidSnapshot = null
	}: {
		roster: Roster;
		raidSnapshot?: RaidWeeklyFile | null;
	} = $props();

	// Filters
	let designation = $state<'all' | 'main' | 'alt'>('all');
	let roleFilter = $state<'all' | 'tank' | 'healer' | 'dps'>('all');
	let classFilter = $state<'all' | WowClass>('all');
	let difficulty = $state<'heroic' | 'mythic'>('mythic');

	const classes = $derived(
		[...new Set(roster.players.flatMap((p) => p.characters.filter((c) => c.active).map((c) => c.class)))]
			.sort()
	);

	const activePlayers = $derived(
		roster.players
			.filter((p) => p.status === 'active')
			.filter((p) => {
				const char = p.characters.find((c) => c.active);
				if (designation !== 'all' && p.team_designation !== designation) return false;
				if (roleFilter !== 'all' && char?.role !== roleFilter) return false;
				if (classFilter !== 'all' && char?.class !== classFilter) return false;
				return true;
			})
	);

	const bosses = $derived(raidSnapshot?.raid_tier?.bosses ?? []);

	function getRaiderParse(raiderId: string, bossId: number) {
		if (!raidSnapshot) return null;
		const r = raidSnapshot.raiders.find((r) => r.raider_id === raiderId);
		if (!r) return null;
		const bp = r.raid_parses.find((p) => p.boss_id === bossId);
		if (!bp) return null;
		return bp.difficulties[difficulty] ?? null;
	}

	function getPlayerParses(raiderId: string): number[] {
		return bosses
			.map((b) => getRaiderParse(raiderId, b.id)?.parse_percentile ?? null)
			.filter((p): p is number => p != null);
	}

	function hasAnyEpicParse(raiderId: string): boolean {
		if (!raidSnapshot) return false;
		const r = raidSnapshot.raiders.find((r) => r.raider_id === raiderId);
		if (!r) return false;
		return r.raid_parses.some((bp) => {
			const d = bp.difficulties[difficulty];
			return d?.kill && isEpicOrAbove(d.parse_percentile);
		});
	}
</script>

{#if raidSnapshot}
	<section class="raid-section" aria-label="Raid parse overview">
		<h2>Raid Parses — {raidSnapshot.raid_tier?.name}</h2>

		<div class="raid-filters">
			<!-- Designation filter -->
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

			<!-- Difficulty toggle -->
			<div class="btn-group" role="group" aria-label="Select difficulty">
				{#each [['heroic', 'Heroic'], ['mythic', 'Mythic']] as [val, label]}
					<button
						type="button"
						class="filter-btn {difficulty === val ? 'filter-btn--active' : ''}"
						onclick={() => {
							difficulty = val as 'heroic' | 'mythic';
							if (typeof localStorage !== 'undefined') localStorage.setItem('raid-difficulty', val);
						}}
						aria-pressed={difficulty === val}
					>
						{label}
					</button>
				{/each}
			</div>

			<!-- Role filter -->
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

			<!-- Class dropdown -->
			<label>
				<span class="sr-only">Filter by class</span>
				<select
					bind:value={classFilter}
					aria-label="Filter by class"
					class="class-select"
				>
					<option value="all">All classes</option>
					{#each classes as cls}
						<option value={cls}>{cls}</option>
					{/each}
				</select>
			</label>
		</div>

		<div class="parse-table-wrapper">
			<table class="parse-table" aria-label="Raid parse table for {raidSnapshot.raid_tier?.name}">
				<thead>
					<tr>
						<th scope="col">Raider</th>
						{#each bosses as boss}
							<th scope="col">{boss.name}</th>
						{/each}
						<th scope="col">Best parse</th>
						<th scope="col">Avg parse</th>
					</tr>
				</thead>
				<tbody>
					{#each activePlayers as player}
						{@const char = player.characters.find((c) => c.active)}
						{@const hasEpic = hasAnyEpicParse(player.raider_id)}
						<tr class={hasEpic ? 'parse-row--epic' : ''}>
							<td>
								<div class="raider-cell">
									{#if char}<RoleIcon role={char.role} />{/if}
									<div>
										<a href="/raider/{player.raider_id}" class="raider-name">{player.display_name}</a>
										{#if char}<div class="char-subtitle muted">{char.spec}</div>{/if}
									</div>
									<TeamDesignationBadge designation={player.team_designation} />
								</div>
							</td>
							{#each bosses as boss}
								{@const pd = getRaiderParse(player.raider_id, boss.id)}
								<td class="parse-cell" data-label={boss.name}>
									{#if pd?.kill}
										<ParseBadge percentile={pd.parse_percentile} />
									{:else}
										<span class="muted" aria-label="No kill">—</span>
									{/if}
								</td>
							{/each}
							<td data-label="Best parse">
								{#if getPlayerParses(player.raider_id).length > 0}
									<ParseBadge percentile={Math.max(...getPlayerParses(player.raider_id))} />
								{:else}
									<span class="muted">—</span>
								{/if}
							</td>
							<td data-label="Avg parse">
								{#if getPlayerParses(player.raider_id).length > 0}
									{(getPlayerParses(player.raider_id).reduce((a, b) => a + b, 0) / getPlayerParses(player.raider_id).length).toFixed(0)}%
								{:else}
									<span class="muted">—</span>
								{/if}
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan={bosses.length + 3} class="muted">No raiders match current filters.</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
{/if}

<style>
	.raid-section {
		margin-block-end: 2rem;
	}

	.raid-filters {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-block-end: 1rem;
		align-items: center;
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

	.class-select {
		min-height: 44px;
		font-size: 0.85rem;
	}

	.raider-cell {
		display: flex;
		align-items: flex-start;
		gap: 0.4rem;
	}

	.raider-name {
		font-weight: 700;
	}

	.char-subtitle {
		font-size: 0.75rem;
	}

	.parse-cell {
		text-align: center;
		min-width: 60px;
	}

	.muted {
		color: var(--pico-muted-color);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
	}
</style>
