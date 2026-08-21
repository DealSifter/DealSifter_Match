import { createClient } from 'npm:@supabase/supabase-js@2';
import { logOperationalEvent } from '../observability.ts';
import { corsHeaders, supabaseAnonKey, supabaseUrl } from './config.ts';
import { checkRateLimit, isOperationalFeatureEnabled, logAbuseGuard, rateLimitResponse, type RateLimitOperation } from '../abuseProtection.ts';
import { cleanProviderUuid } from './providerIdentifiers.ts';

type ProviderMessageMode = 'prepare' | 'confirm' | 'cancel';

function json(body: Record<string, unknown>, status: number, origin: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

function cleanMessage(value: unknown) {
  return String(value || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2000);
}

function cleanIdempotencyKey(value: unknown) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9:_-]/g, '')
    .trim()
    .slice(0, 120);
}

function rpcStatusToHttp(status: unknown) {
  const text = String(status || '');
  if (text === 'not_found' || text === 'provider_unavailable' || text === 'property_unavailable') return 404;
  if (text === 'provider_contact_locked' || text === 'chat_unavailable' || text === 'cancelled' || text === 'expired' || text === 'sent') return 409;
  return 400;
}

function normalizeRpcError(error: unknown) {
  const source = error as { message?: string; code?: string; details?: string; detail?: string } | null;
  const message = String(source?.message || source?.details || source?.detail || '').toLowerCase();
  const code = String(source?.code || '');
  if (message.includes('authentication required') || code === '28000') return { status: 401, error: 'UNAUTHORIZED' };
  if (message.includes('message required')) return { status: 400, error: 'MESSAGE_REQUIRED' };
  if (message.includes('message too long')) return { status: 400, error: 'MESSAGE_TOO_LONG' };
  if (message.includes('service required')) return { status: 400, error: 'INVALID_SERVICE_ID' };
  if (message.includes('property context required')) return { status: 400, error: 'INVALID_PROPERTY_ID' };
  return { status: 400, error: 'PROVIDER_MESSAGE_SEND_FAILED' };
}

async function authenticatedClient(req: Request) {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return { error: 'UNAUTHORIZED' as const, status: 401 as const };
  const client = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) return { error: 'UNAUTHORIZED' as const, status: 401 as const };
  return { client, user };
}

function logProviderMessageSend(event: string, details: Record<string, unknown>) {
  return logOperationalEvent({
    functionName: `maxxis-provider-message-${event.replace('provider_message_send_', '')}`,
    operation: event,
    requestId: String(details.request_id || ''),
    userId: String(details.user_id || ''),
    durationMs: Number(details.duration_ms || 0),
    success: details.success === true,
    status: details.status,
    errorCode: details.error_code,
    provider: 'supabase',
  });
}

