/* global process */
import { test, expect } from '../../fixtures/realBackendFixture.js';

const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function expectHealthyGemini(result) {
  expect(result.ok, JSON.stringify(result.payload)).toBe(true);
  expect(result.payload.degraded, JSON.stringify(result.payload)).not.toBe(true);
  expect(result.payload.requestId).toMatch(REQUEST_ID);
  expect(result.payload.runtime?.provider).toBe('gemini');
  expect(String(result.payload.message || result.payload.answer || '').trim().length).toBeGreaterThan(20);
}

function expectToolInterpretation(result, toolName, responseType) {
  expectHealthyGemini(result);
  expect(result.payload.runtime?.toolName).toBe(toolName);
  expect(result.payload.runtime?.secondPass).toBe(true);
  expect(result.payload.type).toBe(responseType);
}

async function resetMaxxisChatRateLimit(realBackend) {
  await realBackend.adminDelete(
    'edge_rate_limits',
    `subject_id=eq.${realBackend.investor.id}&operation=eq.maxxis_chat`,
  ).catch(() => {});
}

test('real Gemini minimal health returns MAXXIS_OK without fallback', async ({ realBackend }) => {
  const session = await realBackend.signIn(realBackend.investor.email, realBackend.investor.password);
  await resetMaxxisChatRateLimit(realBackend);
  const result = await realBackend.invokeFunction({
    token: session.access_token,
    name: 'maxxis-chat',
    body: {
      message: 'Reply exactly: MAXXIS_OK',
      page: 'dashboard',
      language: 'en',
      context: {},
    },
  });

  expect(result.ok, JSON.stringify(result.payload)).toBe(true);
  expect(result.payload.degraded, JSON.stringify(result.payload)).not.toBe(true);
  expect(result.payload.requestId).toMatch(REQUEST_ID);
  expect(result.payload.runtime?.provider).toBe('gemini');
  expect(result.payload.runtime?.secondPass).toBe(false);
  expect(String(result.payload.message || result.payload.answer || '').trim()).toContain('MAXXIS_OK');
});

test('real Gemini answers free chat in PT, EN and ES without fallback', async ({ realBackend }) => {
  const session = await realBackend.signIn(realBackend.investor.email, realBackend.investor.password);
  const cases = [
    { language: 'pt', message: 'Olá, quem é você?' },
    { language: 'pt', message: 'Como funciona o DealSifter?' },
    { language: 'pt', message: 'Explique o que são Tax Deeds.' },
    { language: 'pt', message: 'Qual a diferença entre Tax Deed e Tax Lien?' },
    { language: 'en', message: 'What can you help me with?' },
    { language: 'es', message: '¿Cómo funciona DealSifter?' },
  ];

  for (const item of cases) {
    await resetMaxxisChatRateLimit(realBackend);
    const result = await realBackend.invokeFunction({
      token: session.access_token,
      name: 'maxxis-chat',
      body: { message: item.message, page: 'dashboard', language: item.language, context: {} },
    });
    expectHealthyGemini(result);
    expect(result.payload.runtime?.secondPass).toBe(false);
  }
});

test('real Gemini answers app support knowledge questions without fallback', async ({ realBackend }) => {
  const session = await realBackend.signIn(realBackend.investor.email, realBackend.investor.password);
  const cases = [
    'Como funciona o Dashboard?',
    'Como funciona o Feed?',
    'Como funciona o MapView?',
    'Como funcionam os Matches?',
    'O que são Nuggets?',
    'Como desbloqueio um provider?',
    'Como altero meu perfil?',
  ];

  for (const message of cases) {
    await resetMaxxisChatRateLimit(realBackend);
    const result = await realBackend.invokeFunction({
      token: session.access_token,
      name: 'maxxis-chat',
      body: { message, page: 'dashboard', language: 'pt', context: {} },
    });
    expectHealthyGemini(result);
    expect(result.payload.runtime?.secondPass).toBe(false);
    expect(result.payload.runtime?.knowledgeVersion).toMatch(/^\d{4}-\d{2}-\d{2}\./);
  }
});

test('real Gemini answers a contextual Dashboard question without degraded fallback', async ({ realBackend }) => {
  const session = await realBackend.signIn(realBackend.investor.email, realBackend.investor.password);
  await resetMaxxisChatRateLimit(realBackend);
  const result = await realBackend.invokeFunction({
    token: session.access_token,
    name: 'maxxis-chat',
    body: { message: 'Como funciona o Dashboard?', page: 'dashboard', language: 'pt' },
  });
  expectHealthyGemini(result);
  expect(result.payload.runtime?.secondPass).toBe(false);
  expect(result.payload.runtime?.knowledgeVersion).toMatch(/^\d{4}-\d{2}-\d{2}\./);
  expect(result.payload.runtime?.knowledgeTopics).toContain('dashboard');
});

