<script lang="ts">
	let {
		message,
		resumes,
	}: {
		message: string;
		resumes?: string | null;
	} = $props();
</script>

<section data-raiding-break-banner aria-label="Raiding break notice" class="raiding-break-banner">
	<p>
		⏸️ {message}
		{#if resumes}
			<span class="raiding-break-banner__resumes">Tracking resumes when {resumes} begins.</span>
		{/if}
	</p>
</section>

<style>
	.raiding-break-banner {
		background: var(--pico-mark-background-color);
		color: var(--pico-mark-color);
		padding: var(--pico-spacing, 1rem);
		border-radius: var(--pico-border-radius, 4px);
		margin-block-end: var(--pico-spacing, 1rem);
	}

	.raiding-break-banner p {
		margin: 0;
	}

	.raiding-break-banner__resumes {
		display: block;
		font-size: 0.85rem;
		opacity: 0.85;
	}
</style>
