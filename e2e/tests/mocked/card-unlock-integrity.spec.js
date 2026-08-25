/* global process */
import { test, expect, E2E_IDS } from '../../fixtures/cardIntegrityFixture.js';
import { loginBaseline, openMatches } from '../../support/baselineActions.js';

const SUPABASE_URL = process.env.E2E_SUPABASE_URL || 'http://127.0.0.1:54321';

async function callProviderUnlock(page, userId, endpoint, body) {
  return page.evaluate(async ({ supabaseUrl, token, path, payload }) => {
    const response = await fetch(`${supabaseUrl}/functions/v1/${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        apikey: 'e2e-local-anon-key',
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return { status: response.status, payload: await response.json() };
  }, {
    supabaseUrl: SUPABASE_URL,
    token: `e2e-access-token:${userId}`,
    path: endpoint,
    payload: body,
  });
}

test('keeps card identity canonical and provider unlock idempotent', async ({ page, mockBackend }) => {
  await loginBaseline(page, mockBackend.users.investor);
  await openMatches(page);

  await expect(page.getByText(mockBackend.users.provider.fullName, { exact: false }).first()).toBeVisible();
  await expect(page.locator('.matches-col-interests:visible').getByText('Dallas, TX', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Legacy Ghost Provider', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Legacy Ghost Property', { exact: true })).toHaveCount(0);

  const startingBalance = mockBackend.users.investor.nuggets;
  const nonexistent = await callProviderUnlock(page, mockBackend.users.investor.id, 'maxxis-provider-unlock-prepare', {
    serviceId: '99999999-9999-4999-8999-999999999999',
  });
  expect(nonexistent).toMatchObject({ status: 404, payload: { status: 'provider_service_not_found' } });
  expect(mockBackend.users.investor.nuggets).toBe(startingBalance);

  const preparedForCancel = await callProviderUnlock(page, mockBackend.users.investor.id, 'maxxis-provider-unlock-prepare', {
    serviceId: E2E_IDS.providerService,
  });
  expect(preparedForCancel).toMatchObject({ status: 200, payload: { action: { serviceId: E2E_IDS.providerService } } });
  const cancelled = await callProviderUnlock(page, mockBackend.users.investor.id, 'maxxis-provider-unlock-cancel', {
    serviceId: E2E_IDS.providerService,
    intentToken: preparedForCancel.payload.action.intentToken,
  });
  expect(cancelled).toMatchObject({ status: 200, payload: { status: 'cancelled' } });
  expect(mockBackend.users.investor.nuggets).toBe(startingBalance);

  const prepared = await callProviderUnlock(page, mockBackend.users.investor.id, 'maxxis-provider-unlock-prepare', {
    serviceId: E2E_IDS.providerService,
  });
  const confirmed = await callProviderUnlock(page, mockBackend.users.investor.id, 'maxxis-provider-unlock-confirm', {
    serviceId: E2E_IDS.providerService,
    intentToken: prepared.payload.action.intentToken,
  });
  expect(confirmed).toMatchObject({ status: 200, payload: { status: 'confirmed' } });
  expect(mockBackend.users.investor.nuggets).toBe(startingBalance - 1);

  const retried = await callProviderUnlock(page, mockBackend.users.investor.id, 'maxxis-provider-unlock-confirm', {
    serviceId: E2E_IDS.providerService,
    intentToken: prepared.payload.action.intentToken,
  });
  expect(retried).toMatchObject({ status: 200, payload: { status: 'already_unlocked' } });
  expect(mockBackend.users.investor.nuggets).toBe(startingBalance - 1);
  expect(mockBackend.state.unlockConfirms).toBe(2);
});
