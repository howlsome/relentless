<script lang="ts">
	import { onMount } from 'svelte';

	/** Current stored preference: 'light' | 'dark' | 'auto' */
	let theme = $state<'light' | 'dark' | 'auto'>('auto');

	onMount(() => {
		const stored = localStorage.getItem('theme');
		if (stored === 'light' || stored === 'dark') {
			// Explicit user preference stored
			theme = stored;
		} else {
			// No stored preference — read the OS setting so the icon is correct
			theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
		}
	});

	/** Effective theme, with a safe SSR fallback of 'light'. */
	function effectiveTheme(): 'light' | 'dark' {
		if (typeof window === 'undefined') return 'light';
		if (theme === 'auto') {
			return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
		}
		return theme;
	}

	function toggle() {
		const next: 'light' | 'dark' = effectiveTheme() === 'dark' ? 'light' : 'dark';
		theme = next;
		document.documentElement.setAttribute('data-theme', next);
		localStorage.setItem('theme', next);
	}

	const ariaLabel = $derived(
		effectiveTheme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
	);

	const isDark = $derived(effectiveTheme() === 'dark');
</script>

<button
	class="theme-toggle"
	onclick={toggle}
	aria-label={ariaLabel}
	title={ariaLabel}
	type="button"
>
	{#if isDark}
		<!-- Sun icon (shown in dark mode — click to go light) -->
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
			focusable="false"
		>
			<circle cx="12" cy="12" r="5" />
			<line x1="12" y1="1" x2="12" y2="3" />
			<line x1="12" y1="21" x2="12" y2="23" />
			<line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
			<line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
			<line x1="1" y1="12" x2="3" y2="12" />
			<line x1="21" y1="12" x2="23" y2="12" />
			<line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
			<line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
		</svg>
	{:else}
		<!-- Moon icon (shown in light/auto mode — click to go dark) -->
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
			focusable="false"
		>
			<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
		</svg>
	{/if}
</button>
