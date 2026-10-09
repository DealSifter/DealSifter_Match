import { test, expect, E2E_IDS } from '../../fixtures/appFixture.js';

const NOTES = 'Welcome to "The Dalegrove MCM", a serene mid century modern oasis with pool, privately set in the coveted hills of Beverly Hills Post Office (BHPO). Situated at the end of a quiet cul de sac just off Coldwater Canyon, this single level residence offers a rare blend of privacy, tranquility, and central accessibility to Beverly Hills, West Hollywood, and Ventura Boulevard. Upon entry, you are welcomed by a light filled open floor plan where expansive walls of glass frame lush greenery and create a seamless indoor outdoor living experience. Clean architectural lines and warm finishes define the home, with a refined living and dining area flowing into a Poggenpohl designed kitchen equipped with premium appliances including a Sub Zero refrigerator. Stroll into your private retreat back yard featuring a heated pool and spa, sun drenched lounge areas, and mature landscaping. A built in outdoor kitchen with barbecue and refrigerator creates an ideal setting for entertaining or quiet relaxation. Positioned just far enough from Coldwater Canyon to avoid traffic noise, yet minutes from world class dining, shopping, and lifestyle amenities. Truly a rare opportunity to own a private design driven retreat in one of Los Angeles\' most desirable hillside enclaves.';
const json = (route, data) => route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(data) });

