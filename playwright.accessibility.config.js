/* global process */
import { defineConfig, devices } from '@playwright/test';
import { assertSafeE2EEnvironment } from './e2e/support/environment.js';

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:4180';
assertSafeE2EEnvironment({ baseURL, destructive: true });

export default defineConfig({
  testDir: './e2e/tests/readiness',
  testMatch: '**/*.accessibility.spec.js',
  timeout: 150_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    reducedMotion: 'reduce',
  },
});
