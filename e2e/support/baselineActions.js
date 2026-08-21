import { expect } from '@playwright/test';
import { loginAs, openLogin, openMaxxis } from './appActions.js';

const BASELINE_STYLE = `
  *, *::before, *::after {
    animation-delay: 0s !important;
    animation-duration: 0s !important;
    caret-color: transparent !important;
    scroll-behavior: auto !important;
    transition-delay: 0s !important;
    transition-duration: 0s !important;
  }
  .maxxis-message-meta {
    color: transparent !important;
  }
`;

export async function primeBaselineStorage(page, userId) {
  await page.addInitScript(({ id }) => {
    localStorage.setItem('ds_theme', 'light');
    localStorage.setItem('lang', 'en');
    localStorage.setItem('ds_guidetips_enabled', '0');
    localStorage.setItem(`ds_guidetips_progress:${id}`, JSON.stringify({
      cycleCompleted: true,
      completedTours: ['initial', 'onboarding-entry', 'onboarding', 'feed', 'mapview', 'matches', 'settings'],
      completedAt: '2026-01-01T00:00:00.000Z',
    }));
    localStorage.setItem('ds_feed_session_seed', 'phase-6-baseline');
    localStorage.removeItem('mapViewPanelWidth');
    localStorage.removeItem('ds_mapview_ui_state_v1');
  }, { id: userId });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
}

export async function installVisualStability(page) {
  await page.addStyleTag({ content: BASELINE_STYLE });
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    window.scrollTo(0, 0);
  });
}

export async function openBaselineLogin(page, user) {
  await primeBaselineStorage(page, user.id);
  await openLogin(page);
  await installVisualStability(page);
  await expect(page.getByTestId('auth-modal')).toBeVisible();
}

export async function loginBaseline(page, user) {
  await primeBaselineStorage(page, user.id);
  await loginAs(page, user);
  await installVisualStability(page);
  await expect(page.getByTestId('dashboard-root')).toBeVisible();
}

export async function sendMaxxisMessage(page, text) {
  if (!(await page.getByTestId('maxxis-panel').isVisible().catch(() => false))) {
    await openMaxxis(page);
  }
  await page.getByTestId('maxxis-input').fill(text);
  const response = page.waitForResponse((item) => item.url().includes('/functions/v1/maxxis-chat'));
  await page.getByTestId('maxxis-send').click({ force: true });
  await response;
  await expect(page.getByTestId('maxxis-messages')).not.toContainText('Thinking');
}

export async function openMatches(page) {
  const desktop = page.getByTestId('nav-matches');
  if (await desktop.isVisible().catch(() => false)) await desktop.click();
  else await page.getByTestId('mobile-nav-matches').click();
  await expect(page.getByTestId('matches-root')).toBeVisible({ timeout: 20_000 });
}

export async function openOnboarding(page) {
  const desktop = page.getByTestId('nav-onboarding');
  if (await desktop.isVisible().catch(() => false)) await desktop.click();
  else if (await page.getByTestId('mobile-nav-onboarding').isVisible().catch(() => false)) {
    await page.getByTestId('mobile-nav-onboarding').click();
  } else {
    await page.getByTestId('nav-dashboard').click();
    const dashboard = page.getByTestId('dashboard-root');
    await expect(dashboard).toBeVisible({ timeout: 20_000 });
    await dashboard.getByRole('button', { name: /profile/i }).first().click();
  }
  await expect(page.getByTestId('onboarding-root')).toBeVisible({ timeout: 20_000 });
}

export async function selectBaselineContact(page, providerName) {
  const contact = page.getByText(providerName, { exact: false }).first();
  await expect(contact).toBeVisible({ timeout: 20_000 });
  await contact.click();
  await expect(page.locator('[data-guide="matches-conversation"]')).toBeVisible({ timeout: 20_000 });
}

export async function selectBaselineProperty(page) {
  const interest = page.locator('.matches-col-interests').getByText('Dallas, TX', { exact: true }).first();
  await expect(interest).toBeVisible({ timeout: 20_000 });
  await interest.click();
  const portfolioItem = page.locator('[data-guide="matches-portfolio"]').getByText('Dallas, TX', { exact: true }).first();
  await expect(portfolioItem).toBeVisible({ timeout: 20_000 });
  await portfolioItem.click();
  await expect(page.locator('[data-guide="matches-property-detail"]')).toBeVisible({ timeout: 20_000 });
}

export function visualMasks(page) {
  return [
    page.locator('.leaflet-tile-container:visible'),
    page.locator('[aria-label*="notification" i] time:visible'),
  ];
}
