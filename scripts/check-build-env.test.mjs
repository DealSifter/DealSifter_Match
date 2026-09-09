import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const scriptPath = fileURLToPath(new URL('./check-build-env.mjs', import.meta.url));
const managedNames = [
  'CI', 'VERCEL', 'VERCEL_ENV', 'VERCEL_TARGET_ENV',
  'VITE_SUPABASE_URL', 'SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY', 'ANON_KEY',
  'VITE_APP_URL', 'APP_URL',
  'VITE_STRIPE_PRICE_P5', 'VITE_STRIPE_PRICE_P15',
  'VITE_STRIPE_PRICE_P40', 'VITE_STRIPE_PRICE_P100',
  'VITE_STRIPE_PRICE_PLAN_PRO', 'VITE_STRIPE_PRICE_PLAN_ENTERPRISE',
  'VITE_STRIPE_PRICE_PLAN_PRO_YEAR', 'VITE_STRIPE_PRICE_PLAN_ENTERPRISE_YEAR',
];

const completeProductionEnv = {
  VITE_SUPABASE_URL: 'https://production-project.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'public-anon-key',
  VITE_APP_URL: 'https://app.example.com',
  VITE_STRIPE_PRICE_P5: 'price_testP5',
  VITE_STRIPE_PRICE_P15: 'price_testP15',
  VITE_STRIPE_PRICE_P40: 'price_testP40',
  VITE_STRIPE_PRICE_P100: 'price_testP100',
  VITE_STRIPE_PRICE_PLAN_PRO: 'price_testProMonth',
  VITE_STRIPE_PRICE_PLAN_ENTERPRISE: 'price_testEnterpriseMonth',
  VITE_STRIPE_PRICE_PLAN_PRO_YEAR: 'price_testProYear',
  VITE_STRIPE_PRICE_PLAN_ENTERPRISE_YEAR: 'price_testEnterpriseYear',
};

function runValidator(overrides = {}, args = [], cwd = fileURLToPath(new URL('../', import.meta.url))) {
  const env = { ...process.env };
  managedNames.forEach((name) => { delete env[name]; });
  Object.assign(env, overrides);
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd,
    env,
    encoding: 'utf8',
  });
}

test('VERCEL_ENV=production passes with complete production variables', () => {
  const result = runValidator({ VERCEL: '1', VERCEL_ENV: 'production', ...completeProductionEnv });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /environment=production/);
  assert.match(result.stdout, /authority=VERCEL_ENV/);
});

test('VERCEL_ENV=production fails closed when a production variable is missing', () => {
  const env = { VERCEL: '1', VERCEL_ENV: 'production', ...completeProductionEnv };
  delete env.VITE_STRIPE_PRICE_P5;
  const result = runValidator(env);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /missing Stripe P5 price/);
});

test('VERCEL_ENV=preview does not require production-only Stripe variables', () => {
  const result = runValidator({
    VERCEL: '1',
    VERCEL_ENV: 'preview',
    VITE_SUPABASE_URL: 'https://staging-project.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'public-staging-anon-key',
    VITE_APP_URL: 'https://preview.example.com',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stderr, /Stripe/);
});

test('VERCEL_ENV=preview warns but compiles when a runtime-only variable is missing', () => {
  const result = runValidator({ VERCEL: '1', VERCEL_ENV: 'preview' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /missing runtime Supabase URL/);
  assert.match(result.stdout, /strict=no/);
});

test('local development preserves non-blocking incomplete-environment behavior', () => {
  const emptyDirectory = mkdtempSync(join(tmpdir(), 'dealsifter-build-env-'));
  try {
    const result = runValidator({}, [], emptyDirectory);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /development environment warning/);
    assert.match(result.stdout, /authority=local/);
  } finally {
    rmSync(emptyDirectory, { recursive: true, force: true });
  }
});

test('Vercel execution without VERCEL_ENV fails closed', () => {
  const result = runValidator({ VERCEL: '1' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unable to classify Vercel deployment/);
});
