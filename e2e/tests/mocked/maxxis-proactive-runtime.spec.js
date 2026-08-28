import { test, expect } from '../../fixtures/baselineFixture.js';
import { loginBaseline } from '../../support/baselineActions.js';

test('routes a real unread chat notification through the proactive experience without auto-action', async ({ page, mockBackend }) => {
  test.setTimeout(360_000);
  mockBackend.state.runtimeProviderReply = true;
  await page.addInitScript(() => {
    window.localStorage.setItem('ds_e2e_maxxis_proactive', '1');
    window.localStorage.removeItem('ds_e2e_maxxis_proactive_events');
  });

  await loginBaseline(page, mockBackend.users.investor);
  await expect(page.getByTestId('maxxis-proactive-bubble')).toContainText('Your provider replied.', { timeout: 120_000 });
  expect(mockBackend.state.messagesSent).toBe(0);

  await page.getByTestId('maxxis-proactive-review').click();
  await expect(page.getByTestId('maxxis-panel')).toBeVisible();
  await expect(page.getByTestId('maxxis-composed-provider_review')).toContainText('Your provider replied.');
  expect(mockBackend.state.messagesSent).toBe(0);
});
