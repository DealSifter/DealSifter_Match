import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readLocalEnv() {
  if (process.env.CI || process.env.VERCEL) return {};
  const result = {};
  for (const filename of ['.env', '.env.local']) {
    const path = resolve(process.cwd(), filename);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      result[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
    }
  }
  return result;
}

const localEnv = readLocalEnv();
const valueOf = (...names) => names.map((name) => process.env[name] || localEnv[name] || '').find(Boolean) || '';
const vercelEnvironment = String(process.env.VERCEL_ENV || '').trim().toLowerCase();
const explicitStrict = process.argv.includes('--strict');
const isVercel = Boolean(process.env.VERCEL);
const isGenericCi = Boolean(process.env.CI) && !isVercel;
const knownVercelEnvironments = new Set(['production', 'preview', 'development']);

let environment = 'development';
if (isVercel) {
  environment = knownVercelEnvironments.has(vercelEnvironment) ? vercelEnvironment : 'unknown';
} else if (isGenericCi) {
  environment = 'ci';
}

const strictProduction = explicitStrict || environment === 'production' || environment === 'ci';
const failures = [];
const warnings = [];

const productionRequired = [
  ['Supabase URL', valueOf('VITE_SUPABASE_URL', 'SUPABASE_URL')],
  ['Supabase public key', valueOf('VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY', 'ANON_KEY')],
  ['App URL', valueOf('VITE_APP_URL', 'APP_URL')],
  ['Stripe P5 price', valueOf('VITE_STRIPE_PRICE_P5')],
  ['Stripe P15 price', valueOf('VITE_STRIPE_PRICE_P15')],
  ['Stripe P40 price', valueOf('VITE_STRIPE_PRICE_P40')],
  ['Stripe P100 price', valueOf('VITE_STRIPE_PRICE_P100')],
  ['Stripe Pro monthly price', valueOf('VITE_STRIPE_PRICE_PLAN_PRO')],
  ['Stripe Enterprise monthly price', valueOf('VITE_STRIPE_PRICE_PLAN_ENTERPRISE')],
  ['Stripe Pro annual price', valueOf('VITE_STRIPE_PRICE_PLAN_PRO_YEAR')],
  ['Stripe Enterprise annual price', valueOf('VITE_STRIPE_PRICE_PLAN_ENTERPRISE_YEAR')],
];

// Required for an authenticated Preview at runtime, but not by Vite compilation.
// Preview must not inherit LIVE values merely to satisfy a build-time check.
const previewRuntimeRequired = [
  ['Supabase URL', valueOf('VITE_SUPABASE_URL', 'SUPABASE_URL')],
  ['Supabase public key', valueOf('VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY', 'ANON_KEY')],
  ['App URL', valueOf('VITE_APP_URL', 'APP_URL')],
];

if (environment === 'unknown') {
  failures.push('unable to classify Vercel deployment: VERCEL_ENV must be production, preview, or development');
}

if (strictProduction) {
  productionRequired.forEach(([label, value]) => {
    if (!String(value).trim()) failures.push(`missing ${label}`);
  });
} else if (environment === 'preview') {
  previewRuntimeRequired.forEach(([label, value]) => {
    if (!String(value).trim()) warnings.push(`missing runtime ${label}`);
  });
} else {
  productionRequired.forEach(([label, value]) => {
    if (!String(value).trim()) warnings.push(`missing ${label}`);
  });
}

for (const [label, value] of productionRequired.filter(([name]) => name.includes('Stripe'))) {
  if (value && !/^price_[A-Za-z0-9]+$/.test(value) && !/^price_ci_[A-Za-z0-9_]+$/.test(value)) {
    const issue = `invalid ${label} format`;
    if (strictProduction) failures.push(issue);
    else warnings.push(issue);
  }
}

for (const [label, value] of productionRequired.filter(([name]) => name.endsWith('URL'))) {
  if (!value) continue;
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      const issue = `invalid ${label} protocol`;
      if (strictProduction) failures.push(issue);
      else warnings.push(issue);
    }
  } catch {
    const issue = `invalid ${label}`;
    if (strictProduction) failures.push(issue);
    else warnings.push(issue);
  }
}

const allNames = new Set([...Object.keys(localEnv), ...Object.keys(process.env)]);
const exposedSecrets = [...allNames].filter((name) => (
  name.startsWith('VITE_') && /(SECRET|SERVICE_ROLE|GEMINI_API_KEY|WEBHOOK_SIGNING)/i.test(name)
));
if (exposedSecrets.length) {
  const message = `secret-like VITE_ variables must not be configured: ${exposedSecrets.sort().join(', ')}`;
  if (process.env.CI || process.env.VERCEL) failures.push(message);
  else warnings.push(message);
}

if (failures.length) {
  const message = failures.map((failure) => `  - ${failure}`).join('\n');
  console.error(`[build-env] ${environment} environment invalid:\n${message}`);
  process.exit(1);
}

if (warnings.length) {
  const message = warnings.map((warning) => `  - ${warning}`).join('\n');
  console.warn(`[build-env] ${environment} environment warning:\n${message}`);
}

console.log(
  `[build-env] environment=${environment} authority=${isVercel ? 'VERCEL_ENV' : explicitStrict ? '--strict' : isGenericCi ? 'CI' : 'local'} production-required=${productionRequired.length} strict=${strictProduction ? 'yes' : 'no'} status=ok`,
);
