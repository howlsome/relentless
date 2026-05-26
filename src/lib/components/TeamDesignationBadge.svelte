<script lang="ts">
	import type { TeamDesignation } from '$lib/types/roster.js';

	let { designation }: { designation: TeamDesignation } = $props();
</script>

<span
	class="designation-badge designation-badge--{designation}"
	aria-label={designation === 'main' ? 'Main team' : 'Alt team'}
>
	<span class="badge-full">{designation === 'main' ? 'Main' : 'Alt'}</span>
	<span class="badge-short">{designation === 'main' ? 'M' : 'A'}</span>
</span>
