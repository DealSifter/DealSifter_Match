import { test, expect, E2E_IDS } from '../../fixtures/baselineFixture.js';
import { loginAs, openMaxxis } from '../../support/appActions.js';
import { openMatches, selectBaselineContact, selectBaselineProperty } from '../../support/baselineActions.js';

test('hands Property and Provider context through Human Chat back to Maxxis Deal AI', async ({ page, mockBackend }) => {
  await page.addInitScript(() => {
    localStorage.setItem('lang', 'en');
    localStorage.setItem('ds_e2e_maxxis_proactive', '1');
    localStorage.setItem('ds_e2e_maxxis_proactive_events', '[]');
  });
  const protectedRequests = [];
  page.on('request', (request) => {
    if (/unlock-confirm|message-confirm|maxxis-deal-workflow/i.test(request.url())) protectedRequests.push(request.url());
  });

  await loginAs(page, mockBackend.users.investor);
  await openMatches(page);
  await selectBaselineProperty(page);
  await openMaxxis(page);
  await page.getByTestId('maxxis-input').fill('How is this deal?');
  await page.getByTestId('maxxis-send').click({ force: true });
  await expect(page.getByTestId('maxxis-composed-analysis')).toContainText('Here is the current deal review.');

  await page.evaluate(({ propertyId, serviceId }) => {
    localStorage.setItem('ds_e2e_maxxis_proactive_events', JSON.stringify([{
      code: 'PROVIDER_REPLIED',
      entityType: 'SERVICE',
      entityId: serviceId,
      propertyId,
      serviceId,
      source: 'conversation',
      severity: 'RELEVANT',
      occurredAt: Date.now(),
      dedupeKey: 'cross-surface-provider-reply',
    }]));
  }, { propertyId: E2E_IDS.property, serviceId: E2E_IDS.providerService });
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('maxxis-proactive-bubble')).toContainText('Your provider replied.');
  await page.getByTestId('maxxis-proactive-review').evaluate((element) => element.click());
  await expect(page.getByTestId('maxxis-composed-provider_review')).toContainText('Your provider replied.');

  await page.keyboard.press('Escape');
  await selectBaselineContact(page, mockBackend.users.provider.fullName);
  await expect(page.locator('[data-guide="matches-conversation"]')).toContainText('inspection window');
  await selectBaselineProperty(page);
  await openMaxxis(page);
  await expect(page.locator('.maxxis-shell')).toHaveAttribute('data-maxxis-continuity-status', 'resolved');
  await expect(page.locator('.maxxis-shell')).toHaveAttribute('data-maxxis-continuity-source', 'current_with_continuity');

  await page.getByTestId('maxxis-input').fill('What now?');
  await page.getByTestId('maxxis-send').click({ force: true });
  await expect(page.getByTestId('maxxis-messages')).toContainText('Conversation Summary');
  await expect(page.getByTestId('maxxis-messages').getByRole('button', { name: 'Send Reply' })).toHaveCount(1);
  await expect(page.getByTestId('maxxis-messages')).not.toContainText(/Which property|Which provider/i);

  expect(mockBackend.state.messagesSent).toBe(0);
  expect(protectedRequests).toEqual([]);
});
