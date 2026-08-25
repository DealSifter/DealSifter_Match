import { test, expect, E2E_IDS } from '../../fixtures/baselineFixture.js';
import { openMaxxis } from '../../support/appActions.js';
import { loginBaseline, openMatches, selectBaselineContact, selectBaselineProperty } from '../../support/baselineActions.js';

test.setTimeout(420_000);

async function askMaxxis(page, text) {
  await page.getByTestId('maxxis-input').fill(text);
  await page.getByTestId('maxxis-send').click({ force: true });
}

test('accepts the integrated Phase 6 experience across deal, provider, memory, proactivity and continuity', async ({ page, mockBackend }) => {
  await page.addInitScript(() => {
    localStorage.setItem('lang', 'en');
    localStorage.setItem('ds_feature_flag_overrides', JSON.stringify({ maxxis_deal_memory: true }));
    localStorage.setItem('ds_e2e_maxxis_proactive', '1');
    localStorage.setItem('ds_e2e_maxxis_proactive_events', '[]');
  });

  const protectedRequests = [];
  page.on('request', (request) => {
    if (/unlock-confirm|message-confirm|maxxis-deal-workflow/i.test(request.url())) {
      protectedRequests.push(request.url());
    }
  });

  await loginBaseline(page, mockBackend.users.investor);
  await expect(page.locator('.maxxis-shell')).toHaveAttribute('data-maxxis-deal-memory', 'enabled');
  await openMatches(page);
  await selectBaselineProperty(page);
  await openMaxxis(page);

  // A. Deal review: current context produces one coherent analysis and useful next interaction.
  await askMaxxis(page, 'How is this deal?');
  await expect(page.getByTestId('maxxis-composed-analysis')).toContainText('Here is the current deal review.');
  await expect(page.getByTestId('maxxis-smart-action-VIEW_PROVIDERS')).toHaveCount(1);

  // B. Provider flow: unlock and send each mutate exactly once, only after explicit confirmation.
  await page.getByTestId('maxxis-smart-action-VIEW_PROVIDERS').click();
  await expect(page.getByTestId('maxxis-smart-action-UNLOCK_PROVIDER_CONTACT')).toBeVisible();
  await page.getByTestId('maxxis-smart-action-UNLOCK_PROVIDER_CONTACT').click();
  await expect(page.getByTestId('maxxis-avatar-header')).toHaveAttribute('data-avatar-state', 'WAITING');
  expect(mockBackend.users.investor.nuggets).toBe(20);
  await page.getByTestId('maxxis-provider-unlock-confirm').click();
  await expect(page.getByTestId('maxxis-composed-action_result')).toContainText('Contact access is now available.');
  await expect.poll(() => mockBackend.state.unlockConfirms).toBe(1);
  expect(mockBackend.users.investor.nuggets).toBe(19);

  await page.getByTestId('maxxis-smart-action-DRAFT_PROVIDER_MESSAGE').click();
  await expect(page.getByTestId('maxxis-messages')).toContainText('Message Draft');
  expect(mockBackend.state.messagesSent).toBe(0);
  await page.getByTestId('maxxis-messages').getByRole('button', { name: 'Send Message', exact: true }).click();
  const sendConfirmation = page.getByText(/^Send this message to /).last().locator('..');
  await expect(sendConfirmation).toContainText('Send this message to');
  expect(mockBackend.state.messagesSent).toBe(0);
  await sendConfirmation.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByTestId('maxxis-messages')).toContainText('Message sent.');
  await expect.poll(() => mockBackend.state.messagesSent).toBe(1);

  // D. Proactive flow: provider reply uses restrained attention and never sends autonomously.
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
      dedupeKey: 'phase-6-final-acceptance',
    }]));
  }, { propertyId: E2E_IDS.property, serviceId: E2E_IDS.providerService });
  await page.keyboard.press('Escape');
  const bubble = page.getByTestId('maxxis-proactive-bubble');
  await expect(bubble).toContainText('Your provider replied.');
  await expect(bubble).not.toContainText(/provider@example|555 0200/i);
  await page.getByTestId('maxxis-proactive-review').evaluate((element) => element.click());
  await expect(page.getByTestId('maxxis-composed-provider_review')).toContainText('Your provider replied.');
  await page.getByTestId('maxxis-smart-action-REVIEW_PROVIDER_REPLY').click();
  await expect(page.getByTestId('maxxis-messages')).toContainText('Conversation Summary');
  expect(mockBackend.state.messagesSent).toBe(1);

  // E. Cross-surface flow: Human Chat remains independent while Maxxis restores safe context.
  await page.keyboard.press('Escape');
  await selectBaselineContact(page, mockBackend.users.provider.fullName);
  await expect(page.locator('[data-guide="matches-conversation"]')).toContainText('inspection window');
  await selectBaselineProperty(page);
  await openMaxxis(page);
  await expect(page.locator('.maxxis-shell')).toHaveAttribute('data-maxxis-continuity-status', 'resolved');
  await askMaxxis(page, 'E agora?');
  await expect(page.getByTestId('maxxis-messages')).toContainText('Conversation Summary');
  await expect(page.getByTestId('maxxis-messages')).not.toContainText(/Which property|Which provider/i);
  expect(mockBackend.state.messagesSent).toBe(1);

  // C. Memory flow: a later page session recalls summarized changes and the current next step.
  await page.keyboard.press('Escape');
  mockBackend.state.maxxisProviderReplied = true;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('matches-root')).toBeVisible({ timeout: 180_000 });
  await selectBaselineProperty(page);
  await openMaxxis(page);
  await askMaxxis(page, 'Where were we?');
  const recall = page.getByTestId('maxxis-composed-memory_recall');
  await expect(recall).toContainText('Provider Reply Detected');
  await expect(recall).toContainText('Review Provider Reply');

  expect(mockBackend.state.unlockConfirms).toBe(1);
  expect(mockBackend.state.messagesSent).toBe(1);
  expect(protectedRequests.filter((url) => /unlock-confirm/i.test(url))).toHaveLength(1);
  expect(protectedRequests.filter((url) => /message-confirm/i.test(url))).toHaveLength(1);
  expect(protectedRequests.filter((url) => /maxxis-deal-workflow/i.test(url))).toHaveLength(0);
});
