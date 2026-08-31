/* global process */
import { test, expect } from '../../fixtures/realBackendFixture.js';

const cases = [
  { id: 'HB-01', message: 'Como funciona o Feed?', page: 'feed' },
  { id: 'HB-02', message: 'Como funciona o Dashboard?', page: 'dashboard' },
  { id: 'HB-03', message: 'O que é Tax Deed?', page: 'dashboard' },
  { id: 'HB-04', message: 'Qual a diferença entre Tax Deed e Wholesale?', page: 'dashboard' },
  { id: 'HB-05', message: 'Mostre propriedades em Dallas.', page: 'feed', expectedTool: 'searchProperties' },
  { id: 'HB-06', message: 'Como está este imóvel?', page: 'property-details', expectedTool: 'getDealCopilotOverview', context: 'property' },
  { id: 'HB-07', message: 'Compare estes dois imóveis.', page: 'property-details', expectedTool: 'compareProperties', context: 'comparison' },
  { id: 'HB-08', message: 'Quem pode me ajudar aqui?', page: 'property-details', expectedTool: 'getPropertyDetails', context: 'property' },
  { id: 'HB-09', message: 'O que estou vendo?', page: 'property-details', context: 'property' },
  { id: 'HB-10', message: 'E agora?', page: 'property-details', context: 'history' },
];

function requestContext(item, fixture) {
  if (item.context === 'comparison') return { propertyIds: [fixture.property.id, fixture.comparisonProperty.id] };
  if (item.context === 'property' || item.context === 'history') return { propertyId: fixture.property.id };
  return {};
}

function classify(result, expectedTool) {
  const payload = result.payload || {};
  const answer = String(payload.message || payload.answer || '').trim();
  if (!result.ok) return { status: 'FAIL', responseClass: `HTTP_${result.status}` };
  if (payload.degraded) return { status: 'DEGRADED', responseClass: String(payload.reason || 'DEGRADED') };
  if (!answer) return { status: 'FAIL', responseClass: 'EMPTY_RESPONSE' };
  if (expectedTool && payload.runtime?.toolName !== expectedTool) return { status: 'FAIL', responseClass: 'WRONG_TOOL' };
  return { status: 'PASS', responseClass: payload.type || 'text' };
}

test('HB-01..HB-10 use authenticated staging, real Gemini and ephemeral fixtures', async ({ realBackend }, testInfo) => {
  expect(process.env.E2E_BACKEND_MODE).toBe('real');
  expect(process.env.E2E_LLM_MODE).toBe('real');
  const session = await realBackend.signIn(realBackend.investor.email, realBackend.investor.password);
  const results = [];
  const selectedId = String(process.env.E2E_HEARTBEAT_CASE || '').trim().toUpperCase();
  const selectedCases = selectedId ? cases.filter((item) => item.id === selectedId) : cases;
  const repeat = selectedId ? Math.max(1, Math.min(3, Number(process.env.E2E_HEARTBEAT_REPEAT || 1))) : 1;
  expect(selectedCases.length, `Unknown E2E_HEARTBEAT_CASE: ${selectedId}`).toBeGreaterThan(0);

  for (const item of selectedCases.flatMap((entry) => Array.from({ length: repeat }, (_, index) => ({ ...entry, attempt: index + 1 })))) {
    const result = await realBackend.invokeFunction({
      token: session.access_token,
      name: 'maxxis-chat',
      body: {
        message: item.message,
        page: item.page,
        language: 'pt',
        context: requestContext(item, realBackend),
        history: item.context === 'history'
          ? [{ role: 'user', content: 'Explique a situação atual deste imóvel.' }]
          : [],
      },
    });
    const classification = classify(result, item.expectedTool);
    const evidence = {
      id: item.id,
      attempt: item.attempt,
      timestamp: new Date().toISOString(),
      target: 'staging',
      authenticated: true,
      geminiReal: result.payload?.runtime?.provider === 'gemini',
      stub: false,
      requestId: result.payload?.requestId || 'missing',
      httpStatus: result.status,
      degraded: result.payload?.degraded === true,
      model: result.payload?.runtime?.model || 'not-reported',
      toolCalled: result.payload?.runtime?.toolName || 'none',
      expectedTool: item.expectedTool || 'none',
      secondPass: result.payload?.runtime?.secondPass === true,
      responseClass: classification.responseClass,
      status: classification.status,
    };
    results.push(evidence);
    console.log(`[heartbeat-evidence] ${JSON.stringify(evidence)}`);
  }

  await testInfo.attach('heartbeat-evidence.json', {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  });
  expect(results).toHaveLength(selectedCases.length * repeat);
  expect(results.every((item) => item.geminiReal && !item.stub)).toBe(true);
  expect(results.filter((item) => item.status !== 'PASS'), JSON.stringify(results)).toEqual([]);
});
