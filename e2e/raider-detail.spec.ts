import { expect, test } from '@playwright/test';

// Real raider UUIDs from roster.json
const HOWL = 'ad297730-db58-4d5d-87d9-2774ba988f2b';
const RAEM = '6b6181f7-636d-4614-b37f-be5231d540af';

test.describe('Raider detail — Howl', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto(`/raider/${HOWL}`);
	});

	test('renders identity header with display name', async ({ page }) => {
		await expect(page.locator('h1')).toContainText('Howl');
	});

	test('shows class and spec', async ({ page }) => {
		await expect(page.locator('body')).toContainText('Elemental');
		await expect(page.locator('body')).toContainText('Shaman');
	});

	test('shows team designation badge (Main)', async ({ page }) => {
		await expect(page.locator('.designation-badge--main')).toBeVisible();
	});

	test('active character section is expanded', async ({ page }) => {
		const activeSection = page.locator('.char-wrapper[open]').first();
		await expect(activeSection).toBeVisible();
	});

	test('back link is present in nav (desktop) or page (mobile)', async ({ page }) => {
		// On desktop ≥640px the .nav-back appears in header; .back-link is hidden
		const navBack = page.locator('.nav-back');
		const backLink = page.locator('a.back-link');
		const either = (await navBack.count()) + (await backLink.count());
		expect(either).toBeGreaterThan(0);
	});

	test('membership status is shown', async ({ page }) => {
		await expect(page.locator('.membership-status')).toBeVisible();
	});

	test('RIO score badge is rendered', async ({ page }) => {
		await expect(page.locator('.rio-badge')).toBeVisible();
	});

	test('streak hero block is visible', async ({ page }) => {
		await expect(page.locator('.streak-hero')).toBeVisible();
	});

	test('dungeon volume panel is visible', async ({ page }) => {
		await expect(page.locator('.dungeon-volume')).toBeVisible();
	});

	test('compliance history section is visible', async ({ page }) => {
		await expect(page.locator('.compliance-history')).toBeVisible();
	});

	test('page does not crash or show undefined', async ({ page }) => {
		await expect(page.locator('body')).not.toContainText('undefined');
	});

	test('role icon is rendered in the raider header', async ({ page }) => {
		await expect(page.locator('.raider-header .role-icon').first()).toBeVisible();
	});

	test('main designation badge is inside raider header', async ({ page }) => {
		const header = page.locator('.raider-header');
		await expect(header.locator('.designation-badge--main')).toBeVisible();
	});
});

test.describe('Raider detail — Raem (tank)', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto(`/raider/${RAEM}`);
	});

	test('renders identity header with display name', async ({ page }) => {
		await expect(page.locator('h1')).toContainText('Raem');
	});

	test('shows tank class', async ({ page }) => {
		await expect(page.locator('body')).toContainText('Blood');
		await expect(page.locator('body')).toContainText('DeathKnight');
	});
});
