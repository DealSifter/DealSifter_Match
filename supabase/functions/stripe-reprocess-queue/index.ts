import { createClient } from "npm:@supabase/supabase-js@2";
import { processQueuedStripeEvents } from "../_shared/stripe-event-processor.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('ANON_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';

if (!supabaseUrl) throw new Error('Missing SUPABASE_URL');
if (!supabaseAnonKey) throw new Error('Missing SUPABASE_ANON_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function assertAdmin(authHeader: string) {
  const accessToken = String(authHeader || '').replace(/^Bearer\s+/i, '').trim();
  if (!accessToken) return { ok: false, status: 401, error: 'Missing bearer token' };

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !user) {
    return { ok: false, status: 401, error: userError?.message || 'Invalid user session' };
  }

  const { data: isAdmin, error: adminError } = await supabase.rpc('ds_is_current_user_admin');
  if (adminError) return { ok: false, status: 500, error: adminError.message };
  if (isAdmin !== true) return { ok: false, status: 403, error: 'Admin access required' };

  return { ok: true, status: 200, error: null };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const auth = await assertAdmin(req.headers.get('Authorization') ?? '');
  if (!auth.ok) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const summary = await processQueuedStripeEvents(10);
    return jsonResponse({ ok: true, ...summary });
  } catch (err) {
    console.error('stripe-reprocess-queue failed:', err);
    return jsonResponse({ error: String((err as Error)?.message || err || 'Stripe reprocess failed') }, 500);
  }
});