async function stableMessageKey(serviceId: string, propertyId: string, message: string) {
  const bytes = new TextEncoder().encode(`${serviceId}:${propertyId}:${message}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return `msg:${Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, '0')).join('').slice(0, 48)}`;
}

async function messagingGuard(userId: string, mode: ProviderMessageMode, requestId: string, origin: string) {
  if (!isOperationalFeatureEnabled('PROVIDER_MESSAGING_ENABLED')) {
    logAbuseGuard({ functionName: `maxxis-provider-message-${mode}`, operation: 'provider_messaging_disabled', requestId, userId, category: 'ABUSE_GUARD', status: 503 });
    return json({ success: false, error: 'PROVIDER_MESSAGING_DISABLED', requestId }, 503, origin);
  }
  const operation = `provider_message_${mode}` as RateLimitOperation;
  const decision = await checkRateLimit(userId, operation);
  if (decision.allowed) return null;
  logAbuseGuard({ functionName: `maxxis-provider-message-${mode}`, operation, requestId, userId, category: mode === 'prepare' ? 'MESSAGE_THROTTLED' : 'RATE_LIMIT', status: decision.unavailable ? 503 : 429, limitType: operation });
  return rateLimitResponse(decision, requestId, corsHeaders(origin));
}

async function prepareProviderMessage(req: Request, origin: string, body: Record<string, unknown>) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const auth = await authenticatedClient(req);
  if ('error' in auth) return json({ success: false, error: auth.error }, auth.status, origin);
  const guarded = await messagingGuard(auth.user.id, 'prepare', requestId, origin);
  if (guarded) return guarded;

  const serviceId = cleanProviderUuid(body.serviceId);
  const propertyId = cleanProviderUuid(body.propertyId);
  const message = cleanMessage(body.message);
  let idempotencyKey = cleanIdempotencyKey(body.idempotencyKey);
  if (!serviceId) return json({ success: false, error: 'INVALID_SERVICE_ID' }, 400, origin);
  if (!propertyId) return json({ success: false, error: 'INVALID_PROPERTY_ID' }, 400, origin);
  if (!message) return json({ success: false, error: 'MESSAGE_REQUIRED' }, 400, origin);
  if (message.length > 1800) return json({ success: false, error: 'MESSAGE_TOO_LONG' }, 400, origin);
  if (!idempotencyKey) idempotencyKey = await stableMessageKey(serviceId, propertyId, message);

  try {
    const rpcArgs = {
      p_service_id: serviceId,
      p_property_id: propertyId,
      p_message: message,
      p_idempotency_key: idempotencyKey || null,
    };
    let { data, error } = await auth.client.rpc('ds_prepare_maxxis_provider_message', rpcArgs);
    if (error?.code === '23505') ({ data, error } = await auth.client.rpc('ds_prepare_maxxis_provider_message', rpcArgs));
    if (error) throw error;
    const result = data && typeof data === 'object' ? data as Record<string, unknown> : {};
    logProviderMessageSend('provider_message_send_prepare', {
      request_id: requestId,
      user_id: auth.user.id,
      action_id: result.actionId,
      service_id: serviceId,
      property_id: propertyId,
      duration_ms: Date.now() - startedAt,
      success: result.success === true,
      status: result.status,
    });
    if (result.success !== true) return json(result, rpcStatusToHttp(result.status), origin);
    return json({
      success: true,
      type: 'provider_message_send_pending',
      data: {
        actionId: result.actionId,
        serviceId: result.serviceId || serviceId,
        propertyId: result.propertyId || propertyId,
        providerId: result.providerId || null,
        serviceTitle: result.serviceTitle || '',
        expiresAt: result.expiresAt || null,
        status: 'pending',
      },
      actions: [],
    }, 200, origin);
  } catch (error) {
    const normalized = normalizeRpcError(error);
    logProviderMessageSend('provider_message_send_prepare', {
      request_id: requestId,
      user_id: auth.user.id,
      service_id: serviceId,
      property_id: propertyId,
      duration_ms: Date.now() - startedAt,
      success: false,
      error_code: normalized.error,
    });
    return json({ success: false, error: normalized.error }, normalized.status, origin);
  }
}

async function confirmProviderMessage(req: Request, origin: string, body: Record<string, unknown>) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const auth = await authenticatedClient(req);
  if ('error' in auth) return json({ success: false, error: auth.error }, auth.status, origin);
  const guarded = await messagingGuard(auth.user.id, 'confirm', requestId, origin);
  if (guarded) return guarded;

  const actionId = cleanProviderUuid(body.actionId);
  if (!actionId) return json({ success: false, error: 'INVALID_ACTION_ID' }, 400, origin);

  try {
    const { data, error } = await auth.client.rpc('ds_confirm_maxxis_provider_message', { p_action_id: actionId });
    if (error) throw error;
    const result = data && typeof data === 'object' ? data as Record<string, unknown> : {};
    logProviderMessageSend('provider_message_send_confirm', {
      request_id: requestId,
      user_id: auth.user.id,
      action_id: actionId,
      service_id: result.serviceId,
      property_id: result.propertyId,
      duration_ms: Date.now() - startedAt,
      success: result.success === true,
      status: result.status,
    });
    if (result.success !== true) return json(result, rpcStatusToHttp(result.status), origin);
    return json({
      success: true,
      type: 'provider_message_sent',
      data: {
        serviceId: result.serviceId,
        propertyId: result.propertyId,
        messageId: result.messageId,
        status: 'sent',
      },
      actions: [],
    }, 200, origin);
  } catch (error) {
    const normalized = normalizeRpcError(error);
    logProviderMessageSend('provider_message_send_confirm', {
      request_id: requestId,
      user_id: auth.user.id,
      action_id: actionId,
      duration_ms: Date.now() - startedAt,
      success: false,
      error_code: normalized.error,
    });
    return json({ success: false, error: normalized.error }, normalized.status, origin);
  }
}

async function cancelProviderMessage(req: Request, origin: string, body: Record<string, unknown>) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const auth = await authenticatedClient(req);
  if ('error' in auth) return json({ success: false, error: auth.error }, auth.status, origin);
  const guarded = await messagingGuard(auth.user.id, 'cancel', requestId, origin);
  if (guarded) return guarded;

  const actionId = cleanProviderUuid(body.actionId);
  if (!actionId) return json({ success: false, error: 'INVALID_ACTION_ID' }, 400, origin);

  try {
    const { data, error } = await auth.client.rpc('ds_cancel_maxxis_provider_message', { p_action_id: actionId });
    if (error) throw error;
    const result = data && typeof data === 'object' ? data as Record<string, unknown> : {};
    logProviderMessageSend('provider_message_send_cancel', {
      request_id: requestId,
      user_id: auth.user.id,
      action_id: actionId,
      duration_ms: Date.now() - startedAt,
      success: result.success === true,
      status: result.status,
    });
    if (result.success !== true) return json(result, rpcStatusToHttp(result.status), origin);
    return json({ success: true, status: 'cancelled' }, 200, origin);
  } catch (error) {
    const normalized = normalizeRpcError(error);
    logProviderMessageSend('provider_message_send_cancel', {
      request_id: requestId,
      user_id: auth.user.id,
      action_id: actionId,
      duration_ms: Date.now() - startedAt,
      success: false,
      error_code: normalized.error,
    });
    return json({ success: false, error: normalized.error }, normalized.status, origin);
  }
}

export async function handleProviderMessageSendRequest(req: Request, mode: ProviderMessageMode) {
  const origin = req.headers.get('Origin') || '';
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return json({ success: false, error: 'METHOD_NOT_ALLOWED' }, 405, origin);
  const body = await req.json().catch(() => ({}));
  if (mode === 'prepare') return prepareProviderMessage(req, origin, body as Record<string, unknown>);
  if (mode === 'confirm') return confirmProviderMessage(req, origin, body as Record<string, unknown>);
  return cancelProviderMessage(req, origin, body as Record<string, unknown>);
}
