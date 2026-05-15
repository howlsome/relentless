<script lang="ts">
	import type { MembershipEvent, RoleHistoryEntry } from '$lib/types/roster.js';
	import { fmtDate } from '$lib/utils/format.js';

	let {
		membershipHistory = [],
		roleHistory = [],
	}: {
		membershipHistory?: MembershipEvent[];
		roleHistory?: RoleHistoryEntry[];
	} = $props();

	interface TimelineEvent {
		date: string;
		type: 'membership' | 'character' | 'team';
		icon: string;
		text: string;
		subtext?: string;
	}

	const events = $derived((): TimelineEvent[] => {
		const all: TimelineEvent[] = [];

		for (const e of membershipHistory) {
			if (e.event === 'joined') {
				all.push({
					date: e.date,
					type: 'membership',
					icon: '🚪',
					text: `Joined Relentless`,
					subtext: 'note' in e ? e.note : undefined,
				});
			} else if (e.event === 'left') {
				all.push({
					date: e.date,
					type: 'membership',
					icon: '💤',
					text: `Left team`,
					subtext: 'note' in e ? e.note : undefined,
				});
			} else if (e.event === 'team_changed') {
				const te = e as Extract<MembershipEvent, { event: 'team_changed' }>;
				all.push({
					date: te.date,
					type: 'team',
					icon: '🔄',
					text: `Moved from ${te.from} → ${te.to} team`,
					subtext: te.reason,
				});
			}
		}

		// Role/character changes from role_history (entries with a 'from' date)
		for (let i = 1; i < roleHistory.length; i++) {
			const entry = roleHistory[i];
			const prev = roleHistory[i - 1];
			if (!entry.from) continue;
			const isReroll = prev.class !== entry.class || prev.character !== entry.character;
			if (isReroll) {
				all.push({
					date: entry.from,
					type: 'character',
					icon: '🎮',
					text: `Rerolled: ${prev.spec} ${prev.class} → ${entry.spec} ${entry.class}`,
					subtext:
						prev.character !== entry.character ? `${prev.character} → ${entry.character}` : undefined,
				});
			} else if (prev.spec !== entry.spec || prev.role !== entry.role) {
				all.push({
					date: entry.from,
					type: 'character',
					icon: '⚔️',
					text: `Spec change: ${prev.spec} → ${entry.spec}`,
				});
			}
		}

		return all.sort((a, b) => a.date.localeCompare(b.date));
	});

	const totalEvents = $derived(events().length);
</script>

{#if totalEvents > 1}
	<section class="raider-timeline" aria-label="Raider history timeline">
		<details>
			<summary class="timeline-toggle">
				View team history ({totalEvents} events)
			</summary>
			<ol class="timeline" aria-label="Chronological raider history">
				{#each events() as event}
					<li class="timeline-entry">
						<span class="timeline-dot" aria-hidden="true">{event.icon}</span>
						<div class="timeline-content">
							<span class="timeline-text">{event.text}</span>
							<time class="timeline-date muted" datetime={event.date}>{fmtDate(event.date)}</time>
							{#if event.subtext}
								<em class="timeline-note muted">{event.subtext}</em>
							{/if}
						</div>
					</li>
				{/each}
			</ol>
		</details>
	</section>
{/if}

<style>
	.raider-timeline {
		margin-block-start: 2rem;
	}

	.timeline-toggle {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--pico-primary);
		cursor: pointer;
		list-style: none;
		min-height: 44px;
		display: flex;
		align-items: center;
	}

	.timeline-toggle::-webkit-details-marker {
		display: none;
	}

	.timeline {
		list-style: none;
		padding: 0;
		margin: 0.75rem 0 0;
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.timeline-entry {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.5rem 0;
		border-left: 2px solid var(--pico-muted-border-color);
		padding-left: 1rem;
		position: relative;
	}

	.timeline-dot {
		position: absolute;
		left: -0.75rem;
		background: var(--pico-background-color);
		font-size: 1rem;
	}

	.timeline-content {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.timeline-text {
		font-weight: 600;
	}

	.timeline-date {
		font-size: 0.8rem;
	}

	.timeline-note {
		font-size: 0.8rem;
	}

	.muted {
		color: var(--pico-muted-color);
	}
</style>
