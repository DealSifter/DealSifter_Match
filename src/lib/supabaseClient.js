import { createClient } from '@supabase/supabase-js';

const normalizeEnvValue = (value) => String(value || '')
  .trim()
  .replace(/^['"]|['"]$/g, '')
  .replace(/[\r\n\t]/g, '')
  .trim();
const isValidHttpUrl = (value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
};
const canonicalizeSupabaseUrl = (value) => {
  const raw = normalizeEnvValue(value);
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^[a-z0-9-]+\.supabase\.(co|in)$/i.test(raw)) return `https://${raw}`;
  return raw;
};

const readFirstEnv = (...keys) => {
  for (const key of keys) {
    const value = normalizeEnvValue(import.meta.env?.[key]);
    if (value) return value;
  }
  return '';
};

const supabaseUrl = canonicalizeSupabaseUrl(readFirstEnv('VITE_SUPABASE_URL', 'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'));
const supabaseAnonKey = readFirstEnv('VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY');
const hasValidSupabaseUrl = isValidHttpUrl(supabaseUrl);
const nativeFetch = (...args) => fetch(...args);
const pendingReadRequests = new Map();

const getRequestMethod = (input, init = {}) => {
  const method = init?.method || (typeof input === 'object' && input?.method) || 'GET';
  return String(method || 'GET').toUpperCase();
};

const getRequestUrl = (input) => {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input?.url || '';
};

const shouldDedupeSupabaseRead = (input, init) => {
  const method = getRequestMethod(input, init);
  if (method !== 'GET' && method !== 'HEAD') return false;
  const url = getRequestUrl(input);
  if (!url || !supabaseUrl || !url.startsWith(supabaseUrl)) return false;
  return !url.includes('/auth/v1/');
};

const quotaFriendlyFetch = async (input, init = {}) => {
  if (!shouldDedupeSupabaseRead(input, init)) {
    return nativeFetch(input, init);
  }

  const key = `${getRequestMethod(input, init)} ${getRequestUrl(input)}`;
  if (!pendingReadRequests.has(key)) {
    pendingReadRequests.set(
      key,
      nativeFetch(input, init).finally(() => {
        pendingReadRequests.delete(key);
      }),
    );
  }

  const response = await pendingReadRequests.get(key);
  return response.clone();
};

export const isSupabaseConfigured = Boolean(hasValidSupabaseUrl && supabaseAnonKey);
export const supabaseConfigReason = hasValidSupabaseUrl
  ? (supabaseAnonKey ? '' : 'VITE_SUPABASE_ANON_KEY ausente')
  : (supabaseUrl ? `VITE_SUPABASE_URL inválida: ${supabaseUrl}` : 'VITE_SUPABASE_URL ausente');

/** Dev-only hint when env vars were not injected at build time (common on Vercel). */
export const supabaseConfigHint = isSupabaseConfigured
  ? null
  : `Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY na Vercel e faca Redeploy. (${supabaseConfigReason})`;

let supabase = null;
if (isSupabaseConfigured) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        fetch: quotaFriendlyFetch,
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  } catch {
    supabase = null;
  }
}

export { supabase };
