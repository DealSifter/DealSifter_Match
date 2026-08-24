import { test, expect, E2E_IDS } from '../../fixtures/appFixture.js';
import { loginAs } from '../../support/appActions.js';

function providerReplyEvent(dedupeKey) {
  return {
    code: 'PROVIDER_REPLIED',
    entityType: 'SERVICE',
    entityId: E2E_IDS.providerService,
    propertyId: E2E_IDS.property,
    serviceId: E2E_IDS.providerService,
    source: 'conversation',
    severity: 'RELEVANT',
    occurredAt: Date.now(),
    dedupeKey,
  };
}

async function configureProactive(page, dedupeKey) {
  await page.addInitScript((event) => {
    window.localStorage.setItem('ds_e2e_maxxis_proactive', '1');
    window.localStorage.setItem('ds_e2e_maxxis_proactive_events', JSON.stringify([event]));
  }, providerReplyEvent(dedupeKey));
}

async function openPreferencesPopover(page) {
  if (await page.getByTestId('maxxis-preferences-popover').isVisible().catch(() => false)) return;
  if (!(await page.getByTestId('maxxis-panel').isVisible().catch(() => false))) {
    await page.getByTestId('maxxis-fab').evaluate((element) => element.click());
    await expect(page.getByTestId('maxxis-panel')).toBeVisible();
  }
  await page.getByTestId('maxxis-preferences-button').click();
  await expect(page.getByTestId('maxxis-preferences-popover')).toBeVisible();
}

async function openGeneralPreferences(page) {
  await openPreferencesPopover(page);
  await page.getByRole('button', { name: /more settings|mais configurações|más configuraciones/i }).click();
  await expect(page.getByTestId('settings-maxxis-preferences')).toBeVisible();
}

async function logoutFromSettings(page) {
  await page.getByRole('button', { name: /user profile|perfil do usuário|perfil de usuario/i }).click();
  await page.getByTestId('settings-logout').click();
  await expect(page.getByTestId('nav-login')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('nav-login')).toBeVisible();
}

test('syncs animation and proactivity controls without coupling bubble behavior', async ({ page, mockBackend }) => {
  test.setTimeout(300_000);
  await configureProactive(page, 'maxxis-settings-initial');
  await loginAs(page, mockBackend.users.investor);
  await expect(page.getByTestId('maxxis-proactive-bubble')).toBeVisible();

  await page.getByTestId('maxxis-proactive-review').click();
  await openPreferencesPopover(page);
  const writesBeforeIntensity = mockBackend.state.userPreferenceWrites;
  await page.getByLabel(/normal/i).check();
  await expect.poll(() => mockBackend.state.userPreferenceWrites).toBeGreaterThan(writesBeforeIntensity);
  const writesBeforeAnimation = mockBackend.state.userPreferenceWrites;
  await page.getByTestId('maxxis-animation-toggle-header').uncheck();
  await expect(page.getByTestId('maxxis-avatar-header')).toHaveAttribute('data-animation-intensity', 'OFF');
  await expect.poll(() => mockBackend.state.userPreferenceWrites).toBeGreaterThan(writesBeforeAnimation);

  await page.evaluate((event) => {
    window.localStorage.setItem('ds_e2e_maxxis_proactive_events', JSON.stringify([event]));
  }, providerReplyEvent('maxxis-settings-animation-off'));
  await page.reload();
  await expect(page.getByTestId('dashboard-root')).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId('maxxis-proactive-bubble')).toBeVisible();
  await expect(page.getByTestId('maxxis-avatar-fab')).toHaveAttribute('data-animation-intensity', 'OFF');

  await page.getByTestId('maxxis-proactive-review').click();
  await openPreferencesPopover(page);
  const writesBeforeProactivity = mockBackend.state.userPreferenceWrites;
  await page.getByTestId('maxxis-proactive-toggle-header').uncheck();
  await page.evaluate((event) => {
    window.localStorage.setItem('ds_e2e_maxxis_proactive_events', JSON.stringify([event]));
  }, providerReplyEvent('maxxis-settings-proactive-off'));
  await expect.poll(() => mockBackend.state.userPreferenceWrites).toBeGreaterThan(writesBeforeProactivity);
  await page.getByRole('button', { name: /^close$/i }).click();
  await expect(page.getByTestId('maxxis-panel')).toBeHidden();
  await page.evaluate(() => window.dispatchEvent(new Event('ds:e2e:maxxis-proactive')));
  await expect(page.getByTestId('maxxis-proactive-bubble')).toBeHidden();

  await openGeneralPreferences(page);
  await expect(page.getByTestId('maxxis-animation-toggle-settings')).not.toBeChecked();
  await expect(page.getByTestId('maxxis-proactive-toggle-settings')).not.toBeChecked();
  const settingsIntensity = page
    .getByTestId('maxxis-preferences-settings')
    .getByRole('radio', { name: /normal/i });
  await expect(settingsIntensity).toBeChecked();
  await expect(settingsIntensity).toBeDisabled();

  await page.getByTestId('maxxis-animation-toggle-settings').check();
  await expect(settingsIntensity).toBeEnabled();
  await expect(settingsIntensity).toBeChecked();
  await openPreferencesPopover(page);
  await expect(page.getByTestId('maxxis-animation-toggle-header')).toBeChecked();
  await expect(
    page.getByTestId('maxxis-preferences-header').getByRole('radio', { name: /normal/i }),
  ).toBeChecked();
  expect(mockBackend.state.unlockPrepares).toBe(0);
  expect(mockBackend.state.unlockConfirms).toBe(0);
  expect(mockBackend.state.messagesSent).toBe(0);
});

