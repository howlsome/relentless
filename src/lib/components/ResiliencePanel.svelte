<script lang="ts">
	import type { RaiderCompliance } from '$lib/types/compliance.js';
	import { fmtWeekLabel } from '$lib/utils/format.js';

	let {
		compliance,
		dungeons = [],
		progress = {}
	}: {
		compliance: RaiderCompliance | null | undefined;
		dungeons: string[];
		progress?: Record<string, number>;
	} = $props();

	const level = $derived(compliance?.resilience_level ?? null);
	const history = $derived(compliance?.resilience_history ?? []);

	const nextTarget = $derived(level != null ? level + 1 : 10);

	const progressRows = $derived(() =>
		dungeons.map((dungeon) => {
			const best = progress[dungeon] ?? 0;
			const ready = best >= nextTarget;
			const shortfall = ready ? 0 : nextTarget - best;
			const isBottleneck = shortfall > 0;
			return { dungeon, best, ready, shortfall, isBottleneck };
		})
	);

	const bottleneckCount = $derived(progressRows().filter((r) => r.isBottleneck).length);
</script>

<section class="resilience-panel" aria-label="Resilience achievement panel">
	<h3>Resilience</h3>

	<div class="resilience-level-badge {level != null ? 'level--achieved' : 'level--none'}">
		<span aria-hidden="true">🛡️</span>
		{#if level != null}
			<span>Resilience <strong>{level}</strong></span>
		{:else}
			<span class="muted">Not yet achieved</span>
		{/if}
	</div>

	{#if dungeons.length > 0}
		<div class="resilience-progress">
			<h4>Progress to Resilience {nextTarget}</h4>
			<table aria-label="Dungeon progress toward next Resilience level">
				<thead>
					<tr>
						<th scope="col">Dungeon</th>
						<th scope="col">Best timed</th>
						<th scope="col">Target</th>
						<th scope="col">Status</th>
					</tr>
				</thead>
				<tbody>
					{#each progressRows() as row}
						<tr class={row.isBottleneck ? 'row--bottleneck' : 'row--ready'}>
							<td>{row.dungeon}</td>
							<td>{row.best > 0 ? `+${row.best}` : '—'}</td>
							<td>+{nextTarget}</td>
							<td>
								{#if row.ready}
									<span aria-label="Ready">✅ Ready</span>
								{:else}
									<span aria-label="Need +{row.shortfall} more levels" class="need">
										❌ Need +{row.shortfall}
									</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	{#if history.length > 0}
		<div class="resilience-history" aria-label="Resilience achievement history">
			<h4>History</h4>
			<ol class="history-timeline" aria-label="Resilience progression timeline">
				{#each history as entry}
					<li class="history-entry">
						<strong>Resilience {entry.level}</strong>
						<span class="muted">— {fmtWeekLabel(entry.achieved_week)}</span>
					</li>
				{/each}
			</ol>
		</div>
	{/if}
</section>

<style>
	.resilience-panel {
		margin-block-start: 2rem;
	}

	.resilience-level-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		border-radius: var(--pico-border-radius);
		font-size: 1.1rem;
		margin-block-end: 1rem;
	}

	.level--achieved {
		background: color-mix(in srgb, #e5cc80 20%, transparent);
		border: 1px solid color-mix(in srgb, #e5cc80 50%, transparent);
		color: color-mix(in srgb, #a5935d 80%, var(--pico-color));
	}

	.level--none {
		background: var(--pico-muted-border-color);
		border: 1px solid var(--pico-muted-border-color);
	}

	table {
		width: 100%;
		border-collapse: collapse;
		margin-block-end: 1rem;
	}

	td,
	th {
		padding: 0.4rem 0.6rem;
		border-bottom: 1px solid var(--pico-muted-border-color);
		text-align: left;
	}

	th {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--pico-muted-color);
	}

	.row--bottleneck {
		background: color-mix(in srgb, orange 10%, transparent);
	}

	.need {
		color: color-mix(in srgb, orange 70%, var(--pico-color));
		font-weight: 600;
	}

	.history-timeline {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.history-entry {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.9rem;
		padding: 0.3rem 0.6rem;
		background: var(--pico-card-background-color);
		border: 1px solid var(--pico-muted-border-color);
		border-radius: var(--pico-border-radius);
	}

	.muted {
		color: var(--pico-muted-color);
	}
</style>
