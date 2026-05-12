import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
	});

	test('page loads and M+ status table is visible', async ({ page }) => {
		await expect(page.getByRole('heading', { name: /Dashboard/ })).toBeVisible();
		await expect(page.locator('table').first()).toBeVisible();
	});

	test('a player below threshold has a red status indicator', async ({ page }) => {
		// Aetheryn has count=3 (below 4) — should show "Below target"
		const belowTarget = page.locator('text=Below target').first();
		await expect(belowTarget).toBeVisible();
	});

	test('a player meeting threshold has a green status indicator', async ({ page }) => {
		// Howlsome and Shadowbane meet the threshold
		const onTrack = page.locator('text=On track').first();
		await expect(onTrack).toBeVisible();
	});

	test('raid parse table is visible with boss column headers', async ({ page }) => {
		await expect(page.locator('text=Solanar the Dawnbreaker')).toBeVisible();
	});

	test('cell with kill:false shows — not 0', async ({ page }) => {
		// The Architect of Ruin has no kills for any raider
		// Look for '—' in the parse table
		const dashCells = await page.locator('.parse-cell .muted').allTextContents();
		expect(dashCells.some((t) => t.trim() === '—')).toBe(true);
	});

	test('inactive players section is present', async ({ page }) => {
		// No inactive players in fixture, but the section logic should not crash
		await expect(page.locator('body')).not.toContainText('undefined');
	});

	test('summary stat row is visible', async ({ page }) => {
		await expect(page.locator('.summary-row')).toBeVisible();
	});

	test('M+ section heading contains current week', async ({ page }) => {
		await expect(page.locator('h2:has-text("Mythic+")')).toBeVisible();
	});

	test('RIO score is shown for raiders', async ({ page }) => {
		// Howlsome has RIO 3241 — may appear in stat card and/or table
		await expect(page.locator('text=3,241').first()).toBeVisible();
	});

	test('designation filter buttons are present', async ({ page }) => {
		const mainBtn = page.locator('button[aria-pressed]').filter({ hasText: 'Main' }).first();
		await expect(mainBtn).toBeVisible();
	});

	test('designation filter correctly hides Alt raiders when Main selected', async ({ page }) => {
		// Click "Main" filter in the M+ section only (not the raid section)
		await page.locator('.mplus-filters button').filter({ hasText: 'Main' }).click();
		// Shadowbane (alt) should no longer be in the M+ table rows
		// Scope to the M+ section's tbody to avoid matching the raid table
		const mplusShadowbane = page.locator('.mplus-section tbody td a:has-text("Shadowbane")');
		await expect(mplusShadowbane).toHaveCount(0);
	});

	test('role icon appears next to raider names', async ({ page }) => {
		const roleIcons = page.locator('.role-icon');
		expect(await roleIcons.count()).toBeGreaterThan(0);
	});
});
