<script lang="ts">
	import type { BossParse } from '$lib/types/weekly.js';
	import { getBadgeBgColour, getBadgeTextColour } from '$lib/utils/parse-colours.js';
	import BossParseChart from './BossParseChart.svelte';

	let {
		parse,
		difficulty,
		characterName = '',
		rosterSpec = '',
		history = [],
		wclCharUrl = null,
		wclZoneId = null,
		wowanalyzerUrls = [],
	}: {
		parse: BossParse;
		difficulty: 'heroic' | 'mythic';
		characterName?: string;
		rosterSpec?: string;
		history?: (number | null)[];
		wclCharUrl?: string | null;
		wclZoneId?: number | null;
		wowanalyzerUrls?: (string | null)[];
	} = $props();

	const latestWowAnalyzerUrl = $derived(
		[...wowanalyzerUrls].reverse().find((u) => u != null) ?? null,
	);

	const DIFF_IDS: Record<string, number> = { heroic: 4, mythic: 5 };

	function wclUrl(diff: string): string | null {
		if (!wclCharUrl || !wclZoneId) return null;
		const diffId = DIFF_IDS[diff];
		if (!diffId) return null;
		return `${wclCharUrl}#zone=${wclZoneId}&difficulty=${diffId}&encounter=${parse.boss_id}`;
	}

	const diffData = $derived(parse.difficulties[difficulty]);
	// Only count kills made with Relentless (in_raid) or unclassified legacy data.
	// Pug kills (blocking_pug, safe_pug, exempt_pug) are excluded from the card.
	const isRelentlessKill = $derived(
		diffData?.kill === true &&
			(diffData.kill_category == null || diffData.kill_category === 'in_raid'),
	);
	const currentPct = $derived(isRelentlessKill ? diffData?.parse_percentile : null);
	const cardBg = $derived(currentPct != null ? getBadgeBgColour(currentPct) : null);
	const cardColor = $derived(currentPct != null ? getBadgeTextColour(currentPct) : null);

	const kills = $derived(history.filter((h): h is number => h != null));
	const personalBest = $derived(kills.length > 0 ? Math.max(...kills) : null);
	const avgPct = $derived(
		kills.length > 0 ? Math.round(kills.reduce((a, b) => a + b, 0) / kills.length) : null,
	);

	const previousPct = $derived(() => {
		const prev = history.slice(0, -1).filter((h): h is number => h != null);
		return prev.at(-1) ?? null;
	});

	const trend = $derived(() => {
		if (currentPct == null || previousPct() == null) return 'neutral' as const;
		if (currentPct > (previousPct() ?? 0)) return 'up' as const;
		if (currentPct < (previousPct() ?? 0)) return 'down' as const;
		return 'neutral' as const;
	});

	const specMismatch = $derived(
		isRelentlessKill && diffData?.spec && rosterSpec && diffData.spec !== rosterSpec,
	);
</script>

<article
	class="boss-card"
	style={cardBg ? `background:${cardBg};border-color:${cardBg};color:${cardColor}` : ''}
	aria-label="Parse card for {parse.boss_name}"
>
	<!-- Boss name -->
	<div class="boss-card__name" title={parse.boss_name}>{parse.boss_name}</div>

	<!-- Chart -->
	<div class="boss-card__chart">
		<BossParseChart points={history} bossName={parse.boss_name} {characterName} />
	</div>

	{#if isRelentlessKill}
		<!-- Row 1: parse (left) + stacked PB/Avg (right) -->
		<div class="boss-card__row boss-card__row--parse">
			<div class="parse-group">
				{#if wclUrl(difficulty)}
					<a
						href={wclUrl(difficulty)}
						target="_blank"
						rel="noopener noreferrer"
						class="parse-num"
						aria-label="Parse {currentPct?.toFixed(0)}% — view on Warcraft Logs"
						>{currentPct?.toFixed(0)}%</a
					>
				{:else}
					<span class="parse-num">{currentPct?.toFixed(0)}%</span>
				{/if}
				{#if trend() !== 'neutral'}
					<span class="parse-trend parse-trend--{trend()}" aria-hidden="true">
						{trend() === 'up' ? '▲' : '▼'}
					</span>
				{/if}
				{#if specMismatch}
					<span title="Spec mismatch: logged as {diffData?.spec}, roster shows {rosterSpec}">⚠️</span>
				{/if}
			</div>

			<div class="stat-stack">
				<span class="stat"
					>PB <strong>{personalBest != null ? personalBest.toFixed(0) + '%' : '—'}</strong></span
				>
				<span class="stat">Avg <strong>{avgPct != null ? avgPct + '%' : '—'}</strong></span>
			</div>
		</div>

		<!-- Row 2: WoWAnalyzer link on its own -->
		{#if latestWowAnalyzerUrl}
			<div class="boss-card__row boss-card__row--wowa">
				<a
					href={latestWowAnalyzerUrl}
					target="_blank"
					rel="noopener noreferrer"
					class="wowa-link"
					title="Opens your most recent log for this boss in WoWAnalyzer">Open in WoWAnalyzer</a
				>
			</div>
		{/if}
	{:else}
		<div class="boss-card__row boss-card__row--parse">
			<span class="no-kill">No kills yet</span>
			<div class="stat-stack stat-stack--empty">
				<span class="stat">Avg —</span>
			</div>
		</div>
	{/if}
</article>

<style>
	.boss-card {
		padding: 0.65rem 0.75rem;
		border-radius: var(--pico-border-radius);
		border: 1px solid var(--pico-muted-border-color);
		background: var(--pico-card-background-color);
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.boss-card__name {
		font-weight: 600;
		font-size: 0.82rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.boss-card__chart {
		width: 100%;
	}

	/* Shared row styles */
	.boss-card__row {
		display: flex;
		align-items: center;
	}

	/* Row 1: parse (left) + stacked PB/Avg (right) */
	.boss-card__row--parse {
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
		min-height: 2.2rem;
	}

	.parse-group {
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}

	.parse-num {
		font-size: 1.5rem;
		font-weight: 800;
		line-height: 1;
		text-decoration: none;
		color: inherit;
	}

	a.parse-num:hover {
		opacity: 0.85;
	}

	.parse-trend {
		font-size: 0.75rem;
		font-weight: 700;
	}

	.stat-stack {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.1rem;
		font-size: 0.72rem;
	}

	.stat-stack--empty {
		opacity: 0.45;
	}

	.stat strong {
		font-weight: 700;
	}

	/* Row 2: WoWAnalyzer */
	.boss-card__row--wowa {
		justify-content: stretch;
	}

	.wowa-link {
		display: block;
		width: 100%;
		text-align: center;
		font-size: 0.7rem;
		font-weight: 700;
		color: inherit;
		text-decoration: none;
		border: 1px solid currentColor;
		border-radius: 4px;
		padding: 0.25em 0.5em;
		opacity: 0.65;
	}

	.wowa-link:hover {
		opacity: 1;
	}

	.no-kill {
		font-size: 0.85rem;
		opacity: 0.5;
	}
</style>
