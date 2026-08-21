import { test, expect } from '../../fixtures/realBackendFixture.js';

const DASHBOARD_READY_TIMEOUT = 60_000;

async function browserAccessToken(page) {
  return page.evaluate(() => {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.includes('auth-token')) continue;
      const value = JSON.parse(localStorage.getItem(key) || '{}');
      if (value.access_token) return value.access_token;
      if (value.currentSession?.access_token) return value.currentSession.access_token;
    }
    return '';
  });
}

function profilePayload(label) {
  return {
    version: 1,
    profiles: {
      professional: {
        investmentProfile: {
          markets: ['Texas', 'Dallas'],
          propertyTypes: ['Single Family'],
          maxArv: 500000,
          minimumMarginPercent: 20,
          funding: 'Cash Only',
          closingTimeline: '< 14 days',
          e2eLabel: label,
        },
      },
    },
    legacy: {
      professionalProfile: {
        investmentProfile: {
          markets: ['Texas', 'Dallas'],
          propertyTypes: ['Single Family'],
          maxArv: 500000,
          minimumMarginPercent: 20,
          funding: 'Cash Only',
          closingTimeline: '< 14 days',
          e2eLabel: label,
        },
      },
    },
  };
}

async function readProfessionalProfile(realBackend, page, token, userId) {
  const result = await realBackend.browserRestSelect(page, {
    token,
    table: 'professional_profiles',
    query: `select=user_id,category,markets,profile_version,profile_payload&user_id=eq.${userId}`,
  });
  expect(result.ok, JSON.stringify(result.payload)).toBe(true);
  expect(result.payload).toHaveLength(1);
  return result.payload[0];
}

async function saveProfessionalProfile(realBackend, page, token, expectedVersion, label) {
  return realBackend.browserRpc(page, {
    token,
    fn: 'ds_save_professional_profile',
    body: {
      p_expected_version: expectedVersion,
      p_profile_payload: profilePayload(label),
      p_category: 'Investor',
      p_subcategory: 'Cash Buyer',
      p_markets: ['Dallas, TX', 'Texas'],
      p_skills: ['Cash Only', 'Close < 14 days'],
      p_services: ['Acquisition'],
      p_pitch: `real e2e profile ${label}`,
      p_primary_category: 'investor',
      p_category_b: 'cash_buyer',
      p_primary_category_b: 'cash_buyer',
      p_update_photo_b_url: false,
      p_photo_b_url: null,
    },
  });
}

test('real auth session, profile save persistence, conflict protection and account switch', async ({ page, realBackend }) => {
  test.setTimeout(360_000);

  await realBackend.loginViaUi(page, realBackend.investor);
  await expect(page.getByTestId('dashboard-root')).toBeVisible({ timeout: DASHBOARD_READY_TIMEOUT });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('dashboard-root')).toBeVisible({ timeout: DASHBOARD_READY_TIMEOUT });
  const investorToken = await browserAccessToken(page);
  expect(investorToken).toBeTruthy();

  const before = await readProfessionalProfile(realBackend, page, investorToken, realBackend.investor.id);
  const save = await saveProfessionalProfile(realBackend, page, investorToken, before.profile_version, `saved-${realBackend.runId}`);
  expect(save.ok, JSON.stringify(save.payload)).toBe(true);
  expect(save.payload.success).toBe(true);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('dashboard-root')).toBeVisible({ timeout: DASHBOARD_READY_TIMEOUT });
  const after = await readProfessionalProfile(realBackend, page, investorToken, realBackend.investor.id);
  expect(after.profile_version).toBeGreaterThan(before.profile_version);
  expect(JSON.stringify(after.profile_payload)).toContain(`saved-${realBackend.runId}`);

  const staleVersion = after.profile_version;
  const firstConcurrentSave = await saveProfessionalProfile(realBackend, page, investorToken, staleVersion, `winner-${realBackend.runId}`);
  expect(firstConcurrentSave.ok, JSON.stringify(firstConcurrentSave.payload)).toBe(true);
  expect(firstConcurrentSave.payload.success).toBe(true);
  const staleSave = await saveProfessionalProfile(realBackend, page, investorToken, staleVersion, `stale-${realBackend.runId}`);
  expect(staleSave.ok, JSON.stringify(staleSave.payload)).toBe(true);
  expect(staleSave.payload.success).toBe(false);
  expect(staleSave.payload.code).toBe('PROFILE_CONFLICT');

  await realBackend.logoutViaUi(page);
  await realBackend.loginViaUi(page, realBackend.provider);
  await expect(page.getByTestId('dashboard-root')).toBeVisible({ timeout: DASHBOARD_READY_TIMEOUT });
  const providerToken = await browserAccessToken(page);
  expect(providerToken).toBeTruthy();
  expect(providerToken).not.toBe(investorToken);
  await expect(page.getByText(realBackend.investor.email)).toHaveCount(0);
});
