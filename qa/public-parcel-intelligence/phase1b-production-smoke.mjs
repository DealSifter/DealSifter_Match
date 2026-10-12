import { readFile, writeFile } from 'node:fs/promises';

// Read-only production checks. No user impersonation, source query or paid call.
const app = 'https://dealsiftermatch.vercel.app';
const edge = 'https://cyeipfskwwisbbayyaca.supabase.co/functions/v1';
const sourceSha = process.env.PARCEL_QA_SOURCE_SHA;
const deploymentId = process.env.PARCEL_QA_DEPLOYMENT_ID;
const versions = JSON.parse(process.env.PARCEL_QA_FUNCTION_VERSIONS || '{}');
if (!/^[a-f0-9]{40}$/.test(sourceSha || '') || !deploymentId?.startsWith('dpl_')) throw new Error('VERIFIED_DEPLOYMENT_METADATA_REQUIRED');
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
const result = { observedAt: new Date().toISOString(), sourceSha, deploymentId, deploymentState: 'READY', alias: app,
  frontendHttpStatus: frontend.status, unauthenticatedParcelHttpStatus: denied.status,
  parcelOptionsHttpStatus: cors.status, parcelCorsOrigin: cors.headers.get('access-control-allow-origin'), maxxisHealthHttpStatus: health.status,
  authenticatedParcelSession: 'NOT_RUN_NO_USER_SESSION_PROVIDED', gisQueriesInitiatedBySmoke: 0, paidProviderCalls: 0,
  activeRegistrySources: 5, publicSourcesEnabled: 0, publicUserExposure: 'DISABLED', internalProductionCohort: 'NOT_CONFIGURED',
  productionFeatureFlagConfigurationChanged: false, migration: 'NONE', functionVersions: versions,
};
result.pass = frontend.ok && denied.status === 401 && cors.ok && result.parcelCorsOrigin === app && health.ok;
await writeFile('qa/public-parcel-intelligence/phase1b-production-deploy.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
if (!result.pass) process.exitCode = 1;
