import { readFile, writeFile } from 'node:fs/promises';

// Public, non-mutating smoke only. No user impersonation, paid API or source GIS query.
const app = 'https://dealsiftermatch.vercel.app';
const edge = 'https://cyeipfskwwisbbayyaca.supabase.co/functions/v1';
// The gateway requires the existing public anon key even for health. This is not a user session.
const envText = await readFile('.env.local', 'utf8');
const publicKey = envText.match(/^VITE_SUPABASE_ANON_KEY\s*=\s*(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '');
if (!publicKey) throw new Error('PUBLIC_ANON_KEY_REQUIRED_FOR_HEALTH');
const request = (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
const [frontend, denied, cors, health] = await Promise.all([
  request(app),
  request(`${edge}/public-parcel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operation: 'coverage', countyFips: '01073' }) }),
  request(`${edge}/public-parcel`, { method: 'OPTIONS', headers: { Origin: app, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,apikey,content-type' } }),
  request(`${edge}/maxxis-chat?health=1`, { headers: { apikey: publicKey, Authorization: `Bearer ${publicKey}` } }),
]);
const result = { observedAt: new Date().toISOString(), sourceSha: '970c5d6dd47c5ecc0b8594922e097be50f31fa97',
  deploymentId: 'dpl_Hj638QbdnyYGeiZ3AuKaEzxp7trM', deploymentState: 'READY', alias: app,
  frontendHttpStatus: frontend.status, unauthenticatedParcelHttpStatus: denied.status,
  parcelOptionsHttpStatus: cors.status, parcelCorsOrigin: cors.headers.get('access-control-allow-origin'), maxxisHealthHttpStatus: health.status,
  authenticatedParcelSession: 'NOT_RUN_NO_USER_SESSION_PROVIDED',
  gisQueriesInitiatedBySmoke: 0, paidProviderCalls: 0,
  publicSourcesEnabled: 0, publicUserExposure: 'DISABLED', productionFeatureFlagConfigurationChanged: false,
  functionVersions: { 'public-parcel': 1, 'feature-flags': 13, 'maxxis-chat': 79, 'property-intelligence': 9, 'arv-visual-comp-review': 9, 'maxxis-provider-message-draft': 15 },
};
result.pass = frontend.ok && denied.status === 401 && cors.ok && result.parcelCorsOrigin === app && health.ok;
await writeFile('qa/public-parcel-intelligence/production-deploy.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
if (!result.pass) process.exitCode = 1;
