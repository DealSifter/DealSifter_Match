import { test, expect } from '../../fixtures/baselineFixture.js';
import {
  installLegacyMaxxisAvatarBaseline,
  installVisualStability,
  loginBaseline,
  visualMasks,
} from '../../support/baselineActions.js';
import { openDealAndRecallMemory, primeMaxxisDealMemory } from '../../support/maxxisMemoryActions.js';

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

test('desktop Maxxis deal memory recall, changes and forget confirmation', async ({ page, mockBackend }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-baseline');
  await primeMaxxisDealMemory(page, {
    userId: mockBackend.users.investor.id,
    propertyId: mockBackend.ids.property,
    serviceId: mockBackend.ids.providerService,
  });
  await loginBaseline(page, mockBackend.users.investor);
  mockBackend.state.maxxisProviderReplied = true;
  await openDealAndRecallMemory(page, { selectDeal: false });
  await expect(page.getByTestId('maxxis-composed-memory_recall')).toHaveScreenshot('desktop-maxxis-composed-memory.png');

  await page.getByTestId('maxxis-input').fill('Forget this deal memory');
  await page.getByTestId('maxxis-send').click({ force: true });
  await expect(page.getByTestId('maxxis-memory-forget-confirmation')).toBeVisible();
  await capture(page, 'desktop-31-maxxis-memory-forget-confirmation.png');
});

test('mobile Maxxis deal memory remains usable', async ({ page, mockBackend }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-baseline');
  await primeMaxxisDealMemory(page, {
    userId: mockBackend.users.investor.id,
    propertyId: mockBackend.ids.property,
    serviceId: mockBackend.ids.providerService,
  });
  await loginBaseline(page, mockBackend.users.investor);
  mockBackend.state.maxxisProviderReplied = true;
  await openDealAndRecallMemory(page, { selectDeal: false });
  await expect(page.getByTestId('maxxis-composed-memory_recall')).toBeInViewport();
  await expect(page.getByTestId('maxxis-followup-memory_what_changed')).toBeInViewport();
  await expect(page.getByTestId('maxxis-composed-memory_recall')).toHaveScreenshot('mobile-maxxis-composed-memory.png');
});
