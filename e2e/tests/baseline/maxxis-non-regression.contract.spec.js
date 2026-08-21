import { test, expect } from '../../fixtures/baselineFixture.js';
import {
  loginBaseline,
  openMatches,
  openOnboarding,
  selectBaselineContact,
  selectBaselineProperty,
  sendMaxxisMessage,
} from '../../support/baselineActions.js';

async function stableGeometry(locator, samples = 5) {
  const readings = [];
  for (let index = 0; index < samples; index += 1) {
    readings.push(await locator.boundingBox());
    await locator.page().waitForTimeout(120);
  }
  return readings.map((box) => ({
    x: Math.round(box?.x || 0),
    y: Math.round(box?.y || 0),
    width: Math.round(box?.width || 0),
    height: Math.round(box?.height || 0),
  }));
}

test('locks core surfaces, human chat and Maxxis coexistence', async ({ page, mockBackend }) => {
  await loginBaseline(page, mockBackend.users.investor);

  const palette = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    return {
      accent: styles.getPropertyValue('--accent-hex').trim().toLowerCase(),
      gold: styles.getPropertyValue('--gold-hex').trim().toLowerCase(),
      success: styles.getPropertyValue('--success-hex').trim().toLowerCase(),
    };
  });
  expect(palette).toEqual({ accent: '#35cac9', gold: '#f5a623', success: '#75ba75' });

  const feed = page.getByTestId('feed-stack');
  await expect(feed).toBeVisible();
  await page.getByTestId('feed-view-showcase').click({ force: true });
  await expect(feed).toContainText('Dallas');
  const feedGeometry = await stableGeometry(feed);
  expect(new Set(feedGeometry.map(JSON.stringify)).size).toBe(1);

  await openMatches(page);
  await expect(page.getByTestId('matches-root')).toContainText(mockBackend.users.provider.fullName);
  await expect(page.locator('.matches-col-interests')).toContainText('Dallas, TX');
  await expect(page.getByTestId('matches-root')).toContainText(/unlocked/i);

  await selectBaselineContact(page, mockBackend.users.provider.fullName);
  await expect(page.locator('[data-guide="matches-conversation"]')).toContainText('inspection window');
  await expect(page.locator('[data-guide="matches-conversation"]')).toContainText('reserve the 9 AM slot');

  await sendMaxxisMessage(page, `Show property details for ${mockBackend.ids.property}`);
  await expect(page.getByTestId('matches-root')).toBeVisible();
  await expect(page.getByTestId('maxxis-messages')).toContainText('Property Details');
  await expect(page.getByTestId('maxxis-messages')).toContainText(/Available providers/i);
  await expect(page.getByTestId('maxxis-messages')).toContainText(/Deal Progress/i);

  const conversationBeforeClose = await page.getByTestId('maxxis-messages').innerText();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('maxxis-panel')).toBeHidden();
  await page.getByTestId('maxxis-fab').click();
  await expect(page.getByTestId('maxxis-messages')).toContainText('Property Details');
  expect(await page.getByTestId('maxxis-messages').innerText()).toBe(conversationBeforeClose);

  await sendMaxxisMessage(page, `Open Deal Copilot for ${mockBackend.ids.property}`);
  await expect(page.getByTestId('maxxis-messages')).toContainText('Deal Copilot');
  await expect(page.getByTestId('maxxis-messages')).toContainText('Inspection');

  await page.keyboard.press('Escape');
  await selectBaselineProperty(page);
  await expect(page.locator('[data-guide="matches-property-detail"]')).toContainText('$250K');
  await expect(page.locator('[data-guide="matches-property-detail"]')).toContainText('6.5%');
});

test('locks navigation, MapView defaults, settings and onboarding', async ({ page, mockBackend }) => {
  await loginBaseline(page, mockBackend.users.investor);

  await page.getByTestId('nav-mapview').click();
  const mapPanel = page.locator('aside.map-panel');
  await expect(mapPanel).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => Math.round((await mapPanel.boundingBox())?.width || 0)).toBe(360);

  await page.getByTestId('nav-settings').click();
  await expect(page.getByRole('heading', { name: /System Settings/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Preferences/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Communication/i })).toBeVisible();

  await page.getByRole('button', { name: /Back to app/i }).click();
  await expect(mapPanel).toBeVisible({ timeout: 20_000 });
  await openOnboarding(page);
  await expect(page.getByTestId('onboarding-root')).toContainText(/Profile|Portfolio/i);
});
