import { test, expect } from '../../fixtures/appFixture.js';

test('Unlocked keeps exactly canonical paid people/assets, updates live and stays selected when empty', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.route('**/functions/v1/**', route => route.abort());
  await page.route('**/__unlock_map', route => route.fulfill({ contentType: 'text/html', body: '<div id="root" style="height:100vh"></div>' }));
  await page.goto('/__unlock_map');
  await page.evaluate(async () => {
    window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
    await import('/src/index.css'); await import('/node_modules/leaflet/dist/leaflet.css');
    const React = (await import('/node_modules/.vite/deps/react.js')).default;
    const { createRoot } = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
    const { MapView } = await import('/src/pages/MapView.jsx');
    const { setLang } = await import('/src/i18n/translations.js'); setLang('pt');
    sessionStorage.setItem('ds_mapview_ui_state_v1', JSON.stringify({ showPeople: true, showProperties: true, panelCollapsed: false, panelTab: 'filters' }));
    sessionStorage.setItem('mapViewport', JSON.stringify({ center: [31.9686, -99.9018], zoom: 12 }));
    const properties = ['paid', 'locked-sibling', 'locked-other', 'own'].map((id, index) => ({
      id, ownerId: index < 2 ? 'seller' : index === 2 ? 'other' : 'viewer', primaryProfile: 'fsbo',
      type: 'SFR', address: id, city: 'Texas', state: 'TX', price: 250000, lat: 31.9686 + index * .002, lng: -99.9018,
      publishToShowcase: true, ownerPreview: { name: index < 2 ? 'Seller' : 'Other', type: 'FSBO', loc: 'TX' },
    }));
    const root = createRoot(document.getElementById('root'));
    window.__renderUnlockMap = mode => root.render(React.createElement(MapView, {
      showcaseProperties: properties, currentUserId: 'viewer', userProfile: {}, unlocked: [],
      personalProfile: { cardPriorityC: 'primary', fullNameFsbo: 'Self', locFsbo: 'TX' },
      nuggets: 20, setModal: () => {}, setPage: () => {}, openUnlock: () => {},
      unlockedContactMap: mode === 'empty' ? new Map() : new Map([['seller:fsbo', {
        ownerId: 'seller', primaryProfile: 'fsbo', unlockScope: mode === 'portfolio' ? 'contact' : 'property', unlockedPropertyIds: ['paid'],
      }]]), onMaxxisContextChange: value => { window.__unlockMapContext = value; },
    }));
    window.__renderUnlockMap('property');
  });
  const visibleProperties = () => page.evaluate(() => window.__unlockMapContext?.view?.visiblePropertyIds?.slice().sort());
  await expect.poll(visibleProperties).toEqual(['locked-other', 'locked-sibling', 'own', 'paid']);
  const unlockedButton = page.getByRole('button', { name: 'Desbloqueados', exact: true });
  await unlockedButton.click();
  await expect(unlockedButton).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(visibleProperties).toEqual(['paid']);
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(2);
  await page.getByRole('button', { name: /^Neg[oó]cios$/ }).click();
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(1);
  await expect.poll(visibleProperties).toEqual([]);
  await page.getByRole('button', { name: /^Neg[oó]cios$/ }).click();
  await page.getByRole('button', { name: 'Pessoas', exact: true }).click();
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(1);
  await expect.poll(visibleProperties).toEqual(['paid']);
  await page.getByRole('button', { name: 'Pessoas', exact: true }).click();
  await page.evaluate(() => window.__renderUnlockMap('portfolio'));
  await expect.poll(visibleProperties).toEqual(['locked-sibling', 'paid']);
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(3);
  await page.evaluate(() => window.__renderUnlockMap('empty'));
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(0);
  await expect(unlockedButton).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => window.__unlockMapContext?.view.filters.showOnlyUnlocked)).toBe(true);
  await unlockedButton.click();
  await expect.poll(visibleProperties).toEqual(['locked-other', 'locked-sibling', 'own', 'paid']);
});
