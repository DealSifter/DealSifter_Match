import { test, expect } from '../../fixtures/appFixture.js';
import { loginAs } from '../../support/appActions.js';

test.setTimeout(360_000);

async function expectNoHorizontalOverflow(page, context) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content, `${context} horizontal overflow`).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test('mobile navigation, cards, onboarding and Maxxis remain usable without clipping', async ({ page, mockBackend }) => {
  await page.addInitScript(({ ids }) => {
    window.localStorage.setItem('ds_e2e_maxxis_proactive', '1');
    window.localStorage.setItem('ds_e2e_maxxis_attention', JSON.stringify({
      mobileKeyboardOpen: true,
      mobileViewportCongested: true,
    }));
    window.localStorage.setItem('ds_e2e_maxxis_proactive_events', JSON.stringify([{
      code: 'PROVIDER_REPLIED',
      entityType: 'SERVICE',
      entityId: ids.providerService,
      propertyId: ids.property,
      serviceId: ids.providerService,
      source: 'conversation',
      severity: 'RELEVANT',
      occurredAt: Date.now(),
      dedupeKey: 'mobile-avatar-sync',
    }]));
    window.__dsMobileAvatarTimeline = [];
    const recordAvatarTimeline = () => {
      const avatar = document.querySelector('[data-testid="maxxis-avatar-fab"]');
      if (!avatar) return;
      const entry = {
        state: avatar.getAttribute('data-avatar-state'),
        bubbleVisible: Boolean(document.querySelector('[data-testid="maxxis-proactive-bubble"]')),
      };
      const previous = window.__dsMobileAvatarTimeline.at(-1);
      if (!previous || previous.state !== entry.state || previous.bubbleVisible !== entry.bubbleVisible) {
        window.__dsMobileAvatarTimeline.push(entry);
      }
    };
    new MutationObserver(recordAvatarTimeline).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-avatar-state'],
    });
  }, { ids: mockBackend.ids });
  await loginAs(page, mockBackend.users.investor);
  const guideDialog = page.getByRole('dialog', { name: /DealSifter Guide/i });
  await guideDialog.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
  if (await guideDialog.isVisible().catch(() => false)) {
    await guideDialog.getByRole('button', { name: /Close guide/i }).click();
  }
  await expect(page.getByTestId('maxxis-proactive-bubble')).toBeHidden();
  await page.evaluate(() => {
    window.localStorage.removeItem('ds_e2e_maxxis_attention');
    window.dispatchEvent(new Event('ds:e2e:maxxis-attention'));
  });
  await expect(page.getByTestId('feed-stack')).toBeVisible();
  await expectNoHorizontalOverflow(page, 'dashboard');

  await expect.poll(() => page.evaluate(() => window.__dsMobileAvatarTimeline)).toContainEqual({
    state: 'NOTICED',
    bubbleVisible: false,
  });
  await expect(page.getByTestId('maxxis-proactive-bubble')).toBeVisible();
  await expect(page.getByTestId('maxxis-avatar-fab')).toHaveAttribute('data-avatar-state', 'WAITING');
  const anchoredPosition = await page.evaluate(() => {
    const bubble = document.querySelector('[data-testid="maxxis-proactive-bubble"]')?.getBoundingClientRect();
    const fab = document.querySelector('[data-testid="maxxis-fab"]')?.getBoundingClientRect();
    return bubble && fab ? { bubbleRight: bubble.right, fabLeft: fab.left } : null;
  });
  expect(anchoredPosition).not.toBeNull();
  expect(anchoredPosition.bubbleRight).toBeLessThanOrEqual(anchoredPosition.fabLeft + 8);
  await expectNoHorizontalOverflow(page, 'Maxxis proactive bubble');

  await page.getByTestId('maxxis-proactive-review').click();
  await expect(page.getByTestId('maxxis-panel')).toBeVisible();
  expect(mockBackend.state.messagesSent).toBe(0);
  await expect(page.getByTestId('maxxis-input')).toBeInViewport();
  await expect(page.getByTestId('maxxis-send')).toBeInViewport();
  await expectNoHorizontalOverflow(page, 'Maxxis');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('maxxis-panel')).toBeHidden();

  const matchesNav = page.getByTestId('mobile-nav-matches');
  await expect(matchesNav).toBeEnabled({ timeout: 60_000 });
  await matchesNav.click();
  await expect(page.getByTestId('matches-root')).toBeVisible({ timeout: 120_000 });
  await expectNoHorizontalOverflow(page, 'Matches');

  const onboardingNav = page.getByTestId('mobile-nav-onboarding');
  await expect(onboardingNav).toBeEnabled({ timeout: 60_000 });
  await onboardingNav.click();
  await expect(page.getByTestId('onboarding-root')).toBeVisible({ timeout: 120_000 });
  await expectNoHorizontalOverflow(page, 'onboarding');
});