test('isolates preferences across account switches and restores the original account', async ({ page, mockBackend }) => {
  test.setTimeout(600_000);
  await configureProactive(page, 'maxxis-settings-account-isolation');
  await loginAs(page, mockBackend.users.investor);
  await openPreferencesPopover(page);
  const writesBeforeAnimation = mockBackend.state.userPreferenceWrites;
  await page.getByTestId('maxxis-animation-toggle-header').uncheck();
  await expect.poll(() => mockBackend.state.userPreferenceWrites).toBeGreaterThan(writesBeforeAnimation);

  await openGeneralPreferences(page);
  await logoutFromSettings(page);
  await loginAs(page, mockBackend.users.provider);
  await openPreferencesPopover(page);
  await expect(page.getByTestId('maxxis-animation-toggle-header')).toBeChecked();

  await page.getByRole('button', { name: /more settings|mais configurações|más configuraciones/i }).click();
  await logoutFromSettings(page);
  await loginAs(page, mockBackend.users.investor);
  await openPreferencesPopover(page);
  await expect(page.getByTestId('maxxis-animation-toggle-header')).not.toBeChecked();
  await expect(page.getByTestId('maxxis-avatar-header')).toHaveAttribute('data-animation-intensity', 'OFF');
});

test('keeps the global feature flag authoritative and supports accessible popover dismissal', async ({ page, mockBackend }) => {
  test.setTimeout(300_000);
  await loginAs(page, mockBackend.users.investor);
  await openPreferencesPopover(page);
  await expect(page.getByTestId('maxxis-proactive-toggle-header')).toBeDisabled();
  await expect(page.getByTestId('maxxis-proactive-toggle-header')).not.toBeChecked();

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('maxxis-preferences-popover')).toBeHidden();
  await expect(page.getByTestId('maxxis-preferences-button')).toBeFocused();
  await expect(page.getByTestId('maxxis-panel')).toBeVisible();
});

test('keeps runtime preferences active when remote persistence fails', async ({ page, mockBackend }) => {
  test.setTimeout(300_000);
  await configureProactive(page, 'maxxis-settings-persistence-failure');
  await loginAs(page, mockBackend.users.investor);
  await openPreferencesPopover(page);
  const writesBeforeFailure = mockBackend.state.userPreferenceWrites;
  mockBackend.state.failUserPreferenceWrites = true;
  await page.getByTestId('maxxis-animation-toggle-header').uncheck();

  await expect(page.getByTestId('maxxis-avatar-header')).toHaveAttribute('data-animation-intensity', 'OFF');
  await expect(page.getByTestId('maxxis-preferences-popover')).toContainText(/could not save remotely|não foi possível salvar|no se pudo guardar/i);
  expect(mockBackend.state.userPreferenceWrites).toBe(writesBeforeFailure);
  expect(mockBackend.state.unlockPrepares).toBe(0);
  expect(mockBackend.state.unlockConfirms).toBe(0);
  expect(mockBackend.state.messagesSent).toBe(0);
});
