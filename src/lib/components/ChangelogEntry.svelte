<script lang="ts">
	import type { ChangelogEntry } from '$lib/types/changelog.js';
	import { fmtDate } from '$lib/utils/format.js';
	import TeamDesignationBadge from './TeamDesignationBadge.svelte';

	let { entry }: { entry: ChangelogEntry } = $props();

	const icons: Record<string, string> = {
		joined: '🟢',
		left: '🔴',
		team_changed: '🔄',
		rerolled: '🎮',
		role_changed: '⚔️',
		spec_changed: '📖',
		blocking_pug: '🚨',
		exempt_pug: 'ℹ️',
	};

	const icon = $derived(icons[entry.event] ?? '📋');

	const description = $derived((): string => {
		switch (entry.event) {
			case 'joined':
				return `Joined the ${entry.team} team`;
			case 'left':
				return `Left the ${entry.team} team`;
			case 'team_changed': {
				const te = entry as Extract<ChangelogEntry, { event: 'team_changed' }>;
				return `Moved from ${te.from} → ${te.to} team`;
			}
			case 'rerolled': {
				const re = entry as Extract<ChangelogEntry, { event: 'rerolled' }>;
				return `Rerolled: ${re.from_character} (${re.from_class}/${re.from_spec}) → ${re.to_character} (${re.to_class}/${re.to_spec})`;
			}
			case 'role_changed': {
				const rc = entry as Extract<ChangelogEntry, { event: 'role_changed' }>;
				return `Role change: ${rc.from_spec} (${rc.from_role}) → ${rc.to_spec} (${rc.to_role})`;
			}
			case 'spec_changed': {
				const sc = entry as Extract<ChangelogEntry, { event: 'spec_changed' }>;
				return `Spec change: ${sc.from_spec} → ${sc.to_spec}`;
			}
			case 'blocking_pug': {
				const bp = entry as Extract<ChangelogEntry, { event: 'blocking_pug' }>;
				return `Progression-blocking pug — ${bp.difficulty.charAt(0).toUpperCase() + bp.difficulty.slice(1)} ${bp.boss_name} at ${bp.detected_local_time}`;
			}
			case 'exempt_pug': {
				const ep = entry as Extract<ChangelogEntry, { event: 'exempt_pug' }>;
				return `Exempt — Mythic ${ep.boss_name} pugged outside Relentless.`;
			}
			default:
				return (entry as { event: string }).event;
		}
	});

	const character = $derived(
		'character' in entry ? entry.character : 'to_character' in entry ? entry.to_character : '',
	);
	const charClass = $derived(
		'class' in entry ? entry.class : 'to_class' in entry ? entry.to_class : '',
	);
	const charSpec = $derived('spec' in entry ? entry.spec : 'to_spec' in entry ? entry.to_spec : '');
	const note = $derived('note' in entry ? entry.note : undefined);
	const reason = $derived(
		'reason' in entry
			? (entry as Extract<ChangelogEntry, { event: 'team_changed' }>).reason
			: undefined,
	);
	const displayTime = $derived(
		entry.event === 'blocking_pug' || entry.event === 'exempt_pug'
			? (entry as Extract<ChangelogEntry, { event: 'blocking_pug' }>).kill_time
			: entry.timestamp,
	);
</script>

<div class="changelog-entry changelog-entry--{entry.event}" role="listitem">
	<span class="changelog-entry__icon" aria-hidden="true">{icon}</span>

	<div class="changelog-entry__body">
		<div class="changelog-entry__main">
			<a href="/raider/{entry.raider_id}" class="changelog-entry__raider">
				{entry.display_name}
			</a>
			{#if character}
				<span class="muted changelog-entry__char">
					— {character}{charClass ? (charSpec ? ` (${charClass}/${charSpec})` : ` (${charClass})`) : ''}
				</span>
			{/if}
			<TeamDesignationBadge designation={entry.team} />
		</div>

		<div class="changelog-entry__desc">{description()}</div>

		{#if entry.event === 'blocking_pug'}
			{@const bp = entry as Extract<ChangelogEntry, { event: 'blocking_pug' }>}
			{#if bp.wcl_report_code}
				<a
					href="https://www.warcraftlogs.com/reports/{bp.wcl_report_code}#fight={bp.wcl_fight_id ??
						'last'}"
					target="_blank"
					rel="noopener noreferrer"
					class="changelog-entry__wcl">View on Warcraft Logs</a
				>
			{/if}
		{/if}

		{#if reason}
			<em class="changelog-entry__note muted">{reason}</em>
		{/if}

		{#if note}
			<em class="changelog-entry__note muted">{note}</em>
		{/if}

		<time class="changelog-entry__date muted" datetime={displayTime}>
			{fmtDate(displayTime)}
		</time>
	</div>
</div>

<style>
	.changelog-entry {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.6rem 0;
		border-bottom: 1px solid var(--pico-muted-border-color);
	}

	.changelog-entry__wcl {
		font-size: 0.8rem;
		font-weight: 600;
		color: color-mix(in srgb, red 70%, var(--pico-color));
	}

	.changelog-entry--blocking_pug {
		padding: 0.6rem 0.75rem;
		background: color-mix(in srgb, red 10%, transparent);
		border: 1px solid color-mix(in srgb, red 30%, transparent);
		border-radius: var(--pico-border-radius);
		margin-block-end: 0.25rem;
	}

	.changelog-entry--exempt_pug {
		padding: 0.6rem 0.75rem;
		background: color-mix(in srgb, #0070dd 8%, transparent);
		border: 1px solid color-mix(in srgb, #0070dd 25%, transparent);
		border-radius: var(--pico-border-radius);
		margin-block-end: 0.25rem;
	}

	.changelog-entry__icon {
		font-size: 1.1rem;
		flex-shrink: 0;
		margin-top: 0.1rem;
	}

	.changelog-entry__body {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}

	.changelog-entry__main {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.changelog-entry__raider {
		font-weight: 700;
	}

	.changelog-entry__char {
		font-size: 0.85rem;
	}

	.changelog-entry__desc {
		font-size: 0.9rem;
	}

	.changelog-entry__note {
		font-size: 0.8rem;
	}

	.changelog-entry__date {
		font-size: 0.75rem;
	}

	.muted {
		color: var(--pico-muted-color);
	}

	@media (max-width: 640px) {
		.changelog-entry {
			padding: 0.5rem 0;
		}

		.changelog-entry--blocking_pug,
		.changelog-entry--exempt_pug {
			padding: 0.65rem 0.75rem;
		}
	}
</style>
