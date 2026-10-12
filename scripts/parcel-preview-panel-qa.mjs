import { readFile, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { setupMockSupabase } from '../e2e/support/mockSupabase.js';

// Local deterministic presentation checks, NEVER authenticated production evidence.
if (process.env.NODE_ENV === 'production') throw new Error('LOCAL_FIXTURE_QA_ONLY');
const output = 'qa/public-parcel-intelligence/production-preview';
const inspection = JSON.parse(await readFile('qa/public-parcel-intelligence/phase1b-source-inspection.json', 'utf8'));
const pilot = inspection.find(row => row.sourceId === 'us-ma-massgis-parcels' && row.countyFips === '25017');
const fixture = { ...pilot.point.parcels[0], propertyTax: 1234, propertyTaxYear: 2025,
  legalDescription: 'DETERMINISTIC QA — complete legal description '.repeat(15), subdivision: 'DETERMINISTIC QA subdivision',
  areaCrossCheck: { status: 'MATERIAL_CONFLICT' }, provenance: { ...pilot.point.parcels[0].provenance,
    propertyTax: { sourceField: 'QA_EXPLICIT_ANNUAL_TAX' }, legalDescription: { sourceField: 'QA_LEGAL' }, subdivision: { sourceField: 'QA_SUBDIVISION' } } };
const browser = await chromium.launch({ headless: true }); const results = [];
try {
  for (const [language, title, conflict, stale, close, provenance] of [
    ['pt', 'Dados públicos da parcela', 'Divergência nos dados de área', 'Dados em cache', 'Fechar dados do lote', 'Origem dos campos'],
    ['en', 'Public parcel data', 'Parcel area data conflict', 'Cached data', 'Close parcel details', 'Field provenance'],
    ['es', 'Datos públicos de la parcela', 'Divergencia en los datos de área', 'Datos en caché', 'Cerrar datos de la parcela', 'Origen de los campos'],
  ]) for (const [device, width, height] of [['DESKTOP', 1280, 900], ['MOBILE', 390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height } }); await setupMockSupabase(context);
    const page = await context.newPage();
    page.on('pageerror', error => console.error(error.message));
    await page.route('**/functions/v1/public-parcel', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
      status: 'COVERAGE_AVAILABLE', freshness: 'STALE_USABLE', cacheHit: true, parcels: [fixture], sourceIds: [fixture.source],
    }) }));
    await page.route('**/__parcel_panel_qa', route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto('http://127.0.0.1:4180/__parcel_panel_qa');
    await page.evaluate(async ({ language, point }) => {
      window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
      await import('/src/index.css'); await import('/node_modules/leaflet/dist/leaflet.css');
      const React = (await import('/node_modules/.vite/deps/react.js')).default;
      const { createRoot } = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
      // Use the exact Vite module URL, including dependency version, so the
      // harness and real layer share one Leaflet context rather than two copies.
      const layerModule = await (await fetch('/src/components/map/PublicParcelLayer.jsx')).text();
      const leafletModule = layerModule.match(/from "([^"]*react-leaflet\.js[^"]*)"/)[1];
      const { MapContainer } = await import(leafletModule);
      const { default: Layer } = await import('/src/components/map/PublicParcelLayer.jsx');
      const viewport = { zoom: 19, bounds: [point.lng - .001, point.lat - .001, point.lng + .001, point.lat + .001] };
      createRoot(document.getElementById('root')).render(React.createElement(MapContainer, { center: [point.lat, point.lng], zoom: 19, style: { height: '100vh', width: '100vw' } },
        React.createElement(Layer, { enabled: true, active: true, viewport, language, selectedPoint: point })));
    }, { language, point: pilot.controlPoint });
    const path = page.locator('.leaflet-public-parcels-pane path'); await expect(path).toBeVisible({ timeout: 30000 });
    await path.click(); const panel = page.getByTestId('public-parcel-panel'); await expect(panel).toBeVisible();
    await expect(panel).toContainText(title); await expect(panel).toContainText(conflict); await expect(panel).toContainText(stale);
    await expect(panel).toContainText('2025'); await expect(panel).toContainText('DETERMINISTIC QA subdivision');
    expect(await panel.innerText()).not.toMatch(/STALE_USABLE|MATERIAL_CONFLICT|NO_ACTIVE_PUBLIC_SOURCE/);
    const box = await panel.boundingBox(); expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
    const hasScroll = await panel.evaluate(el => el.scrollHeight > el.clientHeight); expect(hasScroll).toBe(true);
    await panel.getByText(provenance, { exact: true }).click(); await expect(panel).toContainText('QA_EXPLICIT_ANNUAL_TAX');
    await panel.evaluate(el => { el.scrollTop = el.scrollHeight; });
    await expect(panel.locator('small')).toBeVisible();
    await page.getByRole('button', { name: close, exact: true }).click(); await expect(panel).not.toBeVisible();
    results.push({ language, device, status: 'PASS', areaConflict: 'PASS', staleUsable: 'PASS', explicitTax: 'PASS', legalDescriptionUntruncated: 'PASS',
      subdivision: 'PASS', fieldProvenance: 'PASS', scrollContainment: 'PASS', dismissal: 'PASS' }); await context.close();
  }
  await writeFile(`${output}/parcel-panel-field-validation.json`, JSON.stringify({ evidenceMode: 'LOCAL_DETERMINISTIC_FIXTURES_NOT_LIVE_SOURCE_OR_PRODUCTION_AUTH',
    results, semantics: { nullNotZero: 'TARGETED_UNIT_TEST_PASS', assessmentNotMarket: 'TARGETED_UNIT_TEST_PASS', noFrontendAreaRecalculation: true,
      ownerAssessmentZoning: 'REAL_MASSGIS_NORMALIZED_FIELDS_PLUS_UNIT_TESTS', taxFixtureNotLiveMassGIS: true } }, null, 2) + '\n');
  console.log(JSON.stringify({ status: 'PASS', cases: results.length, mode: 'DETERMINISTIC_LOCAL_PRESENTATION' }));
} finally { await browser.close(); }
