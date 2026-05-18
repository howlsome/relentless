import { expect, test } from '@playwright/test';
import { FIXTURES } from './fixtures/raiders.js';

// Real raider UUID — used as a live smoke test for an active player
const HOWL = 'ad297730-db58-4d5d-87d9-2774ba988f2b';

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

// ── Role fixture tests — one per role, using stable WoW lore characters ─────
// These target inactive fixture entries in roster.json and will never change.

for (const [roleKey, fixture] of Object.entries(FIXTURES)) {
	test.describe(`Fixture raider — ${fixture.displayName} (${roleKey})`, () => {
		test.beforeEach(async ({ page }) => {
			await page.goto(`/raider/${fixture.uuid}`);
		});

		test('renders display name', async ({ page }) => {
			await expect(page.locator('h1')).toContainText(fixture.displayName);
		});

		test('shows class', async ({ page }) => {
			await expect(page.locator('body')).toContainText(fixture.charClass);
		});

		test('shows spec', async ({ page }) => {
			await expect(page.locator('body')).toContainText(fixture.spec);
		});

		test('role icon has correct aria-label', async ({ page }) => {
			await expect(
				page.locator(`.role-icon[aria-label="${fixture.roleLabel}"]`).first(),
			).toBeVisible();
		});

		test('page does not crash or show undefined', async ({ page }) => {
			await expect(page.locator('body')).not.toContainText('undefined');
		});
	});
}
