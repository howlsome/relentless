<script lang="ts">
	import type { Roster } from '$lib/types/roster.js';
	import type { RaidWeeklyFile } from '$lib/types/weekly.js';
	import { getWowClassColor } from '$lib/utils/format.js';
	import { getBadgeBgColour, getBadgeTextColour } from '$lib/utils/parse-colours.js';
	import { getPrimarySpec } from '$lib/utils/roster.js';
	import RoleIcon from './RoleIcon.svelte';
	import TeamDesignationBadge from './TeamDesignationBadge.svelte';

	let {
		roster,
		raidSnapshot = null,
		difficulty = $bindable<'heroic' | 'mythic'>('heroic'),
	}: {
		roster: Roster;
		raidSnapshot?: RaidWeeklyFile | null;
		difficulty?: 'heroic' | 'mythic';
	} = $props();

	const activePlayers = $derived(
		roster.players
			.filter((p) => p.status === 'active')
			.sort((a, b) => a.display_name.localeCompare(b.display_name)),
	);

	const bosses = $derived(raidSnapshot?.raid_tier?.bosses ?? []);

	function getRaiderParse(raiderId: string, bossId: number) {
		if (!raidSnapshot) return null;
		const r = raidSnapshot.raiders.find((r) => r.raider_id === raiderId);
		if (!r) return null;
		const bp = r.raid_parses.find((p) => p.boss_id === bossId);
		if (!bp) return null;
		const d = bp.difficulties[difficulty] ?? null;
		if (!d?.kill || (d.kill_category != null && d.kill_category !== 'in_raid')) return null;
		return d;
	}

	function getOffspecParses(raiderId: string, bossId: number) {
		if (!raidSnapshot) return [];
		const r = raidSnapshot.raiders.find((r) => r.raider_id === raiderId);
		if (!r?.offspec_parses) return [];
		const results: Array<{ pct: string; bg: string; fg: string }> = [];
		for (const bossParsesForSpec of Object.values(r.offspec_parses)) {
			const bp = bossParsesForSpec.find((p) => p.boss_id === bossId);
			const d = bp?.difficulties?.[difficulty];
			if (!d?.kill) continue;
			results.push({
				pct: d.parse_percentile?.toFixed(0) ?? '?',
				bg: getBadgeBgColour(d.parse_percentile),
				fg: getBadgeTextColour(d.parse_percentile),
			});
		}
		return results;
	}

	const BOSS_ABBREV: Record<string, string> = {
		'Imperator Averzian': 'Imp A',
		Vorasius: 'Vora',
		'Fallen-King Salhadaar': 'FK Sal',
		'Vaelgor & Ezzorak': 'V&E',
		'Lightblinded Vanguard': 'Vang',
		'Crown of the Cosmos': 'Crown',
		'Chimaerus, the Undreamt God': 'Chim',
		"Belo'ren, Child of Al'ar": 'Belo',
		'Midnight Falls': "L'ura",
	};

	function abbrevBoss(name: string): string {
		if (BOSS_ABBREV[name]) return BOSS_ABBREV[name];
		// Generic fallback: strip ", X" and "& X" suffixes, take first word, max 5 chars
		const stripped = name
			.replace(/,\s.+$/, '')
			.replace(/\s*&\s*.+$/, '')
			.trim();
		const first = stripped.split(' ')[0];
		return first.length <= 5 ? first : first.slice(0, 5);
	}
</script>

