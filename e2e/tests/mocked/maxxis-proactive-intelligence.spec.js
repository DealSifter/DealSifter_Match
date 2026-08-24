import { test, expect, E2E_IDS } from '../../fixtures/appFixture.js';
import { loginAs, openMaxxis } from '../../support/appActions.js';

async function enableProactive(page, events = []) {
  await page.addInitScript(({ proactiveEvents }) => {
    window.localStorage.setItem('ds_e2e_maxxis_proactive', '1');
    window.localStorage.setItem('ds_e2e_maxxis_proactive_events', JSON.stringify(proactiveEvents));
    window.__dsMaxxisAvatarTimeline = [];
    const recordAvatarTimeline = () => {
      const avatar = document.querySelector('[data-testid="maxxis-avatar-fab"]');
      if (!avatar) return;
      const entry = {
        state: avatar.getAttribute('data-avatar-state'),
        bubbleVisible: Boolean(document.querySelector('[data-testid="maxxis-proactive-bubble"]')),
      };
      const previous = window.__dsMaxxisAvatarTimeline.at(-1);
      if (!previous || previous.state !== entry.state || previous.bubbleVisible !== entry.bubbleVisible) {
        window.__dsMaxxisAvatarTimeline.push(entry);
      }
    };
    new MutationObserver(recordAvatarTimeline).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-avatar-state'],
    });
  }, { proactiveEvents: events });
}

async function setAttentionOverride(page, value) {
  await page.evaluate((override) => {
    if (override) window.localStorage.setItem('ds_e2e_maxxis_attention', JSON.stringify(override));
    else window.localStorage.removeItem('ds_e2e_maxxis_attention');
    window.dispatchEvent(new Event('ds:e2e:maxxis-attention'));
  }, value);
}

async function initializeAttentionOverride(page, value) {
  await page.addInitScript((override) => {
    window.localStorage.setItem('ds_e2e_maxxis_attention', JSON.stringify(override));
  }, value);
}

function providerReplyEvent(dedupeKey = 'provider-reply-wow') {
  return {
    code: 'PROVIDER_REPLIED',
    entityType: 'SERVICE',
    entityId: E2E_IDS.providerService,
    propertyId: E2E_IDS.property,
    serviceId: E2E_IDS.providerService,
    source: 'conversation',
    severity: 'RELEVANT',
    occurredAt: Date.now(),
    dedupeKey,
  };
}

test.describe('Maxxis proactive intelligence', () => {
  test('stays silent when the proactive feature flag is off', async ({ page, mockBackend }) => {
    await loginAs(page, mockBackend.users.investor);
    await expect(page.getByTestId('maxxis-proactive-bubble')).toBeHidden();
  });

  test('surfaces provider reply bubble and opens Maxxis context without sending automatically', async ({ page, mockBackend }) => {
    await enableProactive(page, [providerReplyEvent()]);
    await loginAs(page, mockBackend.users.investor);

    const avatar = page.getByTestId('maxxis-avatar-fab');
    await expect.poll(() => page.evaluate(() => window.__dsMaxxisAvatarTimeline)).toContainEqual({
      state: 'NOTICED',
      bubbleVisible: false,
    });
    await expect(page.getByTestId('maxxis-proactive-bubble')).toContainText('Your provider replied.');
    await expect(avatar).toHaveAttribute('data-avatar-state', 'WAITING');
    const functionRequests = [];
    page.on('request', (request) => {
      if (request.url().includes('/functions/v1/')) functionRequests.push(request.url());
    });
    await page.getByTestId('maxxis-proactive-review').evaluate((element) => element.click());

    await expect(page.getByTestId('maxxis-panel')).toBeVisible();
    await expect(page.getByTestId('maxxis-avatar-header')).toHaveAttribute('data-avatar-state', 'OBSERVING');
    await expect(page.getByTestId('maxxis-messages')).toContainText('Provider reply context loaded.');
    await expect(page.getByTestId('maxxis-smart-action-REVIEW_PROVIDER_REPLY')).toBeVisible();
    expect(mockBackend.state.messagesSent).toBe(0);
    expect(functionRequests).toEqual([]);

    await page.getByTestId('maxxis-smart-action-REVIEW_PROVIDER_REPLY').click();
    await expect(page.getByTestId('maxxis-messages')).toContainText('Conversation Summary');
    await expect(page.getByTestId('maxxis-messages')).toContainText('Suggested Reply');
    expect(mockBackend.state.messagesSent).toBe(0);
  });

  test('dismisses a signal and does not show it again on route/context refresh', async ({ page, mockBackend }) => {
    await enableProactive(page, [providerReplyEvent('dismiss-once')]);
    await loginAs(page, mockBackend.users.investor);

    await expect(page.getByTestId('maxxis-proactive-bubble')).toBeVisible();
    await page.getByTestId('maxxis-proactive-dismiss').evaluate((element) => element.click());
    await expect(page.getByTestId('maxxis-proactive-bubble')).toBeHidden();

    await page.getByRole('button', { name: /conexões|connections/i }).click().catch(async () => {
      await page.getByText(/Conexões|Connections/i).first().click();
    });
    await page.getByRole('button', { name: /feed/i }).click().catch(async () => {
      await page.getByText(/Feed/i).first().click();
    });
    await expect(page.getByTestId('maxxis-proactive-bubble')).toBeHidden();
  });

  test('does not show the external bubble while Maxxis is already open', async ({ page, mockBackend }) => {
    await enableProactive(page, [providerReplyEvent('maxxis-open')]);
    await loginAs(page, mockBackend.users.investor);
    await openMaxxis(page);
    await expect(page.getByTestId('maxxis-panel')).toBeVisible();
    await expect(page.getByTestId('maxxis-proactive-bubble')).toBeHidden();
  });

  test('defers a provider reply during a critical modal and re-evaluates it when the modal closes', async ({ page, mockBackend }) => {
    await enableProactive(page, [providerReplyEvent('modal-deferred')]);
    await initializeAttentionOverride(page, { activeModal: 'checkout', criticalModalOpen: true });
    await loginAs(page, mockBackend.users.investor);

    await expect(page.getByTestId('maxxis-proactive-bubble')).toBeHidden();
    await setAttentionOverride(page, null);
    await expect(page.getByTestId('maxxis-proactive-bubble')).toContainText('Your provider replied.');
    expect(mockBackend.state.messagesSent).toBe(0);
  });

  test('keeps external attention quiet while the user types in human chat', async ({ page, mockBackend }) => {
    await enableProactive(page, [providerReplyEvent('typing-deferred')]);
    await initializeAttentionOverride(page, { userTyping: true, currentSubview: 'human_chat' });
    await loginAs(page, mockBackend.users.investor);

    await expect(page.getByTestId('maxxis-proactive-bubble')).toBeHidden();
    await setAttentionOverride(page, null);
    await expect(page.getByTestId('maxxis-proactive-bubble')).toBeVisible();
    expect(mockBackend.state.messagesSent).toBe(0);
  });

  test('does not let a proactive bubble compete with SUCCESS feedback', async ({ page, mockBackend }) => {
    await enableProactive(page, [providerReplyEvent('success-deferred')]);
    await initializeAttentionOverride(page, { avatarState: 'SUCCESS' });
    await loginAs(page, mockBackend.users.investor);

    await expect(page.getByTestId('maxxis-proactive-bubble')).toBeHidden();
    await setAttentionOverride(page, null);
    await expect(page.getByTestId('maxxis-proactive-bubble')).toBeVisible();
    expect(mockBackend.state.messagesSent).toBe(0);
  });
});
