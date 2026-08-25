import { test, expect } from '../../fixtures/appFixture.js';
import { loginAs, openMaxxis } from '../../support/appActions.js';

async function askMaxxis(page, text) {
  if (!(await page.getByTestId('maxxis-panel').isVisible().catch(() => false))) {
    await openMaxxis(page);
  }
  await page.getByTestId('maxxis-input').fill(text);
  await page.getByTestId('maxxis-send').click({ force: true });
}

test.describe('Maxxis controlled smart actions', () => {
  test('runs snapshot to providers to unlock confirmation to draft without automatic send', async ({ page, mockBackend }) => {
    await loginAs(page, mockBackend.users.investor);
    await page.evaluate(() => {
      window.__dsMaxxisActionTimeline = [];
      const recordAvatarState = () => {
        const avatar = document.querySelector('[data-testid="maxxis-avatar-header"]');
        const state = avatar?.getAttribute('data-avatar-state');
        if (state && window.__dsMaxxisActionTimeline.at(-1) !== state) {
          window.__dsMaxxisActionTimeline.push(state);
        }
      };
      new MutationObserver(recordAvatarState).observe(document, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['data-avatar-state'],
      });
    });
    await openMaxxis(page);

    await askMaxxis(page, 'How is this deal?');
    await expect(page.getByTestId('maxxis-composed-analysis')).toContainText('Here is the current deal review.');
    await expect(page.getByTestId('maxxis-smart-action-VIEW_PROVIDERS')).toBeVisible();

    await page.getByTestId('maxxis-smart-action-VIEW_PROVIDERS').click();
    await expect(page.getByTestId('maxxis-messages')).toContainText('Providers loaded for this deal');
    await expect(page.getByTestId('maxxis-smart-action-UNLOCK_PROVIDER_CONTACT')).toBeVisible();

    await page.getByTestId('maxxis-smart-action-UNLOCK_PROVIDER_CONTACT').click();
    await expect(page.getByTestId('maxxis-composed-action_confirmation')).toContainText('1 Nuggets');
    await expect(page.getByTestId('maxxis-composed-action_confirmation')).toContainText('Nothing will happen until you confirm.');
    await expect(page.getByTestId('maxxis-provider-unlock-confirm')).toBeVisible();
    await expect(page.getByTestId('maxxis-provider-contact-status').last()).toContainText(/locked/i);
    await expect.poll(() => mockBackend.state.unlockPrepares).toBe(1);
    expect(mockBackend.users.investor.nuggets).toBe(20);
    await expect(page.getByTestId('maxxis-avatar-header')).toHaveAttribute('data-avatar-state', 'WAITING');

    await page.getByTestId('maxxis-provider-unlock-confirm').click();
    await expect.poll(() => page.evaluate(() => window.__dsMaxxisActionTimeline)).toContain('PROCESSING');
    await expect(page.getByTestId('maxxis-composed-action_result')).toContainText('Contact access is now available.');
    await expect(page.getByTestId('maxxis-avatar-header')).toHaveAttribute('data-avatar-state', 'OBSERVING', { timeout: 3_000 });
    await expect(page.getByTestId('maxxis-smart-action-DRAFT_PROVIDER_MESSAGE')).toBeVisible();
    await expect.poll(() => mockBackend.state.unlockConfirms).toBe(1);
    expect(mockBackend.users.investor.nuggets).toBe(19);

    await page.getByTestId('maxxis-smart-action-DRAFT_PROVIDER_MESSAGE').click();
    await expect(page.getByTestId('maxxis-composed-action_preparation')).toContainText('Nothing will happen until you confirm.');
    await expect(page.getByTestId('maxxis-messages')).toContainText('Message Draft');
    await expect(page.getByTestId('maxxis-messages')).toContainText('Send Message');
    expect(mockBackend.state.messagesSent).toBe(0);
  });

  test('cancelled unlock leaves nuggets untouched and reports no change', async ({ page, mockBackend }) => {
    await loginAs(page, mockBackend.users.investor);
    await openMaxxis(page);

    await askMaxxis(page, 'How is this deal?');
    await page.getByTestId('maxxis-smart-action-VIEW_PROVIDERS').click();
    await page.getByTestId('maxxis-smart-action-UNLOCK_PROVIDER_CONTACT').click();
    await page.getByTestId('maxxis-provider-unlock-cancel').click();

    await expect(page.getByTestId('maxxis-messages')).toContainText('Nothing was changed.');
    await expect.poll(() => mockBackend.state.unlockCancels).toBe(1);
    expect(mockBackend.users.investor.nuggets).toBe(20);
  });
});
