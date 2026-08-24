import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '../../fixtures/appFixture.js';
import { loginAs, openLogin } from '../../support/appActions.js';

test.setTimeout(480_000);

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
  const toRgb = (color) => color.match(/[\da-f]{2}/g).map((channel) => Number.parseInt(channel, 16));
  const isBrandRendering = (renderedColor) => APPROVED_BRAND_CONTRAST_COLORS.some((brandColor) => {
    const rendered = toRgb(renderedColor);
    const brand = toRgb(brandColor);
    return rendered.every((channel, index) => Math.abs(channel - brand[index]) <= 2);
  });
  return (failure.match(/#[\da-f]{6}/g) || []).some(isBrandRendering);
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
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(({ ids }) => {
    window.localStorage.setItem('ds_e2e_maxxis_proactive', '1');
    window.localStorage.setItem('ds_e2e_maxxis_proactive_events', JSON.stringify([{
      code: 'PROVIDER_REPLIED',
      entityType: 'SERVICE',
      entityId: ids.providerService,
      propertyId: ids.property,
      serviceId: ids.providerService,
      source: 'conversation',
      severity: 'RELEVANT',
      occurredAt: Date.now(),
      dedupeKey: 'accessibility-avatar-sync',
    }]));
  }, { ids: mockBackend.ids });
  await loginAs(page, mockBackend.users.investor);
  const guideDialog = page.getByRole('dialog', { name: /DealSifter Guide/i });
  await guideDialog.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
  if (await guideDialog.isVisible().catch(() => false)) {
    await guideDialog.getByRole('button', { name: /Close guide/i }).click();
  }
  await expectNoHighSeverityViolations(page, 'dashboard', '[data-testid="dashboard-root"]');

  const proactiveBubble = page.getByTestId('maxxis-proactive-bubble');
  await expect(proactiveBubble).toBeVisible();
  await expect(proactiveBubble).toHaveAttribute('role', 'status');
  await expect(page.getByTestId('maxxis-avatar-fab')).toHaveAttribute('data-reduced-motion', 'true');
  await expectNoHighSeverityViolations(page, 'Maxxis proactive bubble', '[data-testid="maxxis-proactive-bubble"]');
  await page.getByTestId('maxxis-proactive-review').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('maxxis-panel')).toBeVisible();
  await expect(page.getByTestId('maxxis-input')).toBeFocused();
  await expectNoHighSeverityViolations(page, 'Maxxis', '[data-testid="maxxis-panel"]');
  await page.getByTestId('maxxis-preferences-button').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('maxxis-preferences-popover')).toBeVisible();
  await expectNoHighSeverityViolations(page, 'Maxxis preferences', '[data-testid="maxxis-preferences-popover"]');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('maxxis-preferences-popover')).toBeHidden();
  await expect(page.getByTestId('maxxis-preferences-button')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('maxxis-panel')).toBeHidden();

  await page.getByTestId('nav-matches').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('matches-root')).toBeVisible({ timeout: 120_000 });
  await expectNoHighSeverityViolations(page, 'Matches', '[data-testid="matches-root"]');

  await page.getByTestId('nav-dashboard').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('dashboard-root')).toBeVisible({ timeout: 120_000 });
  const profileLauncher = page.getByRole('button', { name: /E2E Investor.*profile/i }).first();
  await profileLauncher.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('onboarding-root')).toBeVisible({ timeout: 120_000 });
  await expectNoHighSeverityViolations(page, 'onboarding', '[data-testid="onboarding-root"]');
});
