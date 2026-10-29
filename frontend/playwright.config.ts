import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests run against the real stack: start the backend first (scripts/start-all.ps1), then `npm run e2e`.
 * The dev server is started for you unless E2E_BASE_URL points at one that is already running.
 * They use the demo users, and every test files its own claim, so they can be re-run without restarting.
 */
const baseURL = process.env['E2E_BASE_URL'];

export default defineConfig({
  testDir: './e2e',
  // One backend, shared data: keep the tests in order rather than racing each other.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  // Several stories sign in as three people and take six steps; on a busy machine the 30-second default is too close.
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: baseURL ?? 'http://localhost:4200',
    // Uses the Edge/Chrome already installed, so no browser download is needed.
    channel: process.env['E2E_BROWSER'] ?? 'msedge',
    locale: 'en-GB',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: baseURL
    ? undefined
    : {
        command: 'npm start',
        url: 'http://localhost:4200',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
