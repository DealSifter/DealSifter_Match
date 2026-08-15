import { createClient } from 'npm:@supabase/supabase-js@2';
import { supabaseAnonKey, supabaseUrl } from './config.ts';
import { getPropertyDetailsForAuthenticatedUser } from './getPropertyDetails.ts';
import { logMaxxisEvent } from './logger.ts';
import { analyzeProviderConversation } from './providerConversationAnalyzer.ts';
import {
  orchestrateDealCopilotOverview,
  type DealCopilotProviderSummary,
  type OptionalCopilotContext,
} from './dealCopilotContextRules.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanUuid(value: unknown) {
  const id = String(value || '').trim();
  return UUID_PATTERN.test(id) ? id : '';
}

function metadataRecord(value: unknown) {
  return value && typeof value === 'object' ? value as Record<string, any> : {};
}

function linkedPropertyId(metadata: unknown) {
  const value = metadataRecord(metadata);
  const refData = metadataRecord(value.refData);
  return cleanUuid(value.propertyId || value.property_id || refData.propertyId || refData.property_id);
}

function linkedServiceId(metadata: unknown) {
  const value = metadataRecord(metadata);
  const refData = metadataRecord(value.refData);
  return cleanUuid(value.serviceId || value.service_id || refData.serviceId || refData.service_id);
}

async function loadOptionalPropertyContext(
  client: ReturnType<typeof createClient>,
  userId: string,
  propertyId: string,
): Promise<OptionalCopilotContext> {
  const { data: rows, error } = await client
    .from('chat_messages')
    .select('sender_id, recipient_id, body, metadata, created_at')
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order('created_at', { ascending: true })
    .limit(250);
  if (error) throw new Error('COPILOT_CONVERSATION_LOOKUP_FAILED');
  const linkedRows = (rows || []).filter((row: any) => linkedPropertyId(row.metadata) === propertyId);
  if (!linkedRows.length) return { conversationSummary: null, providers: [], queryCount: 1 };
  const analysis = analyzeProviderConversation(linkedRows.map((row: any) => ({
    sender: cleanUuid(row.sender_id) === userId ? 'user' as const : 'provider' as const,
    text: String(row.body || ''),
    createdAt: row.created_at || null,
  })));
  const serviceIds = Array.from(new Set(linkedRows.map((row: any) => linkedServiceId(row.metadata)).filter(Boolean))).slice(0, 10);
  let providers: DealCopilotProviderSummary[] = [];
  const capabilitiesUnavailable: string[] = [];
  let queryCount = 1;
  if (serviceIds.length) {
    queryCount += 1;
    const { data: services, error: servicesError } = await client
      .from('services')
      .select('id, title, category')
      .in('id', serviceIds)
      .limit(10);
    if (servicesError) {
      capabilitiesUnavailable.push('provider_summary');
    } else {
      providers = (services || []).map((service: any) => ({
        serviceId: cleanUuid(service.id),
        title: String(service.title || service.category || 'Provider').trim().slice(0, 140),
        serviceType: String(service.category || '').trim().slice(0, 100),
      })).filter((service: DealCopilotProviderSummary) => service.serviceId);
    }
  }
  return {
    conversationSummary: {
      summary: analysis.summary,
      facts: analysis.facts,
      openItems: analysis.openItems,
      providerReplyFound: analysis.providerReplyFound,
      messageCount: analysis.messageCount,
    },
    providers,
    capabilitiesLoaded: ['provider_conversation_analysis'],
    capabilitiesUnavailable,
    queryCount,
  };
}

export async function getDealCopilotOverviewForAuthenticatedUser(
  propertyId: string,
  authHeader: string,
  client: ReturnType<typeof createClient>,
  userId: string,
) {
  const startedAt = Date.now();
  if (!userId) throw new Error('UNAUTHORIZED');
  const overview = await orchestrateDealCopilotOverview({
    propertyId,
    loadDetails: (trustedPropertyId) => getPropertyDetailsForAuthenticatedUser(
      { propertyId: trustedPropertyId, includeOperationalContext: true },
      authHeader,
      client,
      userId,
    ),
    loadOptionalContext: (trustedPropertyId) => loadOptionalPropertyContext(client, userId, trustedPropertyId),
  });
  logMaxxisEvent('maxxis_deal_copilot_overview', {
    user_id: userId,
    success: Boolean(overview),
    duration_ms: Date.now() - startedAt,
    capabilities_loaded: overview?.capabilitiesLoaded || [],
    capabilities_unavailable: overview?.capabilitiesUnavailable || [],
    query_count: overview?.queryCount || 0,
  });
  return overview;
}

export async function getDealCopilotOverview(propertyId: string, authHeader: string) {
  const token = String(authHeader || '').replace(/^Bearer\s+/i, '').trim();
  const client = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authError } = await client.auth.getUser(token);
  if (authError || !user) throw new Error('UNAUTHORIZED');
  return getDealCopilotOverviewForAuthenticatedUser(propertyId, authHeader, client, user.id);
}
