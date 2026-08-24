import { test, expect } from '../../fixtures/baselineFixture.js';
import { loginBaseline } from '../../support/baselineActions.js';
import { openDealAndRecallMemory, primeMaxxisDealMemory } from '../../support/maxxisMemoryActions.js';

test.setTimeout(360_000);

test('Maxxis deal memory recall and explicit forget confirmation fit the mobile viewport', async ({ page, mockBackend }) => {
  await primeMaxxisDealMemory(page, {
    userId: mockBackend.users.investor.id,
    propertyId: mockBackend.ids.property,
    serviceId: mockBackend.ids.providerService,
  });
  await loginBaseline(page, mockBackend.users.investor);
  mockBackend.state.maxxisProviderReplied = true;
  await openDealAndRecallMemory(page, { selectDeal: false });
  await expect(page.getByTestId('maxxis-memory-recall')).toBeInViewport();
  await expect(page.getByTestId('maxxis-followup-memory_what_changed')).toBeInViewport();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);

  await page.getByTestId('maxxis-input').fill('Forget this deal memory');
  await page.getByTestId('maxxis-send').click({ force: true });
  await expect(page.getByTestId('maxxis-memory-forget-confirmation')).toBeInViewport();
  await expect(page.getByTestId('maxxis-memory-forget-confirm')).toBeEnabled();
  await expect(page.getByTestId('maxxis-memory-forget-cancel')).toBeEnabled();
});
