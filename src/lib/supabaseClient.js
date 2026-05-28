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

const readFirstEnv = (...keys) => {
  for (const key of keys) {
    const value = normalizeEnvValue(import.meta.env?.[key]);
    if (value) return value;
  }
  return '';
};

const supabaseUrl = readFirstEnv('VITE_SUPABASE_URL', 'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = readFirstEnv('VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY');
const hasValidSupabaseUrl = isValidHttpUrl(supabaseUrl);

export const isSupabaseConfigured = Boolean(hasValidSupabaseUrl && supabaseAnonKey);

/** Dev-only hint when env vars were not injected at build time (common on Vercel). */
export const supabaseConfigHint = isSupabaseConfigured
  ? null
  : 'Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (ou SUPABASE_URL / SUPABASE_ANON_KEY) na Vercel e faca Redeploy.';

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
