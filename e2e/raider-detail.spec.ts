import { test, expect } from '@playwright/test';

// Howlsome UUID
const HOWLSOME = 'a3f1c2d4-7e89-4b0a-bc34-1f2e3d4c5b6a';
// Aetheryn UUID (healer, missed latest week)
const AETHERYN  = 'b4c2d1e3-8f90-5c1b-cd45-2g3f4e5d6c7b';
// Shadowbane UUID (alt, has inactive character)
const SHADOWBANE = 'c5d3e2f1-9a01-6d2c-de56-3h4g5f6e7d8c';

test.describe('Raider detail — Howlsome', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto(`/raider/${HOWLSOME}`);
	});

	test('renders identity header with display name', async ({ page }) => {
		await expect(page.locator('h1:has-text("Howlsome")')).toBeVisible();
	});

	test('shows class and spec', async ({ page }) => {
		await expect(page.locator('body')).toContainText('Unholy');
		await expect(page.locator('body')).toContainText('DeathKnight');
	});

	test('shows RIO score badge', async ({ page }) => {
		await expect(page.locator('body')).toContainText('3,241');
	});

	test('shows "On track" status badge', async ({ page }) => {
		await expect(page.locator('.status-badge--met')).toBeVisible();
	});

	test('shows team designation badge (Main)', async ({ page }) => {
		const mainBadge = page.locator('.designation-badge--main');
		await expect(mainBadge).toBeVisible();
	});

	test('streak hero block is visible with streak count', async ({ page }) => {
		// Howlsome has streak=4 and ≥3 → should show 🔥
		await expect(page.locator('.streak-hero')).toBeVisible();
		await expect(page.locator('body')).toContainText('🔥');
	});

	test('streak count shows 4', async ({ page }) => {
		await expect(page.locator('.streak-count')).toContainText('4');
	});

	test('dungeon volume panel is visible', async ({ page }) => {
		await expect(page.locator('.dungeon-volume')).toBeVisible();
	});

	test('highest key shown in +N notation', async ({ page }) => {
		await expect(page.locator('body')).toContainText('+14');
	});

	test('record week highlighted (gold styling)', async ({ page }) => {
		await expect(page.locator('.vol-card--gold').first()).toBeVisible();
	});

	test('compliance history table present', async ({ page }) => {
		await expect(page.locator('.compliance-history')).toBeVisible();
	});

	test('compliance table contains met week (✅)', async ({ page }) => {
		await expect(page.locator('text=✅').first()).toBeVisible();
	});

	test('compliance table contains missed week (❌)', async ({ page }) => {
		await expect(page.locator('text=❌').first()).toBeVisible();
	});

	test('active character section is expanded (open attribute)', async ({ page }) => {
		const activeSection = page.locator('.char-section[open]').first();
		await expect(activeSection).toBeVisible();
	});

	test('at least one boss parse card is rendered', async ({ page }) => {
		await expect(page.locator('.boss-card').first()).toBeVisible();
	});

	test('boss parse card shows boss name', async ({ page }) => {
		await expect(page.locator('body')).toContainText('Solanar the Dawnbreaker');
	});

	test('Resilience panel is present', async ({ page }) => {
		await expect(page.locator('.resilience-panel')).toBeVisible();
	});

	test('Resilience level 13 shown in gold', async ({ page }) => {
		await expect(page.locator('.level--achieved')).toBeVisible();
		await expect(page.locator('body')).toContainText('Resilience 13');
	});

	test('back link navigates to dashboard', async ({ page }) => {
		await expect(page.locator('a.back-link')).toBeVisible();
	});

	test('main designation badge is below display name', async ({ page }) => {
		const header = page.locator('.raider-header');
		await expect(header.locator('.designation-badge--main')).toBeVisible();
	});
});

test.describe('Raider detail — Aetheryn (missed latest week)', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto(`/raider/${AETHERYN}`);
	});

	test('shows missed-week callout', async ({ page }) => {
		await expect(page.locator('[role="alert"]')).toBeVisible();
	});

	test('shows "Below target" status badge', async ({ page }) => {
		await expect(page.locator('.status-badge--missed')).toBeVisible();
	});

	test('Resilience "Not yet achieved" shown in grey', async ({ page }) => {
		await expect(page.locator('.level--none')).toBeVisible();
	});
});

test.describe('Raider detail — Shadowbane (alt, has inactive character)', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto(`/raider/${SHADOWBANE}`);
	});

	test('shows alt designation badge', async ({ page }) => {
		await expect(page.locator('.designation-badge--alt')).toBeVisible();
	});

	test('has an inactive character section (collapsed)', async ({ page }) => {
		const inactiveSections = page.locator('.char-section:not([open])');
		await expect(inactiveSections.first()).toBeVisible();
	});

	test('inactive section header shows character name without expanding', async ({ page }) => {
		const summary = page.locator('.char-section:not([open]) summary').first();
		await expect(summary).toBeVisible();
		// Should contain 'Voidclaw' (the inactive character)
		await expect(summary).toContainText('Voidclaw');
	});
});
