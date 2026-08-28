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

test('real Gemini answers a contextual Dashboard question without degraded fallback', async ({ realBackend }) => {
  const session = await realBackend.signIn(realBackend.investor.email, realBackend.investor.password);
  const result = await realBackend.invokeFunction({
    token: session.access_token,
    name: 'maxxis-chat',
    body: { message: 'Como funciona o Dashboard?', page: 'dashboard', language: 'pt' },
  });
  expectHealthyGemini(result);
  expect(result.payload.runtime?.secondPass).toBe(false);
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
  ];

  const selectedCase = String(process.env.E2E_GEMINI_TOOL_CASE || '').trim();
  const casesToRun = selectedCase ? cases.filter((item) => item.expectedTool === selectedCase) : cases;
  expect(casesToRun.length, `Unknown E2E_GEMINI_TOOL_CASE: ${selectedCase}`).toBeGreaterThan(0);

  for (const item of casesToRun) {
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
