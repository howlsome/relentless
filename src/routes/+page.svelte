<script lang="ts">
	import { browser } from '$app/environment';
	import MplusStatus from '$lib/components/MplusStatus.svelte';
	import RoleIcon from '$lib/components/RoleIcon.svelte';
	import RosterTable from '$lib/components/RosterTable.svelte';
	import type { ComplianceFile } from '$lib/types/compliance.js';
	import type { Roster } from '$lib/types/roster.js';
	import type { SeasonsIndex } from '$lib/types/seasons.js';
	import type { MplusWeeklyFile, RaidWeeklyFile } from '$lib/types/weekly.js';
	import { getPrimarySpec } from '$lib/utils/roster.js';

	let {
		data,
	}: {
		data: {
			roster: Roster;
			seasonsIndex: SeasonsIndex;
			mplusSnapshot: MplusWeeklyFile | null;
			mplusCompliance: ComplianceFile | null;
			primaryRaidDifficulty: 'heroic' | 'mythic';
			raidZones: Array<{
				meta: object;
				snapshot: RaidWeeklyFile | null;
				season_id: string;
				label: string;
			}>;
		};
	} = $props();

	const { roster, seasonsIndex, mplusSnapshot, mplusCompliance, raidZones, primaryRaidDifficulty } =
		$derived(data);

	// Pick the live non-beta, non-composite zone with the most individual bosses (raid-46).
	type MetaShape = { name?: string; bosses?: Array<{ id: number; name: string }> };
	const primaryRaidZone = $derived(
		(() => {
			const live = raidZones.filter((z) => {
				const l = z.label.toLowerCase();
				return !l.includes('beta') && !l.includes('complete');
			});
			const pool = live.length ? live : raidZones;
			return (
				[...pool].sort(
					(a, b) =>
						((b.meta as MetaShape)?.bosses?.length ?? 0) - ((a.meta as MetaShape)?.bosses?.length ?? 0),
				)[0] ?? null
			);
		})(),
	);

	// Summary stats
	const activePlayers = $derived(roster.players.filter((p) => p.status === 'active'));

	const RANGED_SPECS = new Set([
		'Balance',
		'Elemental',
		'Shadow',
		'Arcane',
		'Fire',
		'Affliction',
		'Demonology',
		'Destruction',
		'Beast Mastery',
		'Marksmanship',
		'Devastation',
		'Augmentation',
	]);

	const rosterComp = $derived(() => {
		const counts = { tank: 0, healer: 0, rangedDps: 0, meleeDps: 0 };
		for (const p of activePlayers) {
			const char = p.characters.find((c: { active: boolean }) => c.active);
			const primarySpec = char ? getPrimarySpec(char) : null;
			const role = (primarySpec?.role ?? char?.role ?? 'dps') as 'tank' | 'healer' | 'dps';
			if (role === 'tank') counts.tank++;
			else if (role === 'healer') counts.healer++;
			else {
				const spec = primarySpec?.spec ?? char?.spec ?? '';
				const cls = char?.class ?? '';
				const ranged = RANGED_SPECS.has(spec) || (spec === 'Frost' && cls === 'Mage');
				if (ranged) counts.rangedDps++;
				else counts.meleeDps++;
			}
		}
		return counts;
	});

	const onTrackCount = $derived(
		mplusSnapshot ? mplusSnapshot.raiders.filter((r) => r.mplus_requirement_met).length : 0,
	);

	const raidRaiders = $derived(primaryRaidZone?.snapshot?.raiders ?? []);

	// Progression card difficulty — defaults to roster config, persisted in localStorage
	let progDifficulty = $state<'heroic' | 'mythic'>(primaryRaidDifficulty);
	if (browser) {
		const stored = localStorage.getItem('prog-difficulty');
		if (stored === 'heroic' || stored === 'mythic') progDifficulty = stored;
	}
	function setProgDifficulty(d: 'heroic' | 'mythic') {
		progDifficulty = d;
		if (browser) localStorage.setItem('prog-difficulty', d);
	}

	const bossProg = $derived(
		((zone) => {
			if (!zone) return [];
			const bosses = (zone.meta as MetaShape)?.bosses ?? [];
			const raiders = zone.snapshot?.raiders ?? [];
			return bosses.map((boss) => {
				const killed = raiders.some((r: (typeof raidRaiders)[0]) => {
					const diff = r.raid_parses?.find((p) => p.boss_id === boss.id)?.difficulties?.[progDifficulty];
					// Only count Relentless kills — exclude pug kills (blocking or exempt)
					return diff?.kill === true && (diff.kill_category == null || diff.kill_category === 'in_raid');
				});
				return { id: boss.id, name: boss.name, killed };
			});
		})(primaryRaidZone),
	);
	const bossDown = $derived(bossProg.filter((b) => b.killed).length);
	const bossTotal = $derived(bossProg.length);