test('real Gemini selects tools and interprets their structured results in a second pass', async ({ realBackend }) => {
  const session = await realBackend.signIn(realBackend.investor.email, realBackend.investor.password);
  const token = session.access_token;
  const cases = [
    {
      message: 'Qual oportunidade melhor se encaixa com meu perfil?',
      page: 'feed',
      expectedTool: 'searchProperties',
      expectedType: 'properties',
      context: {},
    },
    {
      message: 'Mostre propriedades em Dallas até $250k.',
      page: 'feed',
      expectedTool: 'searchProperties',
      expectedType: 'properties',
      context: {},
    },
    {
      message: 'Qual o price/sqft deste imóvel?',
      page: 'property-details',
      expectedTool: 'getPropertyDetails',
      expectedType: 'property_details',
      context: { propertyId: realBackend.property.id },
    },
    {
      message: 'Mostre os detalhes publicados deste imóvel.',
      page: 'property-details',
      expectedTool: 'getPropertyDetails',
      expectedType: 'property_details',
      context: { propertyId: realBackend.property.id },
    },
    {
      message: 'Compare estes dois imóveis.',
      page: 'property-details',
      expectedTool: 'compareProperties',
      expectedType: 'property_comparison',
      context: { propertyIds: [realBackend.property.id, realBackend.comparisonProperty.id] },
    },
    {
      message: 'Como está este deal?',
      page: 'property-details',
      expectedTool: 'getDealCopilotOverview',
      expectedType: 'deal_copilot_overview',
      context: { propertyId: realBackend.property.id },
    },
    {
      message: 'Como está este imóvel?',
      page: 'property-details',
      expectedTool: 'getDealCopilotOverview',
      expectedType: 'deal_copilot_overview',
      context: { propertyId: realBackend.property.id },
    },
  ];

  const selectedCase = String(process.env.E2E_GEMINI_TOOL_CASE || '').trim();
  const casesToRun = selectedCase ? cases.filter((item) => item.expectedTool === selectedCase) : cases;
  expect(casesToRun.length, `Unknown E2E_GEMINI_TOOL_CASE: ${selectedCase}`).toBeGreaterThan(0);

  for (const item of casesToRun) {
    await resetMaxxisChatRateLimit(realBackend);
    const result = await realBackend.invokeFunction({
      token,
      name: 'maxxis-chat',
      body: {
        message: item.message,
        page: item.page,
        language: 'pt',
        context: item.context,
      },
    });
    expectToolInterpretation(result, item.expectedTool, item.expectedType);
  }
});

test('real Gemini understands free-language requests in Portuguese, English and Spanish', async ({ realBackend }) => {
  const session = await realBackend.signIn(realBackend.investor.email, realBackend.investor.password);
  const token = session.access_token;
  const cases = [
    {
      language: 'pt',
      message: 'Quais imóveis parecem mais alinhados ao que eu busco?',
      page: 'feed',
      expectedTool: 'searchProperties',
      expectedType: 'properties',
    },
    {
      language: 'pt',
      message: 'Tem alguma coisa aqui que eu deveria prestar atenção?',
      page: 'property-details',
      context: { propertyId: realBackend.property.id },
      expectedTool: 'getDealCopilotOverview',
      expectedType: 'deal_copilot_overview',
    },
    {
      language: 'en',
      message: 'Could you walk me through what I am looking at on this screen?',
      page: 'dashboard',
    },
    {
      language: 'en',
      message: 'Who could help me move this property forward?',
      page: 'property-details',
      context: { propertyId: realBackend.property.id },
      expectedTool: 'getPropertyDetails',
      expectedType: 'property_details',
    },
    {
      language: 'es',
      message: '¿Qué cambió en este negocio desde la última revisión?',
      page: 'property-details',
      context: { propertyId: realBackend.property.id },
      expectedTool: 'getDealCopilotOverview',
      expectedType: 'deal_copilot_overview',
    },
    {
      language: 'es',
      message: '¿Y ahora qué debería revisar aquí?',
      page: 'property-details',
      context: { propertyId: realBackend.property.id },
      history: [{ role: 'user', content: 'Explícame la situación actual de este negocio.' }],
    },
  ];

  for (const item of cases) {
    await resetMaxxisChatRateLimit(realBackend);
    const result = await realBackend.invokeFunction({
      token,
      name: 'maxxis-chat',
      body: {
        message: item.message,
        page: item.page,
        language: item.language,
        history: item.history || [],
        context: item.context || {},
      },
    });
    if (item.expectedTool) expectToolInterpretation(result, item.expectedTool, item.expectedType);
    else expectHealthyGemini(result);
  }
});
