<script lang="ts">
	interface SafePugKill {
		boss_id: number;
		boss_name: string;
		difficulty: string;
		kill_time: string;
		detected_local_time: string;
	}

	interface RaiderWithSafePugs {
		raider_id: string;
		display_name: string;
		safe_pug_kills: SafePugKill[];
	}

	let { raiders }: { raiders: RaiderWithSafePugs[] } = $props();

	const safePugRaiders = $derived(raiders.filter((r) => r.safe_pug_kills?.length > 0));
	const count = $derived(safePugRaiders.length);

	let expanded = $state(false);
</script>

{#if count > 0}
	<section
		data-safe-pug-banner
		aria-label="Safe pugs this week"
		class="safe-pug-banner"
	>
		<button
			type="button"
			aria-expanded={expanded}
			onclick={() => (expanded = !expanded)}
			class="safe-pug-banner__toggle"
		>
			🌱 {count} {count === 1 ? 'raider has' : 'raiders have'} pugged Mythic on their own time this
			week — showing initiative without affecting team plans.
		</button>

		{#if expanded}
			<ul class="safe-pug-banner__list" role="list">
				{#each safePugRaiders as raider}
					{#each raider.safe_pug_kills as kill}
						<li class="safe-pug-banner__item">
							<a href="/raider/{raider.raider_id}">{raider.display_name}</a>
							— {kill.boss_name} (Mythic) — {kill.detected_local_time}
						</li>
					{/each}
				{/each}
			</ul>
		{/if}
	</section>
{/if}

<style>
	.safe-pug-banner {
		background: var(--pico-ins-color, #3a7d44);
		color: #fff;
		padding: var(--pico-spacing, 1rem);
		border-radius: var(--pico-border-radius, 4px);
		margin-block-end: var(--pico-spacing, 1rem);
	}

	.safe-pug-banner__toggle {
		background: none;
		border: none;
		color: inherit;
		cursor: pointer;
		font: inherit;
		text-align: left;
		width: 100%;
		padding: 0;
	}

	.safe-pug-banner__list {
		margin-block-start: 0.75rem;
		padding-inline-start: 1.5rem;
	}

	.safe-pug-banner__item {
		margin-block-end: 0.25rem;
	}

	.safe-pug-banner__item a {
		color: inherit;
		font-weight: bold;
	}
</style>
