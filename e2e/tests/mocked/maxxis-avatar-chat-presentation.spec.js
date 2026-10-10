import { test, expect } from '../../fixtures/appFixture.js';

async function mount(page) {
  await page.route('**/functions/v1/**', route => route.abort());
  await page.route('**/__presentation_harness', route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
  await page.goto('/__presentation_harness');
  await page.evaluate(async () => {
    window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
    await import('/src/index.css');
    await import('/src/components/maxxis/MaxxisAssistant.css');
    const React = (await import('/node_modules/.vite/deps/react.js')).default;
    const { createRoot } = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
    const { MaxxisAvatarRenderer } = await import('/src/features/maxxis/avatar/MaxxisAvatarRenderer.jsx');
    const { MaxxisArvResultExperience } = await import('/src/features/maxxis/arvReview/MaxxisArvResultExperience.jsx');
    const { resolveMaxxisAvatarState } = await import('/src/features/maxxis/avatar/maxxisAvatarStateMachine.js');
    const root = createRoot(document.getElementById('root'));
    let previous;
    window.__renderPresentation = (context = {}) => {
      previous = resolveMaxxisAvatarState({ ...context, previousState: previous, timelineManaged: true });
      root.render(React.createElement('div', { className: 'maxxis-panel' },
        React.createElement('div', { style: { width: 64, height: 64 } }, React.createElement(MaxxisAvatarRenderer, { avatarState: previous })),
        React.createElement('div', { className: 'maxxis-messages' },
          React.createElement('div', { className: 'maxxis-message maxxis-message-assistant' },
            React.createElement('div', { className: 'maxxis-message-body' }, 'Mensagem comum'),
            React.createElement(MaxxisArvResultExperience, { language: 'pt', evaluation: { status: 'ARV_UNAVAILABLE', confidence: 'LOW', eligibleCompCount: 0, limitations: ['TRANSACTION_QUALITY_UNKNOWN'], valuationSet: [], providerAvmCrossCheck: { value: 2360000, evidenceStatus: 'ESTIMATED' } } }),
            React.createElement('button', { className: 'maxxis-smart-action-chip' }, 'Revisar análise'),
            React.createElement('div', { className: 'maxxis-v2-page' }, React.createElement('h3', { style: { fontSize: 19 } }, 'PDF protegido'))))));
    };
    // The bug inherited the application's larger font outside .message-body.
    document.body.style.fontSize = '26px';
    window.__renderPresentation();
  });
  await expect(page.locator('.maxxis-avatar-layer')).toHaveCount(6);
}

test.describe('Maxxis stable conversational presentation', () => {
  test('navigation does not change poses or replace loaded avatar nodes; messages and badge do', async ({ page }) => {
    await mount(page);
    const avatar = page.getByTestId('maxxis-avatar-renderer');
    await expect(avatar).toHaveAttribute('data-avatar-state', 'IDLE');
    await page.evaluate(() => { window.__motionNode = document.querySelector('.maxxis-avatar-motion'); window.__images = [...document.querySelectorAll('.maxxis-avatar-layer')]; });
    for (const name of ['feed', 'matches', 'map', 'dashboard']) {
      await page.evaluate(pageName => window.__renderPresentation({ appContext: { surface: { page: pageName }, entity: { propertyId: 'property-1' } } }), name);
      await expect(avatar).toHaveAttribute('data-avatar-state', 'IDLE');
    }
    await page.evaluate(() => window.__renderPresentation({ loading: true }));
    await expect(avatar).toHaveAttribute('data-avatar-state', 'PROCESSING');
    await expect(avatar).toHaveAttribute('data-avatar-asset', 'avatar-processing');
    await page.evaluate(() => window.__renderPresentation({ communicationPhase: 'MESSAGE' }));
    await expect(avatar).toHaveAttribute('data-avatar-state', 'NOTICED');
    await expect(avatar).toHaveAttribute('data-avatar-asset', 'avatar-noticed');
    expect(await page.evaluate(() => window.__motionNode === document.querySelector('.maxxis-avatar-motion') && window.__images.every((img, i) => img === document.querySelectorAll('.maxxis-avatar-layer')[i] && img.complete && img.naturalWidth > 0))).toBe(true);
  });

  for (const theme of ['light', 'dark']) {
    test(`ordinary text, ARV, headings, dropdowns, results and buttons share the ${theme} metric`, async ({ page }) => {
      await mount(page);
      await page.evaluate(themeName => document.documentElement.dataset.theme = themeName, theme);
      await page.locator('.maxxis-arv-evidence-details > summary').click();
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 900 });
        const metrics = await page.evaluate(() => {
          const selectors = ['.maxxis-message-body', '.maxxis-arv-range', '.maxxis-arv-inline-metrics', '.maxxis-arv-provider-estimate strong', '.maxxis-arv-evidence-details > summary', '.maxxis-arv-evidence-drawer h4', '.maxxis-arv-evidence-drawer p', '.maxxis-smart-action-chip'];
          return selectors.map(selector => { const style = getComputedStyle(document.querySelector(selector)); return [style.fontSize, style.lineHeight, style.fontFamily]; });
        });
        expect(new Set(metrics.map(metric => JSON.stringify(metric))).size).toBe(1);
        expect(metrics[0][0]).toBe(width < 768 ? '12px' : '13px');
        expect(await page.locator('.maxxis-v2-page h3').evaluate(node => getComputedStyle(node).fontSize)).toBe('19px');
      }
    });
  }
});
