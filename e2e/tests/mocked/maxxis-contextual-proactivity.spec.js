import { test, expect, E2E_IDS } from '../../fixtures/appFixture.js';
import { mkdir } from 'node:fs/promises';

async function mountAssistant(page, overrides = {}) {
  await page.route('**/__maxxis_harness', (route) => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
  await page.goto('/__maxxis_harness', { waitUntil: 'domcontentloaded' });
  await page.evaluate(async ({ propertyId, overrides: props }) => {
    window.$RefreshReg$ = () => {};
    window.$RefreshSig$ = () => (type) => type;
    window.__vite_plugin_react_preamble_installed__ = true;
    await import('/src/index.css');
    const reactModule = await import('/node_modules/.vite/deps/react.js');
    const React = reactModule.default || reactModule;
    const domModule = await import('/node_modules/.vite/deps/react-dom_client.js');
    const createRoot = domModule.createRoot || domModule.default.createRoot;
    const { MaxxisAssistant } = await import('/src/components/maxxis/MaxxisAssistant.jsx');
    const app = document.getElementById('root');
    if (app) app.style.display = 'none';
    const host = document.createElement('div'); document.body.appendChild(host);
    window.__contextualRoot = createRoot(host);
    const property = { id: propertyId, type: 'SFR', price: 114000, sqft: 1200, objective: 'Seller Financing', state: 'FL' };
    const options = { page: 'dashboard', sessionKey: 'contextual-browser', propertyContextId: propertyId,
      propertyCandidates: [property], proactiveFeatureEnabled: true, currentPlan: 'free',
      appContext: { surface: { page: 'dashboard' }, entity: { propertyId, type: 'PROPERTY', id: propertyId } }, ...props };
    window.__refreshContextual = () => window.__renderContextual({ appContext: { ...options.appContext, surface: { page: 'dashboard', subview: 'feed' } } });
    window.__renderContextual = (next) => { Object.assign(options, next); window.__contextualRoot.render(React.createElement(MaxxisAssistant, options)); };
    window.__renderContextual({});
  }, { propertyId: E2E_IDS.property, overrides });
}

test.describe('Contextual Maxxis prompts over real UI', () => {
  test.setTimeout(360000);
  test('property opening offers one concrete input with zero chat/provider acquisition; acceptance opens the exact field', async ({ page }) => {
    const requests = [];
    page.on('request', (request) => { if (/functions\/v1\/(maxxis-chat|property-intelligence)/.test(request.url())) requests.push(request.url()); });
    await mountAssistant(page);
    const bubble = page.getByTestId('maxxis-proactive-bubble');
    await expect(bubble).toContainText(/down payment|entrada/i);
    await expect(bubble).toHaveCount(1);
    expect(requests).toEqual([]);
    await page.getByTestId('maxxis-proactive-review').click();
    await expect(page.getByTestId('maxxis-panel')).toBeVisible();
    await expect(page.getByTestId('maxxis-analysis-gap-resolution').getByRole('spinbutton')).toBeVisible();
    await expect(page.getByTestId('maxxis-messages')).toContainText(/down payment|entrada/i);
    expect(requests).toEqual([]);
  });
  test('dismissal survives context refresh and OFF suppresses all prompts', async ({ page }) => {
    await mountAssistant(page);
    await expect(page.getByTestId('maxxis-proactive-bubble')).toBeVisible();
    await page.getByTestId('maxxis-proactive-dismiss').click();
    await page.evaluate(() => window.__refreshContextual());
    await expect(page.getByTestId('maxxis-proactive-bubble')).toBeHidden();
    await page.evaluate(() => window.__renderContextual({ userPreferences: { maxxis: { proactiveEnabled: false } } }));
    await expect(page.locator('[data-maxxis-proactive="disabled"]')).toBeAttached();
    await expect(page.getByTestId('maxxis-proactive-bubble')).toBeHidden();
  });
  test('in-chat insight stays lightweight and does not hijack an unrelated tax question', async ({ page }) => {
    await mountAssistant(page, { userPreferences: { maxxis: { proactiveEnabled: false } } });
    await page.getByTestId('maxxis-fab').click();
    await page.evaluate(() => window.__renderContextual({ userPreferences: { maxxis: { proactiveEnabled: true } } }));
    await expect(page.getByTestId('maxxis-smart-action-DECISION_PROACTIVE_SELLER_FINANCING_INPUT')).toHaveCount(1);
    await expect(page.getByTestId('maxxis-proactive-bubble')).toBeHidden();
    const requested = page.waitForRequest((request) => request.url().includes('/functions/v1/maxxis-chat') && request.method() === 'POST');
    await page.getByTestId('maxxis-input').fill('What is the property tax?');
    await page.getByTestId('maxxis-send').click();
    expect((await requested).postDataJSON().message).toBe('What is the property tax?');
    await expect(page.getByTestId('maxxis-analysis-gap-resolution')).toBeHidden();
  });
});

const shots = 'qa-artifacts/maxxis-conversational-avatar';
async function screenshot(page, name) {
  await mkdir(shots, { recursive: true });
  await page.screenshot({ path: `${shots}/${name}.png`, animations: 'disabled' });
}

test.describe('Conversational avatar placement and accessibility', () => {
  test.setTimeout(180000);
  for (const width of [360, 390, 430, 768, 1440]) {
    test(`speech tail remains attached at ${width}px, including enlarged avatar and viewport resize`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await mountAssistant(page, { userPreferences: { maxxis: { animationEnabled: false, avatarSize: width === 430 ? 2.5 : 1 } } });
      await expect(page.getByTestId('maxxis-communication-badge')).toHaveAttribute('data-phase', 'WAITING');
      const bubble = page.getByTestId('maxxis-proactive-bubble');
      await expect(bubble).toBeVisible();
      const geometry = await page.evaluate(() => {
        const avatar = document.querySelector('.maxxis-avatar-art').getBoundingClientRect();
        const bubble = document.querySelector('[data-testid="maxxis-proactive-bubble"]').getBoundingClientRect();
        return { avatar: { left: avatar.left, top: avatar.top, right: avatar.right, bottom: avatar.bottom },
          bubble: { left: bubble.left, top: bubble.top, right: bubble.right, bottom: bubble.bottom },
          side: document.querySelector('[data-testid="maxxis-communication-badge"]').dataset.side };
      });
      expect(geometry.bubble.left).toBeGreaterThanOrEqual(11);
      expect(geometry.bubble.right).toBeLessThanOrEqual(width - 11);
      expect(geometry.bubble.bottom).toBeLessThan(width < 768 ? 800 - 74 : 789);
      const gap = geometry.side === 'above' ? geometry.avatar.top - geometry.bubble.bottom : geometry.avatar.left - geometry.bubble.right;
      expect(gap).toBeGreaterThanOrEqual(10);
      expect(gap).toBeLessThanOrEqual(14);
      await expect(bubble.locator('button')).toHaveCount(2);
      expect((await bubble.locator('p').innerText()).length).toBeLessThanOrEqual(220);
      await expect(page.getByTestId('maxxis-avatar-fab')).toHaveAttribute('data-conversational-state', 'WAITING_FOR_USER');
      await screenshot(page, width < 768 ? `mobile-${width}-speech-bubble` : width === 768 ? 'tablet-speech-bubble' : 'desktop-waiting');
      if (width === 1440) await screenshot(page, 'desktop-proactive-speech-bubble');
      await page.setViewportSize({ width: width < 768 ? width + 20 : width - 100, height: 750 });
      await expect(bubble).toBeVisible();
      expect((await bubble.boundingBox()).x).toBeGreaterThanOrEqual(11);
    });
  }
  test('dismissal collapses to AI, Escape keeps chat closed, and keyboard can open it manually', async ({ page }) => {
    await mountAssistant(page, { userPreferences: { maxxis: { animationEnabled: false } } });
    await expect(page.getByTestId('maxxis-proactive-bubble')).toBeVisible();
    await page.getByTestId('maxxis-proactive-review').focus();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('maxxis-communication-badge')).toHaveAttribute('data-phase', 'IDLE_BADGE');
    await expect(page.getByTestId('maxxis-ai-badge')).toBeVisible();
    await expect(page.getByTestId('maxxis-avatar-fab')).toHaveAttribute('data-conversational-state', 'IDLE');
    await expect(page.getByTestId('maxxis-panel')).toBeHidden();
    await screenshot(page, 'desktop-idle');
    await page.getByTestId('maxxis-ai-badge').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('maxxis-panel')).toBeVisible();
  });
  test('reduced motion leaves communication functional and has no repeated live announcement', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mountAssistant(page);
    const bubble = page.getByTestId('maxxis-proactive-bubble');
    await expect(bubble).toBeVisible();
    await expect(bubble.locator('[aria-live="polite"]')).toHaveCount(1);
    expect(await bubble.evaluate((element) => getComputedStyle(element).animationName)).toBe('none');
    await page.getByTestId('maxxis-proactive-review').click();
    await expect(page.getByTestId('maxxis-analysis-gap-resolution')).toBeVisible();
    await expect(page.getByTestId('maxxis-proactive-bubble')).toHaveCount(0);
  });
  test('mobile bottom nav, idle preference and both theme tokens are respected', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mountAssistant(page, { userPreferences: { maxxis: { animationEnabled: false } } });
    await page.addStyleTag({ content: ':root { --ds-mobile-bottom-nav-visible-height: 100px; }' });
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    const bubble = page.getByTestId('maxxis-proactive-bubble');
    await expect(bubble).toBeVisible();
    expect((await bubble.boundingBox()).y + (await bubble.boundingBox()).height).toBeLessThan(744);
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
      await expect(bubble).toBeVisible();
      await screenshot(page, `${theme}-theme-bubble`);
    }
    await page.evaluate(() => window.__renderContextual({ userPreferences: { maxxis: { proactiveEnabled: false } } }));
    await expect(bubble).toHaveCount(0);
    await expect(page.getByTestId('maxxis-ai-badge')).toBeVisible();
    await screenshot(page, 'mobile-idle');
  });
  test('official visual states render without acquisition, including result-ready QA', async ({ page }) => {
    await mountAssistant(page, { userPreferences: { maxxis: { proactiveEnabled: false } } });
    const requests = [];
    page.on('request', (request) => { if (/functions\/v1\/(maxxis-chat|property-intelligence)/.test(request.url())) requests.push(request.url()); });
    await page.evaluate(async () => {
      const React = (await import('/node_modules/.vite/deps/react.js')).default;
      const { createRoot } = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
      const { MaxxisAvatarRenderer } = await import('/src/features/maxxis/avatar/MaxxisAvatarRenderer.jsx');
      const { resolveMaxxisAvatarState } = await import('/src/features/maxxis/avatar/maxxisAvatarStateMachine.js');
      const host = document.createElement('div'); document.body.appendChild(host);
      host.style.cssText = 'position:fixed;right:24px;bottom:24px;width:90px;height:90px';
      const root = createRoot(host);
      document.querySelector('[data-testid="maxxis-avatar-anchor"]').style.display = 'none';
      window.__visualState = (context) => root.render(React.createElement(MaxxisAvatarRenderer, { avatarState: { ...resolveMaxxisAvatarState(context), intensity: 'OFF' }, testId: 'qa-official-avatar' }));
    });
    for (const [state, context, file] of [
      ['OBSERVING', { contextObservationActive: true }, 'desktop-observing'],
      ['THINKING', { loading: true }, 'desktop-thinking'],
      ['ACTION_IN_PROGRESS', { loading: true, proactiveActionInProgress: true }, 'desktop-action-in-progress'],
      ['RESULT_READY', { lastActionResult: { success: true } }, 'desktop-result-ready'],
      ['POSITIVE_FEEDBACK', { lastActionResult: { success: true, visualPhase: 'POSITIVE_FEEDBACK' } }, 'desktop-positive-feedback'],
    ]) {
      await page.evaluate((value) => window.__visualState(value), context);
      await expect(page.getByTestId('qa-official-avatar')).toHaveAttribute('data-conversational-state', state);
      await expect(page.getByTestId('qa-official-avatar').locator('img')).toHaveCount(1);
      await screenshot(page, file);
    }
    expect(requests).toEqual([]);
  });
});
