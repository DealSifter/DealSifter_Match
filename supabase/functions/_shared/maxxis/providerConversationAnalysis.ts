import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, supabaseAnonKey, supabaseUrl } from './config.ts';
import {
  analyzeProviderConversation,
  type ProviderConversationMessage,
} from './providerConversationAnalyzer.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const MESSAGE_LIMIT = 20;

function json(body: Record<string, unknown>, status: number, origin: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

function cleanUuid(value: unknown) {
  const text = String(value || '').trim();
  return UUID_PATTERN.test(text) ? text : '';
}

function cleanText(value: unknown, max = 500) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
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

function logConversationAnalysis(details: Record<string, unknown>) {
  console.log(JSON.stringify({
    event: 'provider_conversation_analysis',
    request_id: String(details.request_id || ''),
    user_id: String(details.user_id || ''),
    service_id: String(details.service_id || ''),
    property_id: String(details.property_id || ''),
    provider_valid: Boolean(details.provider_valid),
    message_count: Number(details.message_count || 0),
    duration_ms: Number(details.duration_ms || 0),
    success: Boolean(details.success),
    error_code: details.error_code ? String(details.error_code) : undefined,
  }));
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

async function validatePropertyContext(client: ReturnType<typeof createClient>, propertyId: string) {
  if (!propertyId) return null;
  const { data, error } = await client
    .from('properties')
    .select('id, city, state, type, is_active, publish_to_showcase, deal_closed')
    .eq('id', propertyId)
    .eq('is_active', true)
    .eq('publish_to_showcase', true)
    .or('deal_closed.is.null,deal_closed.eq.false')
    .maybeSingle();
  if (error) throw new Error('PROPERTY_LOOKUP_FAILED');
  return data?.id
    ? {
      id: String(data.id),
      city: cleanText(data.city, 80),
      state: cleanText(data.state, 2).toUpperCase(),
      type: cleanText(data.type, 80),
    }
    : null;
}

async function fetchConversationMessages(
  client: ReturnType<typeof createClient>,
  userId: string,
  providerId: string,
): Promise<ProviderConversationMessage[]> {
  const { data, error } = await client
    .from('chat_messages')
    .select('id, sender_id, recipient_id, body, message_type, metadata, created_at')
    .or(`and(sender_id.eq.${userId},recipient_id.eq.${providerId}),and(sender_id.eq.${providerId},recipient_id.eq.${userId})`)
    .order('created_at', { ascending: false })
    .limit(MESSAGE_LIMIT);
  if (error) throw new Error('CHAT_MESSAGES_LOOKUP_FAILED');

  return (Array.isArray(data) ? data : [])
    .filter((row) => !['system', 'system_notice'].includes(String(row?.message_type || '').toLowerCase()))
    .reverse()
    .map((row) => ({
      sender: String(row.sender_id || '') === providerId ? 'provider' as const : 'user' as const,
      text: cleanText(row.body, 1200),
      createdAt: row.created_at ? String(row.created_at) : null,
    }))
    .filter((message) => message.text);
}

export async function handleProviderConversationAnalysisRequest(req: Request) {
  const origin = req.headers.get('Origin') || '';
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return json({ success: false, error: 'METHOD_NOT_ALLOWED' }, 405, origin);

  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  let userId = '';
  let serviceId = '';
  let propertyId = '';
  let providerValid = false;
  let messageCount = 0;

  try {
    const auth = await authenticatedClient(req);
    if ('error' in auth) {
      logConversationAnalysis({ request_id: requestId, success: false, duration_ms: Date.now() - startedAt, error_code: auth.error });
      return json({ success: false, error: auth.error }, auth.status, origin);
    }
    userId = auth.user.id;
    const body = await req.json().catch(() => ({}));
    serviceId = cleanUuid(body.serviceId);
    propertyId = cleanUuid(body.propertyId);
    const question = cleanText(body.question, 260);

    if (!serviceId) return json({ success: false, error: 'INVALID_SERVICE_ID' }, 400, origin);
    const target = await resolveServiceTarget(auth.client, serviceId, userId);
    providerValid = Boolean(target);
    if (!target) {
      logConversationAnalysis({
        request_id: requestId,
        user_id: userId,
        service_id: serviceId,
        property_id: propertyId,
        provider_valid: false,
        success: false,
        duration_ms: Date.now() - startedAt,
        error_code: 'PROVIDER_UNAVAILABLE',
      });
      return json({ success: false, error: 'PROVIDER_UNAVAILABLE' }, 404, origin);
    }

    const property = propertyId ? await validatePropertyContext(auth.client, propertyId) : null;
    if (propertyId && !property) return json({ success: false, error: 'PROPERTY_CONTEXT_UNAVAILABLE' }, 404, origin);

    const messages = await fetchConversationMessages(auth.client, userId, target.ownerId);
    messageCount = messages.length;
    const analysis = analyzeProviderConversation(messages, question);
    logConversationAnalysis({
      request_id: requestId,
      user_id: userId,
      service_id: serviceId,
      property_id: propertyId,
      provider_valid: true,
      message_count: messageCount,
      success: true,
      duration_ms: Date.now() - startedAt,
    });

    return json({
      success: true,
      type: 'provider_conversation_analysis',
      data: {
        serviceId,
        propertyId: property?.id || propertyId || null,
        serviceTitle: target.serviceTitle,
        summary: analysis.summary,
        facts: analysis.facts,
        questions: analysis.questions,
        requests: analysis.requests,
        quotedAmounts: analysis.quotedAmounts,
        availability: analysis.availability,
        openItems: analysis.openItems,
        suggestedReply: analysis.suggestedReply,
        providerReplyFound: analysis.providerReplyFound,
        messageCount: analysis.messageCount,
      },
      actions: [],
    }, 200, origin);
  } catch (error) {
    logConversationAnalysis({
      request_id: requestId,
      user_id: userId,
      service_id: serviceId,
      property_id: propertyId,
      provider_valid: providerValid,
      message_count: messageCount,
      success: false,
      duration_ms: Date.now() - startedAt,
      error_code: error instanceof Error ? error.message : 'PROVIDER_CONVERSATION_ANALYSIS_FAILED',
    });
    return json({ success: false, error: 'PROVIDER_CONVERSATION_ANALYSIS_FAILED' }, 500, origin);
  }
}
