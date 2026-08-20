import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/maxxis/config.ts';
import { resolveFeatureFlags, type FeatureEnvironment } from '../_shared/featureFlags.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const productionRef = 'cyeipfskwwisbbayyaca';
const stagingRef = 'oqdcnjupquhybwdbeeew';

function json(body: Record<string, unknown>, status: number, origin: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function environmentFromUrl(): FeatureEnvironment {
  if (supabaseUrl.includes(productionRef)) return 'production';
  if (supabaseUrl.includes(stagingRef)) return 'staging';
  return 'development';
}

function remoteConfig() {
  try {
    const value = JSON.parse(Deno.env.get('FEATURE_FLAGS_JSON') || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin') || '';
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405, origin);

  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token || !supabaseUrl || !supabaseAnonKey) return json({ error: 'UNAUTHORIZED' }, 401, origin);
  const client = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) return json({ error: 'UNAUTHORIZED' }, 401, origin);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { body = {}; }
  const requestedOverrides = body.overrides && typeof body.overrides === 'object' && !Array.isArray(body.overrides)
    ? body.overrides as Record<string, unknown>
    : {};
  const environment = environmentFromUrl();
  let allowOverride = environment !== 'production';
  if (!allowOverride && Object.keys(requestedOverrides).length) {
    const { data: isAdmin } = await client.rpc('ds_is_current_user_admin');
    allowOverride = isAdmin === true;
  }

  const flags = resolveFeatureFlags({
    userId: user.id,
    environment,
    remoteConfig: remoteConfig(),
    overrides: requestedOverrides,
    allowOverride,
  });
  return json({ flags, environment, source: 'server', overrideApplied: allowOverride && Object.keys(requestedOverrides).length > 0 }, 200, origin);
});
