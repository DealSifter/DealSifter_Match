import { test, expect } from '../../fixtures/baselineFixture.js';
import { loginAs } from '../../support/appActions.js';
import {
  installVisualStability,
  installLegacyMaxxisAvatarBaseline,
  loginBaseline,
  openBaselineLogin,
  openMatches,
  openOnboarding,
  selectBaselineContact,
  selectBaselineProperty,
  sendMaxxisMessage,
  visualMasks,
} from '../../support/baselineActions.js';

async function capture(page, name) {
  await installVisualStability(page);
  await installLegacyMaxxisAvatarBaseline(page);
  await expect(page).toHaveScreenshot(name, {
    animations: 'disabled',
    caret: 'hide',
    mask: visualMasks(page),
    maskColor: '#e4e5e6',
  });
}

test('desktop application visual baseline', async ({ page, mockBackend }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-baseline');

  await openBaselineLogin(page, mockBackend.users.investor);
  await capture(page, 'desktop-01-auth.png');

  await loginAs(page, mockBackend.users.investor);
  await installVisualStability(page);
  await expect(page.getByTestId('dashboard-root')).toBeVisible();
  await capture(page, 'desktop-02-dashboard-light.png');

  await page.getByTestId('feed-view-showcase').click({ force: true });
  await expect(page.getByTestId('feed-stack')).toContainText('Dallas');
  await capture(page, 'desktop-03-feed-showcase.png');

  await page.getByRole('button', { name: /Enable dark mode/i }).click();
  await capture(page, 'desktop-04-dashboard-dark.png');
  await page.getByRole('button', { name: /Enable light mode/i }).click();

  await page.getByTestId('nav-settings').click();
  await expect(page.getByRole('heading', { name: /System Settings/i })).toBeVisible();
  await page.getByRole('button', { name: /Preferences/i }).click();
  await capture(page, 'desktop-05-settings-preferences.png');
  await page.getByRole('button', { name: /Back to app/i }).click();

  await openOnboarding(page);
  await page.getByRole('button', { name: /Skills/i }).click();
  await capture(page, 'desktop-06-onboarding.png');

  await page.getByTestId('nav-mapview').click();
  await expect(page.locator('aside.map-panel')).toBeVisible({ timeout: 30_000 });
  await capture(page, 'desktop-07-map.png');

  await openMatches(page);
  await expect(page.getByTestId('matches-root')).toContainText(mockBackend.users.provider.fullName);
  await capture(page, 'desktop-08-matches-overview.png');

  await selectBaselineContact(page, mockBackend.users.provider.fullName);
  await expect(page.locator('[data-guide="matches-conversation"]')).toContainText('inspection window');
  await capture(page, 'desktop-09-human-chat.png');

  await selectBaselineProperty(page);
  await capture(page, 'desktop-10-property-detail.png');
  await capture(page, 'desktop-11-maxxis-closed.png');

  await page.getByTestId('maxxis-fab').click();
  await expect(page.getByTestId('maxxis-panel')).toBeVisible();
  await capture(page, 'desktop-12-maxxis-open.png');

  await sendMaxxisMessage(page, `Show property details for ${mockBackend.ids.property}`);
  await expect(page.getByTestId('maxxis-messages')).toContainText('Property Details');
  await capture(page, 'desktop-13-maxxis-property.png');

  const providers = page.getByText(/Available providers/i).last();
  await providers.scrollIntoViewIfNeeded();
  await capture(page, 'desktop-14-maxxis-provider.png');

  const workflow = page.getByText(/Deal Progress/i).last();
  await workflow.scrollIntoViewIfNeeded();
  await capture(page, 'desktop-15-maxxis-workflow.png');

  await sendMaxxisMessage(page, `Open Deal Copilot for ${mockBackend.ids.property}`);
  await expect(page.getByTestId('maxxis-messages')).toContainText('Deal Copilot');
  await page.getByText('Deal Copilot', { exact: true }).last().scrollIntoViewIfNeeded();
  await capture(page, 'desktop-16-maxxis-copilot.png');
});

test('mobile application visual baseline', async ({ page, mockBackend }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-baseline');

  await loginBaseline(page, mockBackend.users.investor);
  await capture(page, 'mobile-01-home.png');

  await openMatches(page);
  await expect(page.getByTestId('matches-root')).toContainText(mockBackend.users.provider.fullName);
  await capture(page, 'mobile-02-matches.png');

  await page.getByRole('button', { name: /Interests/i }).first().click();
  const interest = page.locator('.matches-col-interests').getByText('Dallas, TX', { exact: true }).first();
  await expect(interest).toBeVisible();
  await interest.click();
  await page.getByRole('button', { name: 'Portfolio', exact: true }).click();
  const portfolioItem = page.locator('[data-guide="matches-portfolio"]').getByText('Dallas, TX', { exact: true }).first();
  await expect(portfolioItem).toBeVisible();
  await portfolioItem.click();
  await expect(page.locator('[data-guide="matches-property-detail"]')).toBeVisible();
  await capture(page, 'mobile-03-property.png');

  await page.locator('[data-guide="matches-property-detail"]').getByRole('button', { name: /Back to List/i }).click();
  await page.getByTestId('maxxis-fab').click();
  await expect(page.getByTestId('maxxis-panel')).toBeVisible();
  await sendMaxxisMessage(page, `Show property details for ${mockBackend.ids.property}`);
  await capture(page, 'mobile-04-maxxis.png');
  await page.keyboard.press('Escape');

  await openOnboarding(page);
  await page.getByRole('button', { name: /Skills/i }).click();
  await capture(page, 'mobile-05-onboarding.png');

  await page.getByTestId('nav-app-menu').click();
  await capture(page, 'mobile-06-navigation.png');
});
