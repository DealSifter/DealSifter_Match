import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gable, droad, landSnapshot, reportResult } from '../../../src/features/maxxis/qa/runtimeOrchestrationFixtures.js';
import { buildMarketReferenceAnswer } from '../../../supabase/functions/_shared/maxxis/marketReferenceAnswer.ts';
import { calculateLandDevelopmentScenario } from '../../../supabase/functions/_shared/maxxis/landDevelopmentScenario.ts';

test.setTimeout(180000);
test('real chat component: topic switch, property switch, LAND persistence, evidence and report handoff', async ({ page }) => {
  mkdirSync('qa/runtime-orchestration-hardening', { recursive: true });
  const saved = {}; const calls = []; const navigations = [];
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/maxxis-analysis-inputs')) {
      const body = route.request().postDataJSON();
      if (body.action === 'UPSERT') saved[body.propertyId] = { ...saved[body.propertyId], ...body.dealAssumptions };
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data: { deal_assumptions: saved[body.propertyId] || {} } }) }); return;
    }
    if (url.pathname.endsWith('/maxxis-chat')) {
      const body = route.request().postDataJSON(); calls.push(body);
      const id = body.context?.propertyId;
      let result;
      if (body.analysisMode === 'PROPERTY_ANALYSIS_MODE') {
        const snapshot = landSnapshot(false);
        const assumptions = saved[gable.id] || {};
        snapshot.dealAssumptions = { ...assumptions, activeScenario: { propertyId: gable.id, strategy: 'LAND', provenance: 'USER_PROVIDED', status: 'PARTIAL', assumptions,
          calculatedOutputs: calculateLandDevelopmentScenario({ ...gable, ...assumptions, purchasePrice: gable.price }) } };
        result = reportResult(snapshot);
      } else if (body.controlledIntent === 'explain_market_estimate') {
        result = buildMarketReferenceAnswer({ propertyId: droad.id, propertyFacts: droad, generatedAt: 'v1',
          recentSalesMarketEstimate: { status: 'AVAILABLE', centralEstimate: 120000, range: { low: 110000, high: 130000 }, valuationCompCount: 3, unitMetric: 'PRICE_PER_SQFT', confidence: 'MODERATE' } }, 'EXPLAIN_MARKET_ESTIMATE', 'pt');
      } else if (id === gable.id) result = buildMarketReferenceAnswer({ ...landSnapshot(), dealAssumptions: saved[gable.id] || {} }, 'LAND_MARKET_REFERENCE', 'pt');
      else result = { type: 'deal_insight', answer: 'Dados atuais do imóvel.', data: { state: 'AVAILABLE', propertyId: droad.id, property: droad,
        structuredAnalysis: { type: 'maxxis_structured_analysis', decisionActions: [{ code: 'RESOLVE_INTEREST_RATE', label: 'Resolver taxa de juros', inputField: 'interestRate', source: 'USER', gapCode: 'SELLER_FINANCING_interest_rate', why: 'Informe taxa de juros.', generatedFromStateVersion: 'v1' }] } } };
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...result, message: result.answer }) }); return;
    }
    if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') { await route.abort(); return; }
    if (url.pathname === '/__runtime_harness') { await route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }); return; }
    await route.continue();
  });
  await page.goto('/__runtime_harness');
  await page.evaluate(async ({ gable, droad }) => {
    localStorage.setItem('lang', 'pt');
    window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
    await import('/src/index.css');
    const React = (await import('/node_modules/.vite/deps/react.js')).default;
    const { createRoot } = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
    const { MaxxisAssistant } = await import('/src/components/maxxis/MaxxisAssistant.jsx');
    const root = createRoot(document.getElementById('root'));
    window.__runtimeNavigations = []; window.__runtimeActive = droad; window.__runtimeRequest = null;
    window.__runtimeRender = () => root.render(React.createElement(MaxxisAssistant, {
      sessionKey: 'runtime-fixture-account', page: 'feed', currentPlan: 'enterprise', propertyCandidates: [droad, gable], propertyContextId: window.__runtimeActive.id,
      appContext: { surface: { page: 'feed' }, entity: { propertyId: window.__runtimeActive.id, type: 'PROPERTY' } },
      propertyAnalysisRequest: window.__runtimeRequest, onNavigateAction: value => window.__runtimeNavigations.push(value),
      onOpenReportSelector: value => { window.__runtimeRequest = { id: 'runtime-L3', reportType: value.reportType, prompt: 'Build the full Deal Intelligence view for the property currently selected. Never calculate ARV.', reportProperty: gable,
        propertyAnalysisContext: { mode: 'PROPERTY_ANALYSIS_MODE', property_id: gable.id, report_type: 'DEAL_INTELLIGENCE' } }; window.__runtimeRender(); },
    }));
    window.__runtimeSwitchLand = () => { window.__runtimeActive = gable; window.__runtimeRender(); };
    window.__runtimeRender();
  }, { gable, droad });
  await page.getByTestId('maxxis-fab').evaluate(element => element.click());
  const chat = page.getByTestId('maxxis-messages');
  const ask = async text => { await page.getByTestId('maxxis-input').fill(text); await page.getByTestId('maxxis-send').click(); };
  await ask('Avalie os riscos deste negócio.');
  await page.getByRole('button', { name: 'Resolver taxa de juros', exact: true }).click({ timeout: 20000 });
  await expect(page.getByTestId('maxxis-analysis-gap-resolution')).toBeVisible();
  await ask('Como você chegou à estimativa de mercado?');
  await expect(chat).toContainText('Como a referência de mercado foi obtida');
  await expect(chat).toContainText('comparáveis utilizados: 3');
  await page.screenshot({ path: 'qa/runtime-orchestration-hardening/valuation-question-no-gap-loop.png' });
  await page.evaluate(() => window.__runtimeSwitchLand());
  await ask('quanto vc acha que vale esse terreno?');
  await expect(chat).toContainText('Referência do terreno por vendas recentes');
  await page.screenshot({ path: 'qa/runtime-orchestration-hardening/gable-land-value.png' });
  await ask('Zoneamento R2. Pretendo construir 1 SFH.');
  await expect.poll(() => saved[gable.id]?.proposedUnitCount).toBe(1);
  await ask('qual seria o custo de construção?');
  await expect(chat).toContainText('R2');
  await ask('quanto vale esse terreno?');
  const compButton = chat.getByRole('button', { name: 'Ver comparáveis', exact: true }).last();
  await compButton.click();
  await expect(page.getByTestId('maxxis-market-comparables').last()).toContainText('Example Rd');
  navigations.push(...await page.evaluate(() => window.__runtimeNavigations));
  expect(navigations).toEqual([]);
  await page.screenshot({ path: 'qa/runtime-orchestration-hardening/gable-comparables.png' });
  await page.evaluate(() => window.__runtimeRequest = null);
  await page.evaluate(() => { window.__runtimeRequest = { id: 'runtime-L3', reportType: 'DEAL_INTELLIGENCE', prompt: 'Build the full Deal Intelligence view for the property currently selected. Never calculate ARV.',
    reportProperty: window.__runtimeActive, propertyAnalysisContext: { mode: 'PROPERTY_ANALYSIS_MODE', property_id: window.__runtimeActive.id, report_type: 'DEAL_INTELLIGENCE' } }; window.__runtimeRender(); });
  await expect(chat.locator('.maxxis-message-report')).toBeVisible({ timeout: 30000 });
  await expect(chat.locator('.maxxis-message-user').filter({ hasText: 'Build the full' })).toHaveCount(0);
  await page.screenshot({ path: 'qa/runtime-orchestration-hardening/gable-l3-report.png' });
  expect(calls.at(-1).analysisMode).toBe('PROPERTY_ANALYSIS_MODE');
  expect(calls.at(-1).context.propertyId).toBe(gable.id);
  writeFileSync('qa/runtime-orchestration-hardening/browser-e2e.json', JSON.stringify({ state: 'PASS', environment: 'LOCAL_REAL_BROWSER_MOCK_CACHE_ONLY', flows: ['A','B','C','D','E'],
    authenticatedProductionSmoke: 'NOT_VERIFIED', inputPersistence: saved[gable.id], providerCalls: 0, geminiCalls: 0, matchesNavigations: navigations, reportRequest: { mode: calls.at(-1).analysisMode, propertyId: calls.at(-1).context.propertyId } }, null, 2));
});
