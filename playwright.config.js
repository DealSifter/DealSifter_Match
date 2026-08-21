/* global process */
import { defineConfig, devices } from '@playwright/test';
import { assertSafeE2EEnvironment } from './e2e/support/environment.js';

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:4180';
const isCI = Boolean(process.env.CI);

assertSafeE2EEnvironment({ baseURL, destructive: true });

export default defineConfig({
  testDir: './e2e/tests/mocked',
  timeout: 150_000,
  expect: {
    timeout: 7_500,
  },
  fullyParallel: false,
  forbidOnly: isCI,
  retries: 0,
  workers: isCI ? 1 : 1,
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
