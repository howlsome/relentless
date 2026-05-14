<script lang="ts">
	import { browser } from '$app/environment';

	interface LockoutWarning {
		boss_id: number;
		boss_name: string;
		difficulty: string;
		kill_time: string;
		detected_local_time: string;
		reason: string;
		prior_blocks_last_4_weeks: number;
	}

	interface RaiderWithWarnings {
		raider_id: string;
		display_name: string;
		lockout_warnings: LockoutWarning[];
	}

	let { raiders }: { raiders: RaiderWithWarnings[] } = $props();

	const STORAGE_KEY = 'lockout-banner-dismissed';

	const blockingRaiders = $derived(raiders.filter((r) => r.lockout_warnings?.length > 0));
	const count = $derived(blockingRaiders.length);

	let dismissed = $state(browser ? !!sessionStorage.getItem(STORAGE_KEY) : false);
	let expanded = $state(false);

	function dismiss() {
		dismissed = true;
		if (browser) sessionStorage.setItem(STORAGE_KEY, '1');
	}
</script>

{#if count > 0 && !dismissed}
	<section
		data-lockout-banner
		aria-label="Progression-blocking pugs this week"
		class="lockout-banner lockout-banner--blocking"
	>
		<div class="lockout-banner__header">
			<button
				type="button"
				aria-expanded={expanded}
				aria-label="Toggle progression-blocking pug details"
				onclick={() => (expanded = !expanded)}
				class="lockout-banner__toggle"
			>
				🚨 {count} {count === 1 ? 'raider has' : 'raiders have'} killed Mythic bosses outside team
				raid times in a way that blocks Relentless progression this week. Officers should review
				immediately.
			</button>
			<button
				type="button"
				onclick={dismiss}
				class="lockout-banner__dismiss"
				aria-label="Dismiss progression-blocking warning"
			>
				Dismiss
			</button>
		</div>

		{#if expanded}
			<ul class="lockout-banner__list" role="list">
				{#each blockingRaiders as raider}
					{#each raider.lockout_warnings as warning}
						<li class="lockout-banner__item">
							<a href="/raider/{raider.raider_id}">{raider.display_name}</a>
							— {warning.boss_name} (Mythic) — killed {warning.detected_local_time}
						</li>
					{/each}
				{/each}
			</ul>
		{/if}
	</section>
{/if}

<style>
	.lockout-banner--blocking {
		background: var(--pico-del-color, #d9534f);
		color: #fff;
		padding: var(--pico-spacing, 1rem);
		border-radius: var(--pico-border-radius, 4px);
		margin-block-end: var(--pico-spacing, 1rem);
	}

	.lockout-banner__header {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.lockout-banner__toggle {
		background: none;
		border: none;
		color: inherit;
		cursor: pointer;
		font: inherit;
		text-align: left;
		flex: 1;
		padding: 0;
	}

	.lockout-banner__dismiss {
		background: rgba(255 255 255 / 0.2);
		border: 1px solid rgba(255 255 255 / 0.5);
		color: inherit;
		cursor: pointer;
		font: inherit;
		padding: 0.25rem 0.75rem;
		border-radius: 4px;
		white-space: nowrap;
	}

	.lockout-banner__list {
		margin-block-start: 0.75rem;
		padding-inline-start: 1.5rem;
	}

	.lockout-banner__item {
		margin-block-end: 0.25rem;
	}

	.lockout-banner__item a {
		color: inherit;
		font-weight: bold;
	}
</style>
