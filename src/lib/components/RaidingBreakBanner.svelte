<script lang="ts">
	let {
		message,
		note,
	}: {
		message: string;
		note?: string | null;
	} = $props();
</script>

<section data-raiding-break-banner aria-label="Raiding break notice" class="raiding-break-banner">
	<p>
		⏸️ {message}
		{#if note}
			<span class="raiding-break-banner__note">{note}</span>
		{/if}
	</p>
</section>

<style>
	.raiding-break-banner {
		background: color-mix(in srgb, orange 8%, var(--pico-card-background-color));
		border: 1px solid color-mix(in srgb, orange 40%, transparent);
		border-radius: var(--pico-border-radius);
		padding: var(--pico-spacing);
		margin-block-end: var(--pico-spacing);
	}

	.raiding-break-banner p {
		margin: 0;
	}

	.raiding-break-banner__note {
		display: block;
		font-size: 0.85rem;
		color: var(--pico-muted-color);
	}
</style>