async function mount(page, mode = 'assistant') {
  // Fail unexpected acquisition locally, even if a developer's Vite env points
  // to production. These tests must never contact paid analysis/provider APIs.
  await page.route('**/functions/v1/maxxis-chat', route => json(route, { error: 'UNEXPECTED_ANALYSIS_ACQUISITION' }));
  await page.route('**/functions/v1/property-intelligence', route => json(route, { error: 'UNEXPECTED_PROVIDER_ACQUISITION' }));
  await page.route('https://api.rentcast.io/**', route => route.abort());
  await page.route('**/__degraded_harness', route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
  await page.goto('/__degraded_harness', { waitUntil: 'domcontentloaded' });
  await page.evaluate(async ({ id, notes, mode }) => {
    window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
    await import('/src/index.css');
    const React = (await import('/node_modules/.vite/deps/react.js')).default;
    const { createRoot } = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
    const { setLang } = await import('/src/i18n/translations.js');
    const { isSupabaseConfigured } = await import('/src/lib/supabaseClient.js');
    if (!isSupabaseConfigured) throw new Error('E2E Vite server requires the isolated Supabase test environment.');
    window.__setDegradedLocale = setLang; setLang('pt-BR');
    const property = Object.freeze({ id, type: 'SFR', address: '9537 Dalegrove Dr', city: 'Beverly Hills', state: 'CA', zip: '90210', price: 2195000, sqft: 1838, beds: 3, baths: 2, objective: 'SUB-TO', description: notes, notes, images: [] });
    window.__degradedProperty = property;
    const host = document.getElementById('root'); host.style.maxWidth = '760px';
    const root = createRoot(host);
    if (mode === 'assistant') {
      const { MaxxisAssistant } = await import('/src/components/maxxis/MaxxisAssistant.jsx');
      root.render(React.createElement(MaxxisAssistant, { sessionKey: 'degraded-e2e', page: 'dashboard', propertyContextId: id, propertyCandidates: [property], currentPlan: 'enterprise', userPreferences: { maxxis: { proactiveEnabled: false } }, appContext: { surface: { page: 'dashboard' }, entity: { id, propertyId: id, type: 'PROPERTY' } } }));
    } else if (mode === 'feed') {
      const { PropertyCard } = await import('/src/components/cards/PropertyCard.jsx');
      root.render(React.createElement(PropertyCard, { property, previewOnly: true, showActions: false, owner: { name: 'Mr. Zen' } }));
    } else {
      const { PortfolioDetail } = await import('/src/components/matches/MatchesPortfolio.jsx');
      root.render(React.createElement(PortfolioDetail, { item: property, owner: { name: 'Mr. Zen', desc: notes }, ownerDesc: notes, onBack: () => {}, canUseChat: false }));
    }
  }, { id: E2E_IDS.property, notes: NOTES, mode });
}

test.describe('Degraded evidence and localized narratives, real UI with isolated backend', () => {
  test.setTimeout(240000);
  for (const state of ['FRESH', 'STALE_USABLE', 'QUOTA_EXHAUSTED', 'ABSENT']) {
    test(`ARV chat continues under ${state} with zero acquisition`, async ({ page }) => {
      const providerRequests = [];
      page.on('request', request => { if (/api\.rentcast\.io|functions\/v1\/(?:maxxis-chat|property-intelligence)/.test(request.url())) providerRequests.push(request.url()); });
      await page.route('**/functions/v1/arv-visual-comp-review', route => {
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization,apikey,content-type,x-client-info,x-supabase-api-version' } });
        if (['QUOTA_EXHAUSTED', 'ABSENT'].includes(state)) return json(route, { success: false, state: 'no_cached_evidence', error: 'CACHED_SOLD_EVIDENCE_REQUIRED' });
        return json(route, { success: true, state: 'ready', data: { propertyId: E2E_IDS.property, candidates: [], summary: { totalStructuralCandidates: 2, reviewedCount: 0, status: 'NOT_STARTED' }, evidenceFreshness: { valuation: { state, retrievedAt: '2026-09-27T00:03:38Z' }, sold: { state, retrievedAt: '2026-09-26T03:50:36Z' } } } });
      });
      await mount(page);
      await page.getByTestId('maxxis-fab').click();
      await expect(page.getByTestId('maxxis-messages')).toContainText('Ola, eu sou');
      await page.getByTestId('maxxis-input').fill('Revise o ARV deste imóvel');
      await page.getByTestId('maxxis-send').click();
      const messages = page.getByTestId('maxxis-messages');
      if (['QUOTA_EXHAUSTED', 'ABSENT'].includes(state)) {
        await expect(messages).toContainText('Preço por sqft');
        await expect(messages).toContainText('Próximo passo');
        await expect(messages).toContainText('Não atualizei dados externos nem calculei um ARV');
      } else {
        await expect(messages).toContainText('Encontrei 2 vendas');
        if (state === 'STALE_USABLE') await expect(messages).toContainText('dados externos anteriores');
      }
      await page.getByTestId('maxxis-input').fill('Continuar com os dados cadastrados');
      await expect(page.getByTestId('maxxis-send')).toBeEnabled();
      expect(providerRequests).toEqual([]);
    });
  }
  test('chat explains registered notes in Portuguese and returns the exact original on request', async ({ page }) => {
    let translations = 0;
    const providerRequests = [];
    page.on('request', request => { if (/api\.rentcast\.io|functions\/v1\/(?:maxxis-chat|property-intelligence)/.test(request.url())) providerRequests.push(request.url()); });
    await page.route('**/functions/v1/presentation-translate', route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization,apikey,content-type,x-client-info,x-supabase-api-version' } });
      translations++;
      return json(route, { translatedText: 'Bem-vindo a "The Dalegrove MCM", um oásis moderno com piscina.', translationSource: 'cached-gemini' });
    });
    await mount(page);
    await page.getByTestId('maxxis-fab').click();
    await page.getByTestId('maxxis-input').fill('O que dizem as notas deste imóvel?');
    await page.getByTestId('maxxis-send').click();
    await expect(page.getByTestId('maxxis-messages')).toContainText('Nas notas cadastradas (informadas pelo usuário)');
    await expect(page.getByTestId('maxxis-messages')).toContainText('Bem-vindo a');
    await page.getByTestId('maxxis-input').fill('Mostre exatamente o texto original');
    await page.getByTestId('maxxis-send').click();
    await expect(page.getByTestId('maxxis-messages')).toContainText(NOTES);
    expect(translations).toBe(1);
    expect(providerRequests).toEqual([]);
    expect(await page.evaluate(() => window.__degradedProperty.notes)).toBe(NOTES);
  });
  for (const surface of ['feed', 'portfolio']) {
    test(`${surface} adapts real Dalegrove narrative PT/EN/ES, preserving originals and deduping calls`, async ({ page }) => {
      let translations = 0;
      const providerRequests = [];
      page.on('request', request => { if (/api\.rentcast\.io/.test(request.url())) providerRequests.push(request.url()); });
      await page.route('**/functions/v1/presentation-translate', route => {
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization,apikey,content-type,x-client-info,x-supabase-api-version' } });
        translations++;
        const body = route.request().postDataJSON();
        return json(route, { translatedText: body.toLang === 'pt' ? 'Bem-vindo a "The Dalegrove MCM", um oásis moderno com piscina. Beverly Hills, Poggenpohl e Sub Zero.' : 'Bienvenido a "The Dalegrove MCM", un oasis moderno con piscina. Beverly Hills, Poggenpohl y Sub Zero.', translationSource: 'cached-gemini' });
      });
      await mount(page, surface);
      await expect(page.locator('[data-presentation-translated="true"]').first()).toContainText('Bem-vindo');
      expect(await page.evaluate(() => window.__degradedProperty.description)).toBe(NOTES);
      const firstCalls = translations;
      await page.evaluate(() => window.__setDegradedLocale('en-US'));
      await expect(page.locator('[data-presentation-translated="false"]').first()).toContainText('Welcome to');
      await page.evaluate(() => window.__setDegradedLocale('es-ES'));
      await expect(page.locator('[data-presentation-translated="true"]').first()).toContainText('Bienvenido');
      await page.evaluate(() => window.__setDegradedLocale('pt-BR'));
      await expect(page.locator('[data-presentation-translated="true"]').first()).toContainText('Bem-vindo');
      expect(translations).toBe(firstCalls + 1);
      expect(await page.evaluate(() => window.__degradedProperty.notes)).toBe(NOTES);
      expect(providerRequests).toEqual([]);
    });
  }
});
