import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const app = 'https://dealsiftermatch.vercel.app';
const base = 'https://cyeipfskwwisbbayyaca.supabase.co';
const env = Object.fromEntries((await readFile('.env.local', 'utf8')).split(/\r?\n/).filter(line => /^[A-Za-z_][A-Za-z0-9_]*=/.test(line))
  .map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')]; }));
const publicKey = env.VITE_SUPABASE_ANON_KEY;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SERVICE_ROLE_KEY;
if (!publicKey || !key) throw new Error('EXISTING_SCOPED_QA_CONFIG_REQUIRED');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage(); const errors = []; const requestHeaderNames = [];
  page.on('console', message => { if (/blocked by CORS|not allowed by Access-Control-Allow-Headers/.test(message.text())) errors.push(message.text()); });
  page.on('request', request => { if (request.url().includes('/functions/v1/geocode-address')) requestHeaderNames.push(Object.keys(request.headers())); });
  const frontend = await page.goto(app, { waitUntil: 'networkidle', timeout: 60000 });
  const result = await page.evaluate(async ({ base, publicKey }) => {
    try {
      const response = await fetch(`${base}/functions/v1/geocode-address`, { method: 'POST',
        headers: { apikey: publicKey, Authorization: `Bearer ${publicKey}`, 'Content-Type': 'application/json',
          baggage: 'sentry-environment=production', 'sentry-trace': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-0' },
        body: JSON.stringify({ address: '1524 Wood Spring Ct', city: 'Raleigh', state: 'NC', zip: '27614' }) });
      return { status: response.status, transportSucceeded: true };
    } catch { return { transportSucceeded: false }; }
  }, { base, publicKey });
  // Backend maintenance authorization, not a manufactured user session; read-only RPC.
  const response = await fetch(`${base}/rest/v1/rpc/ds_get_global_feed_inventory`, { method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`READ_ONLY_INVENTORY_${response.status}`);
  const inventory = await response.json();
  const property = inventory.properties?.find(property => property.id === '60379a77-98b1-4c31-af00-32e6ac208e83');
  const privateProperties = inventory.properties?.filter(property => property.hide_street_address_on_card);
  const receipt = { observedAt: new Date().toISOString(), frontendStatus: frontend.status(), browserGeocode: result,
    corsErrors: errors, requestHeaderNames, propertyPresent: Boolean(property), propertyStatus: property?.geocode_status,
    geocodeValid: property?.geocode_valid, physicalPointPresent: Number.isFinite(property?.lat) && Number.isFinite(property?.lng),
    privateCards: privateProperties.length,
    privateExactPointsRedacted: privateProperties.every(property => property.address === null && property.lat === null && property.lng === null && property.geocode_input === null),
    realUserAuthenticatedAcceptance: 'NOT_PERFORMED_NO_USER_SESSION', paidProviderCalls: 0, geocoderProviderCalls: 0 };
  receipt.pass = frontend.ok() && result.transportSucceeded && result.status === 401 && errors.length === 0
    && receipt.geocodeValid === true && receipt.physicalPointPresent && receipt.privateExactPointsRedacted;
  await writeFile('qa/geocode-wood-spring/production-smoke.json', JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt)); if (!receipt.pass) process.exitCode = 1;
} finally { await browser.close(); }
