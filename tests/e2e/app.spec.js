import { expect, test } from '@playwright/test';

test('loads the interactive testing dashboard', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'X Testing Dashboard' })).toBeVisible();
  await expect(page.getByText('End-to-end testing coverage')).toBeVisible();
  await expect(page.getByText('Risk register')).toBeVisible();
});

test('updates readiness score when scenarios are completed', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#score-value')).toHaveText('0%');
  await page.getByLabel(/happy-path user journey/i).check();
  await expect(page.locator('#score-value')).toHaveText('20%');
});

test('persists notes and generates a safe text report', async ({ page }) => {
  await page.goto('/');

  await page.getByPlaceholder(/Add release risks/i).fill('<script>alert("x")</script> Needs review');
  await page.getByRole('button', { name: 'Generate report' }).click();

  await expect(page.locator('#report-output')).toContainText('Needs review');
  await expect(page.locator('#report-output')).toContainText('<script>alert("x")</script>');

  await page.reload();
  await expect(page.getByPlaceholder(/Add release risks/i)).toHaveValue('<script>alert("x")</script> Needs review');
});

test('supports theme switching', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Toggle theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
