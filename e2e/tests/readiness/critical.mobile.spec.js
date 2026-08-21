import { test, expect } from '../../fixtures/appFixture.js';
import { loginAs, openMaxxis } from '../../support/appActions.js';

test.setTimeout(360_000);

async function expectNoHorizontalOverflow(page, context) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content, `${context} horizontal overflow`).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test('mobile navigation, cards, onboarding and Maxxis remain usable without clipping', async ({ page, mockBackend }) => {
  await loginAs(page, mockBackend.users.investor);
  const guideDialog = page.getByRole('dialog', { name: /DealSifter Guide/i });
  await guideDialog.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
  if (await guideDialog.isVisible().catch(() => false)) {
    await guideDialog.getByRole('button', { name: /Close guide/i }).click();
  }
  await expect(page.getByTestId('feed-stack')).toBeVisible();
  await expectNoHorizontalOverflow(page, 'dashboard');

  await openMaxxis(page);
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
