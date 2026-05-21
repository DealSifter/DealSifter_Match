import { createClient } from '@supabase/supabase-js';

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/** Dev-only hint when env vars were not injected at build time (common on Vercel). */
export const supabaseConfigHint = isSupabaseConfigured
  ? null
  : 'Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY na Vercel e faça Redeploy.';

let supabase = null;
if (isSupabaseConfigured) {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

export { supabase };
