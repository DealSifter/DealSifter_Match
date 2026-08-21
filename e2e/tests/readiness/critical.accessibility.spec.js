import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '../../fixtures/appFixture.js';
import { loginAs, openLogin } from '../../support/appActions.js';

// Product-approved brand colors are intentionally used for identity/status
// text as well as decorative UI. Keep the exception limited to those exact
// colors; every unrelated serious/critical contrast finding remains blocking.
const APPROVED_BRAND_CONTRAST_COLORS = [
  '#35cac9',
  '#5dd6d5',
  '#f5a623',
  '#75ba75',
];

function isApprovedBrandContrastNode(node) {
  const failure = String(node?.failureSummary || '').toLowerCase();
  return APPROVED_BRAND_CONTRAST_COLORS.some((color) => failure.includes(color));
}

async function expectNoHighSeverityViolations(page, context, selector) {
  const results = await new AxeBuilder({ page })
    .include(selector)
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const violations = results.violations
    .filter(({ impact }) => impact === 'critical' || impact === 'serious')
    .map((violation) => (
      violation.id === 'color-contrast'
        ? { ...violation, nodes: violation.nodes.filter((node) => !isApprovedBrandContrastNode(node)) }
        : violation
    ))
    .filter((violation) => violation.nodes.length > 0);
  const summary = violations.map(({ id, impact, nodes }) => ({
    id,
    impact,
    targets: nodes.map((node) => node.target),
    elements: nodes.map((node) => node.html),
    failures: nodes.map((node) => node.failureSummary),
  }));
  expect(summary, `${context}: ${JSON.stringify(summary, null, 2)}`).toEqual([]);
}

test('login dialog is labelled, keyboard-contained and free of high-severity violations', async ({ page }) => {
  await openLogin(page);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator(':focus')).toBeVisible();
  await expectNoHighSeverityViolations(page, 'login', '.ds-modal-content');

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('dashboard, Matches and Maxxis pass accessibility and keyboard checks', async ({ page, mockBackend }) => {
  await loginAs(page, mockBackend.users.investor);
  const guideDialog = page.getByRole('dialog', { name: /DealSifter Guide/i });
  await guideDialog.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
  if (await guideDialog.isVisible().catch(() => false)) {
    await guideDialog.getByRole('button', { name: /Close guide/i }).click();
  }
  await expectNoHighSeverityViolations(page, 'dashboard', '[data-testid="dashboard-root"]');

  await page.getByTestId('maxxis-fab').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('maxxis-panel')).toBeVisible();
  await expect(page.getByTestId('maxxis-input')).toBeFocused();
  await expectNoHighSeverityViolations(page, 'Maxxis', '[data-testid="maxxis-panel"]');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('maxxis-panel')).toBeHidden();

  await page.getByTestId('nav-matches').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('matches-root')).toBeVisible({ timeout: 20_000 });
  await expectNoHighSeverityViolations(page, 'Matches', '[data-testid="matches-root"]');

  await page.getByTestId('nav-dashboard').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('dashboard-root')).toBeVisible({ timeout: 20_000 });
  const profileLauncher = page.getByRole('button', { name: /E2E Investor.*profile/i }).first();
  await profileLauncher.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('onboarding-root')).toBeVisible({ timeout: 20_000 });
  await expectNoHighSeverityViolations(page, 'onboarding', '[data-testid="onboarding-root"]');
});
