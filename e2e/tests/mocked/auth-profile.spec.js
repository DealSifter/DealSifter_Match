/* global process */
import { test, expect, E2E_USERS } from '../../fixtures/appFixture.js';
import { loginAs, logout, openLogin } from '../../support/appActions.js';

const SUPABASE_URL = process.env.E2E_SUPABASE_URL || 'http://127.0.0.1:54321';

test.describe('auth and profile quality gate', () => {
  test('valid login, reload session, permitted profile persistence and logout', async ({ page, mockBackend }) => {
    await loginAs(page, mockBackend.users.investor);

    await expect(page.getByTestId('dashboard-root')).toBeVisible();
    await expect.poll(async () => page.evaluate(() => localStorage.getItem('authSession') || '')).toContain(mockBackend.users.investor.id);

    await page.reload();
    await expect.poll(async () => page.evaluate(() => localStorage.getItem('authSession') || '')).toContain(mockBackend.users.investor.id);
    await expect(page.getByTestId('dashboard-root')).toBeVisible({ timeout: 20_000 });

    const patchResult = await page.evaluate(async ({ supabaseUrl, token, runId }) => {
      const response = await fetch(`${supabaseUrl}/rest/v1/user_profiles?user_id=eq.self`, {
        method: 'PATCH',
        headers: {
          authorization: `Bearer ${token}`,
          apikey: 'e2e-local-anon-key',
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({ bio: `permitted profile update ${runId}` }),
      });
      const payload = await response.json();
      return { ok: response.ok, payload };
    }, {
      supabaseUrl: SUPABASE_URL,
      token: `e2e-access-token:${mockBackend.users.investor.id}`,
      runId: mockBackend.runId,
    });

    expect(patchResult.ok).toBe(true);
    expect(JSON.stringify(patchResult.payload)).toContain(`permitted profile update ${mockBackend.runId}`);

    await logout(page);
    await expect.poll(async () => page.evaluate(() => localStorage.getItem('authSession') || '')).toBe('');
  });

  test('invalid login is rejected and does not enter the app', async ({ page }) => {
    await openLogin(page);
    await page.getByTestId('auth-tab-login').click();
    await page.getByTestId('auth-email').fill('not-a-user@example.test');
    await page.getByTestId('auth-password').fill('wrong-password');

    const responsePromise = page.waitForResponse((response) => (
      response.url().includes('/auth/v1/token') && response.status() === 400
    ));
    await page.getByTestId('auth-submit').click({ force: true });
    await responsePromise;

    await expect(page.getByTestId('auth-modal')).toBeVisible();
    await expect(page.getByTestId('dashboard-root')).toHaveCount(0);
  });

  test('account switch clears visible leakage between users', async ({ page, mockBackend }) => {
    await loginAs(page, E2E_USERS.investor);
    await expect.poll(async () => page.evaluate(() => localStorage.getItem('authSession') || '')).toContain(E2E_USERS.investor.id);

    await logout(page);

    await loginAs(page, E2E_USERS.provider);
    await expect.poll(async () => page.evaluate(() => localStorage.getItem('authSession') || '')).toContain(E2E_USERS.provider.id);
    await expect(page.locator('body')).not.toContainText(E2E_USERS.investor.email);

    const storedAuth = await page.evaluate(() => {
      const entries = [];
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key && key.includes('auth')) entries.push(`${key}:${localStorage.getItem(key)}`);
      }
      return entries.join('\n');
    });
    expect(storedAuth).toContain(mockBackend.users.provider.id);
    expect(storedAuth).not.toContain(mockBackend.users.investor.id);
  });

  test('incomplete profile loads safely and profile_version conflict is rejected', async ({ page, mockBackend }) => {
    await loginAs(page, mockBackend.users.incomplete);
    await expect(page.getByTestId('dashboard-root')).toBeVisible();

    const conflict = await page.evaluate(async ({ supabaseUrl, token }) => {
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/ds_save_professional_profile`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          apikey: 'e2e-local-anon-key',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          p_profile_payload: { markets: ['TX'] },
          p_expected_profile_version: 1,
        }),
      });
      const payload = await response.json();
      return { status: response.status, payload };
    }, {
      supabaseUrl: SUPABASE_URL,
      token: `e2e-access-token:${mockBackend.users.incomplete.id}`,
    });

    expect(conflict.status).toBe(409);
    expect(conflict.payload.code).toBe('PROFILE_VERSION_CONFLICT');
  });
});
