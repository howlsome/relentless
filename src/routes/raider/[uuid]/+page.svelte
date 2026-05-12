<script lang="ts">
	import { onMount } from 'svelte';
	import type { Player } from '$lib/types/roster.js';
	import type { RaiderCompliance } from '$lib/types/compliance.js';
	import type { MplusRaiderEntry } from '$lib/types/weekly.js';
	import RoleIcon from '$lib/components/RoleIcon.svelte';
	import TeamDesignationBadge from '$lib/components/TeamDesignationBadge.svelte';
	import RioScoreBadge from '$lib/components/RioScoreBadge.svelte';
	import MembershipStatus from '$lib/components/MembershipStatus.svelte';
	import StreakHero from '$lib/components/StreakHero.svelte';
	import DungeonVolume from '$lib/components/DungeonVolume.svelte';
	import ComplianceHistory from '$lib/components/ComplianceHistory.svelte';
	import MilestoneBanner from '$lib/components/MilestoneBanner.svelte';
	import CharacterParseSection from '$lib/components/CharacterParseSection.svelte';
	import ResiliencePanel from '$lib/components/ResiliencePanel.svelte';
	import RaiderTimeline from '$lib/components/RaiderTimeline.svelte';
	import { computeMplusMilestones } from '$lib/utils/milestones.js';
	import { fmtKey, fmtDate } from '$lib/utils/format.js';

	let {
		data
	}: {
		data: {
			raider: Player | null;
			raiderCompliance: RaiderCompliance | null;
			mplusSnapshot: MplusRaiderEntry | null;
			raidSnapshots: Array<{ meta: { name: string; bosses: Array<{id: number; name: string}>; difficulties: Array<{id: number; name: string}> }; raiderData: { raid_parses: import('$lib/types/weekly.js').BossParse[] } | null; season_id: string }>;
			raiderHistory: object | null;
			activeSeason: { dungeons: string[]; dungeon_count: number } | null;
			weeklyMinimum: number;
		};
	} = $props();

	const { raider, raiderCompliance, mplusSnapshot, raidSnapshots, activeSeason, weeklyMinimum } = $derived(data);

	// Difficulty toggle — persisted in localStorage
	let difficulty = $state<'heroic' | 'mythic'>('mythic');

	onMount(() => {
		const stored = localStorage.getItem('raid-difficulty');
		if (stored === 'heroic' || stored === 'mythic') difficulty = stored;
	});

	function setDifficulty(d: 'heroic' | 'mythic') {
		difficulty = d;
		localStorage.setItem('raid-difficulty', d);
	}

	const milestones = $derived(computeMplusMilestones(raiderCompliance));

	const activeChar = $derived(raider?.characters.find((c) => c.active) ?? null);
	const inactiveChars = $derived(raider?.characters.filter((c) => !c.active) ?? []);

	const currentWeekData = $derived(raiderCompliance?.weeks[0] ?? null);
	const isOnTrack = $derived(currentWeekData?.met ?? null);

	const dungeons = $derived(activeSeason?.dungeons ?? []);

	// For raid section: get the first available raid zone's data
	const raidZone = $derived(raidSnapshots[0] ?? null);
	const raiderRaidData = $derived(raidZone?.raiderData ?? null);

	// Date range formatting for inactive chars
	function charDateRange(char: Player['characters'][0]): string {
		const rh = raider?.role_history ?? [];
		const entry = rh.find((r) => r.character === char.name);
		const from = entry?.from ?? null;
		const to = entry?.to ?? null;
		return `${fmtDate(from)} → ${to ? fmtDate(to) : 'present'}`;
	}

	function bestParseForChar(charName: string): string | null {
		if (!raiderRaidData) return null;
		const parses = raiderRaidData.raid_parses
			.flatMap((bp) => {
				const h = bp.difficulties['heroic']?.parse_percentile;
				const m = bp.difficulties['mythic']?.parse_percentile;
				return [h, m].filter((p): p is number => p != null);
			});
		if (!parses.length) return null;
		const best = Math.max(...parses);
		return `Best: ${best.toFixed(0)}%`;
	}
</script>

<svelte:head>
	<title>{raider?.display_name ?? 'Raider'} — Undaunted: Relentless</title>
</svelte:head>

