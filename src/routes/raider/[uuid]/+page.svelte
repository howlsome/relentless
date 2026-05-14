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
	import RaiderTimeline from '$lib/components/RaiderTimeline.svelte';
	import { computeMplusMilestones } from '$lib/utils/milestones.js';
	import { fmtKey, fmtDate } from '$lib/utils/format.js';
	import type { RaidRaiderEntry } from '$lib/types/weekly.js';
	import { getPrimarySpec } from '$lib/utils/roster.js';

	let {
		data
	}: {
		data: {
			raider: Player | null;
			raiderCompliance: RaiderCompliance | null;
			mplusSnapshot: MplusRaiderEntry | null;
			primaryRaidZone: { meta: { name: string; wcl_zone_id?: number; bosses: Array<{id: number; name: string}>; difficulties: Array<{id: number; name: string}> }; raiderData: RaidRaiderEntry | null; season_id: string } | null;
			raiderHistory: object | null;
			activeSeason: { label: string; start_date?: string; dungeons: string[]; dungeon_count: number } | null;
			weeklyMinimum: number;
			weeklyHistoryByDiff: Record<string, Record<number, (number | null)[]>>;
			wowanalyzerByDiff: Record<string, Record<number, (string | null)[]>>;
		};
	} = $props();

	const { raider, raiderCompliance, mplusSnapshot, primaryRaidZone, activeSeason, weeklyMinimum, weeklyHistoryByDiff, wowanalyzerByDiff } = $derived(data);

	// Difficulty toggle — persisted in localStorage
	let difficulty = $state<'heroic' | 'mythic'>('mythic');

	const weeklyHistory = $derived(weeklyHistoryByDiff?.[difficulty] ?? {});
	const wowanalyzerUrls = $derived(wowanalyzerByDiff?.[difficulty] ?? {});

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

	const raidZone = $derived(primaryRaidZone);
	const raiderRaidData = $derived(raidZone?.raiderData ?? null);
	const lockoutRaider = $derived(raiderRaidData ?? null);

	const wclCharUrl = $derived((() => {
		if (!activeChar || !raidZone) return null;
		const region = 'eu';
		const realm = activeChar.realm.toLowerCase().replace(/\s+/g, '-').replace(/'/g, '');
		const name = activeChar.name.toLowerCase();
		return `https://www.warcraftlogs.com/character/${region}/${realm}/${name}`;
	})());
	const wclZoneId = $derived(raidZone?.meta?.wcl_zone_id ?? null);

	// Date range formatting for inactive chars
	function charDateRange(char: Player['characters'][0]): string {
		const rh = raider?.role_history ?? [];
		const entry = rh.find((r) => r.character === char.name);
		const from = entry?.from ?? null;
		const to = entry?.to ?? null;
		return `${fmtDate(from)} → ${to ? fmtDate(to) : 'present'}`;
	}

	function charStartDate(char: Player['characters'][0]): string {
		const rh = raider?.role_history ?? [];
		const entry = rh.find((r) => r.character === char.name);
		return fmtDate(entry?.from ?? null);
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
				{#if activeChar}<RoleIcon role={activeChar.role ?? 'dps'} spec={activeChar.spec} charClass={activeChar.class} />{/if}
				{raider.display_name}
			</h1>
			<TeamDesignationBadge designation={raider.team_designation} />
		</div>


		<div class="raider-header__badges">
			<MembershipStatus player={raider} />
			<RioScoreBadge score={mplusSnapshot?.rio_score ?? null} characterName={activeChar?.name ?? ''} />

			{#if isOnTrack === true}
				<span class="status-badge status-badge--met" aria-label="M+ requirement met this week">On track</span>
			{:else if isOnTrack === false}
				<span class="status-badge status-badge--behind" aria-label="M+ requirement not yet met — still time this week">Behind this week</span>
			{:else}
				<span class="status-badge status-badge--pending" aria-label="No data yet">Not yet tracked</span>
			{/if}

			{#if lockoutRaider?.lockout_warnings?.length}
				<span class="status-badge status-badge--blocking" aria-label="Progression-blocking pug this week">🚨 Progression-blocking pug</span>
			{/if}
			{#if lockoutRaider?.safe_pug_kills?.length}
				<span class="status-badge status-badge--safe-pug" aria-label="Safe pugs this week">🌱 Progress pugging</span>
			{/if}
		</div>

	</header>

	<!-- Single blocking pug warning block — all blocked bosses this reset listed inside -->
	{#if lockoutRaider?.lockout_warnings?.length}
		<div class="blocking-warn" role="alert" aria-label="Progression-blocking pug warnings">
			<p class="blocking-warn__title">🚨 Progression-blocking pug{lockoutRaider.lockout_warnings.length > 1 ? 's' : ''} this reset — locked out for the entirety of this reset.</p>
			<ul class="blocking-warn__list">
				{#each lockoutRaider.lockout_warnings as w}
					<li>
						{w.difficulty.charAt(0).toUpperCase() + w.difficulty.slice(1)} — {w.boss_name}{#if w.wcl_report_code}&nbsp;&mdash; <a href="https://www.warcraftlogs.com/reports/{w.wcl_report_code}#fight={w.wcl_fight_id ?? 'last'}" target="_blank" rel="noopener noreferrer" class="wcl-link">Logs</a>{/if}
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<!-- Exempt pug notes — informational, blue style -->
	{#if lockoutRaider?.exempt_pug_kills?.length}
		<div class="exempt-notes">
			{#each lockoutRaider.exempt_pug_kills as e}
				<div class="exempt-note">
					<span>ℹ️ Mythic <strong>{e.boss_name}</strong> pugged outside Relentless — exempt by <strong>{e.exemption_granted_by}</strong>{e.exemption_reason ? `: ${e.exemption_reason}` : ''}.</span>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Active character — expanded by default, contains both Raid and M+ -->
	{#if activeChar}
		<details class="char-wrapper" open>
			<summary class="char-wrapper__summary">
				<RoleIcon role={activeChar.role ?? 'dps'} />
				<span class="char-wrapper__name">{activeChar.name}</span>
				<span class="char-wrapper__detail">
					{activeChar.specs?.length ? (getPrimarySpec(activeChar)?.spec ?? activeChar.spec) : activeChar.spec}
					{activeChar.class} · {activeChar.realm}
				</span>
				<span class="char-wrapper__date">Since {charStartDate(activeChar)}</span>
			</summary>

			{#if raidZone}
				<details class="zone-wrapper" open>
					<summary class="zone-wrapper__summary">Raid — {raidZone.meta.name}</summary>
					<section class="panel zone-panel" aria-label="Raid — {raidZone.meta.name}">
						<div class="difficulty-toggle" role="group" aria-label="Select difficulty">
							{#each [['heroic', 'Heroic'], ['mythic', 'Mythic']] as [val, label]}
								<button
									type="button"
									class="filter-btn {difficulty === val ? 'filter-btn--active' : ''}"
									onclick={() => setDifficulty(val as 'heroic' | 'mythic')}
									aria-pressed={difficulty === val}
								>{label}</button>
							{/each}
						</div>
						<CharacterParseSection
							character={{ ...activeChar, first_seen: raider.role_history?.find(r => r.character === activeChar.name)?.from ?? undefined }}
							parses={raiderRaidData?.raid_parses ?? []}
							{difficulty}
							isActive={true}
							bare={true}
							{wclCharUrl}
							{wclZoneId}
							{weeklyHistory}
							{wowanalyzerUrls}
						/>
					</section>
				</details>
			{/if}

			<details class="zone-wrapper" open>
				<summary class="zone-wrapper__summary">Mythic+ — {activeSeason?.label ?? 'Current Season'}</summary>
				<section class="panel zone-panel" aria-label="Mythic+">
					<MilestoneBanner {milestones} />
					<StreakHero compliance={raiderCompliance} {weeklyMinimum} />
					<DungeonVolume compliance={raiderCompliance} />
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
					<ComplianceHistory compliance={raiderCompliance} {weeklyMinimum} seasonStartDate={activeSeason?.start_date ?? null} />
				</section>
			</details>
		</details>
	{/if}

	<!-- Inactive characters — collapsed, raid history only -->
	{#each inactiveChars as char}
		<details class="char-wrapper">
			<summary class="char-wrapper__summary">
				<RoleIcon role={char.role ?? 'dps'} spec={char.spec} charClass={char.class} />
				<span class="char-wrapper__name">{char.name}</span>
				<span class="char-wrapper__detail">
					{char.spec} {char.class} · {char.realm}
				</span>
				<span class="char-wrapper__date">{charDateRange(char)}</span>
			</summary>
			<section class="panel">
				<CharacterParseSection
					character={char}
					parses={[]}
					{difficulty}
					isActive={false}
					dateRange={charDateRange(char)}
					bestParseSummary={bestParseForChar(char.name)}
				/>
			</section>
		</details>
	{/each}

	<!-- Raider history timeline -->
	<RaiderTimeline
		membershipHistory={raider.membership_history}
		roleHistory={raider.role_history}
	/>

{/if}

<style>
	.char-wrapper {
		border: 1px solid var(--pico-muted-border-color);
		border-radius: var(--pico-border-radius);
		margin-block-end: 1rem;
	}

	.char-wrapper__summary {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		cursor: pointer;
		list-style: none;
		min-height: 48px;
		background: var(--pico-card-sectioning-background-color);
		border-radius: var(--pico-border-radius);
		font-weight: 600;
	}

	.char-wrapper__summary::-webkit-details-marker { display: none; }

	.char-wrapper__summary::before {
		content: '＋';
		font-size: 1.1rem;
		font-weight: 900;
		color: var(--pico-muted-color);
		flex-shrink: 0;
	}

	details[open] .char-wrapper__summary::before { content: '－'; }

	details[open] .char-wrapper__summary {
		border-radius: var(--pico-border-radius) var(--pico-border-radius) 0 0;
	}

	.char-wrapper__name {
		font-size: 1rem;
	}

	.char-wrapper__detail {
		font-size: 0.85rem;
		color: var(--pico-muted-color);
		font-weight: 400;
	}

	.char-wrapper__date {
		margin-inline-start: auto;
		font-size: 0.75rem;
		color: var(--pico-muted-color);
		font-weight: 400;
		white-space: nowrap;
	}

	.char-wrapper > .panel,
	.char-wrapper > .zone-wrapper {
		margin-block-end: 0;
		border: none;
		border-radius: 0;
		border-top: 1px solid var(--pico-muted-border-color);
	}

	.char-wrapper > .zone-wrapper:last-child,
	.char-wrapper > .panel:last-child {
		border-radius: 0 0 var(--pico-border-radius) var(--pico-border-radius);
	}

	.zone-wrapper__summary {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.6rem 1rem;
		cursor: pointer;
		list-style: none;
		min-height: 40px;
		font-size: 0.9rem;
		font-weight: 600;
		background: var(--pico-card-sectioning-background-color);
	}

	.zone-wrapper__summary::-webkit-details-marker { display: none; }

	.zone-wrapper__summary::before {
		content: '＋';
		font-size: 1rem;
		font-weight: 900;
		color: var(--pico-muted-color);
		flex-shrink: 0;
	}

	details[open] .zone-wrapper__summary::before { content: '－'; }

	.zone-panel {
		border: none;
		border-top: 1px solid var(--pico-muted-border-color);
		border-radius: 0;
		margin-block-end: 0;
	}

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

	/* Hidden on desktop — the header nav shows the back link instead */
	@media (min-width: 640px) {
		.back-link {
			display: none;
		}
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

	.status-badge--behind {
		background: color-mix(in srgb, orange 20%, transparent);
		color: color-mix(in srgb, orange 60%, var(--pico-color));
	}

	.status-badge--pending {
		background: var(--pico-muted-border-color);
		color: var(--pico-muted-color);
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

	.exempt-notes {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-block-end: 1rem;
	}

	.exempt-note {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.65rem 1rem;
		background: color-mix(in srgb, #0070dd 10%, transparent);
		border: 1px solid color-mix(in srgb, #0070dd 30%, transparent);
		border-radius: var(--pico-border-radius);
		font-size: 0.9rem;
	}

	.blocking-warn {
		padding: 0.75rem 1rem;
		background: color-mix(in srgb, red 10%, transparent);
		border: 1px solid color-mix(in srgb, red 30%, transparent);
		border-radius: var(--pico-border-radius);
		margin-block-end: 1rem;
		font-size: 0.9rem;
	}

	.blocking-warn__title {
		margin: 0 0 0.5rem;
		font-weight: 600;
		color: color-mix(in srgb, red 70%, var(--pico-color));
	}

	.blocking-warn__list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.blocking-warn__list li {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.3rem;
	}

	.wcl-link {
		font-size: 0.8rem;
		font-weight: 600;
		color: color-mix(in srgb, red 70%, var(--pico-color));
	}

	@media (max-width: 639px) {
		.blocking-warn {
			padding: 0.65rem 0.75rem;
		}
	}

</style>
