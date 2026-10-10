import { test, expect } from '../../fixtures/appFixture.js';

test.setTimeout(120000);
async function mount(page) {
  const calls = [];
  await page.route('**/functions/v1/**', route => { calls.push(route.request().url()); return route.abort(); });
  await page.route('**/__land_harness', route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
  await page.goto('/__land_harness');
  await page.evaluate(async () => {
    window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
    await import('/src/index.css'); await import('/src/components/maxxis/MaxxisAssistant.css');
    const React = (await import('/node_modules/.vite/deps/react.js')).default;
    const { createRoot } = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
    const { setLang } = await import('/src/i18n/translations.js'); setLang('pt');
    const { MaxxisAssistant } = await import('/src/components/maxxis/MaxxisAssistant.jsx');
    const { PropertyPinPopup } = await import('/src/components/map/PropertyPinPopup.jsx');
    const { PortfolioPinCarousel } = await import('/src/components/map/PortfolioPinCarousel.jsx');
    const owner = { id: 'person:fsbo', ownerId: 'person', primaryProfile: 'fsbo', linkedProperties: [
      { id: 'p1', ownerId: 'person', primaryProfile: 'fsbo', title: 'Primeiro imóvel', images: ['/src/assets/feed-match-icon.png'] },
      { id: 'p2', ownerId: 'person', primaryProfile: 'fsbo', title: 'Segundo imóvel', images: ['/src/assets/feed-match-icon.png'] } ] };
    const property = { id: '74100000-0000-4000-8000-000000000001', type: 'Land', title: '741 Gable Dr', address: '741 Gable Dr', city: 'Center Point', state: 'AL', price: 19000, lot: '1.14 acres' };
    const openPortfolio = item => { window.__portfolioOpened = item.id; };
    const openFeed = () => { window.__openedFeed = true; };
    function Harness() {
      const [matched, setMatched] = React.useState(false);
      return React.createElement(React.Fragment, null,
        React.createElement('div', { className: 'ds-map-person-popup', style: { margin: 10, background: '#fff', padding: 12 } },
          React.createElement('div', { className: 'ds-map-popup-card' }, React.createElement('strong', null, 'Mr. Zen'), React.createElement('p', null, 'FSBO · TX'), React.createElement('p', null, 'Portfólio: 2 imóveis')),
          React.createElement(PortfolioPinCarousel, { owner, language: 'pt', onOpen: openPortfolio })),
        React.createElement(PropertyPinPopup, { property, label: property.address, selected: matched, language: 'pt',
          onOpen: openFeed, onMatch: () => { setMatched(value => !value); } }),
        React.createElement(MaxxisAssistant, { propertyCandidates: [property], propertyContextId: property.id,
          sessionKey: 'synthetic-gable-e2e', enabled: true, currentPlan: 'enterprise', userPreferencesHydrated: true }));
    }
    createRoot(document.getElementById('root')).render(React.createElement(Harness));
  });
  return calls;
}

test('real chat progresses from two homes to proposed size without a provider request', async ({ page }) => {
  const calls = await mount(page);
  await page.getByTestId('maxxis-fab').click();
  await page.getByTestId('maxxis-input').fill('Quero subdividir em dois lotes e construir duas casas.');
  await page.getByTestId('maxxis-send').click();
  await expect(page.getByTestId('maxxis-messages')).toContainText('cada casa com quantos sqft');
  await page.getByTestId('maxxis-input').fill('1500 sqft cada');
  await page.getByTestId('maxxis-send').click();
  const conversation = page.getByTestId('maxxis-messages');
  await expect(conversation).toContainText('436.500');
  await expect(conversation).toContainText('Não é lucro líquido');
  await expect(conversation).toContainText('Salvar premissas para o relatório');
  expect(calls.filter(url => /maxxis-chat|property-intelligence|rentcast/.test(url))).toHaveLength(0);
  await page.getByTestId('maxxis-minimize-button').click();
  await page.getByTestId('maxxis-fab').click();
  await expect(conversation).toContainText('436.500');
});

test('people popup reserves the right column for scoped portfolio images and independent carousel controls', async ({ page }) => {
  await mount(page);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const popup = page.locator('.ds-map-person-popup');
    const bounds = await popup.evaluate(node => {
      const left = node.firstElementChild.getBoundingClientRect(); const right = node.lastElementChild.getBoundingClientRect();
      return { separate: right.left >= left.right, fits: node.getBoundingClientRect().right <= innerWidth, aspect: right.width / right.height };
    });
    expect(bounds.separate).toBe(true); expect(bounds.fits).toBe(true); expect(bounds.aspect).toBeCloseTo(16 / 9, 1);
    await popup.getByRole('button', { name: 'Próxima imagem' }).click();
    await expect(popup.locator('.ds-pin-portfolio-count')).toHaveText(width === 1280 ? '2/2' : '1/2');
    expect(await page.evaluate(() => window.__portfolioOpened)).toBeUndefined();
  }
  await page.getByRole('button', { name: 'Abrir item do portfólio: Primeiro imóvel' }).click();
  expect(await page.evaluate(() => window.__portfolioOpened)).toBe('p1');
});

test('pin photo opens feed independently and Match gets selected on mobile and desktop', async ({ page }) => {
  await mount(page);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const card = page.locator('.ds-property-pin-popup');
    expect(await card.evaluate(node => node.getBoundingClientRect().right <= innerWidth)).toBe(true);
    const match = card.getByRole('button', { name: 'Match' });
    await match.click();
    await expect(match).toHaveAttribute('aria-pressed', width === 1280 ? 'true' : 'false');
    expect(await page.evaluate(() => Boolean(window.__openedFeed))).toBe(false);
  }
  await page.getByRole('button', { name: /Abrir no feed:/ }).click();
  expect(await page.evaluate(() => window.__openedFeed)).toBe(true);
});
