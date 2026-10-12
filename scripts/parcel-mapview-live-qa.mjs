import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { setupMockSupabase } from '../e2e/support/mockSupabase.js';

if (!process.argv.includes('--live') || process.env.NODE_ENV === 'production') throw new Error('LOCAL_INTERNAL_QA_ONLY');
const output = 'qa/public-parcel-intelligence';
const records = JSON.parse(await readFile(`${output}/phase1b-source-inspection.json`, 'utf8'));
const pilot = records.find(row => row.sourceId === 'us-ut-salt-lake-parcels' && row.countyFips === '49035');
const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, watch: { usePolling: false } }, appType: 'custom' });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  console.log('Loading normal parcel resolver for live internal MapView QA');
  const { PublicParcelResolver, validateParcelQuery } = await server.ssrLoadModule('/supabase/functions/_shared/public-parcel/resolver.ts');
  const { ArcGISParcelAdapter } = await server.ssrLoadModule('/supabase/functions/_shared/public-parcel/arcgis.ts');
  const { resolveFeatureFlags } = await server.ssrLoadModule('/supabase/functions/_shared/featureFlags.ts');
  let sourceRequests = 0;
  const sourceFetch = (...args) => { sourceRequests++; return fetch(...args); };
  const resolver = new PublicParcelResolver({ providerFactory: source => new ArcGISParcelAdapter(source, sourceFetch) });
  const config = { public_parcel_intelligence: { enabled: true, environments: ['development'], percentage: 100, internalUserIds: ['internal-parcel-validation'] } };
  for (const mobile of [false, true]) {
    console.log(mobile ? 'Mobile live QA' : 'Desktop live QA');
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 } });
    // Only the unrelated application/auth boundary is mocked. ALL parcel/county
    // evidence comes from current government requests through the NORMAL resolver.
    await setupMockSupabase(context);
    const page = await context.newPage(); const calls = []; let initiatedRequests = 0; let pendingRequests = 0;
    await page.route('**/functions/v1/public-parcel', async route => {
      initiatedRequests++; pendingRequests++;
      try {
      const query = validateParcelQuery(route.request().postDataJSON());
      const value = await resolver.resolve(query);
      calls.push({ query, status: value.status, reason: value.reason, exceededLimit: value.exceededLimit, count: value.parcels.length, cacheHit: value.cacheHit, sourceIds: value.sourceIds });
      console.log(JSON.stringify(calls.at(-1)));
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(value) });
      } finally { pendingRequests--; }
    });
    await page.route('**/__parcel_internal_live', route => route.fulfill({ contentType: 'text/html', body: '<div id="root" style="height:100vh"></div>' }));
    await page.goto('http://127.0.0.1:4180/__parcel_internal_live');
    const identity = 'internal-parcel-validation';
    const flag = resolveFeatureFlags({ userId: identity, environment: 'development', remoteConfig: config }).public_parcel_intelligence;
    const parcel = pilot.point.parcels[0];
    await page.evaluate(async ({ point, parcel, flag }) => {
      window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
      await import('/src/index.css'); await import('/node_modules/leaflet/dist/leaflet.css');
      const React = (await import('/node_modules/.vite/deps/react.js')).default;
      const { createRoot } = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
      const { MapView } = await import('/src/pages/MapView.jsx');
      const { setLang } = await import('/src/i18n/translations.js'); setLang('pt');
      sessionStorage.setItem('ds_mapview_ui_state_v1', JSON.stringify({ showPeople: false, showProperties: true, panelCollapsed: false, panelTab: 'filters' }));
      sessionStorage.setItem('mapViewport', JSON.stringify({ center: [point.lat, point.lng], zoom: 20 }));
      const root = createRoot(document.getElementById('root')); let generation = 0;
      window.__liveRender = async (enabled = flag, zoom = 20) => {
        root.render(null);
        await new Promise(resolve => setTimeout(resolve, 50)); // Let prior viewport persistence finish before setting this independent control.
        window.__liveMountedAt = performance.now();
        sessionStorage.setItem('ds_mapview_ui_state_v1', JSON.stringify({ showPeople: false, showProperties: true, panelCollapsed: false, panelTab: 'filters', viewport: { center: [point.lat, point.lng], zoom } }));
        sessionStorage.setItem('mapViewport', JSON.stringify({ center: [point.lat, point.lng], zoom }));
        root.render(React.createElement(MapView, { key: ++generation, showcaseProperties: [{ id: 'internal-public-parcel-control', ownerId: 'qa-control-owner', primaryProfile: 'fsbo', type: 'SFR', address: parcel.situsAddress,
          city: 'Salt Lake City', state: 'UT', lat: point.lat, lng: point.lng, publishToShowcase: true, ownerPreview: { name: 'Internal parcel control', type: 'FSBO', loc: 'UT' } }],
          currentUserId: 'internal-parcel-validation', userProfile: {}, personalProfile: {}, unlocked: [], unlockedContactMap: new Map(),
          setModal: () => {}, setPage: () => {}, openUnlock: () => {}, onMaxxisContextChange: value => { window.__liveMapContext = value; }, parcelFeatureEnabled: enabled }));
      };
      await window.__liveRender(false);
    }, { point: pilot.controlPoint, parcel, flag });
    await expect(page.locator('.leaflet-container')).toBeVisible();
    const offReadyMs = await page.evaluate(() => performance.now() - window.__liveMountedAt);
    const beforeOff = sourceRequests; await page.waitForTimeout(800);
    expect(initiatedRequests).toBe(0); expect(sourceRequests).toBe(beforeOff);
    await page.evaluate(() => window.__liveRender(true));
    const onStart = Date.now();
    const toggle = page.getByRole('button', { name: 'Limites de parcelas', exact: true });
    await toggle.click();
    if (mobile) {
      await page.waitForTimeout(2000);
      await page.getByRole('complementary').getByRole('button', { name: 'Fechar painel', exact: true }).click();
    }
    // The internal layer permits native-tile overzoom to narrow capped urban
    // viewports; default public MapView is unchanged. Actual UI clicks, not fixtures.
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await expect(page.locator('.leaflet-public-parcels-pane path').first()).toBeVisible({ timeout: 30000 });
    const liveLayerReadyMs = Date.now() - onStart;
    // Wait for the zoom animation's final viewport request before selecting a
    // polygon; this does not force a click or bypass the actual UI lifecycle.
    await page.waitForTimeout(2500);
    await expect(page.locator('.leaflet-public-parcels-pane path').first()).toBeVisible({ timeout: 30000 });
    await page.screenshot({ path: `${output}/active-parcel-overlay-${mobile ? 'mobile' : 'desktop'}.png` });
    // Find a genuinely exposed parcel, not a path hidden beneath the filter panel
    // or a marker. This is a real pointer click, not a forced event/fixture popup.
    const clickPoint = await page.evaluate(() => {
      for (const path of document.querySelectorAll('.leaflet-public-parcels-pane path')) {
        const box = path.getBoundingClientRect();
        for (const fx of [.5, .3, .7]) for (const fy of [.5, .3, .7]) {
          const x = box.x + box.width * fx; const y = box.y + box.height * fy;
          if (x < 30 || x > innerWidth - 50 || y < 60 || y > innerHeight - 60) continue;
          if (document.elementFromPoint(x, y) === path) return { x, y };
        }
      }
      return null;
    });
    expect(clickPoint).not.toBeNull(); await page.mouse.click(clickPoint.x, clickPoint.y);
    const panel = page.getByTestId('public-parcel-panel'); await expect(panel).toBeVisible({ timeout: 30000 });
    await expect(panel).toContainText('Dados públicos da parcela'); await expect(panel).toContainText('Utah Geospatial Resource Center');
    await page.waitForTimeout(3500);
    await expect.poll(() => pendingRequests, { timeout: 30000 }).toBe(0);
    await expect(panel).toBeVisible(); // The real Leaflet auto-pan/viewport refresh must not dismiss it.
    const box = await panel.boundingBox(); expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
    await page.screenshot({ path: `${output}/${mobile ? 'active-parcel-mobile.png' : 'active-parcel-panel-desktop.png'}` });
    const queryCount = initiatedRequests;
    await page.evaluate(() => window.__liveRender(true, 12)); await toggle.click();
    await expect(page.getByRole('status')).toContainText('zoom 16+'); await page.waitForTimeout(700);
    expect(initiatedRequests).toBe(queryCount);
    results.push({ device: mobile ? 'MOBILE' : 'DESKTOP', status: 'PASS', normalResolver: true, liveGovernmentQueries: true, fixtureParcelResponses: 0,
      applicationAuthBoundary: 'LOCAL_TEST_IDENTITY_ONLY', productionAuthenticatedE2E: 'NOT_RUN', internalAllowlist: true, generalUserFlag: resolveFeatureFlags({ userId: 'general', environment: 'development', remoteConfig: config }).public_parcel_intelligence,
      offGISRequests: 0, lowZoomRequests: 0, panelUsable: true, calls });
    results.at(-1).performance = { offReadyMs, liveLayerReadyMs, measurement: 'Local cold mount and live source latency; not a production benchmark.' };
    await context.close();
  }
  await writeFile(`${output}/mapview-internal-e2e.json`, JSON.stringify({ observedAt: new Date().toISOString(), results, publicExposure: 'DISABLED', paidCalls: 0, canonicalWrites: 0 }, null, 2) + '\n');
  console.log(JSON.stringify({ results: results.map(result => ({ device: result.device, status: result.status, calls: result.calls.length })), sourceRequests }));
} finally { await browser.close(); await server.close(); }
