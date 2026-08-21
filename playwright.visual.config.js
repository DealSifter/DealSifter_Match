/* global process */
import { defineConfig, devices } from '@playwright/test';
import { assertSafeE2EEnvironment } from './e2e/support/environment.js';

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:4180';
assertSafeE2EEnvironment({ baseURL, destructive: true });

export default defineConfig({
  testDir: './e2e/tests/baseline',
  testMatch: '**/*.visual.spec.js',
  timeout: 300_000,
  expect: {
    timeout: 20_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.015,
      scale: 'css',
    },
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    colorScheme: 'light',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'desktop-baseline',
      use: { viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-baseline',
      use: { ...devices['Pixel 5'] },
    },
  ],
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
});
