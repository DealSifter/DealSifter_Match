import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const config = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8'));
const indexHtml = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const failures = [];
const fail = (message) => failures.push(message);

if (config.installCommand !== 'npm ci') fail('installCommand must be npm ci');

const headerRules = config.headers || (config.routes || []).filter(rule=>rule.continue).map(rule=>({
  source:rule.src,headers:Object.entries(rule.headers || {}).map(([key,value])=>({key,value})),
}));
const globalRule = headerRules.find((rule) => rule.source === '/(.*)');
const globalHeaders = new Map((globalRule?.headers || []).map(({ key, value }) => [key.toLowerCase(), value]));
const requiredHeaders = [
  'content-security-policy',
  'strict-transport-security',
  'x-content-type-options',
  'x-frame-options',
  'referrer-policy',
  'permissions-policy',
  'cross-origin-opener-policy',
];
requiredHeaders.forEach((name) => {
  if (!globalHeaders.has(name)) fail(`missing security header: ${name}`);
});
if (!String(globalHeaders.get('content-security-policy') || '').includes("frame-ancestors 'none'")) {
  fail('Content-Security-Policy must prevent framing');
}
if (!/connect-src[^;]*https:\/\/[^\s;]*ingest(?:\.[a-z]{2})?\.sentry\.io/i.test(indexHtml)) {
  fail('Browser Content-Security-Policy must allow the configured Sentry ingest host');
}

const assetsRule = headerRules.find((rule) => rule.source === '/assets/(.*)');
const assetCache = (assetsRule?.headers || []).find(({ key }) => key.toLowerCase() === 'cache-control')?.value || '';
if (!/immutable/i.test(assetCache)) fail('hashed assets must use immutable caching');

const indexRule = headerRules.find((rule) => rule.source === '/index.html' || rule.source === '/((?!assets/).*)');
const indexCache = (indexRule?.headers || []).find(({ key }) => key.toLowerCase() === 'cache-control')?.value || '';
if (!/no-store/i.test(indexCache)) fail('SPA entrypoint must not use persistent caching');
if(config.routes){
  const filesystem=config.routes.findIndex(rule=>rule.handle==='filesystem');
  const missing=config.routes.findIndex(rule=>rule.src==='/assets/(.*)'&&rule.status===404);
  if(filesystem<0||missing<=filesystem||!/no-store/i.test(config.routes[missing]?.headers?.['Cache-Control']||'')){
    fail('missing assets must return an uncached 404 after filesystem lookup');
  }
}

if (failures.length) {
  failures.forEach((message) => console.error(`[hosting-security] ${message}`));
  process.exit(1);
}
console.log(`[hosting-security] headers=${requiredHeaders.length} install=npm-ci asset-cache=immutable entry-cache=no-store`);
console.log('[hosting-security] Vercel policy check passed.');
