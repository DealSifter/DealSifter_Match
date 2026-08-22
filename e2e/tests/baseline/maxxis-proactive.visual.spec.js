import { test, expect } from '../../fixtures/baselineFixture.js';
import { loginBaseline, installVisualStability, visualMasks } from '../../support/baselineActions.js';
import { E2E_IDS } from '../../fixtures/e2eUsers.js';

async function enableProactiveVisual(page, dedupeKey = 'visual-provider-reply') {
  await page.addInitScript(({ ids, key }) => {
    window.localStorage.setItem('ds_e2e_maxxis_proactive', '1');
    window.localStorage.setItem('ds_e2e_maxxis_proactive_events', JSON.stringify([{
      code: 'PROVIDER_REPLIED',
      entityType: 'SERVICE',
      entityId: ids.providerService,
      propertyId: ids.property,
      serviceId: ids.providerService,
      source: 'conversation',
      severity: 'RELEVANT',
      occurredAt: Date.now(),
      dedupeKey: key,
    }]));
  }, { ids: E2E_IDS, key: dedupeKey });
}

async function capture(page, name) {
  await installVisualStability(page);
  await expect(page).toHaveScreenshot(name, {
    animations: 'disabled',
    caret: 'hide',
    mask: visualMasks(page),
    maskColor: '#e4e5e6',
  });
}

test('desktop Maxxis proactive bubble visual states', async ({ page, mockBackend }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-baseline');

  await enableProactiveVisual(page, 'visual-desktop-provider-reply');
  await loginBaseline(page, mockBackend.users.investor);
  await expect(page.getByTestId('maxxis-proactive-bubble')).toBeVisible();
  await capture(page, 'desktop-17-maxxis-proactive-bubble.png');

  await page.getByTestId('maxxis-proactive-dismiss').evaluate((element) => element.click());
  await expect(page.getByTestId('maxxis-proactive-bubble')).toBeHidden();
  await capture(page, 'desktop-18-maxxis-proactive-dismissed.png');

  await page.evaluate(({ ids }) => {
    window.localStorage.setItem('ds_e2e_maxxis_proactive_events', JSON.stringify([{
      code: 'PROVIDER_REPLIED',
      entityType: 'SERVICE',
      entityId: ids.providerService,
      propertyId: ids.property,
      serviceId: ids.providerService,
      source: 'conversation',
      severity: 'RELEVANT',
      occurredAt: Date.now(),
      dedupeKey: 'visual-maxxis-open',
    }]));
  }, { ids: E2E_IDS });
  await page.getByTestId('maxxis-fab').click();
  await expect(page.getByTestId('maxxis-panel')).toBeVisible();
  await expect(page.getByTestId('maxxis-proactive-bubble')).toBeHidden();
  await capture(page, 'desktop-19-maxxis-proactive-maxxis-open.png');
});

test('mobile Maxxis proactive bubble visual state', async ({ page, mockBackend }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-baseline');

  await enableProactiveVisual(page, 'visual-mobile-provider-reply');
  await loginBaseline(page, mockBackend.users.investor);
  await expect(page.getByTestId('maxxis-proactive-bubble')).toBeVisible();
  await capture(page, 'mobile-07-maxxis-proactive-bubble.png');
});

