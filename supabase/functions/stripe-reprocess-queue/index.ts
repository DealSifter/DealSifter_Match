import { createClient } from "npm:@supabase/supabase-js@2";
import { processQueuedStripeEvents } from "../_shared/stripe-event-processor.ts";
import { createRequestId, logOperationalEvent, withRequestId } from '../_shared/observability.ts';
import { checkRateLimit, logAbuseGuard, rateLimitResponse } from '../_shared/abuseProtection.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('ANON_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';

if (!supabaseUrl) throw new Error('Missing SUPABASE_URL');
if (!supabaseAnonKey) throw new Error('Missing SUPABASE_ANON_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status = 200, requestId = '') {
  return withRequestId(new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  }), requestId);
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

  return { ok: true, status: 200, error: null, userId: user.id };
}

Deno.serve(async (req) => {
  const requestId = createRequestId(req);
  const startedAt = Date.now();
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    logOperationalEvent({ functionName: 'stripe-reprocess-queue', operation: 'validate_method', requestId, durationMs: Date.now() - startedAt, success: false, errorCode: 'METHOD_NOT_ALLOWED', status: 405, provider: 'stripe' });
    return jsonResponse({ error: 'Method not allowed', requestId }, 405, requestId);
  }

  const auth = await assertAdmin(req.headers.get('Authorization') ?? '');
  if (!auth.ok) {
    logOperationalEvent({ functionName: 'stripe-reprocess-queue', operation: 'authorize_admin', requestId, durationMs: Date.now() - startedAt, success: false, errorCode: auth.status === 403 ? 'ADMIN_ACCESS_REQUIRED' : 'UNAUTHORIZED', status: auth.status, provider: 'supabase' });
    return jsonResponse({ error: auth.status === 403 ? 'Admin access required' : 'Unauthorized', requestId }, auth.status, requestId);
  }

  const rateLimit = await checkRateLimit(String(auth.userId || ''), 'stripe_reprocess');
  if (!rateLimit.allowed) {
    logAbuseGuard({ functionName: 'stripe-reprocess-queue', operation: 'stripe_reprocess', requestId, userId: auth.userId, category: 'RATE_LIMIT', status: rateLimit.unavailable ? 503 : 429, limitType: 'stripe_reprocess' });
    return rateLimitResponse(rateLimit, requestId, corsHeaders);
  }

  try {
    const summary = await processQueuedStripeEvents(10);
    logOperationalEvent({ functionName: 'stripe-reprocess-queue', operation: 'process_queue', requestId, userId: auth.userId, durationMs: Date.now() - startedAt, success: true, status: 200, provider: 'stripe', metrics: summary });
    return jsonResponse({ ok: true, ...summary }, 200, requestId);
  } catch {
    logOperationalEvent({ functionName: 'stripe-reprocess-queue', operation: 'process_queue', requestId, userId: auth.userId, durationMs: Date.now() - startedAt, success: false, errorCode: 'STRIPE_REPROCESS_FAILED', status: 500, provider: 'stripe', severity: 'CRITICAL' });
    return jsonResponse({ error: 'Internal error', requestId }, 500, requestId);
  }
});
