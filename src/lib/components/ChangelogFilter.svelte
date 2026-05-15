<script lang="ts">
	import type { SeasonsIndex } from '$lib/types/seasons.js';

	let {
		team = $bindable('all'),
		eventType = $bindable('all'),
		seasonId = $bindable('all'),
		seasonsIndex,
	}: {
		team: string;
		eventType: string;
		seasonId: string;
		seasonsIndex: SeasonsIndex;
	} = $props();

	const activeCount = $derived(
		(team !== 'all' ? 1 : 0) + (eventType !== 'all' ? 1 : 0) + (seasonId !== 'all' ? 1 : 0),
	);

	let open = $state(false);
</script>

<div class="filter-wrapper">
	<button
		type="button"
		class="filter-toggle"
		aria-expanded={open}
		aria-controls="changelog-filter-panel"
		onclick={() => (open = !open)}
	>
		Filters
		{#if activeCount > 0}
			<span class="filter-count" aria-label="{activeCount} active filter{activeCount > 1 ? 's' : ''}">
				{activeCount}
			</span>
		{/if}
		<span class="filter-toggle__chevron" aria-hidden="true">{open ? '▲' : '▼'}</span>
	</button>

	{#if open}
		<div
			id="changelog-filter-panel"
			class="filter-panel"
			role="region"
			aria-label="Filter changelog entries"
		>
			<!-- Team filter -->
			<div class="filter-group">
				<span class="filter-label">Team</span>
				<div class="btn-group" role="group" aria-label="Filter by team">
					{#each ['all', 'main', 'alt'] as opt}
						<button
							type="button"
							class="filter-btn {team === opt ? 'filter-btn--active' : ''}"
							onclick={() => (team = opt)}
							aria-pressed={team === opt}
						>
							{opt === 'all' ? 'All' : opt.charAt(0).toUpperCase() + opt.slice(1)}
						</button>
					{/each}
				</div>
			</div>

			<!-- Event type filter -->
			<div class="filter-group">
				<label for="filter-event" class="filter-label">Event type</label>
				<select
					id="filter-event"
					bind:value={eventType}
					class="filter-select"
					aria-label="Filter by event type"
				>
					<option value="all">All events</option>
					<option value="joined">🟢 Joined</option>
					<option value="left">🔴 Left</option>
					<option value="team_changed">🔄 Designation change</option>
					<option value="rerolled">🎮 Rerolled</option>
					<option value="role_changed">⚔️ Role changed</option>
					<option value="spec_changed">📖 Spec changed</option>
					<option value="blocking_pug">🚨 Blocking pug</option>
					<option value="exempt_pug">ℹ️ Exempt pug</option>
				</select>
			</div>

			<!-- Date range / season filter -->
			<div class="filter-group">
				<label for="filter-season" class="filter-label">Date range</label>
				<select
					id="filter-season"
					bind:value={seasonId}
					class="filter-select"
					aria-label="Filter by season"
				>
					<option value="all">All time</option>
					{#each seasonsIndex.all_mplus_seasons as s}
						<option value={s.season_id}>{s.label}</option>
					{/each}
				</select>
			</div>
		</div>
	{/if}
</div>

<style>
	.filter-wrapper {
		display: inline-block;
	}

	.filter-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.4rem 0.9rem;
		min-height: 44px;
		background: none;
		border: 1px solid var(--pico-muted-border-color);
		border-radius: var(--pico-border-radius);
		cursor: pointer;
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--pico-color);
		anchor-name: --filter-toggle;
	}

	.filter-toggle:hover {
		background: var(--pico-secondary-hover-background);
	}

	.filter-count {
		background: var(--pico-primary);
		color: var(--pico-primary-inverse);
		border-radius: 999px;
		padding: 0.05em 0.45em;
		font-size: 0.75em;
		font-weight: 800;
	}

	.filter-toggle__chevron {
		font-size: 0.65rem;
		color: var(--pico-muted-color);
	}

	.filter-panel {
		/* CSS Anchor Positioning — positions relative to --filter-toggle */
		position: fixed;
		position-anchor: --filter-toggle;
		top: calc(anchor(bottom) + 0.4rem);
		right: anchor(right);
		z-index: 50;
		background: var(--pico-card-background-color);
		border: 1px solid var(--pico-muted-border-color);
		border-radius: var(--pico-border-radius);
		padding: 1rem;
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		min-width: 280px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
		/* Fallback for browsers without anchor positioning support */
		@supports not (anchor-name: --x) {
			position: absolute;
			top: calc(100% + 0.4rem);
			right: 0;
		}
	}

	.filter-group {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.filter-label {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--pico-muted-color);
		font-weight: 600;
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

	.filter-select {
		min-width: 150px;
		min-height: 44px;
		font-size: 0.85rem;
	}
</style>
