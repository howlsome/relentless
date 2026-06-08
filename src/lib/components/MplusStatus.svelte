<script lang="ts">
	import type { Roster } from '$lib/types/roster.js';
	import type { SeasonsIndex } from '$lib/types/seasons.js';
	import type { MplusRaiderEntry, MplusWeeklyFile } from '$lib/types/weekly.js';
	import { fmtKey, fmtWeekLabel, getSeasonWeek, getWowClassColor } from '$lib/utils/format.js';
	import { getKeyLevelStyle, getRioScoreStyle } from '$lib/utils/parse-colours.js';
	import RoleIcon from './RoleIcon.svelte';
	import TeamDesignationBadge from './TeamDesignationBadge.svelte';

	let {
		roster,
		seasonsIndex,
		snapshot = null,
	}: {
		roster: Roster;
		seasonsIndex: SeasonsIndex;
		snapshot?: MplusWeeklyFile | null;
	} = $props();

	function reqStatus(
		keyCount: number,
		minimum: number,
	): { emoji: string; label: string; key: 'met' | 'partial' | 'unmet' } {
		if (keyCount >= minimum) return { emoji: '👍', label: 'Requirement met', key: 'met' };
		if (keyCount >= Math.ceil(minimum / 2))
			return { emoji: '🫤', label: 'Halfway there', key: 'partial' };
		return { emoji: '👎', label: 'Requirement not met', key: 'unmet' };
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
		<div class="mplus-body">
			<div class="parse-table-wrapper">
				<table class="mplus-table" aria-label="M+ weekly status per raider">
					<thead>
						<tr>
							<th scope="col" class="raider-col">Raider</th>
							<th scope="col" class="status-col">4× +10 or higher</th>
							<th scope="col" class="centered-col">Highest key</th>
							<th scope="col" class="centered-col">RIO</th>
						</tr>
					</thead>
					<tbody>
						{#each raiderEntries() as raider}
							{@const player = roster.players.find((p) => p.raider_id === raider.raider_id)}
							{@const keyCount = raider.mplus_weekly_count_at_or_above_minimum}
							{@const minimum = roster.mplus_weekly_minimum ?? 4}
							{@const ks = getKeyLevelStyle(raider.mplus_highest_key_this_week)}
							{@const status = reqStatus(keyCount, minimum)}
							{@const rioStyle = getRioScoreStyle(raider.rio_score)}
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
								<td
									data-label="4× +10 or higher"
									class="status-col status-{status.key}"
									aria-label={status.label}
									title={status.label}
								>
									<span class="cell-emoji">{status.emoji}</span>
								</td>
								<td
									data-label="Highest key"
									class="centered-col"
									style="background:{ks.bgHex};color:{ks.textHex}"
								>
									{fmtKey(raider.mplus_highest_key_this_week)}
								</td>
								<td
									data-label="RIO"
									class="centered-col"
									style={raider.rio_score != null
										? `background:${rioStyle.bgHex};color:${rioStyle.textHex}`
										: ''}
									aria-label="Raider.io score: {raider.rio_score ?? 'unavailable'}"
									title={raider.rio_score != null
										? `Raider.io score — ${rioStyle.label}`
										: 'Raider.io score unavailable'}
								>
									{#if raider.rio_score != null}
										{raider.rio_score.toLocaleString()}
									{:else}
										<span class="cell-empty">—</span>
									{/if}
								</td>
							</tr>
						{:else}
							<tr>
								<td colspan="4" class="muted">No raiders match the current filters.</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<aside class="mplus-info">
				<p class="mplus-info__title">Weekly requirement</p>
				<p>
					As a <strong>Relentless Raider</strong> you are expected to complete at least
					<strong>4 Mythic+ keys at +10 or higher</strong> each week.
				</p>
				<p class="mplus-info__reason">
					This unlocks your full vault options and keeps the team competitive heading into progression
					night.
				</p>
			</aside>
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

	.mplus-body {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1rem;
		align-items: start;
	}

	@media (min-width: 1024px) {
		.mplus-body {
			grid-template-columns: max-content 16rem;
		}
	}

	.parse-table-wrapper {
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		min-width: 0;
	}

	.mplus-info {
		width: 16rem;
		padding: 0.75rem 1rem;
		border: 1px solid var(--pico-muted-border-color);
		border-radius: var(--pico-border-radius);
		background: var(--pico-card-background-color);
		font-size: 0.875rem;
		line-height: 1.5;
	}

	.mplus-info__title {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-weight: 700;
		color: var(--pico-muted-color);
		margin-block-end: 0.5rem;
	}

	.mplus-info p {
		margin-block-end: 0.5rem;
	}

	.mplus-info p:last-child {
		margin-block-end: 0;
	}

	.mplus-info__reason {
		color: var(--pico-muted-color);
		font-size: 0.8rem;
	}

	.mplus-table {
		width: auto;
		border-collapse: collapse;
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

	.status-col,
	.centered-col {
		text-align: center;
		width: 8rem;
		min-width: 8rem;
		white-space: nowrap;
		font-weight: 700;
	}

	.status-met {
		background: color-mix(in srgb, #14ac00 30%, var(--pico-card-background-color));
		color: color-mix(in srgb, #14ac00 60%, var(--pico-color));
	}

	.status-partial {
		background: color-mix(in srgb, #ff8000 30%, var(--pico-card-background-color));
		color: color-mix(in srgb, #ff8000 70%, var(--pico-color));
	}

	.status-unmet {
		background: color-mix(in srgb, #c41e3a 30%, var(--pico-card-background-color));
		color: color-mix(in srgb, #c41e3a 60%, var(--pico-color));
	}

	.cell-emoji {
		font-size: 1.25rem;
		line-height: 1;
	}

	.cell-empty {
		opacity: 0.5;
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