{#if !raider}
	<h1>Raider not found</h1>
	<p><a href="/">← Back to dashboard</a></p>
{:else}
	<a href="/" class="back-link">← Back to dashboard</a>

	<!-- Identity header -->
	<header class="raider-header">
		<div class="raider-header__top">
			<h1 class="raider-header__name">
				{#if activeChar}<RoleIcon role={activeChar.role} />{/if}
				{raider.display_name}
			</h1>
			<TeamDesignationBadge designation={raider.team_designation} />
		</div>

		{#if activeChar}
			<div class="raider-header__subtitle">
				{activeChar.name} — {activeChar.realm} — {activeChar.spec} {activeChar.class}
			</div>
		{/if}

		<div class="raider-header__badges">
			<RioScoreBadge score={mplusSnapshot?.rio_score ?? null} characterName={activeChar?.name ?? ''} />

			{#if isOnTrack === true}
				<span class="status-badge status-badge--met" aria-label="On track this week">On track</span>
			{:else if isOnTrack === false}
				<span class="status-badge status-badge--missed" aria-label="Below target this week">Below target</span>
			{:else}
				<span class="status-badge status-badge--pending" aria-label="No data yet">Not yet tracked</span>
			{/if}

			{#if mplusSnapshot?.resilience_level != null}
				<span class="status-badge status-badge--resilience" aria-label="Resilience level {mplusSnapshot.resilience_level}">
					🛡️ Resilience {mplusSnapshot.resilience_level}
				</span>
			{/if}
		</div>

		<MembershipStatus player={raider} />
	</header>

	<!-- M+ gamification panel -->
	<section class="panel" aria-label="M+ performance">
		<h2>Mythic+ Performance</h2>

		<MilestoneBanner {milestones} />
		<StreakHero compliance={raiderCompliance} {weeklyMinimum} />
		<DungeonVolume compliance={raiderCompliance} />

		<!-- This week's runs -->
		{#if mplusSnapshot?.mplus_runs_this_week?.length}
			<div class="this-week-runs">
				<h3>This week's runs</h3>
				<table aria-label="Runs completed this reset">
					<thead>
						<tr>
							<th scope="col">Dungeon</th>
							<th scope="col">Key level</th>
							<th scope="col">Timed</th>
						</tr>
					</thead>
					<tbody>
						{#each mplusSnapshot.mplus_runs_this_week as run}
							<tr>
								<td>{run.dungeon}</td>
								<td>{fmtKey(run.level)}</td>
								<td>{run.timed ? '✅' : '❌'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		<ComplianceHistory compliance={raiderCompliance} {weeklyMinimum} />
	</section>

	<!-- Raid performance section -->
	{#if raidZone}
		<section class="panel" aria-label="Raid performance — {raidZone.meta.name}">
			<h2>Raid Performance — {raidZone.meta.name}</h2>

			<div class="difficulty-toggle" role="group" aria-label="Select difficulty">
				{#each [['heroic', 'Heroic'], ['mythic', 'Mythic']] as [val, label]}
					<button
						type="button"
						class="filter-btn {difficulty === val ? 'filter-btn--active' : ''}"
						onclick={() => setDifficulty(val as 'heroic' | 'mythic')}
						aria-pressed={difficulty === val}
					>
						{label}
					</button>
				{/each}
			</div>

			<!-- Active character section (expanded) -->
			{#if activeChar && raiderRaidData}
				<CharacterParseSection
					character={{ ...activeChar, first_seen: raider.role_history?.find(r => r.character === activeChar.name)?.from ?? undefined }}
					parses={raiderRaidData.raid_parses}
					{difficulty}
					isActive={true}
				/>
			{:else if activeChar}
				<CharacterParseSection
					character={activeChar}
					parses={[]}
					{difficulty}
					isActive={true}
				/>
			{/if}

			<!-- Inactive character sections (collapsed) -->
			{#each inactiveChars as char}
				<CharacterParseSection
					character={char}
					parses={[]}
					{difficulty}
					isActive={false}
					dateRange={charDateRange(char)}
					bestParseSummary={bestParseForChar(char.name)}
				/>
			{/each}
		</section>
	{/if}

	<!-- Raider history timeline -->
	<RaiderTimeline
		membershipHistory={raider.membership_history}
		roleHistory={raider.role_history}
	/>

	<!-- Resilience panel -->
	<ResiliencePanel
		compliance={raiderCompliance}
		{dungeons}
		progress={mplusSnapshot?.resilience_progress ?? {}}
	/>
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

	.back-link:hover {
		color: var(--pico-primary);
	}

	.raider-header {
		margin-block-end: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.raider-header__top {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.raider-header__name {
		margin: 0;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.raider-header__subtitle {
		color: var(--pico-muted-color);
		font-size: 1rem;
	}

	.raider-header__badges {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.panel {
		margin-block-end: 2rem;
		padding: 1.25rem;
		border: 1px solid var(--pico-muted-border-color);
		border-radius: var(--pico-border-radius);
	}

	.status-badge {
		display: inline-flex;
		align-items: center;
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

	.status-badge--pending {
		background: var(--pico-muted-border-color);
		color: var(--pico-muted-color);
	}

	.status-badge--resilience {
		background: color-mix(in srgb, #e5cc80 20%, transparent);
		border: 1px solid color-mix(in srgb, #e5cc80 50%, transparent);
	}

	.difficulty-toggle {
		display: flex;
		border-radius: var(--pico-border-radius);
		overflow: hidden;
		border: 1px solid var(--pico-muted-border-color);
		width: fit-content;
		margin-block-end: 1rem;
	}

	.filter-btn {
		background: none;
		border: none;
		border-radius: 0;
		padding: 0.4rem 1rem;
		min-height: 44px;
		cursor: pointer;
		font-size: 0.9rem;
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

	.this-week-runs {
		margin-block-end: 1rem;
	}

	.this-week-runs table {
		width: 100%;
		border-collapse: collapse;
	}

	.this-week-runs td,
	.this-week-runs th {
		padding: 0.4rem 0.6rem;
		text-align: left;
		border-bottom: 1px solid var(--pico-muted-border-color);
	}

	.this-week-runs th {
		font-size: 0.75rem;
		text-transform: uppercase;
		color: var(--pico-muted-color);
	}
</style>
