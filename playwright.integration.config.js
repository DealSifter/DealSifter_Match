/* global process */
import { defineConfig, devices } from '@playwright/test';
import { assertSafeRealBackendEnvironment } from './e2e/support/environment.js';

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:4181';
const isCI = Boolean(process.env.CI);

assertSafeRealBackendEnvironment({ baseURL });

export default defineConfig({
  testDir: './e2e/tests/integration',
  timeout: 180_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: isCI,
  retries: 0,
  workers: 1,
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium-real-backend',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
