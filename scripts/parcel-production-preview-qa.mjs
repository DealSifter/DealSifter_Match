import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { setupMockSupabase } from '../e2e/support/mockSupabase.js';

if (!process.argv.includes('--live') || process.env.NODE_ENV === 'production') throw new Error('LOCAL_REAL_SOURCE_QA_ONLY');
const output = 'qa/public-parcel-intelligence/production-preview';
await mkdir(`${output}/screenshots`, { recursive: true });
const records = JSON.parse(await readFile('qa/public-parcel-intelligence/phase1b-source-inspection.json', 'utf8'));
const pilot = records.find(row => row.sourceId === 'us-ma-massgis-parcels' && row.countyFips === '25017');
const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, watch: { usePolling: false } }, appType: 'custom' });
const browser = await chromium.launch({ headless: true });
const results = []; let upstreamRequests = 0; let paidCalls = 0;
const save = async (name, value) => writeFile(`${output}/${name}`, JSON.stringify(value, null, 2) + '\n');
try {
  const { PublicParcelResolver, validateParcelQuery } = await server.ssrLoadModule('/supabase/functions/_shared/public-parcel/resolver.ts');
  const { ArcGISParcelAdapter } = await server.ssrLoadModule('/supabase/functions/_shared/public-parcel/arcgis.ts');
  const resolver = new PublicParcelResolver({ providerFactory: source => new ArcGISParcelAdapter(source, (...args) => { upstreamRequests++; return fetch(...args); }) });
  for (const [device, width, height] of [['DESKTOP', 1280, 900], ['TABLET', 768, 1024], ['MOBILE', 390, 844]]) {
    console.log(`Real MassGIS preview: ${device}`);
    const context = await browser.newContext({ viewport: { width, height } }); await setupMockSupabase(context);
    const page = await context.newPage(); const calls = []; let pending = 0; let initiated = 0;
    page.on('request', request => { if (/\/functions\/v1\/(?:rentcast|regrid|attom|gemini|stripe|maxxis-chat|create-checkout)/i.test(request.url())) paidCalls++; });
    await page.route('**/functions/v1/public-parcel', async route => {
      initiated++; pending++;
      try {
        const query = validateParcelQuery(route.request().postDataJSON()); const value = await resolver.resolve(query);
        calls.push({ status: value.status, count: value.parcels.length, cacheHit: value.cacheHit, exceededLimit: value.exceededLimit, sourceIds: value.sourceIds, zoom: query.zoom });
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(value) });
      } finally { pending--; }
    });
    await page.route('**/__parcel_preview_qa', route => route.fulfill({ contentType: 'text/html', body: '<div id="root" style="height:100vh"></div>' }));
    await page.goto('http://127.0.0.1:4180/__parcel_preview_qa');
    await page.evaluate(async ({ point, parcel }) => {
      window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
      await import('/src/index.css'); await import('/node_modules/leaflet/dist/leaflet.css');
      const React = (await import('/node_modules/.vite/deps/react.js')).default;
      const { createRoot } = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
      const { MapView } = await import('/src/pages/MapView.jsx'); const { setLang } = await import('/src/i18n/translations.js');
      const root = createRoot(document.getElementById('root')); let generation = 0;
      window.__previewRender = async ({ eligible = true, center = point, zoom = 18, preserve = false, language = 'pt' } = {}) => {
        const saved = preserve ? JSON.parse(sessionStorage.getItem('ds_mapview_ui_state_v1') || '{}') : {};
        root.render(null); await new Promise(resolve => setTimeout(resolve, 50)); setLang(language);
        const viewport = { center: [center.lat, center.lng], zoom };
        sessionStorage.setItem('ds_mapview_ui_state_v1', JSON.stringify({ showPeople: false, showProperties: true, panelCollapsed: false, panelTab: 'filters', viewport,
          selectedCardId: 'preview-control-property', parcelPreferenceOwner: saved.parcelPreferenceOwner, publicParcelBoundariesEnabled: saved.publicParcelBoundariesEnabled }));
        sessionStorage.setItem('mapViewport', JSON.stringify(viewport)); window.__previewMountedAt = performance.now();
        root.render(React.createElement(MapView, { key: ++generation, showcaseProperties: [{ id: 'preview-control-property', ownerId: 'qa-public-owner', primaryProfile: 'fsbo', type: 'SFR',
          address: parcel.situsAddress, city: 'Cambridge', state: 'MA', price: 100000, lat: center.lat, lng: center.lng, publishToShowcase: true,
          ownerPreview: { name: 'Public preview QA control', type: 'FSBO', loc: 'MA' } }], currentUserId: 'qa-preview-identity', userProfile: {}, personalProfile: {},
          unlocked: [], unlockedContactMap: new Map(), setModal: () => {}, setPage: () => {}, openUnlock: () => {},
          onMaxxisContextChange: value => { window.__previewContext = value; }, parcelFeatureEnabled: eligible, parcelQaGridEnabled: eligible }));
      };
      await window.__previewRender();
    }, { point: pilot.controlPoint, parcel: pilot.point.parcels[0] });
    const toggle = page.getByRole('button', { name: 'Limites de lotes', exact: true });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false'); await expect(toggle).toContainText('OFF');
    const offReadyMs = await page.evaluate(() => performance.now() - window.__previewMountedAt);
    await page.waitForTimeout(700); expect(initiated).toBe(0);
    const markerCount = await page.locator('.leaflet-marker-pane .leaflet-marker-icon').count();
    const toggleBox = await toggle.boundingBox(); const filterBox = await page.getByRole('complementary').boundingBox();
    expect(toggleBox.x + toggleBox.width).toBeLessThanOrEqual(filterBox.x + filterBox.width + 1);
    if (device === 'DESKTOP') await page.screenshot({ path: `${output}/screenshots/parcel-toggle-off-desktop.png` });
    await toggle.focus(); await page.keyboard.press('Space'); await expect(toggle).toHaveAttribute('aria-pressed', 'true'); await expect(toggle).toContainText('ON');
    await expect.poll(() => calls.length, { timeout: 30000 }).toBeGreaterThan(0); await expect.poll(() => pending, { timeout: 30000 }).toBe(0);
    expect(await page.locator('.leaflet-marker-pane .leaflet-marker-icon').count()).toBe(markerCount);
    if (device === 'DESKTOP') await page.screenshot({ path: `${output}/screenshots/parcel-toggle-on-desktop.png` });
    if (device === 'MOBILE') await page.screenshot({ path: `${output}/screenshots/parcel-toggle-mobile.png` });
    // Exercise re-enable at the SAME native viewport before zooming/popup auto-pan.
    const beforeCache = upstreamRequests; const beforeOff = initiated;
    await toggle.click(); await expect(page.locator('.leaflet-public-parcels-pane path')).toHaveCount(0); await page.waitForTimeout(700); expect(initiated).toBe(beforeOff);
    await toggle.click(); await page.waitForTimeout(2500); await expect.poll(() => pending, { timeout: 30000 }).toBe(0);
    expect(upstreamRequests).toBe(beforeCache);
    if (width <= 900) await page.getByRole('complementary').getByRole('button', { name: 'Fechar painel', exact: true }).click();
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await page.waitForTimeout(2500); await expect.poll(() => pending, { timeout: 30000 }).toBe(0);
    if (calls.at(-1)?.exceededLimit) {
      await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
      await page.waitForTimeout(2500); await expect.poll(() => pending, { timeout: 30000 }).toBe(0);
    }
    await expect.poll(() => page.locator('.leaflet-public-parcels-pane path').evaluateAll(paths => paths.filter(path => {
      const box = path.getBoundingClientRect(); return box.width > 1 && box.height > 1;
    }).length), { timeout: 30000 }).toBeGreaterThan(0);
    if (device === 'DESKTOP') await page.screenshot({ path: `${output}/screenshots/parcel-overlay-desktop.png` });
    const propertyBefore = await page.evaluate(() => JSON.parse(sessionStorage.getItem('ds_mapview_ui_state_v1')).selectedCardId);
    const click = await page.evaluate(() => {
      const paths = [...document.querySelectorAll('.leaflet-public-parcels-pane path')].sort((a, b) => {
        const distance = path => { const box = path.getBoundingClientRect(); return Math.hypot(box.x + box.width / 2 - innerWidth * .65, box.y + box.height / 2 - innerHeight / 2); };
        return distance(a) - distance(b);
      });
      for (const path of paths) {
        const box = path.getBoundingClientRect();
        for (const fx of [.5, .3, .7]) for (const fy of [.5, .3, .7]) {
          const x = box.x + box.width * fx; const y = box.y + box.height * fy;
          if (x > 40 && x < innerWidth - 50 && y > 100 && y < innerHeight - 60 && document.elementFromPoint(x, y) === path) return { x, y };
        }
      }
      return null;
    });
    expect(click).not.toBeNull(); await page.mouse.click(click.x, click.y);
    const panel = page.getByTestId('public-parcel-panel'); await expect(panel).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(2500); await expect.poll(() => pending, { timeout: 30000 }).toBe(0); await expect(panel).toBeVisible();
    await expect(panel).toContainText('MassGIS'); await expect(panel).toContainText('APN'); await expect(panel).toContainText('sqft'); await expect(panel).toContainText('Não substituem levantamento topográfico.');
    const panelBox = await panel.boundingBox(); expect(panelBox.x).toBeGreaterThanOrEqual(width > 900 ? filterBox.width : 0); expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(width + 1);
    expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('ds_mapview_ui_state_v1')).selectedCardId)).toBe(propertyBefore);
    if (device === 'DESKTOP') await page.screenshot({ path: `${output}/screenshots/parcel-panel-desktop.png` });
    if (device === 'MOBILE') await page.screenshot({ path: `${output}/screenshots/parcel-panel-mobile.png` });
    await page.getByRole('button', { name: 'Fechar dados do lote', exact: true }).click(); await expect(panel).not.toBeVisible();
    // Persist the explicit choice on remount; stale ON cannot bypass lost eligibility.
    await page.evaluate(() => window.__previewRender({ preserve: true })); await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => pending, { timeout: 30000 }).toBe(0);
    await page.evaluate(() => window.__previewRender({ eligible: false, preserve: true })); await expect(toggle).toHaveCount(0); await expect(page.locator('.leaflet-public-parcels-pane path')).toHaveCount(0);
    const disabledCount = initiated; await page.waitForTimeout(800); expect(initiated).toBe(disabledCount);
    await page.evaluate(() => window.__previewRender({ zoom: 12 })); await toggle.click(); await expect(page.getByRole('status')).toContainText('Aproxime o mapa');
    const lowCount = initiated; await page.waitForTimeout(800); expect(initiated).toBe(lowCount);
    if (device === 'DESKTOP') {
      await page.evaluate(() => window.__previewRender({ center: { lat: 33.519, lng: -86.81 }, zoom: 18 })); await toggle.click();
      await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
      await expect(page.getByRole('status')).toContainText('não disponíveis nesta área', { timeout: 30000 });
      await expect(page.locator('.leaflet-public-parcels-pane path')).toHaveCount(0);
      await page.screenshot({ path: `${output}/screenshots/parcel-no-coverage-desktop.png` });
    }
    results.push({ device, status: 'PASS', evidenceMode: 'LOCAL_REAL_GIS_WITH_MOCKED_APPLICATION_AUTH_BOUNDARY', productionAuthentication: 'BLOCKED',
      toggle: 'PASS', keyboard: 'PASS', persistedPreference: 'PASS', revokedEligibility: 'PASS', markerCountPreserved: true, parcelSelectionIndependent: true,
      cacheReenableExtraUpstreamRequests: 0, featureOffGISCalls: 0, lowZoomGISCalls: 0, panel: 'PASS', noCoverage: device === 'DESKTOP' ? 'PASS_REAL_CENSUS_NORMAL_RESOLVER' : 'NOT_RUN', offReadyMs, calls });
    await context.close();
  }
  expect(paidCalls).toBe(0);
  await save('mapview-runtime-validation.json', { observedAt: new Date().toISOString(), baseline: 'be3d3e94b43b1f3f90936f9e55890e50d14ff1e8', results, source: 'MassGIS / Middlesex County / MA', paidCalls, upstreamRequests, generalExposure: 'DISABLED' });
  await save('performance-validation.json', { offGISCalls: 0, lowZoomGISCalls: 0, reenableExtraUpstreamRequests: 0, cancellation: 'UNIT_LATEST_GENERATION_TEST_PASS', measurements: results.map(({ device, offReadyMs }) => ({ device, offReadyMs })), productionBenchmark: 'NOT_RUN' });
  console.log(JSON.stringify({ status: 'PASS', devices: results.map(row => row.device), upstreamRequests, paidCalls }));
} finally { await browser.close(); await server.close(); }
