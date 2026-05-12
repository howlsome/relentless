<script lang="ts">
	import type { RaiderCompliance } from '$lib/types/compliance.js';
	import { shouldShowMissedWeekCallout } from '$lib/utils/milestones.js';

	let {
		compliance,
		weeklyMinimum = 4
	}: {
		compliance: RaiderCompliance | null | undefined;
		weeklyMinimum?: number;
	} = $props();

	const streak = $derived(compliance?.current_streak ?? 0);
	const longest = $derived(compliance?.longest_streak ?? 0);
	const met = $derived(compliance?.total_weeks_met ?? 0);
	const tracked = $derived(compliance?.total_weeks_tracked ?? 0);
	const rate = $derived(tracked > 0 ? Math.round((met / tracked) * 100) : 0);

	const streakEmoji = $derived(() => {
		if (streak >= 3) return '🔥';
		if (streak === 1) return '🌱';
		// Streak just broke (latest week is false, previous was true)
		const weeks = compliance?.weeks ?? [];
		if (streak === 0 && weeks.length >= 2 && weeks[1]?.met) return '💀';
		return '';
	});

	const missed = $derived(shouldShowMissedWeekCallout(compliance));
</script>

<div class="streak-panel">
	{#if missed.show}
		<div class="missed-callout" role="alert">
			<span aria-hidden="true">⚠️</span>
			Requirement missed last week — {missed.count} keys completed, {weeklyMinimum} needed.
		</div>
	{/if}

	<div class="streak-hero" aria-label="Current streak: {streak} weeks">
		<div class="streak-main">
			<span class="streak-emoji" aria-hidden="true">{streakEmoji()}</span>
			<span class="streak-count">{streak}</span>
			<span class="streak-label">-week streak</span>
		</div>

		<div class="streak-stats">
			<div class="streak-stat">
				<span class="streak-stat__value">{longest}</span>
				<span class="streak-stat__label">Best</span>
			</div>
			<div class="streak-stat">
				<span class="streak-stat__value">{met}/{tracked}</span>
				<span class="streak-stat__label">({rate}%)</span>
			</div>
		</div>
	</div>
</div>

<style>
	.streak-panel {
		margin-block-end: 1rem;
	}

	.missed-callout {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		margin-block-end: 0.75rem;
		background: color-mix(in srgb, red 15%, transparent);
		border: 1px solid color-mix(in srgb, red 35%, transparent);
		border-radius: var(--pico-border-radius);
		font-weight: 600;
		color: color-mix(in srgb, red 70%, var(--pico-color));
	}

	.streak-hero {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		flex-wrap: wrap;
	}

	.streak-main {
		display: flex;
		align-items: baseline;
		gap: 0.25rem;
	}

	.streak-emoji {
		font-size: 1.8rem;
	}

	.streak-count {
		font-size: 2.5rem;
		font-weight: 900;
		line-height: 1;
		color: var(--pico-primary);
	}

	.streak-label {
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--pico-muted-color);
	}

	.streak-stats {
		display: flex;
		gap: 1.5rem;
	}

	.streak-stat {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.streak-stat__value {
		font-size: 1.1rem;
		font-weight: 700;
	}

	.streak-stat__label {
		font-size: 0.75rem;
		color: var(--pico-muted-color);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
</style>
