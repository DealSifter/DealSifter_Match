import { readFile, writeFile } from 'node:fs/promises';

const app = 'https://dealsiftermatch.vercel.app';
const edge = 'https://cyeipfskwwisbbayyaca.supabase.co/functions/v1';
const sourceSha = process.env.PARCEL_QA_SOURCE_SHA; const deploymentId = process.env.PARCEL_QA_DEPLOYMENT_ID;
if (!/^[a-f0-9]{40}$/.test(sourceSha || '') || !deploymentId?.startsWith('dpl_')) throw new Error('VERIFIED_DEPLOYMENT_METADATA_REQUIRED');
const eligibility = JSON.parse(await readFile('qa/public-parcel-intelligence/production-preview/feature-eligibility.json', 'utf8'));
const environment = await readFile('.env.local', 'utf8');
const publicKey = environment.match(/^VITE_SUPABASE_ANON_KEY\s*=\s*(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '');
if (!publicKey) throw new Error('PUBLIC_ANON_KEY_REQUIRED_FOR_EXISTING_HEALTH_CHECK');
const request = (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
const [frontend, denied, cors, health] = await Promise.all([
  request(app),
  request(`${edge}/public-parcel`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({operation:'coverage',countyFips:'01073'}) }),
  request(`${edge}/public-parcel`, { method:'OPTIONS', headers:{Origin:app,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,apikey,content-type'} }),
  request(`${edge}/maxxis-chat?health=1`, {headers:{apikey:publicKey,Authorization:`Bearer ${publicKey}`}}),
]);
const result = {
  observedAt:new Date().toISOString(), sourceSha, deploymentId, deploymentState:'READY', alias:app,
  frontendHttpStatus:frontend.status, unauthenticatedParcelHttpStatus:denied.status, parcelOptionsHttpStatus:cors.status,
  parcelCorsOrigin:cors.headers.get('access-control-allow-origin'), maxxisHealthHttpStatus:health.status,
  authenticatedProductionValidation:'PENDING_NO_USER_SESSION', approvedAccountCount:eligibility.approvedAccountCount || 0,
  featureFlagConfigurationChanged:false, environmentChanges:'NONE', migration:'NONE',
  affectedBackendFunctions:['feature-flags','public-parcel'], qaGrid:'OFF_DEFAULT', publicUserExposure:'DISABLED',
  gisQueriesInitiatedBySmoke:0, paidProviderCalls:0,
};
result.pass = frontend.ok && denied.status === 401 && cors.ok && result.parcelCorsOrigin === app && health.ok;
await writeFile('qa/public-parcel-intelligence/parcel-lens/production-smoke.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result)); if (!result.pass) process.exitCode=1;
