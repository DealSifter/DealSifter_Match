import { test, expect, E2E_IDS } from '../../fixtures/appFixture.js';
import { loginAs } from '../../support/appActions.js';

function providerReplyEvent(dedupeKey) {
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

async function enableProactive(page, dedupeKey) {
  await page.addInitScript((event) => {
    window.localStorage.setItem('ds_e2e_maxxis_proactive', '1');
    window.localStorage.setItem('ds_e2e_maxxis_proactive_events', JSON.stringify([event]));
  }, providerReplyEvent(dedupeKey));
}

async function openPreferences(page) {
  await page.getByTestId('maxxis-fab').evaluate((element) => element.click());
  await expect(page.getByTestId('maxxis-panel')).toBeVisible();
  await page.getByTestId('maxxis-preferences-button').click();
  await expect(page.getByTestId('maxxis-preferences-popover')).toBeVisible();
}

test('keeps the blur fixed while the official PNG scales continuously without horizontal overflow', async ({ page, mockBackend }) => {
  test.setTimeout(300_000);
  await loginAs(page, mockBackend.users.investor);
  const fab = page.getByTestId('maxxis-fab');
  const lightSurface = await fab.evaluate((element) => getComputedStyle(element, '::before').backgroundImage);
  expect(lightSurface).toContain('radial-gradient');
  expect(lightSurface).toContain('rgba(5, 22, 25');
  await expect(fab).toHaveCSS('border-top-width', '0px');

  const fixedBoxBefore = await fab.boundingBox();
  await openPreferences(page);
  await page.getByTestId('maxxis-avatar-size-slider-header').fill('2.5');
  await expect(page.getByTestId('maxxis-avatar-size-value-header')).toContainText('2.50x');
  await expect(page.getByTestId('maxxis-avatar-header')).toHaveAttribute('data-avatar-size', '2.50');
  await page.locator('.maxxis-actions').getByRole('button', { name: /close|fechar|cerrar/i }).click();

  await expect(page.getByTestId('maxxis-avatar-fab')).toHaveAttribute('data-avatar-size', '2.50');
  const fixedBoxAfter = await fab.boundingBox();
  expect(fixedBoxAfter?.width).toBe(fixedBoxBefore?.width);
  expect(fixedBoxAfter?.height).toBe(fixedBoxBefore?.height);
  const artBox = await fab.locator('.maxxis-avatar-art').boundingBox();
  const rendererBox = await page.getByTestId('maxxis-avatar-fab').boundingBox();
  expect(artBox?.width).toBeGreaterThan(rendererBox?.width || 0);
  const artCenter = (artBox?.x || 0) + (artBox?.width || 0) / 2;
  const rendererCenter = (rendererBox?.x || 0) + (rendererBox?.width || 0) / 2;
  expect(Math.abs(artCenter - rendererCenter)).toBeLessThan(4);
  const badgeBox = await fab.getByText('AI', { exact: true }).boundingBox();
  expect((badgeBox?.x || 0) + (badgeBox?.width || 0) / 2).toBeLessThan((fixedBoxAfter?.x || 0) + (fixedBoxAfter?.width || 0) / 2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  const darkSurface = await fab.evaluate((element) => getComputedStyle(element, '::before').backgroundImage);
  expect(darkSurface).toContain('rgba(255, 255, 255');
  expect(darkSurface).not.toBe(lightSurface);

  await page.setViewportSize({ width: 375, height: 812 });
  await expect(fab).toBeInViewport();
  await expect(page.getByTestId('maxxis-avatar-fab')).toHaveAttribute('data-avatar-size', '2.50');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('treats the proactive bubble as communication with keyboard continuity and no autonomous action', async ({ page, mockBackend }) => {
  test.setTimeout(300_000);
  await enableProactive(page, 'presentation-keyboard-continuity');
  await loginAs(page, mockBackend.users.investor);

  const bubble = page.getByTestId('maxxis-proactive-bubble');
  const communication = page.getByTestId('maxxis-proactive-review');
  await expect(bubble).toBeVisible();
  await expect(communication).toHaveAccessibleName('Your provider replied.');
  await communication.focus();
  await expect(communication).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.getByTestId('maxxis-panel')).toBeVisible();
  await expect(bubble).toBeHidden();
  await expect(page.getByTestId('maxxis-composed-provider_review')).toContainText('Your provider replied.');
  await expect(page.getByTestId('maxxis-composed-provider_review')).toContainText('ready for review');
  await expect(page.getByTestId('maxxis-composed-provider_review')).toHaveCount(1);
  expect(mockBackend.state.unlockPrepares).toBe(0);
  expect(mockBackend.state.unlockConfirms).toBe(0);
  expect(mockBackend.state.messagesSent).toBe(0);
});

test('lets the associated avatar consume an insight once', async ({ page, mockBackend }) => {
  test.setTimeout(300_000);
  await enableProactive(page, 'presentation-avatar-continuity');
  await loginAs(page, mockBackend.users.investor);
  await expect(page.getByTestId('maxxis-proactive-bubble')).toBeVisible();

  await page.getByTestId('maxxis-fab').evaluate((element) => {
    element.click();
    element.click();
  });
  await expect(page.getByTestId('maxxis-panel')).toBeVisible();
  await expect(page.getByTestId('maxxis-composed-provider_review')).toHaveCount(1);
  expect(mockBackend.state.unlockPrepares).toBe(0);
  expect(mockBackend.state.unlockConfirms).toBe(0);
  expect(mockBackend.state.messagesSent).toBe(0);
});

test('keeps X as dismissal only on mobile', async ({ page, mockBackend }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 375, height: 812 });
  await enableProactive(page, 'presentation-dismiss-only');
  mockBackend.state.settingsPayloadByUserId[mockBackend.users.investor.id] = {
    userPreferences: {
      maxxis: {
        animationsEnabled: true,
        animationIntensity: 'SUBTLE',
        proactiveInsightsEnabled: true,
        avatarSize: 2.5,
      },
    },
  };
  await loginAs(page, mockBackend.users.investor);
  await expect(page.getByTestId('maxxis-proactive-bubble')).toBeVisible();
  await expect(page.getByTestId('maxxis-avatar-fab')).toHaveAttribute('data-avatar-size', '2.50');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: /dismiss maxxis deal ai insight|descartar insight/i }).click();
  await expect(page.getByTestId('maxxis-proactive-bubble')).toBeHidden();
  await expect(page.getByTestId('maxxis-panel')).toBeHidden();
  expect(mockBackend.state.messagesSent).toBe(0);
});
