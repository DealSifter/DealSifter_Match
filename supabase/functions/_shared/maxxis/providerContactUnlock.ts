import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, supabaseAnonKey, supabaseUrl } from './config.ts';
import { logMaxxisEvent } from './logger.ts';
import { checkRateLimit, isOperationalFeatureEnabled, logAbuseGuard, rateLimitResponse, type RateLimitOperation } from '../abuseProtection.ts';
import { cleanProviderUuid } from './providerIdentifiers.ts';

type ProviderUnlockMode = 'prepare' | 'confirm' | 'cancel';

function json(body: Record<string, unknown>, status: number, origin: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

function pickRow<T>(data: T | T[] | null): T | null {
  return Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
}

function normalizeRpcError(error: unknown) {
  const source = error as { message?: string; code?: string; details?: string; detail?: string } | null;
  const message = String(source?.message || source?.details || source?.detail || '').toLowerCase();
  const code = String(source?.code || '');
  if (message.includes('not enough nuggets') || code === '22003') return { status: 402, error: 'INSUFFICIENT_BALANCE' };
  if (message.includes('plan_limit_reached')) return { status: 409, error: 'PLAN_LIMIT_REACHED' };
  if (message.includes('intent expired') || code === '57014') return { status: 410, error: 'INTENT_EXPIRED' };
  if (message.includes('intent invalid')) return { status: 409, error: 'INTENT_INVALID' };
  if (message.includes('unlock cost changed') || code === '40001') return { status: 409, error: 'UNLOCK_COST_CHANGED' };
  if (message.includes('active exclusivity') || code === '55000') return { status: 409, error: 'UNAVAILABLE' };
  if (message.includes('authentication required') || message.includes('unauthorized') || code === '28000') return { status: 401, error: 'UNAUTHORIZED' };
  return { status: 400, error: 'PROVIDER_UNLOCK_FAILED' };
}

async function authenticatedClient(req: Request) {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return { error: 'UNAUTHORIZED' as const, status: 401 as const };
  const client = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) return { error: 'UNAUTHORIZED' as const, status: 401 as const };
  return { client, user, authHeader };
}

async function unlockGuard(userId: string, mode: ProviderUnlockMode, requestId: string, origin: string) {
  if (!isOperationalFeatureEnabled('CONTACT_UNLOCK_ENABLED')) {
    logAbuseGuard({ functionName: `maxxis-provider-unlock-${mode}`, operation: 'contact_unlock_disabled', requestId, userId, category: 'ABUSE_GUARD', status: 503 });
    return json({ success: false, error: 'CONTACT_UNLOCK_DISABLED', requestId }, 503, origin);
  }
  const operation = `provider_unlock_${mode}` as RateLimitOperation;
  const decision = await checkRateLimit(userId, operation);
  if (decision.allowed) return null;
  logAbuseGuard({ functionName: `maxxis-provider-unlock-${mode}`, operation, requestId, userId, category: 'RATE_LIMIT', status: decision.unavailable ? 503 : 429, limitType: operation });
  return rateLimitResponse(decision, requestId, corsHeaders(origin));
}

async function resolveServiceTarget(client: ReturnType<typeof createClient>, serviceId: string, userId: string) {
  const { data, error } = await client
    .from('services')
    .select('id, title, category, markets, owner_id, primary_profile, publish_to_connections')
    .eq('id', serviceId)
    .eq('publish_to_connections', true)
    .maybeSingle();
  if (error) throw new Error('SERVICE_LOOKUP_FAILED');
  if (!data?.id || !data.owner_id) return null;
  if (String(data.owner_id) === userId) return null;
  return {
    serviceId: String(data.id),
    serviceTitle: String(data.title || data.category || 'Provider'),
    serviceType: String(data.category || ''),
    markets: Array.isArray(data.markets) ? data.markets.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 4) : [],
    ownerId: String(data.owner_id),
    profileScope: String(data.primary_profile || 'personal'),
  };
}

function normalizeAccess(row: Record<string, unknown> | null) {
  const status = String(row?.status || 'unavailable');
  return {
    status: ['locked', 'already_unlocked', 'insufficient_balance', 'unavailable'].includes(status) ? status : 'unavailable',
    cost: Number.isFinite(Number(row?.cost)) ? Number(row?.cost) : null,
    currency: String(row?.currency || 'nuggets'),
    profileScope: String(row?.profile_scope || row?.profileScope || 'personal'),
    reason: row?.reason ? String(row.reason) : null,
  };
}

async function fetchAccess(client: ReturnType<typeof createClient>, serviceId: string) {
  const { data, error } = await client.rpc('ds_get_provider_contact_access', { p_service_ids: [serviceId] });
  if (error) throw error;
  return normalizeAccess(pickRow(data) as Record<string, unknown> | null);
}

