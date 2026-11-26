import { defineConfig, devices } from '@playwright/test';

/**
 * Browser suites (Prompt 17): tests/e2e (exact numbers and an axe scan per calculator) and tests/visual (screenshots).
 *
 *   npm run build && npm run e2e         every project below
 *   npm run e2e -- --project=chromium    one browser
 *   npm run visual                       screenshots, Chromium only (see tests/visual)
 *   E2E_BASE_URL=https://<preview>.pages.dev npm run e2e     against a deployed preview instead of the local build
 *
 * Chromium runs on the Google Chrome already installed (channel "chrome"), so it needs no download. Firefox, WebKit and
 * mobile Safari are Playwright's own builds: run `npx playwright install firefox webkit` once before using those projects.
 */
const remote = process.env.E2E_BASE_URL;
const channel = process.env.E2E_CHANNEL ?? 'chrome';

export default defineConfig({
  testDir: 'tests',
  testMatch: ['e2e/**/*.spec.ts', 'visual/**/*.spec.ts'],
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: remote ?? 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    reducedMotion: 'reduce',
  },
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' } },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], channel } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 13'] } },
  ],
  webServer: remote ? undefined : { command: 'node scripts/serve-dist.mjs 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: true, timeout: 30_000 },
});
