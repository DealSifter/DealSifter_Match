import { readFile, mkdir, writeFile, access } from 'node:fs/promises';
import { test, expect } from '../../fixtures/appFixture.js';

const output = 'qa/public-parcel-intelligence';
const diagnostics = JSON.parse(await readFile(`${output}/cross-state-validation.json`, 'utf8'));
const pilot = diagnostics.sources.find(source => source.countyFips === '06097' && source.normalizationPass);
const gable = JSON.parse(await readFile(`${output}/gable-public-parcel.json`, 'utf8'));
const labels = {
  pt: { button: 'Limites de parcelas', title: 'Dados públicos da parcela', source: 'Fonte', conflict: 'Conflito nos dados da parcela', empty: 'Sem fonte pública ativa e aprovada neste condado.' },
  en: { button: 'Parcel Boundaries', title: 'Public parcel data', source: 'Source', conflict: 'Parcel data conflict', empty: 'No active approved public source in this county.' },
  es: { button: 'Límites de parcelas', title: 'Datos públicos de la parcela', source: 'Fuente', conflict: 'Conflicto en datos de parcela', empty: 'Sin fuente pública activa y aprobada en este condado.' },
};

async function harness(page, { language = 'pt', point = pilot.controlPoint, zoom = 18, flag = true, baseline = false } = {}) {
  await page.route('**/__parcel_map', route => route.fulfill({ contentType: 'text/html', body: '<div id="root" style="height:100vh"></div>' }));
  await page.goto('/__parcel_map');
  await page.evaluate(async options => {
    window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
    await import('/src/index.css'); await import('/node_modules/leaflet/dist/leaflet.css');
    const React = (await import('/node_modules/.vite/deps/react.js')).default;
    const { createRoot } = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
    const current = (await import('/src/pages/MapView.jsx')).MapView;
    const original = options.baseline ? (await import('/.tmp-codex/parcel-map-baseline.jsx')).MapView : null;
    const { setLang } = await import('/src/i18n/translations.js'); setLang(options.language);
    sessionStorage.setItem('ds_mapview_ui_state_v1', JSON.stringify({ showPeople: false, showProperties: true, panelCollapsed: false, panelTab: 'filters' }));
    sessionStorage.setItem('mapViewport', JSON.stringify({ center: [options.point.lat, options.point.lng], zoom: options.zoom }));
    const properties = [{ id: 'control-property', ownerId: 'seller', primaryProfile: 'fsbo', type: 'SFR', address: 'Parcel QA control', city: 'Control', state: 'CA', price: 250000,
      lat: options.point.lat + .0005, lng: options.point.lng + .0005, publishToShowcase: true, ownerPreview: { name: 'Control seller', type: 'FSBO', loc: 'CA' } }];
    const root = createRoot(document.getElementById('root'));
    let generation = 0;
    window.__renderParcelMap = (which = 'current', feature = options.flag) => {
      window.__parcelMountedAt = performance.now(); window.__parcelContext = null;
      root.render(React.createElement(which === 'baseline' ? original : current, {
        key: ++generation, showcaseProperties: properties, currentUserId: 'viewer', userProfile: {}, unlocked: [], personalProfile: {},
        nuggets: 20, setModal: () => {}, setPage: () => {}, openUnlock: () => {}, parcelFeatureEnabled: feature,
        unlockedContactMap: new Map([['seller:fsbo', { ownerId: 'seller', primaryProfile: 'fsbo', unlockScope: 'property', unlockedPropertyIds: ['control-property'] }]]),
        onMaxxisContextChange: value => { window.__parcelContext = value; },
      }));
    };
    window.__renderParcelMap();
  }, { language, point, zoom, flag, baseline });
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__parcelContext?.view.visiblePropertyIds)).toEqual(['control-property']);
}

