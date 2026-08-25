import { test as base, expect } from '@playwright/test';
import { E2E_IDS, E2E_USERS } from './e2eUsers.js';
import { setupMockSupabase } from '../support/mockSupabase.js';

export const test = base.extend({
  mockBackend: [async ({ context }, use) => {
    const backend = await setupMockSupabase(context, { baseline: true, staleFeedActions: true });
    await use(backend);
  }, { auto: true }],
});

export { expect, E2E_IDS, E2E_USERS };
