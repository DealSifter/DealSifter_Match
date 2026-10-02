import { test, expect, E2E_IDS } from '../../fixtures/appFixture.js';
import { loginAs, openMaxxis } from '../../support/appActions.js';

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

test.describe('Maxxis canonical current-property context', () => {
  for (const viewport of viewports) {
    test(`persists the active property for a generic opportunity question — ${viewport.name}`, async ({ page, mockBackend }) => {
      test.setTimeout(240_000);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await loginAs(page, mockBackend.users.investor);
      await openMaxxis(page);

      const initialResponse = page.waitForResponse((response) => (
        response.url().includes('/functions/v1/maxxis-chat') && response.request().method() === 'POST'
      ));
      await page.getByTestId('maxxis-input').fill(`Show property details for ${E2E_IDS.property}`);
      await page.getByTestId('maxxis-send').click({ force: true });
      await initialResponse;
      await expect(page.getByTestId('maxxis-messages')).toContainText('Property Details');

      const requestPromise = page.waitForRequest((request) => (
        request.method() === 'POST'
        && request.url().includes('/functions/v1/maxxis-chat')
        && request.postDataJSON()?.message === 'há alguma oportunidade para mim?'
      ));
      await page.getByTestId('maxxis-input').fill('há alguma oportunidade para mim?');
      await page.getByTestId('maxxis-send').click({ force: true });
      const body = (await requestPromise).postDataJSON();

      expect(body.context.propertyId).toBe(E2E_IDS.property);
      expect(body.controlledIntent).toBe('property_analysis_question');
      await expect(page.getByTestId('dashboard-root')).toBeVisible();
      await expect(page.getByTestId('maxxis-panel')).toBeVisible();
    });
  }
});
