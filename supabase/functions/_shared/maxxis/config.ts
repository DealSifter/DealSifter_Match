import { buildCorsHeaders, parseAllowedOrigins } from './corsPolicy.ts';

export const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
export const supabaseAnonKey = Deno.env.get('ANON_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
export const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
export const geminiApiKey = Deno.env.get('GEMINI_API_KEY') ?? Deno.env.get('GOOGLE_GENERATIVE_AI_API_KEY') ?? '';

const configuredModel = Deno.env.get('MAXXIS_GEMINI_MODEL') ?? '';
export const geminiModels = Array.from(new Set([
  configuredModel,
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash-lite-001',
].filter(Boolean)));

export const geminiTimeoutMs = Math.max(1_000, Number(Deno.env.get('MAXXIS_GEMINI_TIMEOUT_MS') || 20_000));

const allowedOrigins = parseAllowedOrigins(
  Deno.env.get('MAXXIS_ALLOWED_ORIGINS') || '',
  [Deno.env.get('APP_URL') || '', Deno.env.get('VITE_APP_URL') || ''],
);

export function corsHeaders(origin = '') {
  return buildCorsHeaders(origin, allowedOrigins);
}
