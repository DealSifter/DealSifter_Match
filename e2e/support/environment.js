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
const REAL_RUNTIME_STAGING_PROJECT_REF = 'oqdcnjupquhybwdbeeew';

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
    throw new Error('BLOCKED_BY_GUARD: invalid Supabase URL for real backend E2E.');
  }
  if (PRODUCTION_SUPABASE_PROJECT_REFS.has(projectRef) || projectRef !== REAL_RUNTIME_STAGING_PROJECT_REF) {
    throw new Error(`BLOCKED_BY_GUARD: real backend E2E requires staging project ${REAL_RUNTIME_STAGING_PROJECT_REF}.`);
  }
  if (!String(serviceRoleKey || '').trim()) {
    throw new Error('BLOCKED_AUTH: staging service-role credential is required for fixture setup/cleanup.');
  }
}

export function assertRealGeminiEnvironment({
  mode = process.env.E2E_LLM_MODE,
  supabaseUrl = process.env.E2E_SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  stubValue = process.env.MAXXIS_E2E_LLM_STUB,
} = {}) {
  if (mode !== 'real') {
    throw new Error('BLOCKED_BY_GUARD: set E2E_LLM_MODE=real explicitly.');
  }
  const projectRef = getSupabaseProjectRef(supabaseUrl);
  if (!projectRef || PRODUCTION_SUPABASE_PROJECT_REFS.has(projectRef) || projectRef !== REAL_RUNTIME_STAGING_PROJECT_REF) {
    throw new Error(`BLOCKED_BY_GUARD: real Gemini E2E requires staging project ${REAL_RUNTIME_STAGING_PROJECT_REF}.`);
  }
  if (String(stubValue || '').trim() && String(stubValue || '').trim() !== '0') {
    throw new Error('BLOCKED_BY_GUARD: MAXXIS_E2E_LLM_STUB is forbidden in real-runtime acceptance.');
  }
}
