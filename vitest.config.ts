import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

/**
 * Dedicated Vitest config for unit + component tests.
 * Uses @sveltejs/vite-plugin-svelte directly (not SvelteKit) so that the
 * `browser` export condition is honoured — resolving Svelte to its client
 * bundle instead of the SSR bundle.
 */
export default defineConfig({
	plugins: [svelte({ hot: false })],
	resolve: {
		conditions: ['browser', 'import', 'module', 'default'],
		alias: {
			$lib: resolve('./src/lib'),
			'$lib/types': resolve('./src/lib/types'),
			'$lib/utils': resolve('./src/lib/utils'),
			'$lib/components': resolve('./src/lib/components'),
			'$lib/styles': resolve('./src/lib/styles'),
			'$app/environment': resolve('./src/lib/__mocks__/app-environment.ts'),
			'$app/stores': resolve('./src/lib/__mocks__/app-stores.ts')
		}
	},
	test: {
		include: ['src/**/*.test.ts', 'src/**/*.test.js'],
		exclude: ['e2e/**'],
		environment: 'jsdom',
		setupFiles: ['./src/test-setup.ts'],
		globals: true
	}
});
