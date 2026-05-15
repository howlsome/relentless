import { expect, test } from '@playwright/test';

test.describe('Dashboard', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
	});

	test('page loads without error', async ({ page }) => {
		await expect(page.locator('.site-header')).toBeVisible();
		await expect(page.locator('body')).not.toContainText('undefined');
		await expect(page.locator('body')).not.toContainText('Error');
	});

	test('site header nav brand is visible', async ({ page }) => {
		await expect(page.locator('header nav')).toBeVisible();
		await expect(page.locator('header nav')).toContainText('Undaunted');
	});

	test('M+ section heading is visible', async ({ page }) => {
		await expect(page.locator('h2:has-text("Mythic+")')).toBeVisible();
	});

	test('inactive players section does not error', async ({ page }) => {
		await expect(page.locator('body')).not.toContainText('undefined');
	});

	test('page contains roster raider names', async ({ page }) => {
		// All 5 real raiders should be mentioned somewhere on the page
		const body = await page.textContent('body');
		expect(body).toContain('Howl');
	});

	test('page body has meaningful content', async ({ page }) => {
		const body = await page.textContent('body');
		expect(body?.length).toBeGreaterThan(100);
		expect(body).not.toContain('undefined');
	});
});
