import { test, expect, E2E_IDS } from '../../fixtures/baselineFixture.js';
import { installLegacyMaxxisAvatarBaseline, installVisualStability, loginBaseline } from '../../support/baselineActions.js';
import { openMaxxis } from '../../support/appActions.js';

test('desktop composed Maxxis Deal AI analysis, confirmation, success and provider response', async ({ page, mockBackend }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-baseline');
  await page.addInitScript(() => {
    localStorage.setItem('lang', 'en');
    localStorage.setItem('ds_e2e_maxxis_proactive', '1');
    localStorage.setItem('ds_e2e_maxxis_proactive_events', '[]');
  });
  await loginBaseline(page, mockBackend.users.investor);
  await installVisualStability(page);
  await installLegacyMaxxisAvatarBaseline(page);
  await openMaxxis(page);

  await page.getByTestId('maxxis-input').fill('How is this deal?');
  await page.getByTestId('maxxis-send').click({ force: true });
  await expect(page.getByTestId('maxxis-composed-analysis')).toHaveScreenshot('desktop-maxxis-composed-analysis.png');

  await page.getByTestId('maxxis-smart-action-VIEW_PROVIDERS').click();
  await page.getByTestId('maxxis-smart-action-UNLOCK_PROVIDER_CONTACT').click();
  await expect(page.getByTestId('maxxis-composed-action_confirmation')).toHaveScreenshot('desktop-maxxis-composed-confirmation.png');

  await page.getByTestId('maxxis-provider-unlock-confirm').click();
  await expect(page.getByTestId('maxxis-composed-action_result')).toHaveScreenshot('desktop-maxxis-composed-success.png');

  await page.evaluate(({ propertyId, serviceId }) => {
    localStorage.setItem('ds_e2e_maxxis_proactive_events', JSON.stringify([{
      code: 'PROVIDER_REPLIED', entityType: 'SERVICE', entityId: serviceId, propertyId, serviceId,
      source: 'conversation', severity: 'RELEVANT', occurredAt: Date.now(), dedupeKey: 'composition-visual-provider',
    }]));
  }, { propertyId: E2E_IDS.property, serviceId: E2E_IDS.providerService });
  await page.keyboard.press('Escape');
  await page.getByTestId('maxxis-proactive-review').evaluate((element) => element.click());
  await expect(page.getByTestId('maxxis-composed-provider_review')).toHaveScreenshot('desktop-maxxis-composed-provider.png');
});
