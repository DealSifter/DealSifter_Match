import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '../../fixtures/baselineFixture.js';
import { loginBaseline } from '../../support/baselineActions.js';
import { openDealAndRecallMemory, primeMaxxisDealMemory } from '../../support/maxxisMemoryActions.js';

test.setTimeout(360_000);

async function expectNoSeriousStructuralViolations(page, selector) {
  const results = await new AxeBuilder({ page })
    .include(selector)
    .disableRules(['color-contrast'])
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const violations = results.violations
    .filter(({ impact }) => impact === 'critical' || impact === 'serious')
    .map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map((node) => node.target) }));
  expect(violations).toEqual([]);
}

test('Maxxis memory recall and forget confirmation are labelled and keyboard operable', async ({ page, mockBackend }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await primeMaxxisDealMemory(page, {
    userId: mockBackend.users.investor.id,
    propertyId: mockBackend.ids.property,
    serviceId: mockBackend.ids.providerService,
  });
  await loginBaseline(page, mockBackend.users.investor);
  mockBackend.state.maxxisProviderReplied = true;
  await openDealAndRecallMemory(page, { selectDeal: false });
  await expectNoSeriousStructuralViolations(page, '[data-testid="maxxis-memory-recall"]');
  await page.getByTestId('maxxis-followup-memory_what_changed').focus();
  await expect(page.getByTestId('maxxis-followup-memory_what_changed')).toBeFocused();

  await page.getByTestId('maxxis-input').fill('Forget this deal memory');
  await page.getByTestId('maxxis-send').click({ force: true });
  const confirmation = page.getByTestId('maxxis-memory-forget-confirmation');
  await expect(confirmation).toBeVisible();
  await expectNoSeriousStructuralViolations(page, '[data-testid="maxxis-memory-forget-confirmation"]');
  await page.getByTestId('maxxis-memory-forget-cancel').focus();
  await page.keyboard.press('Enter');
  await expect(confirmation).toBeHidden();
  await expect(page.getByTestId('maxxis-messages')).toContainText(/memory.*kept/i);
});
