<script lang="ts">
	import type { BossParse } from '$lib/types/weekly.js';
	import type { Character } from '$lib/types/roster.js';
	import BossParseCard from './BossParseCard.svelte';
	import RoleIcon from './RoleIcon.svelte';

	let {
		character,
		parses,
		difficulty,
		isActive,
		dateRange = null,
		bestParseSummary = null,
		weeklyHistory = {}
	}: {
		character: Character & { first_seen?: string; last_seen?: string };
		parses: BossParse[];
		difficulty: 'heroic' | 'mythic';
		isActive: boolean;
		dateRange?: string | null;
		/** For inactive section headers: e.g. "Best: 94 Purple" */
		bestParseSummary?: string | null;
		/** Map from boss_id → array of parse percentiles (newest last) */
		weeklyHistory?: Record<number, (number | null)[]>;
	} = $props();
</script>

<details class="char-section" open={isActive || undefined}>
	<summary class="char-section__summary {isActive ? '' : 'char-section__summary--inactive'}">
		<span class="char-section__identity">
			<RoleIcon role={character.role} />
			<span class="char-section__name {isActive ? '' : 'muted'}">{character.name}</span>
			<span class="char-section__spec muted">— {character.spec} {character.class}</span>
			{#if !isActive}
				<span class="char-section__badge">Historical</span>
			{/if}
		</span>

		<span class="char-section__meta">
			{#if dateRange}
				<span class="muted char-section__range">{dateRange}</span>
			{/if}
			{#if !isActive && bestParseSummary}
				<span class="char-section__best">{bestParseSummary}</span>
			{/if}
			{#if isActive}
				<span class="char-section__active-since muted">Active since {character.first_seen ?? '?'}</span>
			{/if}
		</span>
	</summary>

	<div class="char-section__cards {isActive ? '' : 'char-section__cards--historical'}">
		{#if parses.length === 0}
			<p class="muted">No parse data for this character.</p>
		{:else}
			<div class="boss-grid">
				{#each parses as bossparse}
					<BossParseCard
						parse={bossparse}
						{difficulty}
						characterName={character.name}
						rosterSpec={character.spec}
						history={weeklyHistory[bossparse.boss_id] ?? []}
					/>
				{/each}
			</div>
		{/if}
	</div>
</details>

<style>
	.char-section {
		border: 1px solid var(--pico-muted-border-color);
		border-radius: var(--pico-border-radius);
		margin-block-end: 0.75rem;
		overflow: hidden;
	}

	.char-section__summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		cursor: pointer;
		min-height: 44px;
		list-style: none;
		background: var(--pico-card-sectioning-background-color);
		gap: 0.75rem;
	}

	.char-section__summary::-webkit-details-marker {
		display: none;
	}

	.char-section__summary::before {
		content: '▶';
		font-size: 0.7rem;
		transition: transform 0.15s ease;
		margin-right: 0.5rem;
		color: var(--pico-muted-color);
	}

	details[open] .char-section__summary::before {
		transform: rotate(90deg);
	}

	.char-section__identity {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.char-section__name {
		font-weight: 700;
		font-size: 1rem;
	}

	.char-section__spec {
		font-size: 0.85rem;
	}

	.char-section__badge {
		font-size: 0.7rem;
		background: var(--pico-muted-border-color);
		padding: 0.1em 0.4em;
		border-radius: 0.2em;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.char-section__meta {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.1rem;
		font-size: 0.8rem;
	}

	.char-section__best {
		font-weight: 600;
	}

	.char-section__cards {
		padding: 1rem;
	}

	.char-section__cards--historical {
		opacity: 0.75;
	}

	.boss-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 0.75rem;
	}

	.muted {
		color: var(--pico-muted-color);
	}

	@media (max-width: 640px) {
		.boss-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
