/* global process */
import { test, expect } from '../fixtures/appFixture.js';
import { loginAs } from '../support/appActions.js';

const SUPABASE_URL = process.env.E2E_SUPABASE_URL || 'http://127.0.0.1:54321';

test.describe('negative security and privacy quality gate', () => {
  test('public inventory omits protected fields before unlock', async ({ page, mockBackend }) => {
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
      supabaseUrl: SUPABASE_URL,
      token: `e2e-access-token:${mockBackend.users.investor.id}`,
    });

    mockBackend.expectNoSensitivePublicInventory(inventory);
    expect(JSON.stringify(inventory)).not.toContain('contact');
  });

  test('protected functions reject missing JWT and invalid origin', async ({ page, mockBackend }) => {
    const noJwt = await page.evaluate(async ({ supabaseUrl }) => {
      const response = await fetch(`${supabaseUrl}/functions/v1/maxxis-chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: 'hello' }),
      });
      return { status: response.status, payload: await response.json() };
    }, { supabaseUrl: SUPABASE_URL });

    expect(noJwt.status).toBe(401);
    expect(noJwt.payload.success).toBe(false);

    const badOrigin = await page.evaluate(async ({ supabaseUrl, token }) => {
      const response = await fetch(`${supabaseUrl}/functions/v1/maxxis-provider-unlock-prepare?e2e_origin=https%3A%2F%2Fevil.example`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          apikey: 'e2e-local-anon-key',
          'x-e2e-origin': 'https://evil.example',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ serviceId: '66666666-6666-4666-8666-666666666666' }),
      });
      return { status: response.status, payload: await response.json() };
    }, {
      supabaseUrl: SUPABASE_URL,
      token: `e2e-access-token:${mockBackend.users.investor.id}`,
    });

    expect(badOrigin.status).toBe(403);
    expect(badOrigin.payload.success).toBe(false);
  });

  test('cross-account profile access and draft/cancel message do not expose or send protected contact', async ({ page, mockBackend }) => {
    await loginAs(page, mockBackend.users.investor);

    const crossAccount = await page.evaluate(async ({ supabaseUrl, token, providerId }) => {
      const response = await fetch(`${supabaseUrl}/rest/v1/user_profiles?user_id=eq.${providerId}`, {
        headers: {
          authorization: `Bearer ${token}`,
          apikey: 'e2e-local-anon-key',
          accept: 'application/json',
        },
      });
      return { status: response.status, payload: await response.json() };
    }, {
      supabaseUrl: SUPABASE_URL,
      token: `e2e-access-token:${mockBackend.users.investor.id}`,
      providerId: mockBackend.users.provider.id,
    });

    expect(crossAccount.status).toBe(200);
    expect(JSON.stringify(crossAccount.payload)).not.toContain(mockBackend.users.provider.email);

    const draft = await page.evaluate(async ({ supabaseUrl, token, serviceId, propertyId }) => {
      const response = await fetch(`${supabaseUrl}/functions/v1/maxxis-provider-message-draft`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          apikey: 'e2e-local-anon-key',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ serviceId, propertyId, language: 'en' }),
      });
      return { status: response.status, payload: await response.json() };
    }, {
      supabaseUrl: SUPABASE_URL,
      token: `e2e-access-token:${mockBackend.users.investor.id}`,
      serviceId: mockBackend.ids.providerService,
      propertyId: mockBackend.ids.property,
    });

    expect(draft.status).toBe(200);
    expect(draft.payload.success).toBe(true);
    expect(JSON.stringify(draft.payload)).not.toContain(mockBackend.users.provider.email);
    expect(mockBackend.state.messagesSent).toBe(0);

    const cancel = await page.evaluate(async ({ supabaseUrl, token }) => {
      const response = await fetch(`${supabaseUrl}/functions/v1/maxxis-provider-message-cancel`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          apikey: 'e2e-local-anon-key',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ actionId: '88888888-8888-4888-8888-888888888888' }),
      });
      return { status: response.status, payload: await response.json() };
    }, {
      supabaseUrl: SUPABASE_URL,
      token: `e2e-access-token:${mockBackend.users.investor.id}`,
    });

    expect(cancel.status).toBe(200);
    expect(cancel.payload.success).toBe(true);
    expect(mockBackend.state.messagesSent).toBe(0);
  });
});
