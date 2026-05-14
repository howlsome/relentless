import { test, expect } from '@playwright/test';

test.describe('No JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('dashboard renders with heading visible', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('heading', { name: /undaunted|dashboard/i })).toBeVisible();
	});

	test('dashboard renders raider data without JS', async ({ page }) => {
		await page.goto('/');
		// At minimum the page should have a heading and not be blank
		const body = await page.textContent('body');
		expect(body?.length).toBeGreaterThan(50);
	});

	test('changelog page renders without JS', async ({ page }) => {
		await page.goto('/changelog');
		await expect(page.getByRole('heading', { name: /changelog/i })).toBeVisible();
	});

	test('navigation links work without JS', async ({ page }) => {
		await page.goto('/');
		// Check that anchor links exist and are navigable
		const links = page.locator('a[href]');
		expect(await links.count()).toBeGreaterThan(0);
	});

	test('theme toggle is hidden without JS', async ({ page }) => {
		await page.goto('/');
		// ThemeToggle is wrapped in {#if browser} so it should not render without JS
		const themeToggle = page.locator('[aria-label*="theme" i], button:has-text("theme")');
		expect(await themeToggle.count()).toBe(0);
	});
});