function normalizeContactCard(row: Record<string, unknown> | null, ownerId: string, profileScope: string) {
  if (!row) return null;
  const contact = row.contact && typeof row.contact === 'object' ? row.contact as Record<string, unknown> : {};
  return {
    ownerId,
    profileScope,
    name: String(contact.name || ''),
    avatarUrl: String(contact.avatar_url || contact.avatarUrl || ''),
    category: String(contact.category || ''),
    location: String(contact.location || ''),
    email: contact.email ? String(contact.email) : null,
    phonePrimary: contact.phone_primary || contact.phonePrimary ? String(contact.phone_primary || contact.phonePrimary) : null,
    phoneSecondary: contact.phone_secondary || contact.phoneSecondary ? String(contact.phone_secondary || contact.phoneSecondary) : null,
    whatsapp: contact.whatsapp ? String(contact.whatsapp) : null,
    contactMethods: Array.isArray(contact.contact_methods)
      ? contact.contact_methods
      : (Array.isArray(contact.contactMethods) ? contact.contactMethods : []),
  };
}

async function fetchUnlockedContact(client: ReturnType<typeof createClient>, userId: string, ownerId: string, profileScope: string) {
  const { data, error } = await client.rpc('ds_get_unlocked_contact_cards', { p_user_id: userId });
  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  const normalizedScope = String(profileScope || 'personal').toLowerCase();
  const row = rows.find((item) => (
    String(item?.owner_id || item?.ownerId) === ownerId
    && String(item?.primary_profile || item?.primaryProfile || 'personal').toLowerCase() === normalizedScope
  ));
  return normalizeContactCard(row as Record<string, unknown> | null, ownerId, normalizedScope);
}

async function prepareProviderUnlock(req: Request, origin: string, body: Record<string, unknown>) {
  const auth = await authenticatedClient(req);
  if ('error' in auth) return json({ success: false, error: auth.error }, auth.status, origin);
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  const guarded = await unlockGuard(auth.user.id, 'prepare', requestId, origin);
  if (guarded) return guarded;
  const serviceId = cleanProviderUuid(body.serviceId);
  if (!serviceId) return json({ success: false, error: 'INVALID_SERVICE_ID' }, 400, origin);

  try {
    const target = await resolveServiceTarget(auth.client, serviceId, auth.user.id);
    if (!target) return json({ success: false, error: 'PROVIDER_UNAVAILABLE' }, 404, origin);
    const access = await fetchAccess(auth.client, serviceId);
    if (access.status === 'already_unlocked') {
      const contact = await fetchUnlockedContact(auth.client, auth.user.id, target.ownerId, access.profileScope);
      logMaxxisEvent('provider_contact_unlock_prepare', {
        request_id: requestId,
        user_id: auth.user.id,
        service_id: serviceId,
        status: 'already_unlocked',
        duration_ms: Date.now() - startedAt,
      });
      return json({ success: true, status: 'already_unlocked', serviceId, contactAccess: access, contact }, 200, origin);
    }
    if (access.status !== 'locked') {
      logMaxxisEvent('provider_contact_unlock_prepare', {
        request_id: requestId,
        user_id: auth.user.id,
        service_id: serviceId,
        status: access.status,
        reason: access.reason,
        duration_ms: Date.now() - startedAt,
      });
      return json({ success: false, status: access.status, serviceId, contactAccess: access }, access.status === 'insufficient_balance' ? 402 : 409, origin);
    }

    const { data, error } = await auth.client.rpc('ds_create_unlock_intent', {
      p_seller_id: target.ownerId,
      p_property_id: null,
      p_profile_scope: access.profileScope,
      p_mode: 'normal',
      p_metadata: { source: 'maxxis_provider_contact_unlock', serviceId },
    });
    if (error) throw error;
    const intent = pickRow(data) as Record<string, unknown> | null;
    const intentToken = cleanProviderUuid(intent?.intent_token);
    if (!intentToken) throw new Error('INTENT_NOT_CREATED');

    logMaxxisEvent('provider_contact_unlock_prepare', {
      request_id: requestId,
      user_id: auth.user.id,
      service_id: serviceId,
      status: 'locked',
      duration_ms: Date.now() - startedAt,
    });
    return json({
      success: true,
      status: 'locked',
      serviceId,
      contactAccess: { ...access, cost: Number(intent?.total_cost ?? access.cost) },
      action: {
        actionType: 'unlock_provider_contact',
        serviceId,
        serviceTitle: target.serviceTitle,
        serviceType: target.serviceType,
        markets: target.markets,
        cost: Number(intent?.total_cost ?? access.cost ?? 0),
        currency: 'nuggets',
        intentToken,
        expiresAt: intent?.expires_at ? String(intent.expires_at) : null,
      },
    }, 200, origin);
  } catch (error) {
    const normalized = normalizeRpcError(error);
    logMaxxisEvent('provider_contact_unlock_prepare', {
      request_id: requestId,
      user_id: auth.user.id,
      service_id: serviceId,
      success: false,
      error_code: normalized.error,
      duration_ms: Date.now() - startedAt,
    });
    return json({ success: false, error: normalized.error }, normalized.status, origin);
  }
}

