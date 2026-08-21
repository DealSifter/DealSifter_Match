import fs from 'node:fs';

const config = JSON.parse(fs.readFileSync('config/observability.json', 'utf8'));
const forceAlert = String(process.env.OBSERVABILITY_FORCE_ALERT || '').toLowerCase() === 'true';
const stagingUrl = String(process.env.E2E_SUPABASE_URL || '').replace(/\/$/, '');
const stagingAnonKey = String(process.env.E2E_SUPABASE_ANON_KEY || '');

async function probe(name, url, { headers = {}, timeoutMs, maxLatencyMs, validate } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { headers, redirect: 'follow', signal: controller.signal, cache: 'no-store' });
    const durationMs = Date.now() - startedAt;
    const body = validate ? await response.json().catch(() => null) : null;
    const valid = response.ok && durationMs <= maxLatencyMs && (!validate || validate(body, response));
    console.log(JSON.stringify({ probe: name, status: response.status, duration_ms: durationMs, success: valid }));
    if (!valid) throw new Error(`${name.toUpperCase()}_HEALTH_REGRESSION`);
    return { response, body, durationMs };
  } finally {
    clearTimeout(timer);
  }
}

await probe('frontend', config.health.frontend_url, {
  timeoutMs: config.health.frontend_timeout_ms,
  maxLatencyMs: config.health.frontend_max_latency_ms,
});

if (stagingUrl && stagingAnonKey) {
  const edgeHeaders = {
    apikey: stagingAnonKey,
    ...(stagingAnonKey.split('.').length === 3
      ? { Authorization: `Bearer ${stagingAnonKey}` }
      : {}),
  };
  await probe('maxxis_edge', `${stagingUrl}/functions/v1/${config.health.edge_function}?health=1`, {
    headers: edgeHeaders,
    timeoutMs: config.health.edge_timeout_ms,
    maxLatencyMs: config.health.edge_max_latency_ms,
    validate: (body, response) => body?.status === 'ok'
      && body?.function === config.health.edge_function
      && Boolean(body?.release)
      && /^[0-9a-f-]{36}$/i.test(response.headers.get('x-request-id') || ''),
  });
}

if (forceAlert) throw new Error('CONTROLLED_OBSERVABILITY_ALERT');
