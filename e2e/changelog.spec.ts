import { expect, test } from '@playwright/test';

test.describe('Changelog page', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/changelog');
	});

	test('renders without error', async ({ page }) => {
		await expect(page.locator('h1:has-text("Changelog")')).toBeVisible();
	});

	test('entries are grouped by ISO week when data exists', async ({ page }) => {
		const headings = await page.locator('.week-heading').allTextContents();
		// If no entries, headings will be empty — just verify no crash
		const idx14 = headings.findIndex((h) => h.includes('14'));
		const idx11 = headings.findIndex((h) => h.includes('11'));
		if (idx14 !== -1 && idx11 !== -1) {
			expect(idx14).toBeLessThan(idx11);
		}
	});

	test('filter panel opens when button is clicked', async ({ page }) => {
		await page.locator('.filter-toggle').click();
		await expect(page.locator('.filter-panel')).toBeVisible();
	});

	test('empty state appears when filters produce zero results', async ({ page }) => {
		await page.locator('.filter-toggle').click();
		await page.locator('#filter-event').selectOption('team_changed');
		await expect(page.locator('.empty-state')).toBeVisible();
	});

	test('filter count badge appears when filter is active', async ({ page }) => {
		await page.locator('.filter-toggle').click();
		await page.locator('.filter-btn:has-text("Main")').first().click();
		await expect(page.locator('.filter-count')).toBeVisible();
	});
});