async function confirmProviderUnlock(req: Request, origin: string, body: Record<string, unknown>) {
  const auth = await authenticatedClient(req);
  if ('error' in auth) return json({ success: false, error: auth.error }, auth.status, origin);
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  const guarded = await unlockGuard(auth.user.id, 'confirm', requestId, origin);
  if (guarded) return guarded;
  const serviceId = cleanProviderUuid(body.serviceId);
  const intentToken = cleanProviderUuid(body.intentToken);
  if (!serviceId) return json({ success: false, error: 'INVALID_SERVICE_ID' }, 400, origin);
  if (!intentToken) return json({ success: false, error: 'INVALID_INTENT_TOKEN' }, 400, origin);

  try {
    const target = await resolveServiceTarget(auth.client, serviceId, auth.user.id);
    if (!target) return json({ success: false, error: 'PROVIDER_UNAVAILABLE' }, 404, origin);
    const before = await fetchAccess(auth.client, serviceId);
    if (before.status === 'already_unlocked') {
      const contact = await fetchUnlockedContact(auth.client, auth.user.id, target.ownerId, before.profileScope);
      logMaxxisEvent('provider_contact_unlock_confirm', {
        request_id: requestId,
        user_id: auth.user.id,
        service_id: serviceId,
        status: 'already_unlocked',
        duration_ms: Date.now() - startedAt,
      });
      return json({ success: true, status: 'already_unlocked', serviceId, contactAccess: before, contact }, 200, origin);
    }

    const { data, error } = await auth.client.rpc('ds_purchase_contact_unlock', {
      p_seller_id: target.ownerId,
      p_intent_token: intentToken,
      p_profile_scope: before.profileScope || target.profileScope,
    });
    if (error) throw error;
    const row = pickRow(data) as Record<string, unknown> | null;
    const access = await fetchAccess(auth.client, serviceId);
    const contact = await fetchUnlockedContact(auth.client, auth.user.id, target.ownerId, access.profileScope);

    logMaxxisEvent('provider_contact_unlock_confirm', {
      request_id: requestId,
      user_id: auth.user.id,
      service_id: serviceId,
      status: Number(row?.total_cost || 0) > 0 ? 'unlocked' : 'already_unlocked',
      duration_ms: Date.now() - startedAt,
    });
    return json({
      success: true,
      status: Number(row?.total_cost || 0) > 0 ? 'unlocked' : 'already_unlocked',
      serviceId,
      contactAccess: { ...access, status: 'already_unlocked' },
      remainingNuggets: Number.isFinite(Number(row?.remaining_nuggets)) ? Number(row?.remaining_nuggets) : null,
      contact,
    }, 200, origin);
  } catch (error) {
    const normalized = normalizeRpcError(error);
    logMaxxisEvent('provider_contact_unlock_confirm', {
      request_id: requestId,
      user_id: auth.user.id,
      service_id: serviceId,
      success: false,
      error_code: normalized.error,
      duration_ms: Date.now() - startedAt,
    });
    return json({ success: false, error: normalized.error }, normalized.status, origin);
  }
}

async function cancelProviderUnlock(req: Request, origin: string, body: Record<string, unknown>) {
  const auth = await authenticatedClient(req);
  if ('error' in auth) return json({ success: false, error: auth.error }, auth.status, origin);
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  const guarded = await unlockGuard(auth.user.id, 'cancel', requestId, origin);
  if (guarded) return guarded;
  const intentToken = cleanProviderUuid(body.intentToken);
  if (!intentToken) return json({ success: false, error: 'INVALID_INTENT_TOKEN' }, 400, origin);

  try {
    const { data, error } = await auth.client.rpc('ds_cancel_unlock_intent', { p_intent_token: intentToken });
    if (error) throw error;
    const result = data && typeof data === 'object' && !Array.isArray(data)
      ? data as Record<string, unknown>
      : { success: false, status: 'invalid_response' };
    logMaxxisEvent('provider_contact_unlock_cancel', {
      request_id: requestId,
      user_id: auth.user.id,
      status: String(result.status || ''),
      success: result.success === true,
      duration_ms: Date.now() - startedAt,
    });
    return json({ success: result.success === true, status: String(result.status || '') }, result.success === true ? 200 : 409, origin);
  } catch (error) {
    const normalized = normalizeRpcError(error);
    logMaxxisEvent('provider_contact_unlock_cancel', {
      request_id: requestId,
      user_id: auth.user.id,
      success: false,
      error_code: normalized.error,
      duration_ms: Date.now() - startedAt,
    });
    return json({ success: false, error: normalized.error }, normalized.status, origin);
  }
}

export async function handleProviderContactUnlockRequest(req: Request, mode: ProviderUnlockMode) {
  const origin = req.headers.get('Origin') || '';
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return json({ success: false, error: 'METHOD_NOT_ALLOWED' }, 405, origin);
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  if (mode === 'prepare') return prepareProviderUnlock(req, origin, body);
  if (mode === 'confirm') return confirmProviderUnlock(req, origin, body);
  return cancelProviderUnlock(req, origin, body);
}
