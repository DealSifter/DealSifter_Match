import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const STAGING_REF = 'oqdcnjupquhybwdbeeew';
const MINIMUM_START_INTERVAL_MS = 20_000;
const url = String(process.env.HEARTBEAT_SUPABASE_URL || '').replace(/\/$/, '');
const anonKey = String(process.env.HEARTBEAT_SUPABASE_ANON_KEY || '');
const email = String(process.env.HEARTBEAT_USER_EMAIL || '');
const password = String(process.env.HEARTBEAT_USER_PASSWORD || '');
const propertyId = String(process.env.HEARTBEAT_PROPERTY_ID || '').trim();

if (!url.includes(STAGING_REF)) throw new Error('Latency probe is restricted to Maxxis staging.');
if (![url, anonKey, email, password].every(Boolean)) throw new Error('Staging latency credentials are missing.');

const authResponse = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: anonKey, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const auth = await authResponse.json().catch(() => ({}));
if (!authResponse.ok || !auth.access_token) throw new Error(`Latency probe authentication failed (${authResponse.status}).`);

const cases = [
  ...Array.from({ length: 5 }, (_, index) => ({ group: 'simple', index: index + 1, message: 'Olá, o que você pode fazer?', page: 'dashboard', context: {} })),
  ...Array.from({ length: 3 }, (_, index) => ({ group: 'feed', index: index + 1, message: 'Como funciona o Feed?', page: 'feed', context: {} })),
  ...Array.from({ length: 3 }, (_, index) => ({ group: 'tax_deed', index: index + 1, message: 'O que é Tax Deed?', page: 'dashboard', context: {} })),
  ...(propertyId ? Array.from({ length: 3 }, (_, index) => ({ group: 'property', index: index + 1, message: 'Como está este imóvel?', page: 'property-details', context: { propertyId } })) : []),
];

let lastStartedAt = 0;
const results = [];
for (const testCase of cases) {
  const waitMs = Math.max(0, MINIMUM_START_INTERVAL_MS - (Date.now() - lastStartedAt));
  if (waitMs) await new Promise((resolveWait) => setTimeout(resolveWait, waitMs));
  lastStartedAt = Date.now();
  const clientStartedAt = performance.now();
  const response = await fetch(`${url}/functions/v1/maxxis-chat`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: `Bearer ${auth.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: testCase.message,
      page: testCase.page,
      language: 'pt',
      context: testCase.context,
      history: [],
    }),
  });
  const clientRoundTripMs = Math.round(performance.now() - clientStartedAt);
  const payload = await response.json().catch(() => ({}));
  const timing = payload.runtime?.timing || {};
  const ok = response.ok
    && payload.status === 'success'
    && payload.providerStatus === 'ok'
    && payload.runtime?.provider === 'gemini'
    && payload.runtime?.model !== 'e2e-llm-stub'
    && (testCase.group !== 'property' || payload.runtime?.toolName === 'getDealCopilotOverview');
  const row = {
    group: testCase.group,
    attempt: testCase.index,
    ok,
    requestId: String(payload.requestId || response.headers.get('x-request-id') || ''),
    httpStatus: response.status,
    conversationStatus: String(payload.status || ''),
    providerStatus: String(payload.providerStatus || ''),
    provider: String(payload.runtime?.provider || ''),
    model: String(payload.runtime?.model || ''),
    tool: String(payload.runtime?.toolName || 'none'),
    clientRoundTripMs,
    edgeTotalMs: Number.isFinite(Number(timing.totalMs)) ? Number(timing.totalMs) : null,
    networkAndClientMs: Number.isFinite(Number(timing.totalMs)) ? Math.max(0, clientRoundTripMs - Number(timing.totalMs)) : null,
    authMs: Number.isFinite(Number(timing.authMs)) ? Number(timing.authMs) : null,
    contextMs: Number.isFinite(Number(timing.contextMs)) ? Number(timing.contextMs) : null,
    knowledgeMs: Number.isFinite(Number(timing.knowledgeMs)) ? Number(timing.knowledgeMs) : null,
    providerCall1Ms: timing.providerCall1Ms ?? null,
    pacingWait1Ms: timing.pacingWait1Ms ?? null,
    toolMs: timing.toolMs ?? null,
    providerCall2Ms: timing.providerCall2Ms ?? null,
    pacingWait2Ms: timing.pacingWait2Ms ?? null,
    responseFinalizeMs: timing.responseFinalizeMs ?? null,
    providerTimeMs: Number.isFinite(Number(timing.providerTimeMs)) ? Number(timing.providerTimeMs) : null,
    applicationOverheadMs: Number.isFinite(Number(timing.applicationOverheadMs)) ? Number(timing.applicationOverheadMs) : null,
    providerAttempts: Array.isArray(timing.providerAttempts) ? timing.providerAttempts : [],
  };
  results.push(row);
  console.log(`[maxxis-latency] group=${row.group} attempt=${row.attempt} ok=${row.ok} totalMs=${row.clientRoundTripMs} providerMs=${row.providerTimeMs ?? 'unknown'} appMs=${row.applicationOverheadMs ?? 'unknown'} requestId=${row.requestId || 'missing'}`);
}

function percentile(values, value) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.ceil(value * sorted.length) - 1)];
}

const summary = Object.fromEntries(['simple', 'feed', 'tax_deed', 'property'].map((group) => {
  const rows = results.filter((row) => row.group === group);
  const totals = rows.map((row) => row.clientRoundTripMs);
  const provider = rows.map((row) => row.providerTimeMs);
  return [group, {
    count: rows.length,
    pass: rows.filter((row) => row.ok).length,
    minMs: totals.length ? Math.min(...totals) : null,
    p50Ms: percentile(totals, 0.5),
    p95Ms: percentile(totals, 0.95),
    maxMs: totals.length ? Math.max(...totals) : null,
    providerP50Ms: percentile(provider, 0.5),
    providerP95Ms: percentile(provider, 0.95),
  }];
}));

const artifact = {
  schemaVersion: 1,
  authority: 'REAL_GEMINI_STAGING',
  target: 'staging',
  stub: false,
  generatedAt: new Date().toISOString(),
  runtimePacing: 'TEST_ONLY',
  summary,
  coldWarm: {
    firstSimpleMs: results.find((row) => row.group === 'simple')?.clientRoundTripMs ?? null,
    warmSimpleP50Ms: percentile(results.filter((row) => row.group === 'simple' && row.attempt > 1).map((row) => row.clientRoundTripMs), 0.5),
  },
  results,
};
const artifactDirectory = resolve('artifacts/latency');
mkdirSync(artifactDirectory, { recursive: true });
const artifactPath = resolve(artifactDirectory, `maxxis-r26-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
console.log(`[maxxis-latency] artifact=${artifactPath}`);
if (results.some((row) => !row.ok)) process.exitCode = 1;
