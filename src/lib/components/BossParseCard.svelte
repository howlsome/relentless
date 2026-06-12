<script lang="ts">
	import type { BossParse } from '$lib/types/weekly.js';
	import { getBadgeBgColour, getBadgeTextColour } from '$lib/utils/parse-colours.js';
	import BossParseChart from './BossParseChart.svelte';

	let {
		parse,
		difficulty,
		characterName = '',
		rosterSpec = '',
		charClass = '',
		history = [],
		wclCharUrl = null,
		wclZoneId = null,
		wowanalyzerUrls = [],
	}: {
		parse: BossParse;
		difficulty: 'heroic' | 'mythic';
		characterName?: string;
		rosterSpec?: string;
		charClass?: string;
		history?: (number | null)[];
		wclCharUrl?: string | null;
		wclZoneId?: number | null;
		wowanalyzerUrls?: (string | null)[];
	} = $props();

	const latestWowAnalyzerUrl = $derived(
		[...wowanalyzerUrls].reverse().find((u) => u != null) ?? null,
	);

	const latestWipefestUrl = $derived(() => {
		if (!latestWowAnalyzerUrl) return null;
		// WoWAnalyzer: https://www.wowanalyzer.com/report/CODE/FIGHTID
		// Wipefest:    https://www.wipefest.gg/report/CODE?gameVersion=warcraft-live
		const match = latestWowAnalyzerUrl.match(/\/report\/([^/]+)\//);
		if (!match) return null;
		return `https://www.wipefest.gg/report/${match[1]}?gameVersion=warcraft-live`;
	});

	function toLorrgsClassSlug(cls: string): string {
		// Insert hyphen before an uppercase letter that follows a lowercase letter (e.g. DeathKnight → death-knight)
		return cls.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
	}

	function toLorrgsBossSlug(name: string): string {
		return name
			.toLowerCase()
			.replace(/'/g, '')
			.replace(/,/g, '')
			.replace(/&/g, '')
			.replace(/\s+/g, '-')
			.replace(/-+/g, '-')
			.replace(/^-|-$/g, '');
	}

	const lorrgsUrl = $derived(() => {
		const spec = diffData?.spec || rosterSpec;
		if (!spec || !charClass) return null;
		const specSlug = `${toLorrgsClassSlug(charClass)}-${spec.toLowerCase()}`;
		const bossSlug = toLorrgsBossSlug(parse.boss_name);
		return `https://lorrgs.io/spec_ranking/${specSlug}/${bossSlug}`;
	});

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
		<!-- Row 1: parse % on its own line -->
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
		</div>

		<!-- Row 2: PB and Avg side by side -->
		<div class="boss-card__row boss-card__row--stats">
			<span class="stat"
				>PB <strong>{personalBest != null ? personalBest.toFixed(0) + '%' : '—'}</strong></span
			>
			<span class="stat">Avg <strong>{avgPct != null ? avgPct + '%' : '—'}</strong></span>
		</div>

		<!-- Row 3: Historical best (pre-tracking) -->
		{#if diffData?.historical_best_parse != null}
			<div
				class="boss-card__row boss-card__row--historical"
				style="background:{getBadgeBgColour(diffData.historical_best_parse)};color:{getBadgeTextColour(
					diffData.historical_best_parse,
				)}"
			>
				<span class="historical-label">Historical:</span>
				<strong class="historical-value">{diffData.historical_best_parse.toFixed(0)}%</strong>
			</div>
		{/if}

		<!-- Row 4: WoWAnalyzer link -->
		{#if latestWowAnalyzerUrl}
			<div class="boss-card__row boss-card__row--wowa">
				<a
					href={latestWowAnalyzerUrl}
					target="_blank"
					rel="noopener noreferrer"
					class="wowa-link"
					title="Opens your most recent log for this boss in WoWAnalyzer">WoWAnalyzer</a
				>
			</div>
		{/if}

		<!-- Row 5: Wipefest link -->
		{#if latestWipefestUrl()}
			<div class="boss-card__row boss-card__row--wowa">
				<a
					href={latestWipefestUrl()}
					target="_blank"
					rel="noopener noreferrer"
					class="wowa-link wipefest-link"
					title="Same report as WoWAnalyzer — only your latest kill is linked">Wipefest</a
				>
			</div>
		{/if}

		<!-- Row 6: Lorrgs link — spec-specific top parse comparison -->
		{#if lorrgsUrl()}
			<div class="boss-card__row boss-card__row--wowa">
				<a
					href={lorrgsUrl()}
					target="_blank"
					rel="noopener noreferrer"
					class="wowa-link lorrgs-link"
					title="View top parses for your spec on this boss in Lorrgs">Lorrgs</a
				>
			</div>
		{/if}
	{:else}
		<div class="boss-card__row boss-card__row--parse">
			<span class="no-kill">No kills yet</span>
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

	/* Row 1: parse % on its own line */
	.boss-card__row--parse {
		justify-content: center;
		align-items: center;
		gap: 0.3rem;
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

	/* Row 2: PB and Avg side by side */
	.boss-card__row--stats {
		justify-content: space-between;
		font-size: 0.72rem;
	}

	.stat strong {
		font-weight: 700;
	}

	/* Row 3: Historical best */
	.boss-card__row--historical {
		justify-content: space-between;
		align-items: center;
		font-size: 0.72rem;
		border-radius: 999px;
		padding: 0.2em 0.65em;
		border: 2px solid currentColor;
		width: 100%;
		box-sizing: border-box;
	}

	.historical-label {
		opacity: 0.85;
	}

	.historical-value {
		font-weight: 700;
	}

	/* Row 4: WoWAnalyzer */
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

	.wipefest-link {
		border-style: dashed;
	}

	.lorrgs-link {
		border-style: dotted;
	}

	.no-kill {
		font-size: 0.85rem;
		opacity: 0.5;
	}
</style>
