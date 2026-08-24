import { test, expect } from '../../fixtures/baselineFixture.js';
import {
  installLegacyMaxxisAvatarBaseline,
  installVisualStability,
  loginBaseline,
  visualMasks,
} from '../../support/baselineActions.js';

async function enableProactiveFlag(page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('ds_e2e_maxxis_proactive', '1');
  });
}

async function capture(page, name) {
  await installVisualStability(page);
  await installLegacyMaxxisAvatarBaseline(page);
  await expect(page).toHaveScreenshot(name, {
    animations: 'disabled',
    caret: 'hide',
    mask: visualMasks(page),
    maskColor: '#e4e5e6',
  });
}

async function openMaxxisPreferences(page) {
  if (!(await page.getByTestId('maxxis-panel').isVisible().catch(() => false))) {
    await page.getByTestId('maxxis-fab').evaluate((element) => element.click());
    await expect(page.getByTestId('maxxis-panel')).toBeVisible();
  }
  await page.getByTestId('maxxis-preferences-button').click();
  await expect(page.getByTestId('maxxis-preferences-popover')).toBeVisible();
}

test('desktop Maxxis interaction preference visual states', async ({ page, mockBackend }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-baseline');
  test.setTimeout(300_000);
  await enableProactiveFlag(page);
  await loginBaseline(page, mockBackend.users.investor);
  await page.getByTestId('maxxis-fab').evaluate((element) => element.click());
  await expect(page.getByTestId('maxxis-panel')).toBeVisible();
  await capture(page, 'desktop-24-maxxis-header-default.png');

  await openMaxxisPreferences(page);
  await capture(page, 'desktop-25-maxxis-settings-popover.png');

  await page.getByRole('button', { name: /more settings|mais configurações|más configuraciones/i }).click();
  await expect(page.getByTestId('settings-maxxis-preferences')).toBeVisible();
  await capture(page, 'desktop-26-settings-maxxis-section.png');

  await page.getByRole('button', { name: /back to app|voltar|volver/i }).click();
  await openMaxxisPreferences(page);
  await page.getByTestId('maxxis-animation-toggle-header').uncheck();
  await capture(page, 'desktop-27-maxxis-animations-off.png');

  await page.getByTestId('maxxis-proactive-toggle-header').uncheck();
  await capture(page, 'desktop-28-maxxis-proactivity-off.png');
});

test('mobile Maxxis interaction preferences', async ({ page, mockBackend }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-baseline');
  test.setTimeout(300_000);
  await enableProactiveFlag(page);
  await loginBaseline(page, mockBackend.users.investor);
  await openMaxxisPreferences(page);
  await expect(page.getByTestId('maxxis-preferences-popover')).toBeInViewport();
  await expect(page.getByTestId('maxxis-preferences-button')).toBeInViewport();
  await capture(page, 'mobile-08-maxxis-preferences.png');
});
