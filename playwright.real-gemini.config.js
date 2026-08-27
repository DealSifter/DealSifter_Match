/* global process */
import { defineConfig, devices } from '@playwright/test';
import {
  assertRealGeminiEnvironment,
  assertSafeRealBackendEnvironment,
} from './e2e/support/environment.js';

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:4181';

assertSafeRealBackendEnvironment({ baseURL });
assertRealGeminiEnvironment();

export default defineConfig({
  testDir: './e2e/tests/real-gemini',
  timeout: 240_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL,
    navigationTimeout: 60_000,
    actionTimeout: 20_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [{ name: 'chromium-real-gemini-staging', use: { ...devices['Desktop Chrome'] } }],
});
