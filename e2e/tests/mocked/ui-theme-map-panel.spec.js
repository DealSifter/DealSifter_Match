import { test, expect } from '../../fixtures/appFixture.js';
import { loginAs } from '../../support/appActions.js';

test.setTimeout(360_000);

async function closeGuideIfVisible(page) {
  const guide = page.getByRole('dialog', { name: /DealSifter Guide/i });
  await guide.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
  if (await guide.isVisible().catch(() => false)) {
    await guide.getByRole('button', { name: /Close guide/i }).click();
  }
}

test('brand palette and MapView defaults stay responsive', async ({ page, mockBackend }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await loginAs(page, mockBackend.users.investor);
  await closeGuideIfVisible(page);

  const palette = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    return {
      accent: styles.getPropertyValue('--accent-hex').trim().toLowerCase(),
      gold: styles.getPropertyValue('--gold-hex').trim().toLowerCase(),
      success: styles.getPropertyValue('--success-hex').trim().toLowerCase(),
    };
  });
  expect(palette).toEqual({ accent: '#35cac9', gold: '#f5a623', success: '#75ba75' });

  await page.evaluate(() => {
    localStorage.removeItem('mapViewPanelWidth');
    localStorage.removeItem('ds_mapview_ui_state_v1');
  });
  await page.getByTestId('nav-mapview').click();
  const panel = page.locator('aside.map-panel');
  await expect(panel).toBeVisible({ timeout: 120_000 });
  await expect.poll(async () => Math.round((await panel.boundingBox())?.width || 0)).toBe(360);

  await page.setViewportSize({ width: 800, height: 1024 });
  await expect.poll(async () => Math.round((await panel.boundingBox())?.width || 0)).toBe(410);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => Math.round((await panel.boundingBox())?.width || 0)).toBe(359);
});
