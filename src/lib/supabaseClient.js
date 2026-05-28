import { createClient } from '@supabase/supabase-js';

const normalizeEnvValue = (value) => String(value || '').trim().replace(/^['\"]|['\"]$/g, '');
const isValidHttpUrl = (value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
};

const supabaseUrl = normalizeEnvValue(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
const hasValidSupabaseUrl = isValidHttpUrl(supabaseUrl);

export const isSupabaseConfigured = Boolean(hasValidSupabaseUrl && supabaseAnonKey);

/** Dev-only hint when env vars were not injected at build time (common on Vercel). */
export const supabaseConfigHint = isSupabaseConfigured
  ? null
  : 'Defina VITE_SUPABASE_URL (https://...) e VITE_SUPABASE_ANON_KEY na Vercel e faca Redeploy.';

let supabase = null;
if (isSupabaseConfigured) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
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
