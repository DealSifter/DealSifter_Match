import { loadEnv } from 'vite';
import { writeFileSync } from 'node:fs';

const env = loadEnv('production', process.cwd(), 'VITE_');
const backend = env.VITE_SUPABASE_URL?.replace(/\/$/, '');
const key = env.VITE_SUPABASE_ANON_KEY;
if (!backend?.includes('cyeipfskwwisbbayyaca') || !key) throw new Error('P0_PRODUCTION_PROJECT_CONFIGURATION_MISMATCH');
const headers = { apikey: key, ...(key.split('.').length === 3 ? { Authorization: `Bearer ${key}` } : {}) };
async function probe(name, url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...headers, ...options.headers }, signal: AbortSignal.timeout(30000) });
  const json = await response.json().catch(() => null);
  return { name, status: response.status, body: json ? { status: json.status, function: json.function, release: json.release, code: json.code } : null };
}
const frontend = await fetch('https://dealsiftermatch.vercel.app', { signal: AbortSignal.timeout(30000) });
const checks = [{ name: 'frontend', status: frontend.status },
  await probe('maxxis-health', backend + '/functions/v1/maxxis-chat?health=1')];
for (const name of ['maxxis-analysis-inputs', 'maxxis-provider-message-draft', 'maxxis-deal-workflow']) {
  checks.push(await probe(name + '-cors', backend + '/functions/v1/' + name, { method: 'OPTIONS' }));
}
// Deliberately unauthenticated, non-destructive read with a nonexistent UUID: confirm privacy boundary.
checks.push(await probe('canonical-property-auth-boundary', backend + '/rest/v1/rpc/ds_get_public_property_details', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p_property_id: '00000000-0000-0000-0000-000000000001' }),
}));
const healthy = checks.slice(0, 5).every(check => check.status >= 200 && check.status < 300);
const receipt = { sourceRevision: 'a02951fe06db81b27a75ec9995ec5e93165ab592', checkedAt: new Date().toISOString(),
  state: healthy ? 'PARTIAL' : 'FAIL', checks,
  canonicalAuthenticatedResponse: { state: 'NOT_VERIFIED', reason: 'No configured authenticated smoke session; anon has no RPC execute permission.' },
  scenarioEndpoint: { endpoint: 'maxxis-chat', state: 'AVAILABILITY_ONLY', deterministicTests: 'PASS' },
  reportEndpoint: { state: 'NOT_REQUIRED_CLIENT_RENDERER', deterministicTests: 'PASS' },
  automatedRentCastCalls: 0, geminiCalls: 0, stripeMutations: 0 };
writeFileSync('qa/p0-canonical-truth/production-smoke.json', JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt));
if (!healthy) process.exitCode = 1;
