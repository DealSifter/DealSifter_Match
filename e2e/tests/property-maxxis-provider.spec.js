/* global process */
import { test, expect, E2E_IDS } from '../fixtures/appFixture.js';
import { loginAs, openMaxxis } from '../support/appActions.js';

test.describe('property, Maxxis and provider flow', () => {
  test('investor can inspect property through Maxxis and cancel provider unlock without nugget debit', async ({ page, mockBackend }) => {
    await loginAs(page, mockBackend.users.investor);

    const inventory = await page.evaluate(async ({ supabaseUrl, token }) => {
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/ds_get_global_feed_inventory`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          apikey: 'e2e-local-anon-key',
          'content-type': 'application/json',
        },
        body: '{}',
      });
      return response.json();
    }, {
      supabaseUrl: process.env.E2E_SUPABASE_URL || 'http://127.0.0.1:54321',
      token: `e2e-access-token:${mockBackend.users.investor.id}`,
    });
    await page.getByTestId('feed-view-showcase').click({ force: true });
    expect(inventory.properties).toHaveLength(1);
    expect(inventory.properties[0].id).toBe(E2E_IDS.property);

    await openMaxxis(page);
    await page.getByTestId('maxxis-input').fill(`Show property details for ${E2E_IDS.property}`);

    const maxxisResponsePromise = page.waitForResponse((response) => response.url().includes('/functions/v1/maxxis-chat'));
    await page.getByTestId('maxxis-send').evaluate((element) => element.click());
    const maxxisResponse = await maxxisResponsePromise;
    const maxxisPayload = await maxxisResponse.json();

    expect(maxxisPayload.type).toBe('property_details');
    expect(maxxisPayload.data.property.id).toBe(E2E_IDS.property);
    expect(maxxisPayload.data.serviceNeeds[0].serviceType).toBe('roofing');
    expect(maxxisPayload.data.serviceMatches[0].fit.score).toBeGreaterThanOrEqual(80);
    expect(maxxisPayload.data.serviceMatches[0].contactAccess.status).toBe('locked');

    await expect(page.getByTestId('maxxis-messages')).toContainText('Property Details');
    await expect(page.getByTestId('maxxis-messages')).toContainText('roofing');

    const prepare = await page.evaluate(async ({ supabaseUrl, token, serviceId }) => {
      const response = await fetch(`${supabaseUrl}/functions/v1/maxxis-provider-unlock-prepare`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          apikey: 'e2e-local-anon-key',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ serviceId }),
      });
      return { status: response.status, payload: await response.json() };
    }, {
      supabaseUrl: process.env.E2E_SUPABASE_URL || 'http://127.0.0.1:54321',
      token: `e2e-access-token:${mockBackend.users.investor.id}`,
      serviceId: mockBackend.ids.providerService,
    });
    expect(prepare.status).toBe(200);
    expect(prepare.payload.action.cost).toBe(1);

    const cancel = await page.evaluate(async ({ supabaseUrl, token, intentToken }) => {
      const response = await fetch(`${supabaseUrl}/functions/v1/maxxis-provider-unlock-cancel`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          apikey: 'e2e-local-anon-key',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ intentToken }),
      });
      return { status: response.status, payload: await response.json() };
    }, {
      supabaseUrl: process.env.E2E_SUPABASE_URL || 'http://127.0.0.1:54321',
      token: `e2e-access-token:${mockBackend.users.investor.id}`,
      intentToken: mockBackend.ids.unlockIntent,
    });
    expect(cancel.status).toBe(200);
    expect(cancel.payload.success).toBe(true);

    await expect.poll(() => mockBackend.state.unlockPrepares).toBe(1);
    await expect.poll(() => mockBackend.state.unlockCancels).toBe(1);
    expect(mockBackend.state.unlockConfirms).toBe(0);
    expect(mockBackend.users.investor.nuggets).toBe(20);
  });
});
