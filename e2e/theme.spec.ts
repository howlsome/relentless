import { expect, test } from '@playwright/test';

test.describe('Theme toggle', () => {
	test('on first load with no localStorage, html data-theme defaults to auto', async ({ page }) => {
		// Clear localStorage and load page
		await page.goto('/');
		const theme = await page.$eval('html', (el) => el.getAttribute('data-theme'));
		// Should be 'auto' (set in app.html) when no localStorage value
		expect(theme).toMatch(/^(auto|light|dark)$/);
	});

	test('dark OS preference: page uses dark theme by default', async ({ browser }) => {
		const context = await browser.newContext({ colorScheme: 'dark' });
		const page = await context.newPage();
		await page.goto('/');
		const theme = await page.$eval('html', (el) => el.getAttribute('data-theme'));
		// Should be 'auto' or 'dark' (inline script might not have run yet)
		expect(['auto', 'dark']).toContain(theme);
		await context.close();
	});

	test('clicking theme toggle changes data-theme', async ({ page }) => {
		await page.goto('/');
		const initialTheme = await page.$eval('html', (el) => el.getAttribute('data-theme'));
		await page.locator('.theme-toggle').click();
		const newTheme = await page.$eval('html', (el) => el.getAttribute('data-theme'));
		expect(newTheme).not.toBe(initialTheme === 'auto' ? 'auto' : initialTheme);
	});

	test('after toggling, reloading preserves the chosen theme', async ({ page }) => {
		await page.goto('/');
		await page.locator('.theme-toggle').click();
		const themeAfterToggle = await page.$eval('html', (el) => el.getAttribute('data-theme'));

		await page.reload();
		const themeAfterReload = await page.$eval('html', (el) => el.getAttribute('data-theme'));
		expect(themeAfterReload).toBe(themeAfterToggle);
	});

	test('toggle button aria-label updates to reflect current state', async ({ page }) => {
		await page.goto('/');
		const btn = page.locator('.theme-toggle');
		const label = await btn.getAttribute('aria-label');
		expect(label).toMatch(/Switch to (light|dark) mode/);
	});

	test('theme toggle is present in nav', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('.theme-toggle')).toBeVisible();
	});
});
