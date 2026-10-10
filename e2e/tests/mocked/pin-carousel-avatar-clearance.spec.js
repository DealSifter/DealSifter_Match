import { test, expect } from '../../fixtures/appFixture.js';

test.setTimeout(120000);

async function mount(page, mode) {
  await page.route('**/functions/v1/**', route => route.abort());
  await page.route('**/__clearance_harness', route => route.fulfill({ contentType: 'text/html', body: '<div id="root" style="height:100vh"></div>' }));
  await page.goto('/__clearance_harness');
  await page.evaluate(async modeName => {
    window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
    await import('/src/index.css');
    const React = (await import('/node_modules/.vite/deps/react.js')).default;
    const { createRoot } = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
    const { setLang } = await import('/src/i18n/translations.js'); setLang('pt');
    const root = createRoot(document.getElementById('root'));
    if (modeName === 'map') {
      await import('/node_modules/leaflet/dist/leaflet.css');
      sessionStorage.setItem('ds_mapview_ui_state_v1', JSON.stringify({ showPeople: true, showProperties: false, panelCollapsed: true }));
      sessionStorage.setItem('mapViewport', JSON.stringify({ center: [31.9686, -99.9018], zoom: 8 }));
      const { MapView } = await import('/src/pages/MapView.jsx');
      const properties = [1, 2].map(index => ({ id: `property-${index}`, ownerId: 'owner', primaryProfile: 'fsbo',
        type: 'SFR', title: `Imóvel ${index}`, address: `Endereço ${index}`, city: 'New York', state: 'NY', price: 250000,
        lat: 40.7, lng: -73.9, publishToShowcase: true, images: ['/src/assets/maxxis/report-previews/sample-property-photo.jpg'],
        ownerPreview: { id: 'owner', name: 'Mr. Zen', primaryProfile: 'fsbo', type: 'FSBO', loc: 'TX', deals: 24,
          photo: '/src/assets/maxxis/avatar/avatar-idle.png' } }));
      root.render(React.createElement(MapView, { showcaseProperties: properties, currentUserId: 'viewer', nuggets: 20,
        userProfile: {}, unlocked: [], setModal: () => {}, setPage: () => {}, openUnlock: () => {} }));
    } else {
      const { MaxxisAssistant } = await import('/src/components/maxxis/MaxxisAssistant.jsx');
      const property = { id: '95370000-0000-4000-8000-000000000001', type: 'SFR', price: 2195000, sqft: 1838,
        objective: 'Seller Financing', state: 'CA' };
      window.__renderClearanceAvatar = size => root.render(React.createElement(MaxxisAssistant, {
        enabled: true, currentPlan: 'free', sessionKey: 'avatar-clearance', page: 'dashboard',
        propertyContextId: property.id, propertyCandidates: [property], proactiveFeatureEnabled: true, userPreferencesHydrated: true,
        userPreferences: { maxxis: { avatarSize: size, animationIntensity: 'NORMAL', proactiveInsightsEnabled: true } },
        appContext: { surface: { page: 'dashboard' }, entity: { propertyId: property.id, type: 'PROPERTY', id: property.id } } }));
      window.__renderClearanceAvatar(1);
    }
  }, mode);
}

test('real Leaflet person popup uses wide photos with a separate reachable close control', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await mount(page, 'map');
  const person = page.locator('.leaflet-marker-icon').filter({ has: page.locator('svg [fill="#20CFC8"]') }).first();
  await person.click();
  const popup = page.locator('.ds-person-leaflet-popup');
  await expect(popup).toBeVisible();
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(popup.locator('.ds-pin-portfolio img')).toBeVisible();
    const geometry = await popup.evaluate(node => {
      const photo = node.querySelector('.ds-pin-portfolio').getBoundingClientRect();
      const close = node.querySelector('.leaflet-popup-close-button').getBoundingClientRect();
      return { gap: photo.top - close.bottom, ratio: photo.width / photo.height, width: photo.width,
        closeReachable: document.elementFromPoint(close.left + close.width / 2, close.top + close.height / 2)?.closest('.leaflet-popup-close-button') !== null };
    });
    expect(geometry.gap).toBeGreaterThanOrEqual(3);
    expect(geometry.ratio).toBeCloseTo(16 / 9, 1);
    if (width === 1280) expect(geometry.width).toBeGreaterThanOrEqual(240);
    expect(geometry.closeReachable).toBe(true);
    await popup.screenshot({ path: testInfo.outputPath(`person-popup-${width}.png`) });
  }
  await popup.locator('.leaflet-popup-close-button').click();
  await expect(popup).toBeHidden();
});

for (const theme of ['light', 'dark']) {
  test(`complete avatar poses stay clear of interactive speech in ${theme}`, async ({ page }, testInfo) => {
    await mount(page, 'avatar');
    await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
    const bubble = page.getByTestId('maxxis-proactive-bubble');
    await expect(bubble).toBeVisible();
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const size of [1, 2.5]) {
        await page.evaluate(value => window.__renderClearanceAvatar(value), size);
        await expect(page.getByTestId('maxxis-avatar-fab')).toHaveAttribute('data-avatar-size', size.toFixed(2));
        for (const state of ['NOTICED', 'WAITING', 'SUCCESS']) {
          await page.evaluate(value => {
            localStorage.setItem('ds_e2e_maxxis_avatar_state', value);
            localStorage.setItem('ds_e2e_maxxis_avatar_intensity', 'NORMAL');
            window.dispatchEvent(new Event('ds:e2e:maxxis-avatar'));
          }, state);
          const layer = page.locator('.maxxis-fab .maxxis-avatar-layer--active');
          await expect(layer).toHaveAttribute('data-avatar-layer-state', state);
          await expect(layer).toHaveCSS('clip-path', 'none');
          await expect.poll(async () => page.evaluate(() => {
            const art = document.querySelector('.maxxis-fab .maxxis-avatar-layer--active').getBoundingClientRect();
            const speech = document.querySelector('.maxxis-speech-surface').getBoundingClientRect();
            return speech.bottom <= art.top || speech.right <= art.left || speech.top >= art.bottom || speech.left >= art.right;
          })).toBe(true);
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        }
      }
      await page.screenshot({ path: testInfo.outputPath(`avatar-${width}.png`) });
    }
  });
}