</script>

<svelte:head>
	<title>Dashboard — Undaunted: Relentless</title>
</svelte:head>

<!-- Summary stat row -->
{#if mplusSnapshot}
	<div class="summary-row" role="list" aria-label="Team summary statistics">
		{#if bossTotal > 0}
			<div class="stat-card stat-card--progression" role="listitem">
				<div class="prog-card-header">
					<div class="stat-card__label">
						{seasonsIndex.all_raid_zones.length > 1
							? 'Raid tier'
							: ((primaryRaidZone?.meta as MetaShape)?.name ?? primaryRaidZone?.label ?? 'Raid')}
					</div>
					{#if browser}
						<div class="prog-diff-toggle" role="group" aria-label="Progression difficulty">
							{#each primaryRaidDifficulty === 'mythic' ? [['mythic', 'M'], ['heroic', 'H']] : [['heroic', 'H'], ['mythic', 'M']] as [val, short]}
								<button
									type="button"
									class="prog-diff-btn {progDifficulty === val ? 'prog-diff-btn--active' : ''}"
									onclick={() => setProgDifficulty(val as 'heroic' | 'mythic')}
									aria-pressed={progDifficulty === val}
									title={val.charAt(0).toUpperCase() + val.slice(1)}>{short}</button
								>
							{/each}
						</div>
					{:else}
						<span class="prog-diff-label">{progDifficulty === 'mythic' ? 'M' : 'H'}</span>
					{/if}
				</div>
				<div class="progression-header">
					<span class="progression-count">
						{bossDown}<span class="progression-denom"> / {bossTotal}</span>
					</span>
					<span class="progression-label">{bossDown === bossTotal ? 'Clear 🎉' : 'bosses'}</span>
				</div>
				<div
					class="prog-bar"
					role="progressbar"
					aria-valuenow={bossDown}
					aria-valuemin={0}
					aria-valuemax={bossTotal}
					aria-label="{progDifficulty} progression"
				>
					<div
						class="prog-bar__fill"
						style="width: {bossTotal > 0 ? (bossDown / bossTotal) * 100 : 0}%"
					></div>
				</div>
				<ol class="boss-pips" aria-label="Boss kill status">
					{#each bossProg as boss}
						<li
							class="boss-pip {boss.killed ? 'boss-pip--killed' : 'boss-pip--alive'}"
							data-tooltip="{boss.name} — {boss.killed ? 'Killed' : 'Not yet'}"
							aria-label="{boss.name}: {boss.killed ? 'killed' : 'not yet killed'}"
						></li>
					{/each}
				</ol>
			</div>
		{/if}
		<div class="stat-card" role="listitem">
			<div class="stat-card__label">Roster</div>
			<div class="roster-comp">
				<span class="roster-comp__item"><RoleIcon role="tank" /> {rosterComp().tank}</span>
				<span class="roster-comp__item"><RoleIcon role="healer" /> {rosterComp().healer}</span>
				<span class="roster-comp__item"><RoleIcon role="dps" /> {rosterComp().meleeDps}</span>
				<span class="roster-comp__item">🏹 {rosterComp().rangedDps}</span>
			</div>
		</div>
		<div
			class="stat-card stat-card--ontrack {onTrackCount === activePlayers.length
				? 'stat-card--good'
				: 'stat-card--warn'}"
			role="listitem"
		>
			<div class="stat-card__label">On track this week</div>
			<div class="stat-card__value--xl">{onTrackCount} / {activePlayers.length}</div>
		</div>
	</div>
{/if}

{#if primaryRaidZone?.snapshot}
	<RosterTable {roster} raidSnapshot={primaryRaidZone.snapshot} />
{:else}
	<section>
		<h2>Raid Parses</h2>
		<p class="muted">Raid data will appear here after the first cron run.</p>
	</section>
{/if}

<MplusStatus {roster} {seasonsIndex} snapshot={mplusSnapshot} />

<style>
	.summary-row {
		display: grid;
		gap: 0.75rem;
		margin-block-end: 1.5rem;

		/* Mobile: raid full-width top, roster + on-track side by side below */
		grid-template-columns: 1fr 1fr;
	}

	.stat-card--progression {
		grid-column: 1 / -1;
	}

	/* Tablet: all three in a row, raid gets more space */
	@media (min-width: 640px) {
		.summary-row {
			grid-template-columns: 2fr 1fr 1fr;
		}

		.stat-card--progression {
			grid-column: auto;
		}
	}

	/* Desktop: raid takes even more space */
	@media (min-width: 1024px) {
		.summary-row {
			grid-template-columns: 3fr 1fr 1fr;
		}
	}

	.stat-card {
		padding: 0.75rem 1rem;
		border-radius: var(--pico-border-radius);
		border: 1px solid var(--pico-muted-border-color);
		background: var(--pico-card-background-color);
	}

	.stat-card--ontrack {
		display: flex;
		flex-direction: column;
	}

	.stat-card__value--xl {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: clamp(1.5rem, 4vw, 2.25rem);
		font-weight: 900;
		line-height: 1;
	}

	.prog-card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-block-end: 0.25rem;
	}

	.prog-diff-toggle {
		display: flex;
		border-radius: 4px;
		overflow: hidden;
		border: 1px solid color-mix(in srgb, #8b5cf6 40%, transparent);
	}

	.prog-diff-btn {
		background: none;
		border: none;
		border-radius: 0;
		padding: 0 0.4rem;
		min-height: 22px;
		min-width: 22px;
		font-size: 0.7rem;
		font-weight: 700;
		cursor: pointer;
		color: color-mix(in srgb, #8b5cf6 70%, var(--pico-color));
		border-right: 1px solid color-mix(in srgb, #8b5cf6 40%, transparent);
		line-height: 1;
	}

	.prog-diff-btn:last-child {
		border-right: none;
	}

	.prog-diff-btn--active {
		background: #8b5cf6;
		color: #fff;
	}

	.prog-diff-label {
		font-size: 0.7rem;
		font-weight: 700;
		color: color-mix(in srgb, #8b5cf6 70%, var(--pico-color));
	}

	.stat-card--progression {
		border-color: color-mix(in srgb, #8b5cf6 35%, transparent);
		background: color-mix(in srgb, #8b5cf6 6%, var(--pico-card-background-color));
	}

	.progression-header {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		margin-block-end: 0.5rem;
	}

	.progression-count {
		font-size: 1.5rem;
		font-weight: 800;
		line-height: 1.1;
	}

	.progression-denom {
		font-size: 1rem;
		font-weight: 600;
		color: var(--pico-muted-color);
	}

	.progression-label {
		font-size: 0.8rem;
		color: var(--pico-muted-color);
		margin-inline-start: auto;
	}

	.prog-bar {
		height: 8px;
		border-radius: 2px;
		background: var(--pico-muted-border-color);
		overflow: hidden;
		margin-block-end: 0.5rem;
	}

	.prog-bar__fill {
		height: 100%;
		border-radius: 2px;
		background: #8b5cf6;
		transition: width 0.3s ease;
	}

	.boss-pips {
		display: flex;
		gap: 3px;
		list-style: none;
		padding: 0;
		margin: 0;
		overflow: visible;
	}

	.boss-pip {
		flex: 1;
		height: 8px;
		border-radius: 2px;
		cursor: default;
		position: relative;
	}

	.boss-pip::after {
		content: attr(data-tooltip);
		position: absolute;
		bottom: calc(100% + 6px);
		left: 50%;
		transform: translateX(-50%);
		background: var(--pico-contrast-background, #1a1a2e);
		color: var(--pico-contrast-inverse, #fff);
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
		font-size: 0.7rem;
		white-space: nowrap;
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.15s ease;
		z-index: 10;
	}

	.boss-pip:hover::after {
		opacity: 1;
	}

	.boss-pip--killed {
		background: #8b5cf6;
	}

	.boss-pip--alive {
		background: var(--pico-muted-border-color);
	}

	.stat-card--good {
		border-color: color-mix(in srgb, #14ac00 40%, transparent);
		background: color-mix(in srgb, #14ac00 8%, var(--pico-card-background-color));
	}

	.stat-card--warn {
		border-color: color-mix(in srgb, orange 40%, transparent);
		background: color-mix(in srgb, orange 8%, var(--pico-card-background-color));
	}

	.stat-card__label {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--pico-muted-color);
		font-weight: 600;
		margin-block-end: 0.25rem;
	}

	.roster-comp {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.3rem 0.5rem;
		margin-block: 0.3rem;
	}

	.roster-comp__item {
		font-size: 1rem;
		font-weight: 700;
	}

	.muted {
		color: var(--pico-muted-color);
	}
</style>
