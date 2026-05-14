<script lang="ts">
	interface LockoutWarning {
		boss_id: number;
		boss_name: string;
		difficulty: string;
		kill_time: string;
		detected_local_time: string;
		reason: string;
		prior_blocks_last_4_weeks: number;
	}

	interface SafePugKill {
		boss_id: number;
		boss_name: string;
		difficulty: string;
		kill_time: string;
		detected_local_time: string;
	}

	interface ExemptPugKill {
		boss_id: number;
		boss_name: string;
		difficulty: string;
		kill_time: string;
		detected_local_time: string;
		exemption_reason: string;
		exemption_granted_by: string;
	}

	interface RaiderLike {
		raider_id: string;
		display_name: string;
		lockout_warnings?: LockoutWarning[];
		safe_pug_kills?: SafePugKill[];
		exempt_pug_kills?: ExemptPugKill[];
	}

	let { raider }: { raider: RaiderLike } = $props();

	const warnings = $derived(raider.lockout_warnings ?? []);
	const safePugs = $derived(raider.safe_pug_kills ?? []);
	const exemptPugs = $derived(raider.exempt_pug_kills ?? []);

	const maxPriorBlocks = $derived(
		warnings.reduce((max, w) => Math.max(max, w.prior_blocks_last_4_weeks ?? 0), 0),
	);

	function buildOfficerReviewSnippet(warning: LockoutWarning): string {
		return JSON.stringify(
			{
				week: '« fill in ISO week »',
				boss: warning.boss_name,
				kill_time_server: warning.detected_local_time,
				officer_review: '« notes »',
				reviewed_by: '« your name »',
				reviewed_at: new Date().toISOString().slice(0, 10),
			},
			null,
			2,
		);
	}

	function buildExemptionSnippet(warning: LockoutWarning): string {
		return JSON.stringify(
			{
				week: '« fill in ISO week »',
				raid_nights_excused: ['monday', 'wednesday'],
				reason: '« reason »',
				granted_by: '« your name »',
				granted_at: new Date().toISOString(),
			},
			null,
			2,
		);
	}

	async function copyToClipboard(text: string) {
		try {
			await navigator.clipboard.writeText(text);
		} catch {
			// Fallback for test/non-secure environments
		}
	}
</script>

{#if warnings.length > 0}
	<section
		data-blocking-callout
		data-testid="blocking-callout"
		class="lockout-callout lockout-callout--blocking"
		aria-label="Progression-blocking pug callout"
	>
		<h3>🚨 Progression-blocking pug this reset</h3>
		<p>
			This raider killed Mythic boss(es) outside team raid times without permission, locking them
			out of upcoming Relentless raid nights. This directly damages team progression and is a
			serious issue that officers should address with the raider:
		</p>
		<ul>
			{#each warnings as warning}
				<li>
					<strong>{warning.boss_name}</strong> — killed {warning.detected_local_time}
				</li>
			{/each}
		</ul>

		{#if maxPriorBlocks >= 1}
			<p class="lockout-callout__escalation">
				Prior progression-blocking pugs in the last 4 weeks: {maxPriorBlocks}.
				Repeated progression-blocking pugs can result in removal from the raid team.
			</p>
		{/if}

		<div class="lockout-callout__actions">
			{#each warnings as warning}
				<button
					type="button"
					onclick={() => copyToClipboard(buildOfficerReviewSnippet(warning))}
					class="lockout-callout__action-btn"
				>
					Log officer review
				</button>
				<button
					type="button"
					onclick={() => copyToClipboard(buildExemptionSnippet(warning))}
					class="lockout-callout__action-btn"
				>
					Add retrospective exemption
				</button>
			{/each}
		</div>
	</section>
{/if}

{#if exemptPugs.length > 0}
	<section
		data-exempt-callout
		data-testid="exempt-callout"
		class="lockout-callout lockout-callout--exempt"
		aria-label="Exempt pug callout"
	>
		<h3>ℹ️ Exempt pugs this reset</h3>
		<p>
			This raider has kills covered by an officer-granted exemption:
		</p>
		<ul>
			{#each exemptPugs as kill}
				<li>
					<strong>{kill.boss_name}</strong> — killed {kill.detected_local_time}
					<br />
					<span class="muted">
						Exemption by {kill.exemption_granted_by}: {kill.exemption_reason}
					</span>
				</li>
			{/each}
		</ul>
	</section>
{/if}

{#if safePugs.length > 0}
	<section
		data-safe-pug-callout
		data-testid="safe-pug-callout"
		class="lockout-callout lockout-callout--safe"
		aria-label="Safe pug callout"
	>
		<h3>🌱 Progress pugging this week</h3>
		<p>
			This raider pugged the following Mythic boss(es) in a safe window — they showed initiative
			without affecting team plans:
		</p>
		<ul>
			{#each safePugs as kill}
				<li>
					<strong>{kill.boss_name}</strong> — killed {kill.detected_local_time}
				</li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	.lockout-callout {
		padding: var(--pico-spacing, 1rem);
		border-radius: var(--pico-border-radius, 4px);
		margin-block-end: var(--pico-spacing, 1rem);
		border-inline-start: 4px solid transparent;
	}

	.lockout-callout--blocking {
		background: color-mix(in srgb, #d9534f 15%, transparent);
		border-color: #d9534f;
	}

	.lockout-callout--exempt {
		background: color-mix(in srgb, #888 10%, transparent);
		border-color: #888;
	}

	.lockout-callout--safe {
		background: color-mix(in srgb, #3a7d44 10%, transparent);
		border-color: #3a7d44;
	}

	.lockout-callout__escalation {
		font-weight: bold;
		margin-block-start: 0.75rem;
	}

	.lockout-callout__actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin-block-start: 0.75rem;
	}

	.lockout-callout__action-btn {
		font-size: 0.875rem;
	}
</style>
