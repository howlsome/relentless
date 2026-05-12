<script lang="ts">
	import type { Role } from '$lib/types/roster.js';

	let { role }: { role: Role } = $props();

	const label = $derived(
		role === 'tank' ? 'Tank' : role === 'healer' ? 'Healer' : 'DPS'
	);
</script>

<span class="role-icon" aria-label={label} title={label} role="img">
	{#if role === 'tank'}
		<!-- Shield -->
		<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
			<path
				d="M12 2L3 6v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V6l-9-4z"
			/>
		</svg>
	{:else if role === 'healer'}
		<!-- Cross / plus -->
		<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
			<path
				d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"
			/>
		</svg>
	{:else}
		<!-- Sword / DPS -->
		<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
			<path
				d="M6.92 5L5 6.92l8.08 8.08-1.08 1.08L10 14.07l-1.41 1.41.92.93-3.54 3.54 1.41 1.41 3.54-3.54.92.92 1.41-1.41-.92-.91 1.08-1.09L19 21l1.92-1.92L6.92 5zM18 3l-3 3 2 2 3-3V3h-2z"
			/>
		</svg>
	{/if}
</span>
