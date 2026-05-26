<script lang="ts">
	import type { RaiderCompliance } from '$lib/types/compliance.js';
	import { deltaClass, fmtKey, getSeasonWeek } from '$lib/utils/format.js';

	let {
		compliance,
		seasonStartDate = null,
	}: {
		compliance: RaiderCompliance | null | undefined;
		seasonStartDate?: string | null;
	} = $props();

	function weekLabel(isoWeek: string | null | undefined): string {
		if (!isoWeek) return '—';
		const sw = seasonStartDate ? getSeasonWeek(isoWeek, seasonStartDate) : null;
		return sw != null ? `Week ${sw}` : isoWeek;
	}

	// weeks are stored latest-first
	const current = $derived(compliance?.weeks[0] ?? null);
	const previous = $derived(compliance?.weeks[1] ?? null);
	const recordDungeons = $derived(compliance?.record_dungeons_week ?? null);
	const recordKey = $derived(compliance?.record_highest_key ?? null);

	const volDelta = $derived(() => {
		if (!current || !previous) return null;
		return current.total_dungeons - previous.total_dungeons;
	});

	const keyDelta = $derived(() => {
		if (current?.highest_key_level == null || previous?.highest_key_level == null) return null;
		return current.highest_key_level - previous.highest_key_level;
	});

	const isRecordWeek = $derived(recordDungeons?.week === current?.week);
	const isKeyRecordWeek = $derived(recordKey?.week === current?.week);
</script>

<div class="dungeon-volume">
	<!-- Row 1: Dungeon volume -->
	<section class="vol-row" aria-label="Dungeon volume this week">
		<h4 class="vol-row__title">Dungeons run</h4>
		<div class="vol-cards">
			<div class="vol-card {isRecordWeek ? 'vol-card--record' : ''}">
				<span class="vol-card__label">This week</span>
				<span class="vol-card__value">{current?.total_dungeons ?? '—'}</span>
				{#if volDelta() != null}
					<span
						class="delta delta--{deltaClass(
							current?.total_dungeons ?? null,
							previous?.total_dungeons ?? null,
						)}"
					>
						{volDelta()! > 0 ? `▲ +${volDelta()}` : volDelta()! < 0 ? `▼ ${volDelta()}` : '—'}
					</span>
				{/if}
			</div>
			<div class="vol-card">
				<span class="vol-card__label">Last week</span>
				<span class="vol-card__value">{previous?.total_dungeons ?? '—'}</span>
			</div>
			<div
				class="vol-card vol-card--gold {recordDungeons?.week === current?.week
					? 'vol-card--record'
					: ''}"
			>
				<span class="vol-card__label">🏆 Record</span>
				<span class="vol-card__value">{recordDungeons?.count ?? '—'}</span>
				{#if recordDungeons}
					<span class="vol-card__sub">{weekLabel(recordDungeons.week)}</span>
				{/if}
			</div>
		</div>
	</section>

	<!-- Row 2: Highest key -->
	<section class="vol-row" aria-label="Highest key level this week">
		<h4 class="vol-row__title">Highest key</h4>
		<div class="vol-cards">
			<div class="vol-card">
				<span class="vol-card__label">This week</span>
				<span class="vol-card__value">{fmtKey(current?.highest_key_level ?? null)}</span>
				{#if keyDelta() != null}
					<span
						class="delta delta--{deltaClass(
							current?.highest_key_level ?? null,
							previous?.highest_key_level ?? null,
						)}"
					>
						{keyDelta()! > 0 ? `▲ +${keyDelta()}` : keyDelta()! < 0 ? `▼ ${keyDelta()}` : '—'}
					</span>
				{/if}
			</div>
			<div class="vol-card">
				<span class="vol-card__label">Last week</span>
				<span class="vol-card__value">{fmtKey(previous?.highest_key_level ?? null)}</span>
			</div>
			<div class="vol-card vol-card--gold">
				<span class="vol-card__label">🏆 Record</span>
				<span class="vol-card__value">{fmtKey(recordKey?.level ?? null)}</span>
				{#if recordKey}
					<span class="vol-card__sub">{weekLabel(recordKey.week)}</span>
				{/if}
			</div>
		</div>
	</section>
</div>

<style>
	.dungeon-volume {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-block-end: 1.25rem;
	}

	.vol-row__title {
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--pico-muted-color);
		margin: 0 0 0.4rem;
	}

	.vol-cards {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
	}

	.vol-card {
		padding: 0.6rem 0.75rem;
		border-radius: var(--pico-border-radius);
		border: 1px solid var(--pico-muted-border-color);
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.vol-card--gold {
		border-color: #e5cc80;
		background: color-mix(in srgb, #e5cc80 12%, transparent);
	}

	.vol-card__label {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--pico-muted-color);
	}

	.vol-card__value {
		font-size: 1.3rem;
		font-weight: 800;
		line-height: 1.1;
	}

	.vol-card__sub {
		font-size: 0.7rem;
		color: var(--pico-muted-color);
	}

	.delta {
		font-size: 0.75rem;
		font-weight: 600;
		border-radius: 999px;
		padding: 0.05em 0.35em;
	}

	.delta--up {
		color: #14ac00;
		background: color-mix(in srgb, #14ac00 15%, transparent);
	}

	.delta--down {
		color: #c41e3a;
		background: color-mix(in srgb, #c41e3a 15%, transparent);
	}

	.delta--neutral {
		color: var(--pico-muted-color);
	}

	@media (max-width: 400px) {
		.vol-cards {
			grid-template-columns: 1fr 1fr;
		}

		.vol-card:last-child {
			grid-column: 1 / -1;
		}
	}
</style>
