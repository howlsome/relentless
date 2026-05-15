<script lang="ts">
	import type { ComplianceFile } from '$lib/types/compliance.js';
	import type { Roster } from '$lib/types/roster.js';
	import type { SeasonsIndex } from '$lib/types/seasons.js';
	import type { MplusRaiderEntry, MplusWeeklyFile } from '$lib/types/weekly.js';
	import { fmtKey, fmtWeekLabel, getSeasonWeek, getWowClassColor } from '$lib/utils/format.js';
	import { getKeyLevelStyle } from '$lib/utils/parse-colours.js';
	import RioScoreBadge from './RioScoreBadge.svelte';
	import RoleIcon from './RoleIcon.svelte';
	import TeamDesignationBadge from './TeamDesignationBadge.svelte';

	let {
		roster,
		seasonsIndex,
		snapshot = null,
		compliance = null,
	}: {
		roster: Roster;
		seasonsIndex: SeasonsIndex;
		snapshot?: MplusWeeklyFile | null;
		compliance?: ComplianceFile | null;
	} = $props();

	function getRecordWeek(raiderId: string): number | null {
		const weeks = compliance?.raiders?.[raiderId]?.weeks ?? [];
		if (!weeks.length) return null;
		return Math.max(...weeks.map((w) => w.total_dungeons ?? 0));
	}

	const activeSeason = $derived(
		seasonsIndex.all_mplus_seasons.find((s) => s.season_id === seasonsIndex.active_mplus_season),
	);
	const seasonWeek = $derived(
		snapshot ? getSeasonWeek(snapshot.week, activeSeason?.start_date) : null,
	);
	const weekLabel = $derived(
		seasonWeek != null ? `Week ${seasonWeek}` : snapshot ? fmtWeekLabel(snapshot.week) : 'Current',
	);

	const raiderEntries = $derived((): (MplusRaiderEntry & { _trackingStart?: string })[] => {
		if (!snapshot) return [];
		return snapshot.raiders
			.filter((r) => {
				const player = roster.players.find((p) => p.raider_id === r.raider_id);
				return player?.status === 'active';
			})
			.sort((a, b) => {
				const nameA =
					roster.players.find((p) => p.raider_id === a.raider_id)?.display_name ?? a.display_name;
				const nameB =
					roster.players.find((p) => p.raider_id === b.raider_id)?.display_name ?? b.display_name;
				return nameA.localeCompare(nameB);
			});
	});

	const inactivePlayers = $derived(roster.players.filter((p) => p.status !== 'active'));
</script>

<section class="mplus-section" aria-label="Mythic+ weekly status">
	<h2>Mythic+ — {weekLabel}</h2>

	{#if !snapshot}
		<p class="muted">M+ data will appear here after the first cron run.</p>
	{:else}
		<div class="parse-table-wrapper">
			<table class="mplus-table" aria-label="M+ weekly status per raider">
				<thead>
					<tr>
						<th scope="col" class="raider-col">Raider</th>
						<th scope="col">RIO</th>
						<th scope="col">4× +10 or higher</th>
						<th scope="col">Highest key</th>
						<th scope="col">Record week</th>
					</tr>
				</thead>
				<tbody>
					{#each raiderEntries() as raider}
						{@const player = roster.players.find((p) => p.raider_id === raider.raider_id)}
						{@const keyCount = raider.mplus_weekly_count_at_or_above_minimum}
						{@const countBg = keyCount >= 4 ? '#14ac00' : keyCount === 3 ? '#ff8000' : '#c41e3a'}
						{@const countFg = keyCount < 3 ? '#ffffff' : '#000000'}
						{@const ks = getKeyLevelStyle(raider.mplus_highest_key_this_week)}
						{@const record = getRecordWeek(raider.raider_id)}
						{@const recBg =
							record != null ? (record >= 4 ? '#14ac00' : record === 3 ? '#ff8000' : '#c41e3a') : null}
						{@const recFg = record != null ? (record < 3 ? '#ffffff' : '#000000') : null}
						<tr>
							<td data-label="Raider" class="raider-col">
								<div class="raider-cell">
									<RoleIcon role={raider.role} spec={raider.spec} charClass={raider.class} />
									<div>
										<a
											href="/raider/{raider.raider_id}"
											class="raider-name"
											style="--class-color:{getWowClassColor(raider.class)}"
										>
											{player?.display_name ?? raider.display_name}
										</a>
										<div class="char-subtitle muted">{raider.active_character}</div>
									</div>
									<span class="badge-right"
										><TeamDesignationBadge designation={raider.team_designation} /></span
									>
								</div>
							</td>
							<td data-label="RIO"><RioScoreBadge score={raider.rio_score} /></td>
							<td data-label="4× +10 or higher">
								<span class="count-badge" style="background:{countBg};color:{countFg}">{keyCount}</span>
							</td>
							<td data-label="Highest key">
								<span class="count-badge" style="background:{ks.bgHex};color:{ks.textHex}"
									>{fmtKey(raider.mplus_highest_key_this_week)}</span
								>
							</td>
							<td data-label="Record week">
								{#if record != null && recBg && recFg}
									<span class="count-badge" style="background:{recBg};color:{recFg}">{record}</span>
								{:else}
									<span class="muted">—</span>
								{/if}
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="5" class="muted">No raiders match the current filters.</td>
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

	.raider-col {
		width: 300px;
		max-width: 300px;
		overflow: hidden;
		border-right: 1px solid var(--pico-muted-border-color);
	}

	.raider-cell {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		white-space: nowrap;
	}

	@media (max-width: 639px) {
		.raider-col {
			width: auto;
			max-width: 100%;
			border-right: none;
		}

		.raider-cell {
			white-space: normal;
			flex-wrap: wrap;
		}
	}

	.badge-right {
		margin-inline-start: auto;
		padding-inline-end: 0.5rem;
	}

	.raider-name {
		font-weight: 700;
	}

	.char-subtitle {
		font-size: 0.8rem;
	}

	.count-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.2em 0.55em;
		border-radius: 0.3em;
		font-weight: 700;
		font-size: 1rem;
		min-width: 2rem;
		line-height: 1.2;
	}

	.status-badge--inactive {
		display: inline-block;
		padding: 0.2em 0.6em;
		border-radius: 999px;
		font-size: 0.8rem;
		font-weight: 700;
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
