<script lang="ts">
	import type { RaiderCompliance } from '$lib/types/compliance.js';
	import { fmtWeekLabel, fmtKey, deltaClass } from '$lib/utils/format.js';

	let {
		compliance,
		weeklyMinimum = 4
	}: {
		compliance: RaiderCompliance | null | undefined;
		weeklyMinimum?: number;
	} = $props();

	const weeks = $derived(compliance?.weeks ?? []); // latest-first

	function getDelta(index: number): number | null {
		const cur = weeks[index]?.total_dungeons ?? null;
		const prev = weeks[index + 1]?.total_dungeons ?? null;
		if (cur == null || prev == null) return null;
		return cur - prev;
	}
</script>

<div class="compliance-history">
	<h3>Weekly M+ history</h3>
	<div class="table-wrapper">
		<table aria-label="Weekly M+ compliance history">
			<thead>
				<tr>
					<th scope="col">Week</th>
					<th scope="col">Keys ≥ 10</th>
					<th scope="col">Total runs</th>
					<th scope="col">Highest key</th>
					<th scope="col">vs prev week</th>
					<th scope="col">Status</th>
				</tr>
			</thead>
			<tbody>
				{#each weeks as week, i}
					<tr class={week.met ? '' : 'row--missed'}>
						<td data-label="Week">{fmtWeekLabel(week.week, week.reset_start)}</td>
						<td data-label="Keys ≥ 10">{week.count}</td>
						<td data-label="Total runs">{week.total_dungeons}</td>
						<td data-label="Highest key">{fmtKey(week.highest_key_level)}</td>
						<td data-label="vs prev week">
							{#if getDelta(i) != null}
								{@const d = getDelta(i)!}
								<span class="delta delta--{deltaClass(week.total_dungeons, weeks[i + 1]?.total_dungeons ?? null)}">
									{d > 0 ? `▲ +${d}` : d < 0 ? `▼ ${d}` : '—'}
								</span>
							{:else}
								<span class="muted">—</span>
							{/if}
						</td>
						<td data-label="Status">
							{#if week.met}
								<span class="status status--met" aria-label="Requirement met">✅</span>
							{:else}
								<span class="status status--missed" aria-label="Requirement missed ({week.count}/{weeklyMinimum})">
									❌ {week.count}/{weeklyMinimum}
								</span>
							{/if}
						</td>
					</tr>
				{:else}
					<tr>
						<td colspan="6" class="muted">No compliance data yet.</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<style>
	.compliance-history {
		margin-block-start: 1.5rem;
	}

	.table-wrapper {
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
	}

	table {
		width: 100%;
		white-space: nowrap;
		border-collapse: collapse;
	}

	td,
	th {
		padding: 0.5rem 0.75rem;
		text-align: left;
		border-bottom: 1px solid var(--pico-muted-border-color);
	}

	th {
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--pico-muted-color);
		font-weight: 600;
	}

	.row--missed {
		background: color-mix(in srgb, red 6%, transparent);
	}

	.delta {
		font-weight: 600;
		font-size: 0.9rem;
	}

	.delta--up {
		color: #14ac00;
	}

	.delta--down {
		color: #c41e3a;
	}

	.status--missed {
		color: #c41e3a;
		font-weight: 600;
	}

	.muted {
		color: var(--pico-muted-color);
	}
</style>
