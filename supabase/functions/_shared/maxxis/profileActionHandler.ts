import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, supabaseAnonKey, supabaseUrl } from './config.ts';
import { logMaxxisEvent } from './logger.ts';

type ProfileActionMode = 'confirm' | 'cancel';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: Record<string, unknown>, status: number, origin: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

function httpStatus(result: Record<string, unknown>) {
  if (result.success === true) return 200;
  if (result.status === 'not_found') return 404;
  if (result.status === 'expired') return 410;
  return 409;
}

export async function handleProfileActionRequest(req: Request, mode: ProfileActionMode) {
  const origin = req.headers.get('Origin') || '';
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return json({ success: false, error: 'METHOD_NOT_ALLOWED' }, 405, origin);

  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ success: false, error: 'UNAUTHORIZED' }, 401, origin);

  const client = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authError } = await client.auth.getUser(token);
  if (authError || !user) return json({ success: false, error: 'UNAUTHORIZED' }, 401, origin);

  const body = await req.json().catch(() => ({}));
  const actionId = String(body?.actionId || '').trim();
  if (!UUID_PATTERN.test(actionId)) return json({ success: false, error: 'INVALID_ACTION_ID' }, 400, origin);

  const rpcName = mode === 'confirm'
    ? 'ds_confirm_maxxis_profile_action'
    : 'ds_cancel_maxxis_profile_action';
  const { data, error } = await client.rpc(rpcName, { p_action_id: actionId });
  if (error) {
    logMaxxisEvent(`maxxis_action_${mode}`, {
      request_id: requestId,
      user_id: user.id,
      duration_ms: Date.now() - startedAt,
      success: false,
      error_code: 'MAXXIS_ACTION_RPC_FAILED',
    });
    return json({ success: false, error: 'MAXXIS_ACTION_FAILED' }, 400, origin);
  }

  const result = data && typeof data === 'object' && !Array.isArray(data)
    ? data as Record<string, unknown>
    : { success: false, status: 'invalid_response' };
  logMaxxisEvent(`maxxis_action_${mode}`, {
    request_id: requestId,
    user_id: user.id,
    duration_ms: Date.now() - startedAt,
    success: result.success === true,
    operation: result.operation,
    action_status: result.status,
  });
  return json({
    success: result.success === true,
    status: String(result.status || ''),
    operation: result.operation ? String(result.operation) : undefined,
    suggestedValue: result.suggestedValue ? String(result.suggestedValue) : undefined,
    valueAdded: typeof result.valueAdded === 'boolean' ? result.valueAdded : undefined,
  }, httpStatus(result), origin);
}
