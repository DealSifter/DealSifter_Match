/* global process */
import { readFileSync, writeFileSync } from 'node:fs';
import { test, expect } from '../../fixtures/realBackendFixture.js';
import {
  aggregateAttemptResults,
  attemptsForHeartbeat,
  classifyHeartbeatAttempt,
  rateLimitWaitMs,
} from '../../../scripts/maxxis-acceptance-lib.mjs';

const contract = JSON.parse(readFileSync(new URL('../../../config/heartbeat-contract.json', import.meta.url), 'utf8'));

function requestContext(item, fixture) {
  if (item.context === 'comparison') return { propertyIds: [fixture.property.id, fixture.comparisonProperty.id] };
  if (item.context === 'property' || item.context === 'property-history') return { propertyId: fixture.property.id };
  return {};
}

function sanitizedInvocationFailure(error) {
  const code = String(error?.code || error?.name || 'RUNTIME_INVOCATION_FAILED').toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 64);
  return { ok: false, status: 0, durationMs: 0, payload: {}, invocationFailure: code };
}

test('HB-01..HB-10 use authenticated staging, real Gemini and ephemeral fixtures', async ({ realBackend }, testInfo) => {
  expect(process.env.E2E_BACKEND_MODE).toBe('real');
  expect(process.env.E2E_LLM_MODE).toBe('real');
  expect(String(process.env.MAXXIS_E2E_LLM_STUB || '')).toBe('');
  const session = await realBackend.signIn(realBackend.investor.email, realBackend.investor.password);
  const results = [];
  const selectedId = String(process.env.E2E_HEARTBEAT_CASE || '').trim().toUpperCase();
  const selectedCases = selectedId ? contract.heartbeats.filter((item) => item.id === selectedId) : contract.heartbeats;
  const varianceCheck = process.env.E2E_HEARTBEAT_VARIANCE_CHECK === '1';
  const legacyRepeat = selectedId ? Math.max(1, Math.min(3, Number(process.env.E2E_HEARTBEAT_REPEAT || 1))) : 1;
  let lastRequestStartedAt = 0;
  expect(selectedCases.length, `Unknown E2E_HEARTBEAT_CASE: ${selectedId}`).toBeGreaterThan(0);

  for (const item of selectedCases) {
    const repetitions = selectedId ? legacyRepeat : attemptsForHeartbeat(item.id, varianceCheck);
    for (let attempt = 1; attempt <= repetitions; attempt += 1) {
      const waitMs = rateLimitWaitMs({ lastStartedAt: lastRequestStartedAt });
      if (waitMs > 0) await new Promise((resolvePromise) => setTimeout(resolvePromise, waitMs));
      lastRequestStartedAt = Date.now();
      let result;
      try {
        result = await realBackend.invokeFunction({
          token: session.access_token,
          name: 'maxxis-chat',
          body: {
            message: item.prompt,
            page: item.page,
            language: 'pt',
            context: requestContext(item, realBackend),
            history: item.context === 'property-history'
              ? [{ role: 'user', content: 'Explique a situação atual deste imóvel.' }]
              : [],
          },
        });
      } catch (error) {
        result = sanitizedInvocationFailure(error);
      }
      const classification = classifyHeartbeatAttempt({ heartbeat: item, result });
      const evidence = {
        runId: realBackend.runId,
        id: item.id,
        attempt,
        timestamp: new Date().toISOString(),
        target: 'staging',
        authenticated: true,
        provider: result.payload?.runtime?.provider || 'unknown',
        stub: false,
        requestId: result.payload?.requestId || 'missing',
        httpStatus: result.status,
        model: result.payload?.runtime?.model || 'not-reported',
        tool: result.payload?.runtime?.toolName || 'none',
        providerStatus: result.payload?.providerStatus || 'not-reported',
        durationMs: Math.round(Number(result.durationMs || 0)),
        responseClass: result.payload?.type || 'none',
        semanticClass: classification.semanticClass,
        status: classification.status,
        classification: classification.classification,
        reason: classification.reason,
      };
      results.push(evidence);
      console.log(`[heartbeat-evidence] ${JSON.stringify(evidence)}`);
    }
  }

  const aggregate = selectedCases.map((item) => aggregateAttemptResults(
    item.id,
    results.filter((result) => result.id === item.id),
  ));
  const summary = {
    status: aggregate.every((item) => item.status === 'PASS') ? 'PASS' : aggregate.some((item) => item.status === 'FLAKY') ? 'FLAKY' : 'FAIL',
    pass: aggregate.filter((item) => item.status === 'PASS').length,
    fail: aggregate.filter((item) => item.status === 'FAIL' || item.status === 'DEGRADED').length,
    flaky: aggregate.filter((item) => item.status === 'FLAKY').length,
    firstFailure: results.find((item) => item.status !== 'PASS') || null,
    heartbeats: aggregate,
  };
  const rawEvidence = {
    schemaVersion: 1,
    runId: realBackend.runId,
    target: 'staging',
    realGemini: results.length > 0 && results.every((item) => item.provider === 'gemini'),
    stub: false,
    varianceCheck,
    summary,
    results,
  };
  const resultFile = String(process.env.E2E_HEARTBEAT_RESULT_FILE || '').trim();
  if (resultFile) writeFileSync(resultFile, `${JSON.stringify(rawEvidence, null, 2)}\n`, 'utf8');
  await testInfo.attach('heartbeat-evidence.json', {
    body: JSON.stringify(rawEvidence, null, 2),
    contentType: 'application/json',
  });
  expect(results.every((item) => item.provider === 'gemini' && !item.stub), JSON.stringify(summary)).toBe(true);
  expect(aggregate.filter((item) => item.status !== 'PASS'), JSON.stringify(summary)).toEqual([]);
});
