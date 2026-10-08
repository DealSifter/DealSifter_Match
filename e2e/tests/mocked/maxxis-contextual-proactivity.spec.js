import { test, expect, E2E_IDS } from '../../fixtures/appFixture.js';

async function mountAssistant(page, overrides = {}) {
  await page.route('**/__maxxis_harness', (route) => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
  await page.goto('/__maxxis_harness', { waitUntil: 'domcontentloaded' });
  await page.evaluate(async ({ propertyId, overrides: props }) => {
    window.$RefreshReg$ = () => {};
    window.$RefreshSig$ = () => (type) => type;
    window.__vite_plugin_react_preamble_installed__ = true;
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
