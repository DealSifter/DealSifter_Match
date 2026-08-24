import { test, expect } from '../../fixtures/realBackendFixture.js';
import { openMaxxis } from '../../support/appActions.js';

async function storedAnimationEnabled(realBackend) {
  const rows = await realBackend.adminSelect(
    'users',
    `select=settings_payload&id=eq.${realBackend.investor.id}`,
  );
  return rows[0]?.settings_payload?.userPreferences?.maxxis?.animationEnabled;
}

async function openMaxxisPreferences(page) {
  await openMaxxis(page);
  await page.getByTestId('maxxis-preferences-button').evaluate((element) => element.click());
  await expect(page.getByTestId('maxxis-preferences-popover')).toBeVisible();
}

test('real Maxxis interaction preference persists, reloads and restores safely', async ({ page, realBackend }) => {
  test.setTimeout(360_000);

  await realBackend.loginViaUi(page, realBackend.investor);
  await expect(page.getByTestId('dashboard-root')).toBeVisible({ timeout: 180_000 });
  await openMaxxisPreferences(page);

  const animationToggle = page.getByTestId('maxxis-animation-toggle-header');
  await expect(animationToggle).toBeChecked();
  await animationToggle.evaluate((element) => element.click());
  await expect(animationToggle).not.toBeChecked();
  await expect.poll(() => storedAnimationEnabled(realBackend), { timeout: 30_000 }).toBe(false);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('dashboard-root')).toBeVisible({ timeout: 180_000 });
  await openMaxxisPreferences(page);
  await expect(page.getByTestId('maxxis-animation-toggle-header')).not.toBeChecked();

  await page.getByTestId('maxxis-animation-toggle-header').evaluate((element) => element.click());
  await expect(page.getByTestId('maxxis-animation-toggle-header')).toBeChecked();
  await expect.poll(() => storedAnimationEnabled(realBackend), { timeout: 30_000 }).toBe(true);
});
