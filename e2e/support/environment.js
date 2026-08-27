/* global process */
const PRODUCTION_HOSTS = new Set([
  'dealsiftermatch.vercel.app',
  'dealsifter-match.vercel.app',
  'dealsifter.com',
  'www.dealsifter.com',
]);

const PRODUCTION_SUPABASE_PROJECT_REFS = new Set([
  'cyeipfskwwisbbayyaca',
]);

export function getE2ERunId() {
  const raw = String(process.env.E2E_RUN_ID || '').trim();
  if (raw) return raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 48);
  return `e2e-${Date.now().toString(36)}`;
}

export function isProductionUrl(value) {
  try {
    const parsed = new URL(String(value || ''));
    return PRODUCTION_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function getSupabaseProjectRef(value) {
  try {
    const parsed = new URL(String(value || ''));
    const parts = parsed.hostname.toLowerCase().split('.');
    return parts.length >= 3 && parts[1] === 'supabase' ? parts[0] : '';
  } catch {
    return '';
  }
}

export function assertSafeE2EEnvironment({ baseURL = process.env.E2E_BASE_URL, destructive = false } = {}) {
  if (!destructive) return;
  if (!isProductionUrl(baseURL)) return;
  throw new Error(
    `Blocked destructive E2E suite against production URL: ${baseURL}. ` +
      'Use a local or staging URL with isolated fixtures.',
  );
}

export function assertSafeRealBackendEnvironment({
  baseURL = process.env.E2E_BASE_URL,
  supabaseUrl = process.env.E2E_SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  backendMode = process.env.E2E_BACKEND_MODE,
  serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY,
} = {}) {
  assertSafeE2EEnvironment({ baseURL, destructive: true });
  if (backendMode !== 'real') {
    throw new Error('Blocked real backend E2E: set E2E_BACKEND_MODE=real explicitly.');
  }
  const projectRef = getSupabaseProjectRef(supabaseUrl);
  if (!projectRef) {
    throw new Error(`Blocked real backend E2E: invalid Supabase URL (${supabaseUrl || 'missing'}).`);
  }
  if (PRODUCTION_SUPABASE_PROJECT_REFS.has(projectRef)) {
    throw new Error(`Blocked real backend E2E against production Supabase project: ${projectRef}.`);
  }
  if (!String(serviceRoleKey || '').trim()) {
    throw new Error('Blocked real backend E2E: E2E_SUPABASE_SERVICE_ROLE_KEY is required for fixture setup/cleanup.');
  }
}

export function assertRealGeminiEnvironment({
  mode = process.env.E2E_LLM_MODE,
  supabaseUrl = process.env.E2E_SUPABASE_URL || process.env.VITE_SUPABASE_URL,
} = {}) {
  if (mode !== 'real') {
    throw new Error('Blocked real Gemini E2E: set E2E_LLM_MODE=real explicitly.');
  }
  const projectRef = getSupabaseProjectRef(supabaseUrl);
  if (!projectRef || PRODUCTION_SUPABASE_PROJECT_REFS.has(projectRef)) {
    throw new Error(`Blocked real Gemini E2E against unsafe Supabase project: ${projectRef || 'missing'}.`);
  }
}
