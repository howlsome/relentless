<script lang="ts">
	import type { BossParse } from '$lib/types/weekly.js';
	import ParseBadge from './ParseBadge.svelte';
	import ParseSparkline from './ParseSparkline.svelte';
	import { fmtWeekLabel } from '$lib/utils/format.js';

	let {
		parse,
		difficulty,
		characterName = '',
		rosterSpec = '',
		/** Parse history for this boss+difficulty, newest last (null = no kill) */
		history = [],
		currentWeek = ''
	}: {
		parse: BossParse;
		difficulty: 'heroic' | 'mythic';
		characterName?: string;
		rosterSpec?: string;
		history?: (number | null)[];
		currentWeek?: string;
	} = $props();

	const diffData = $derived(parse.difficulties[difficulty]);
	const heroic = $derived(parse.difficulties['heroic']);
	const mythic = $derived(parse.difficulties['mythic']);

	const kills = $derived(history.filter((h): h is number => h != null));
	const personalBest = $derived(kills.length > 0 ? Math.max(...kills) : null);
	const firstKill = $derived(kills.length > 0 ? kills[kills.length - 1] : null); // oldest non-null
	const currentPct = $derived(diffData?.kill ? diffData.parse_percentile : null);
	const improvementDelta = $derived(
		currentPct != null && firstKill != null ? Math.round(currentPct - firstKill) : null
	);

	// Trend: compare current to previous week's parse (second-to-last non-null)
	const previousPct = $derived(() => {
		const prev = history.slice(0, -1).filter((h): h is number => h != null);
		return prev.at(-1) ?? null;
	});

	const trend = $derived(() => {
		if (currentPct == null || previousPct() == null) return 'neutral' as const;
		if (currentPct > previousPct()!) return 'up' as const;
		if (currentPct < previousPct()!) return 'down' as const;
		return 'neutral' as const;
	});

	const specMismatch = $derived(
		diffData?.kill && diffData.spec && rosterSpec && diffData.spec !== rosterSpec
	);

	const isPbThisWeek = $derived(currentPct != null && personalBest != null && currentPct >= personalBest);
</script>

<article class="boss-card" aria-label="Parse card for {parse.boss_name}">
	<header class="boss-card__header">
		<span class="boss-card__name">{parse.boss_name}</span>

		<!-- Cross-difficulty summary always visible -->
		<div class="boss-card__cross-diff" aria-label="Parse summary across difficulties">
			<span class="cross-diff-label">H:</span>
			{#if heroic?.kill}
				<ParseBadge percentile={heroic.parse_percentile} size="sm" />
			{:else}
				<span class="muted-dash">—</span>
			{/if}
			<span class="cross-diff-label">M:</span>
			{#if mythic?.kill}
				<ParseBadge percentile={mythic.parse_percentile} size="sm" />
			{:else}
				<span class="muted-dash">—</span>
			{/if}
		</div>
	</header>

	<div class="boss-card__body">
		{#if diffData?.kill}
			<div class="boss-card__primary">
				<ParseBadge percentile={diffData.parse_percentile} size="lg" />
				<span
					class="trend trend--{trend()}"
					aria-label="Trend: {trend()}"
					aria-hidden="true"
				>
					{trend() === 'up' ? '▲' : trend() === 'down' ? '▼' : '—'}
				</span>
				{#if specMismatch}
					<span title="Spec mismatch: logged as {diffData.spec}, roster shows {rosterSpec}" aria-label="Spec mismatch warning">⚠️</span>
				{/if}
			</div>

			<div class="boss-card__meta">
				{#if diffData.spec}
					<span class="boss-card__spec muted">{diffData.spec}</span>
				{/if}

				{#if personalBest != null}
					<span class="boss-card__pb {isPbThisWeek ? 'pb--this-week' : ''}">
						PB: {personalBest.toFixed(0)}%
						{#if isPbThisWeek}<span class="pb-new" aria-label="Personal best set this week">★ This week!</span>{/if}
					</span>
				{/if}

				{#if improvementDelta != null}
					<span class="boss-card__delta muted">
						{improvementDelta >= 0 ? `+${improvementDelta}` : improvementDelta} since first kill
					</span>
				{/if}
			</div>
		{:else}
			<div class="boss-card__no-kill">
				<span class="muted">No kills yet</span>
			</div>
		{/if}

		<!-- Sparkline (8-week history) -->
		<div class="boss-card__sparkline">
			<ParseSparkline
				points={history}
				bossName={parse.boss_name}
				{characterName}
			/>
		</div>
	</div>
</article>

<style>
	.boss-card {
		padding: 0.75rem;
		border-radius: var(--pico-border-radius);
		border: 1px solid var(--pico-muted-border-color);
		background: var(--pico-card-background-color);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.boss-card__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.boss-card__name {
		font-weight: 700;
		font-size: 0.95rem;
	}

	.boss-card__cross-diff {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.8rem;
	}

	.cross-diff-label {
		color: var(--pico-muted-color);
		font-weight: 600;
	}

	.boss-card__primary {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.trend {
		font-size: 1.1rem;
		font-weight: 700;
	}

	.trend--up {
		color: #14ac00;
	}

	.trend--down {
		color: #c41e3a;
	}

	.trend--neutral {
		color: var(--pico-muted-color);
	}

	.boss-card__meta {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.boss-card__pb {
		font-size: 0.8rem;
		font-weight: 600;
	}

	.pb--this-week {
		color: #e5cc80;
	}

	.pb-new {
		margin-left: 0.3em;
		font-size: 0.75em;
		color: #e5cc80;
	}

	.boss-card__delta {
		font-size: 0.75rem;
	}

	.boss-card__sparkline {
		margin-top: 0.25rem;
		max-width: 120px;
	}

	.boss-card__no-kill {
		padding: 0.5rem 0;
	}

	.muted {
		color: var(--pico-muted-color);
	}

	.muted-dash {
		color: var(--pico-muted-color);
		font-size: 0.8rem;
	}
</style>
