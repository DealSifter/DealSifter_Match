import { createClient } from 'npm:@supabase/supabase-js@2';
import { logOperationalEvent } from '../observability.ts';
import { corsHeaders, supabaseAnonKey, supabaseUrl } from './config.ts';
import { checkRateLimit, isOperationalFeatureEnabled, logAbuseGuard, rateLimitResponse } from '../abuseProtection.ts';
import { getPropertyDetailsWithClient } from './propertyDetails.ts';
import { cleanProviderUuid } from './providerIdentifiers.ts';
import {
  buildProviderMessageDraft,
  type ProviderMessageContext,
} from './providerMessageDraftBuilder.ts';

function json(body: Record<string, unknown>, status: number, origin: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

function cleanLanguage(value: unknown) {
  const language = String(value || 'en').slice(0, 2).toLowerCase();
  return ['en', 'pt', 'es'].includes(language) ? language as 'en' | 'pt' | 'es' : 'en';
}

function pickRow<T>(data: T | T[] | null): T | null {
  return Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
}

function logProviderMessageDraft(details: Record<string, unknown>) {
  return logOperationalEvent({
    functionName: 'maxxis-provider-message-draft',
    operation: 'provider_message_draft_request',
    requestId: String(details.request_id || ''),
    userId: String(details.user_id || ''),
    durationMs: Number(details.duration_ms || 0),
    success: details.success === true,
    errorCode: details.error_code,
    provider: 'supabase',
    metrics: {
      provider_valid: Boolean(details.provider_valid),
      property_context_present: Boolean(details.property_context_present),
    },
  });
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

async function resolveServiceTarget(client: ReturnType<typeof createClient>, serviceId: string, userId: string) {
  const { data, error } = await client
    .from('services')
    .select('id, title, category, owner_id, primary_profile, publish_to_connections')
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

export async function handleProviderMessageDraftRequest(req: Request) {
  const origin = req.headers.get('Origin') || '';
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return json({ success: false, error: 'METHOD_NOT_ALLOWED' }, 405, origin);

  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  let userId = '';
  let serviceId = '';
  let propertyId = '';
  let providerValid = false;
  let propertyContextPresent = false;

  try {
    const auth = await authenticatedClient(req);
    if ('error' in auth) {
      logProviderMessageDraft({ request_id: requestId, duration_ms: Date.now() - startedAt, success: false, error_code: auth.error });
      return json({ success: false, error: auth.error }, auth.status, origin);
    }
    userId = auth.user.id;
    if (!isOperationalFeatureEnabled('PROVIDER_MESSAGING_ENABLED')) {
      logAbuseGuard({ functionName: 'maxxis-provider-message-draft', operation: 'provider_messaging_disabled', requestId, userId, category: 'ABUSE_GUARD', status: 503 });
      return json({ success: false, error: 'PROVIDER_MESSAGING_DISABLED', requestId }, 503, origin);
    }
    const rateLimit = await checkRateLimit(userId, 'provider_message_draft');
    if (!rateLimit.allowed) {
      logAbuseGuard({ functionName: 'maxxis-provider-message-draft', operation: 'provider_message_draft', requestId, userId, category: 'RATE_LIMIT', status: rateLimit.unavailable ? 503 : 429, limitType: 'provider_message_draft' });
      return rateLimitResponse(rateLimit, requestId, corsHeaders(origin));
    }
    const body = await req.json().catch(() => ({}));
    serviceId = cleanProviderUuid(body.serviceId);
    propertyId = cleanProviderUuid(body.propertyId);
    const language = cleanLanguage(body.language);
    if (!serviceId) {
      logProviderMessageDraft({
        request_id: requestId,
        user_id: userId,
        provider_valid: false,
        property_context_present: false,
        duration_ms: Date.now() - startedAt,
        success: false,
        error_code: 'INVALID_SERVICE_ID',
      });
      return json({ success: false, error: 'INVALID_SERVICE_ID' }, 400, origin);
    }
    if (!propertyId) {
      logProviderMessageDraft({
        request_id: requestId,
        user_id: userId,
        service_id: serviceId,
        provider_valid: false,
        property_context_present: false,
        duration_ms: Date.now() - startedAt,
        success: false,
        error_code: 'PROPERTY_CONTEXT_REQUIRED',
      });
      return json({ success: false, error: 'PROPERTY_CONTEXT_REQUIRED' }, 400, origin);
    }

    const target = await resolveServiceTarget(auth.client, serviceId, userId);
    providerValid = Boolean(target);
    if (!target) {
      logProviderMessageDraft({
        request_id: requestId,
        user_id: userId,
        service_id: serviceId,
        property_id: propertyId,
        provider_valid: false,
        property_context_present: false,
        duration_ms: Date.now() - startedAt,
        success: false,
        error_code: 'PROVIDER_UNAVAILABLE',
      });
      return json({ success: false, error: 'PROVIDER_UNAVAILABLE' }, 404, origin);
    }

    const access = await fetchAccess(auth.client, serviceId);
    if (access.status !== 'already_unlocked') {
      logProviderMessageDraft({
        request_id: requestId,
        user_id: userId,
        service_id: serviceId,
        property_id: propertyId,
        provider_valid: true,
        property_context_present: false,
        duration_ms: Date.now() - startedAt,
        success: false,
        error_code: 'PROVIDER_CONTACT_LOCKED',
      });
      return json({
        success: false,
        error: 'PROVIDER_CONTACT_LOCKED',
        status: access.status,
        serviceId,
        contactAccess: access,
      }, access.status === 'insufficient_balance' ? 402 : 409, origin);
    }

    const details = await getPropertyDetailsWithClient({ propertyId }, auth.client);
    propertyContextPresent = Boolean(details.found && details.property);
    if (!details.found || !details.property) {
      logProviderMessageDraft({
        request_id: requestId,
        user_id: userId,
        service_id: serviceId,
        property_id: propertyId,
        provider_valid: true,
        property_context_present: false,
        duration_ms: Date.now() - startedAt,
        success: false,
        error_code: 'PROPERTY_CONTEXT_UNAVAILABLE',
      });
      return json({ success: false, error: 'PROPERTY_CONTEXT_UNAVAILABLE' }, 404, origin);
    }

    const context: ProviderMessageContext = {
      serviceId,
      providerId: target.ownerId,
      propertyId,
      serviceTitle: target.serviceTitle,
      serviceType: target.serviceType,
      property: {
        city: details.property.city,
        state: details.property.state,
        type: details.property.type,
        ...(details.property.objective ? { objective: details.property.objective } : {}),
        ...(details.property.rehab ? { rehab: details.property.rehab } : {}),
      },
      dealAdvisor: details.analysis
        ? {
          positiveSignals: details.analysis.positiveSignals,
          attentionPoints: details.analysis.attentionPoints,
        }
        : null,
    };
    const draft = buildProviderMessageDraft(context, language);

    logProviderMessageDraft({
      request_id: requestId,
      user_id: userId,
      service_id: serviceId,
      property_id: propertyId,
      provider_valid: true,
      property_context_present: propertyContextPresent,
      duration_ms: Date.now() - startedAt,
      success: true,
    });

    return json({
      success: true,
      message: 'Provider message draft prepared.',
      type: 'provider_message_draft',
      data: {
        serviceId,
        providerId: target.ownerId,
        propertyId,
        serviceTitle: target.serviceTitle,
        draft,
      },
      actions: [],
    }, 200, origin);
  } catch (error) {
    logProviderMessageDraft({
      request_id: requestId,
      user_id: userId,
      service_id: serviceId,
      property_id: propertyId,
      provider_valid: providerValid,
      property_context_present: propertyContextPresent,
      duration_ms: Date.now() - startedAt,
      success: false,
      error_code: error instanceof Error ? error.message : 'PROVIDER_MESSAGE_DRAFT_FAILED',
    });
    return json({ success: false, error: 'PROVIDER_MESSAGE_DRAFT_FAILED' }, 500, origin);
  }
}
