// @ts-check
import { defineConfig, devices } from '@playwright/test';

const hasExternalTarget = !!process.env.TARGET_URL;
const baseURL = process.env.TARGET_URL || 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  expect: {
    timeout: 5000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: hasExternalTarget
    ? undefined
    : {
        command: 'node scripts/serve-static.js',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
      },
});
