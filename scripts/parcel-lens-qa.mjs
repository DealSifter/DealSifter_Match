import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, expect as baseExpect } from '@playwright/test';
import { setupMockSupabase } from '../e2e/support/mockSupabase.js';

const expect = baseExpect.configure({ timeout: 20000 });
async function pointerClick(page, locator) {
  // Let the native popup's one-time autopan settle; Playwright then checks
  // visibility, stability and actual pointer hit testing (never force=true).
  await page.waitForTimeout(400);
  await locator.click({ timeout: 30000 });
}

if (!process.argv.includes('--live') || process.env.NODE_ENV === 'production') throw new Error('LOCAL_REAL_SOURCE_QA_ONLY');
const output = 'qa/public-parcel-intelligence/parcel-lens'; await mkdir(`${output}/screenshots`, { recursive: true });
const scope = process.argv.find(value => value.startsWith('--case='))?.slice(7);
const inspection = JSON.parse(await readFile('qa/public-parcel-intelligence/phase1b-source-inspection.json', 'utf8'));
const pilot = inspection.find(row => row.sourceId === 'us-ma-massgis-parcels' && row.countyFips === '25017');
const browser = await chromium.launch({ headless: true }); const results = []; let upstreamGISCalls = 0; let paidProviderCalls = 0;
try {
  // Node 22 --experimental-transform-types runs the actual dependency closure
  // without a second Vite SSR server or its unrelated transform/watch work.
  const { PublicParcelResolver, validateParcelQuery } = await import('../supabase/functions/_shared/public-parcel/resolver.ts');
  const { ArcGISParcelAdapter } = await import('../supabase/functions/_shared/public-parcel/arcgis.ts');
  const { parcelLabels } = await import('../src/features/parcel/parcelPresentation.js');
  const resolver = new PublicParcelResolver({ providerFactory: source => new ArcGISParcelAdapter(source, (...args) => { upstreamGISCalls++; return fetch(...args); }) });
  const cases = [['DESKTOP',1280,900,'pt','light'], ['DESKTOP',1280,900,'en','dark'], ['MOBILE',390,844,'pt','dark'], ['MOBILE',390,844,'es','light'], ['TABLET',768,1024,'es','dark']];
  if (scope && !cases.some(([device,,,language,theme]) => `${device}-${language}-${theme}` === scope)) throw new Error('INVALID_QA_CASE');
  for (const [device, width, height, language, theme] of cases.filter(([device,,,language,theme]) => !scope || `${device}-${language}-${theme}` === scope)) {
    console.log(`Parcel Lens real GIS: ${device} ${language} ${theme}`);
    const t = parcelLabels(language); const context = await browser.newContext({ viewport: { width, height } }); await setupMockSupabase(context);
    const page = await context.newPage(); const calls = []; let pending = 0;
    page.on('pageerror', error => console.error(error.message));
    page.on('request', request => { if (/\/functions\/v1\/(rentcast|regrid|attom|gemini|stripe|maxxis-chat|create-checkout)/i.test(request.url())) paidProviderCalls++; });
    await page.route('**/functions/v1/public-parcel', async route => {
      pending++; const query = validateParcelQuery(route.request().postDataJSON());
      try { const result = await resolver.resolve(query); calls.push({ operation: query.operation, status: result.status, count: result.parcels.length, exceededLimit: result.exceededLimit, cacheHit: result.cacheHit });
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(result) }); }
      finally { pending--; }
    });
    await page.route('**/__parcel_lens_qa', route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto('http://127.0.0.1:4180/__parcel_lens_qa');
    await page.evaluate(async ({ point, parcel, language, theme }) => {
      window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
      await import('/src/index.css'); await import('/node_modules/leaflet/dist/leaflet.css');
      const React = (await import('/node_modules/.vite/deps/react.js')).default;
      const { createRoot } = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
      const { MapView } = await import('/src/pages/MapView.jsx'); const { setLang } = await import('/src/i18n/translations.js'); setLang(language);
      const { setTheme } = await import('/src/theme/colors.jsx'); if (setTheme) setTheme(theme); document.documentElement.dataset.theme = theme;
      sessionStorage.setItem('ds_mapview_ui_state_v1', JSON.stringify({ showPeople: false, showProperties: true, panelCollapsed: true, panelTab: 'filters', viewport: { center: [point.lat, point.lng], zoom: 17 } }));
      sessionStorage.setItem('mapViewport', JSON.stringify({ center: [point.lat, point.lng], zoom: 17 })); window.__navigation = [];
      createRoot(document.getElementById('root')).render(React.createElement(MapView, {
        showcaseProperties: [{ id: 'lens-control-property', ownerId: 'qa-source-owner', primaryProfile: 'fsbo', type: 'SFR', address: parcel.situsAddress, city: 'Cambridge', state: 'MA', price: 100000,
          lat: point.lat, lng: point.lng, publishToShowcase: true, ownerPreview: { name: 'Public QA control', type: 'FSBO', loc: 'MA' } }],
        currentUserId: 'qa-lens-identity', userProfile: {}, personalProfile: {}, unlocked: [], unlockedContactMap: new Map(), setModal: () => {},
        setPage: page => window.__navigation.push(page), openUnlock: () => {}, parcelFeatureEnabled: true, parcelQaGridEnabled: false,
      }));
    }, { point: pilot.controlPoint, parcel: pilot.point.parcels[0], language, theme });
    await expect(page.getByTestId('map-zoom-level')).toHaveText('Z17'); await page.waitForTimeout(700); expect(calls).toHaveLength(0);
    await expect(page.getByRole('button', { name: t.boundaries, exact: true })).toHaveCount(0);
    await page.locator('.leaflet-marker-pane .leaflet-marker-icon').first().click();
    const magnifier = page.getByRole('button', { name: t.magnifier, exact: true }); await expect(magnifier).toBeVisible({ timeout: 30000 });
    expect(calls.map(call => call.operation)).toEqual(['query-point']);
    await page.screenshot({ path: `${output}/screenshots/property-${device.toLowerCase()}-${language}-${theme}.png` });
    await pointerClick(page, magnifier); await expect(page.getByTestId('public-parcel-panel')).toBeVisible();
    expect(await page.getByTestId('public-parcel-panel').evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThan(240);
    expect(await page.getByTestId('public-parcel-panel').evaluate(element => Boolean(element.closest('.leaflet-popup-pane')))).toBe(true);
    await expect(page.locator('.ds-parcel-lens-principal')).toHaveCount(1); await expect(page.locator('.ds-parcel-lens-circle')).toHaveCount(1);
    await expect.poll(() => calls.length, { timeout: 30000 }).toBe(2); await expect.poll(() => pending, { timeout: 30000 }).toBe(0);
    await expect(page.locator('.ds-parcel-lens-neighbor').first()).toBeAttached();
    await page.waitForTimeout(2000); const zoomAfterFly = Number((await page.getByTestId('map-zoom-level').textContent()).slice(1)); expect(zoomAfterFly).toBeGreaterThan(17);
    await page.screenshot({ path: `${output}/screenshots/lens-${device.toLowerCase()}-${language}-${theme}.png` });
    await pointerClick(page, page.getByRole('button', { name: t.propertyPage, exact: true })); await expect(page.locator('.ds-property-pin-photo')).toBeVisible();
    await pointerClick(page, page.getByRole('button', { name: t.parcelPage, exact: true })); expect(calls).toHaveLength(2);
    // Close only the existing popup, NOT the lens. Native parcel pointer clicks
    // must remain usable for public neighbors without DealSifter PINs.
    await page.locator('.leaflet-popup-close-button').click();
    const findNeighbor = () => page.evaluate(() => {
      for (const path of document.querySelectorAll('.ds-parcel-lens-neighbor')) {
        const box = path.getBoundingClientRect();
        for (const fx of [.5,.3,.7]) for (const fy of [.5,.3,.7]) {
          const x=box.x+box.width*fx; const y=box.y+box.height*fy;
          if (x>30 && x<innerWidth-45 && y>95 && y<innerHeight-80 && document.elementFromPoint(x,y)===path) return {x,y};
        }
      } return null;
    });
    let click = await findNeighbor();
    // The parcel fit intentionally starts close. Show more of the retained
    // neighborhood, without issuing any new GIS request, to click a real lot.
    while (!click && Number((await page.getByTestId('map-zoom-level').textContent()).slice(1)) > 16) {
      const zoom = Number((await page.getByTestId('map-zoom-level').textContent()).slice(1));
      await page.getByRole('button',{name:'Zoom out',exact:true}).click();
      await expect(page.getByTestId('map-zoom-level')).toHaveText(`Z${zoom-1}`);
      click = await findNeighbor();
    }
    expect(click).not.toBeNull(); await page.mouse.click(click.x,click.y); await expect(page.getByTestId('public-parcel-panel')).toBeVisible();
    expect(await page.getByTestId('public-parcel-panel').evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThan(240);
    expect(await page.getByTestId('public-parcel-panel').evaluate(element => Boolean(element.closest('.leaflet-popup-pane')))).toBe(true);
    await expect(page.locator('.ds-property-pin-photo')).toHaveCount(0); expect(await page.evaluate(() => window.__navigation)).toEqual([]);
    await page.screenshot({ path: `${output}/screenshots/neighbor-${device.toLowerCase()}-${language}-${theme}.png` });
    await page.locator('.leaflet-popup-close-button').click();
    for (let zoom=Number((await page.getByTestId('map-zoom-level').textContent()).slice(1));zoom>12;zoom--) {
      await page.getByRole('button',{name:'Zoom out',exact:true}).click();
      await expect(page.getByTestId('map-zoom-level')).toHaveText(`Z${zoom-1}`);
    }
    await expect(page.getByTestId('map-zoom-level')).toHaveText('Z12'); await page.waitForTimeout(2500); expect(calls).toHaveLength(2);
    await expect(page.locator('.ds-parcel-lens-principal')).toHaveCount(1); await expect(page.locator('.ds-parcel-lens-circle')).toHaveCount(1);
    await page.screenshot({ path: `${output}/screenshots/zoom-out-${device.toLowerCase()}-${language}-${theme}.png` });
    await page.getByRole('button',{name:t.closeLens,exact:true}).click(); await expect(page.locator('.ds-parcel-lens-circle')).toHaveCount(0);
    expect(calls).toHaveLength(2); expect(await page.evaluate(() => window.__navigation)).toEqual([]);
    results.push({device,language,theme,status:'PASS',zoomAfterFly,pointLookup:1,fixedRadiusNeighborQuery:1,zoomOutExtraRequests:0,neighborWithoutPin:'PASS',popupPageSwitch:'PASS',manualClose:'PASS',qaGridHidden:true,calls});
    await context.close();
  }
  expect(paidProviderCalls).toBe(0);
  await writeFile(`${output}/runtime-validation${scope ? `-${scope}` : ''}.json`,JSON.stringify({mode:'LOCAL_REAL_GIS_WITH_MOCKED_APP_AUTH_NOT_PRODUCTION_AUTH',source:'MassGIS / Middlesex County / MA',results,upstreamGISCalls,paidProviderCalls},null,2)+'\n');
  console.log(JSON.stringify({status:'PASS',cases:results.length,upstreamGISCalls,paidProviderCalls}));
} finally { await browser.close(); }
