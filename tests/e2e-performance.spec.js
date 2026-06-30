// @ts-check
import { test, expect } from '@playwright/test';

test.describe('E2E flow and performance budget', () => {
  test('navigates to docs and shows installation heading', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/X Testing/);

    await page.getByRole('link', { name: 'Get started' }).click();
    await expect(page.getByRole('heading', { name: 'Installation' })).toBeVisible();
  });

  test('meets baseline navigation timing thresholds', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');

    const metrics = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const paintEntries = performance.getEntriesByType('paint');
      const firstContentfulPaint = paintEntries.find((entry) => entry.name === 'first-contentful-paint');

      return {
        domContentLoaded: nav ? nav.domContentLoadedEventEnd : null,
        loadEventEnd: nav ? nav.loadEventEnd : null,
        firstContentfulPaint: firstContentfulPaint ? firstContentfulPaint.startTime : null,
      };
    });

    expect(metrics.domContentLoaded, 'domContentLoaded should be captured').not.toBeNull();
    expect(metrics.loadEventEnd, 'loadEventEnd should be captured').not.toBeNull();

    expect(metrics.domContentLoaded).toBeLessThan(2500);
    expect(metrics.loadEventEnd).toBeLessThan(4000);

    if (metrics.firstContentfulPaint !== null) {
      expect(metrics.firstContentfulPaint).toBeLessThan(2500);
    }
  });
});
