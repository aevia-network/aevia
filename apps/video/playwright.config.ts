import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the Aevia video PWA.
 *
 * Assumes the dev server is started externally (`pnpm -C apps/video dev`)
 * and reuses it locally; CI should set `PLAYWRIGHT_BASE_URL` to the preview
 * URL of the Cloudflare Pages deployment instead.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],

  webServer: process.env.CI
    ? undefined
    : {
        command: 'pnpm dev',
        url: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
