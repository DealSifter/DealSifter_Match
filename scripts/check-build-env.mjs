/**
 * Ensures Supabase public env vars exist before production builds (e.g. on Vercel).
 * Accepts VITE_* names or legacy SUPABASE_* names set in the Vercel dashboard.
 */
const url = (
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  ''
).trim();

const anonKey = (
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  ''
).trim();

const isVercel = Boolean(process.env.VERCEL);
const isCi = Boolean(process.env.CI);

if (!url || !anonKey) {
  const msg = [
    'Supabase env missing for frontend build.',
    'Set on Vercel (Project → Settings → Environment Variables):',
    '  VITE_SUPABASE_URL=https://<project-ref>.supabase.co',
    '  VITE_SUPABASE_ANON_KEY=<anon public key>',
    '(Legacy aliases SUPABASE_URL / SUPABASE_ANON_KEY are also supported.)',
    'Then redeploy the project.',
  ].join('\n');

  if (isVercel || isCi) {
    console.error(msg);
    process.exit(1);
  }
  console.warn(`[check-build-env] ${msg}`);
  process.exit(0);
}

console.log('[check-build-env] Supabase public env OK.');