{#if raidSnapshot}
	<section class="raid-section" aria-label="Raid parse overview">
		<h2>Raid Parses — {raidSnapshot.raid_tier?.name}</h2>

		<div class="raid-filters">
			<div class="btn-group" role="group" aria-label="Select difficulty">
				{#each [['heroic', 'Heroic'], ['mythic', 'Mythic']] as [val, label]}
					<button
						type="button"
						class="filter-btn {difficulty === val ? 'filter-btn--active' : ''}"
						onclick={() => (difficulty = val as 'heroic' | 'mythic')}
						aria-pressed={difficulty === val}
					>
						{label}
					</button>
				{/each}
			</div>
		</div>

		<div class="parse-table-wrapper">
			<table class="parse-table" aria-label="Raid parse table for {raidSnapshot.raid_tier?.name}">
				<thead>
					<tr>
						<th scope="col" class="raider-col">Raider</th>
						{#each bosses as boss}
							<th scope="col" class="boss-col" title={boss.name}>{abbrevBoss(boss.name)}</th>
						{/each}
						<th scope="col" class="spacer-col" aria-hidden="true"></th>
					</tr>
				</thead>
				<tbody>
					{#each activePlayers as player}
						{@const char = player.characters.find((c) => c.active)}
						<tr>
							<td class="raider-col">
								<div class="raider-cell">
									{#if char}
										<RoleIcon
											role={char.specs?.length ? (getPrimarySpec(char)?.role ?? 'dps') : (char.role ?? 'dps')}
											spec={char.specs?.length ? (getPrimarySpec(char)?.spec ?? char.spec) : char.spec}
											charClass={char.class}
										/>
									{/if}
									<div>
										<a
											href="/raider/{player.raider_id}"
											class="raider-name"
											style="--class-color:{getWowClassColor(char?.class)}">{player.display_name}</a
										>
										{#if char}
											<div class="char-subtitle muted">{char.name}</div>
										{/if}
									</div>
									<span class="badge-right"
										><TeamDesignationBadge designation={player.team_designation} /></span
									>
								</div>
							</td>
							{#each bosses as boss}
								{@const pd = getRaiderParse(player.raider_id, boss.id)}
								{@const bg = pd?.kill ? getBadgeBgColour(pd.parse_percentile) : null}
								{@const fg = pd?.kill ? getBadgeTextColour(pd.parse_percentile) : null}
								{@const offspecs = getOffspecParses(player.raider_id, boss.id)}
								<td
									class="parse-cell"
									style={bg ? `background:${bg};color:${fg}` : ''}
									data-label={boss.name}
								>
									<div class="parse-cell-inner">
										{#if pd?.kill}
											<span class="parse-main">{pd.parse_percentile?.toFixed(0)}</span>
										{:else}
											<span class="muted">—</span>
										{/if}
										{#each offspecs as op}
											<span
												class="parse-offspec"
												style="background:{op.bg};color:{op.fg}"
												title="Offspec parse">Off: {op.pct}</span
											>
										{/each}
									</div>
								</td>
							{/each}
							<td class="spacer-col" aria-hidden="true"></td>
						</tr>
					{:else}
						<tr>
							<td colspan={bosses.length + 2} class="muted">No raiders match current filters.</td>
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

	.raider-col {
		width: 300px;
		max-width: 300px;
		overflow: hidden;
	}

	.raider-cell {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		white-space: nowrap;
	}

	.badge-right {
		margin-inline-start: auto;
		padding-inline-end: 0.5rem;
	}

	.raider-name {
		font-weight: 700;
	}

	.char-subtitle {
		font-size: 0.75rem;
	}

	.boss-col {
		text-align: center;
		cursor: default;
		white-space: nowrap;
		min-width: 64px;
	}

	@media (max-width: 768px) {
		.spacer-col {
			display: none;
		}
	}

	.parse-cell {
		text-align: center;
		padding: 0;
		min-width: 64px;
		vertical-align: middle;
	}

	.parse-cell-inner {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.2rem;
		padding: 0.4rem 0.5rem;
		min-height: 3.25rem;
	}

	.parse-main {
		font-weight: 800;
		font-size: 0.95rem;
		line-height: 1;
	}

	.parse-offspec {
		font-size: 0.62rem;
		font-weight: 700;
		padding: 0.1em 0.45em;
		border-radius: 999px;
		opacity: 0.82;
		white-space: nowrap;
		line-height: 1.4;
	}

	.muted {
		color: var(--pico-muted-color);
	}
</style>
