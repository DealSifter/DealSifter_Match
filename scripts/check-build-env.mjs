import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validatePreviewSupabaseEnvironment } from './preview-environment-guard.mjs';

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
const strict = process.argv.includes('--strict') || Boolean(process.env.CI || process.env.VERCEL);
const failures = [];
const supabaseUrl = valueOf('VITE_SUPABASE_URL', 'SUPABASE_URL');

const required = [
  ['Supabase URL', supabaseUrl],
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
required.forEach(([label, value]) => { if (!String(value).trim()) failures.push(`missing ${label}`); });

const previewGuard = validatePreviewSupabaseEnvironment({
  vercelEnv: process.env.VERCEL_ENV,
  supabaseUrl,
});
if (!previewGuard.ok) failures.push(previewGuard.reason);

for (const [label, value] of required.filter(([name]) => name.includes('Stripe'))) {
  if (value && !/^price_[A-Za-z0-9]+$/.test(value) && !/^price_ci_[A-Za-z0-9_]+$/.test(value)) {
    failures.push(`invalid ${label} format`);
  }
}

for (const [label, value] of required.filter(([name]) => name.endsWith('URL'))) {
  if (!value) continue;
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) failures.push(`invalid ${label} protocol`);
  } catch {
    failures.push(`invalid ${label}`);
  }
}

const allNames = new Set([...Object.keys(localEnv), ...Object.keys(process.env)]);
const exposedSecrets = [...allNames].filter((name) => (
  name.startsWith('VITE_') && /(SECRET|SERVICE_ROLE|GEMINI_API_KEY|WEBHOOK_SIGNING)/i.test(name)
));
if (exposedSecrets.length) {
  const message = `secret-like VITE_ variables must not be configured: ${exposedSecrets.sort().join(', ')}`;
  if (process.env.CI || process.env.VERCEL) failures.push(message);
  else console.warn(`[build-env] warning: ${message}`);
}

if (failures.length) {
  const message = failures.map((failure) => `  - ${failure}`).join('\n');
  if (strict) {
    console.error(`[build-env] production environment invalid:\n${message}`);
    process.exit(1);
  }
  console.warn(`[build-env] local environment incomplete:\n${message}`);
  process.exit(0);
}

console.log(`[build-env] required-public-values=${required.length} strict=${strict ? 'yes' : 'no'} status=ok`);
