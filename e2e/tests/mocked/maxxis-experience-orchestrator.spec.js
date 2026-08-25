import { test, expect, E2E_IDS } from '../../fixtures/appFixture.js';
import { loginAs, openMaxxis } from '../../support/appActions.js';

test('selects the next provider interaction once and keeps the experience dominant', async ({ page, mockBackend }) => {
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
  await expect(page.getByTestId('maxxis-avatar-fab')).toHaveAttribute('data-avatar-state', 'OBSERVING');
  await openMaxxis(page);
  await page.getByTestId('maxxis-input').fill('How is this deal?');
  await page.getByTestId('maxxis-send').click({ force: true });
  await expect(page.getByTestId('maxxis-composed-analysis')).toContainText('Here is the current deal review.');
  await expect(page.getByTestId('maxxis-smart-action-REVIEW_NEXT_STEP')).toHaveCount(1);

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
      dedupeKey: 'experience-orchestrator-wow',
    }]));
  }, { propertyId: E2E_IDS.property, serviceId: E2E_IDS.providerService });
  await page.keyboard.press('Escape');

  await expect(page.getByTestId('maxxis-proactive-bubble')).toContainText('Your provider replied.');
  await expect(page.getByTestId('maxxis-proactive-bubble')).toHaveCount(1);
  await page.getByTestId('maxxis-proactive-review').evaluate((element) => element.click());
  await expect(page.getByTestId('maxxis-panel')).toBeVisible();
  const providerExperience = page.getByTestId('maxxis-composed-provider_review');
  await expect(providerExperience).toHaveCount(1);
  await expect(providerExperience).toContainText('Your provider replied.');
  await expect(providerExperience).not.toContainText('current deal review');
  await expect(page.getByTestId('maxxis-smart-action-REVIEW_PROVIDER_REPLY')).toHaveCount(1);
  await page.getByTestId('maxxis-smart-action-REVIEW_PROVIDER_REPLY').click();
  await expect(page.getByTestId('maxxis-messages')).toContainText('Conversation Summary');
  await expect(page.getByTestId('maxxis-smart-action-DRAFT_PROVIDER_REPLY')).toHaveCount(1);
  await expect(page.getByTestId('maxxis-proactive-bubble')).toHaveCount(0);

  expect(mockBackend.state.messagesSent).toBe(0);
  expect(protectedRequests).toEqual([]);
});