test('OFF is lazy, makes zero GIS requests and retains existing unlock filters', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const gis = []; const chunks = [];
  page.on('request', req => { if (/public-parcel|arcgis\/rest|TIGERweb/.test(req.url())) gis.push(req.url()); if (/PublicParcelLayer/.test(req.url())) chunks.push(req.url()); });
  await harness(page, { flag: false });
  await expect(page.getByRole('button', { name: labels.pt.button, exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Desbloqueados', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__parcelContext?.view.visiblePropertyIds)).toEqual(['control-property']);
  await page.evaluate(() => window.__renderParcelMap('current', true));
  await expect(page.getByRole('button', { name: labels.pt.button, exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.waitForTimeout(700);
  expect(gis).toEqual([]); expect(chunks).toEqual([]);
});

for (const language of ['pt', 'en', 'es']) {
  test(`Real normalized diagnostic polygon/panel, available fields only: ${language}`, async ({ page }) => {
    await page.setViewportSize({ width: language === 'es' ? 390 : 1280, height: language === 'es' ? 844 : 900 });
    const queries = [];
    await page.route('**/functions/v1/public-parcel', route => {
      queries.push(route.request().postDataJSON());
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...pilot.result, expiresAt: new Date(Date.now() + 300000).toISOString() }) });
    });
    await harness(page, { language });
    await page.getByRole('button', { name: labels[language].button, exact: true }).click();
    await expect(page.locator('.leaflet-public-parcels-pane path')).toHaveCount(pilot.result.parcels.length);
    if (language === 'es') {
      await page.getByRole('complementary').getByRole('button', { name: 'Cerrar panel', exact: true }).click();
      await expect(page.locator('.map-panel')).toHaveCSS('width', '0px');
    }
    expect(queries[0].operation).toBe('query-bounds'); expect(queries[0].zoom).toBeGreaterThanOrEqual(16);
    await page.locator('.leaflet-public-parcels-pane path').first().click({ force: true });
    const panel = page.getByTestId('public-parcel-panel');
    await expect(panel).toBeVisible(); await expect(panel).toContainText(labels[language].title);
    await expect(panel).toContainText(labels[language].conflict); await expect(panel).toContainText(pilot.result.parcels[0].apn);
    await expect(panel.locator('a')).toHaveText(pilot.authority);
    expect(await panel.locator('..').locator('..').evaluate(node => getComputedStyle(node).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
    await expect(panel).not.toContainText(/market value|AVM|Valor de mercado/i);
    await expect(panel.locator('dt').filter({ hasText: /Owner|Proprietário|Propietario|property tax|Imposto predial|Impuesto predial/i })).toHaveCount(0);
    const box = await panel.boundingBox(); const viewport = page.viewportSize();
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/pilot-parcel-panel-${language}.png` });
  });
}

test('Gable unavailable/unsupported and low zoom are honest, with zero GIS at low zoom', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const queries = [];
  await page.route('**/functions/v1/public-parcel', route => {
    const query = route.request().postDataJSON(); queries.push(query);
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'NO_ACTIVE_PUBLIC_SOURCE', countyFips: query.bounds[0] < -120 ? '06001' : '01073', parcels: [] }) });
  });
  await harness(page, { point: { lat: gable.appControl.lat, lng: gable.appControl.lng } });
  await page.getByRole('button', { name: labels.pt.button, exact: true }).click();
  await expect(page.getByRole('status')).toHaveText(labels.pt.empty);
  await expect(page.locator('.leaflet-public-parcels-pane path')).toHaveCount(0);
  await page.screenshot({ path: `${output}/gable-parcel-overlay.png` });
  await page.locator('.leaflet-marker-icon').first().click();
  await page.screenshot({ path: `${output}/gable-parcel-panel.png` });
  expect(queries.length).toBeGreaterThan(0);
  await harness(page, { point: { lat: 37.8044, lng: -122.2712 }, zoom: 17 });
  await page.getByRole('button', { name: labels.pt.button, exact: true }).click();
  await expect(page.getByRole('status')).toHaveText(labels.pt.empty);
  await page.screenshot({ path: `${output}/parcel-no-coverage.png` });
  queries.length = 0;
  await harness(page, { zoom: 12 });
  await page.getByRole('button', { name: labels.pt.button, exact: true }).click();
  await expect(page.getByRole('status')).toContainText('zoom 16+');
  await page.waitForTimeout(700); expect(queries).toEqual([]);
});

test('Original baseline vs parcel OFF: warm mounted MapView timing', async ({ page }) => {
  const baselineAvailable = await access('.tmp-codex/parcel-map-baseline.jsx').then(() => true, () => false);
  test.skip(!baselineAvailable, 'Generate historical QA fixture with node scripts/parcel-map-baseline-fixture.mjs');
  await page.setViewportSize({ width: 1280, height: 900 });
  const gis = []; page.on('request', req => { if (/public-parcel|arcgis\/rest|TIGERweb/.test(req.url())) gis.push(req.url()); });
  await harness(page, { flag: false, baseline: true });
  const samples = { baseline: [], current: [] };
  for (const which of ['baseline', 'current', 'baseline', 'current', 'baseline', 'current']) {
    await page.evaluate(mode => window.__renderParcelMap(mode, false), which);
    await expect.poll(() => page.evaluate(() => window.__parcelContext?.view.visiblePropertyIds)).toEqual(['control-property']);
    await expect(page.locator('.leaflet-marker-icon')).toHaveCount(1);
    samples[which].push(await page.evaluate(async () => { await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); return performance.now() - window.__parcelMountedAt; }));
  }
  const median = values => [...values].sort((a, b) => a - b)[1];
  const deltaMs = median(samples.current) - median(samples.baseline);
  // Warm local mount includes two frames and poll latency; allow 50ms plus 25% baseline variance.
  const budgetMs = 50 + median(samples.baseline) * .25;
  await writeFile(`${output}/mapview-performance.json`, JSON.stringify({ method: 'Warm baseline/current mounts, same dependencies, one marker, two painted frames; local browser, not production traffic', baselineSha: '9dbedf145bbe775248cc18e0a8801fc3209f1c71', samples, deltaMs, budgetMs, passed: deltaMs <= budgetMs, parcelOffGisRequests: gis.length }, null, 2));
  expect(gis).toEqual([]); expect(deltaMs).toBeLessThanOrEqual(budgetMs);
});
