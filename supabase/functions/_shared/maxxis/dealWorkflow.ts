import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, supabaseAnonKey, supabaseServiceRoleKey, supabaseUrl } from './config.ts';
import { logMaxxisEvent } from './logger.ts';
import { checkRateLimit, logAbuseGuard, rateLimitResponse } from '../abuseProtection.ts';
import type { MaxxisPropertyDetails, PropertyServiceMatch, PropertyServiceNeed } from './types.ts';
import {
  buildDealWorkflowDefinition,
  cleanWorkflowUuid as cleanUuid,
  DEAL_WORKFLOW_ORDER as WORKFLOW_ORDER,
  getWorkflowProviders as firstProviders,
  MANUAL_WORKFLOW_CODES,
  reconcileDealWorkflowItems,
  summarizeDealWorkflow,
  type DealWorkflowCode,
  type DealWorkflowItem,
  type DealWorkflowSource,
  type DealWorkflowStatus,
  type DealWorkflowView,
} from './dealWorkflowRules.ts';
export type { DealWorkflowCode, DealWorkflowItem, DealWorkflowStatus, DealWorkflowView } from './dealWorkflowRules.ts';

type WorkflowRow = {
  id?: string;
  property_id: string;
  code: DealWorkflowCode;
  status: DealWorkflowStatus;
  source: DealWorkflowSource;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
};

function json(body: Record<string, unknown>, status: number, origin: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

function rowToItem(row: WorkflowRow): DealWorkflowItem {
  return {
    id: row.id,
    propertyId: row.property_id,
    code: row.code,
    status: row.status,
    source: row.source,
    metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    completedAt: row.completed_at || null,
  };
}

function propertyIdFromMetadata(metadata: unknown) {
  const value = metadata && typeof metadata === 'object' ? metadata as Record<string, any> : {};
  const refData = value.refData && typeof value.refData === 'object' ? value.refData : {};
  return cleanUuid(value.propertyId || value.property_id || refData.propertyId || refData.property_id);
}

async function collectWorkflowEvidence(
  client: ReturnType<typeof createClient>,
  userId: string,
  propertyId: string,
  serviceMatches: PropertyServiceMatch[] | null,
) {
  const providers = firstProviders(serviceMatches);
  const { data: actions, error: actionsError } = await client
    .from('maxxis_pending_actions')
    .select('action_type, payload, status')
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .limit(20);
  if (actionsError) throw new Error('WORKFLOW_PENDING_ACTIONS_FAILED');
  const pendingActions = (actions || [])
    .filter((action: any) => cleanUuid(action?.payload?.propertyId) === propertyId)
    .map((action: any) => ({
      actionType: action.action_type,
      serviceId: cleanUuid(action?.payload?.serviceId) || null,
      propertyId,
      status: action.status,
    }));
  if (!providers.length) return { providerContacted: false, providerReplied: false, pendingActions };
  const serviceIds = providers.map((provider) => provider.serviceId);
  const { data: serviceRows, error: serviceError } = await client.from('services').select('id, owner_id').in('id', serviceIds);
  if (serviceError) throw new Error('WORKFLOW_SERVICE_EVIDENCE_FAILED');
  const providerIds = new Set((serviceRows || []).map((row: any) => cleanUuid(row.owner_id)).filter(Boolean));

  const { data: messages, error: messagesError } = await client
    .from('chat_messages')
    .select('sender_id, recipient_id, metadata, created_at')
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order('created_at', { ascending: true })
    .limit(250);
  if (messagesError) throw new Error('WORKFLOW_CHAT_EVIDENCE_FAILED');
  let providerContacted = false;
  let providerReplied = false;
  const contactedProviders = new Set<string>();
  for (const message of messages || []) {
    if (propertyIdFromMetadata(message.metadata) !== propertyId) continue;
    const senderId = cleanUuid(message.sender_id);
    const recipientId = cleanUuid(message.recipient_id);
    if (senderId === userId && providerIds.has(recipientId)) {
      providerContacted = true;
      contactedProviders.add(recipientId);
    } else if (recipientId === userId && providerIds.has(senderId) && contactedProviders.has(senderId)) {
      providerReplied = true;
    }
  }

  return { providerContacted, providerReplied, pendingActions };
}

async function persistReconciledWorkflow(userId: string, propertyId: string, definition: DealWorkflowItem[]) {
  if (!supabaseServiceRoleKey) throw new Error('WORKFLOW_STORAGE_NOT_CONFIGURED');
  const admin = createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: existingRows, error: existingError } = await admin
    .from('deal_workflow_items')
    .select('id, property_id, code, status, source, metadata, created_at, updated_at, completed_at')
    .eq('user_id', userId)
    .eq('property_id', propertyId);
  if (existingError) throw new Error('WORKFLOW_LOOKUP_FAILED');
  const persisted = (existingRows || []).map((row: WorkflowRow) => rowToItem(row));
  const reconciled = reconcileDealWorkflowItems(definition, persisted);
  const now = new Date().toISOString();
  const rows = reconciled.map((entry) => ({
    user_id: userId,
    property_id: propertyId,
    code: entry.code,
    status: entry.status,
    source: entry.source,
    metadata: entry.metadata,
    completed_at: entry.status === 'completed' ? (entry.completedAt || now) : null,
  }));
  let finalRows = existingRows || [];
  if (rows.length) {
    const { data: upsertedRows, error: upsertError } = await admin
      .from('deal_workflow_items')
      .upsert(rows, { onConflict: 'user_id,property_id,code' })
      .select('id, property_id, code, status, source, metadata, created_at, updated_at, completed_at');
    if (upsertError) throw new Error('WORKFLOW_RECONCILE_FAILED');
    finalRows = upsertedRows || [];
  }
  return summarizeDealWorkflow((finalRows || []).map((row: WorkflowRow) => rowToItem(row)).sort((left, right) => WORKFLOW_ORDER.indexOf(left.code) - WORKFLOW_ORDER.indexOf(right.code)));
}

export async function reconcileDealWorkflowForProperty(input: {
  client: ReturnType<typeof createClient>;
  userId: string;
  property: MaxxisPropertyDetails;
  serviceNeeds: PropertyServiceNeed[];
  serviceMatches: PropertyServiceMatch[] | null;
}) {
  const startedAt = Date.now();
  const evidence = await collectWorkflowEvidence(input.client, input.userId, input.property.id, input.serviceMatches);
  const definition = buildDealWorkflowDefinition({
    property: input.property,
    propertyReviewed: true,
    serviceNeeds: input.serviceNeeds,
    serviceMatches: input.serviceMatches,
    providerContacted: evidence.providerContacted,
    providerReplied: evidence.providerReplied,
  });
  const workflow = await persistReconciledWorkflow(input.userId, input.property.id, definition);
  const workflowProviderContacted = workflow.items.some((entry) => entry.code === 'provider_contacted' && entry.status === 'completed');
  const workflowProviderReplied = workflow.items.some((entry) => entry.code === 'provider_replied' && entry.status === 'completed');
  logMaxxisEvent('maxxis_deal_workflow_reconciled', {
    user_id: input.userId,
    success: true,
    duration_ms: Date.now() - startedAt,
    workflow_item_count: workflow.total,
    workflow_system_completed: workflow.items.filter((entry) => entry.source === 'system' && entry.status === 'completed').length,
  });
  return {
    workflow,
    pendingActions: evidence.pendingActions,
    conversationState: workflowProviderReplied ? 'provider_replied' as const : workflowProviderContacted ? 'message_sent_waiting_reply' as const : 'no_conversation' as const,
    providerReplyFound: workflowProviderReplied,
  };
}

export async function handleDealWorkflowRequest(req: Request) {
  const origin = req.headers.get('Origin') || '';
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return json({ success: false, error: 'METHOD_NOT_ALLOWED' }, 405, origin);
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return json({ success: false, error: 'UNAUTHORIZED' }, 401, origin);
    const client = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await client.auth.getUser(token);
    if (authError || !user) return json({ success: false, error: 'UNAUTHORIZED' }, 401, origin);
    const rateLimit = await checkRateLimit(user.id, 'deal_workflow_update');
    if (!rateLimit.allowed) {
      logAbuseGuard({ functionName: 'maxxis-deal-workflow', operation: 'deal_workflow_update', requestId, userId: user.id, category: 'RATE_LIMIT', status: rateLimit.unavailable ? 503 : 429, limitType: 'deal_workflow_update' });
      return rateLimitResponse(rateLimit, requestId, corsHeaders(origin));
    }
    const body = await req.json().catch(() => ({}));
    const propertyId = cleanUuid(body.propertyId);
    const code = String(body.code || '').trim() as DealWorkflowCode;
    const status = String(body.status || '').trim() as DealWorkflowStatus;
    if (!propertyId || !MANUAL_WORKFLOW_CODES.includes(code) || !['pending', 'completed'].includes(status)) {
      return json({ success: false, error: 'INVALID_WORKFLOW_ITEM' }, 400, origin);
    }
    const { data, error } = await client.rpc('ds_set_manual_deal_workflow_item', {
      p_property_id: propertyId,
      p_code: code,
      p_status: status,
    });
    if (error) throw new Error('WORKFLOW_MANUAL_UPDATE_FAILED');
    if (data?.success !== true) return json({ success: false, error: 'WORKFLOW_ITEM_NOT_FOUND' }, 404, origin);
    const { data: rows, error: rowsError } = await client
      .from('deal_workflow_items')
      .select('id, property_id, code, status, source, metadata, created_at, updated_at, completed_at')
      .eq('property_id', propertyId);
    if (rowsError) throw new Error('WORKFLOW_RESULT_FAILED');
    const workflow = summarizeDealWorkflow((rows || []).map((row: WorkflowRow) => rowToItem(row)).sort((left, right) => WORKFLOW_ORDER.indexOf(left.code) - WORKFLOW_ORDER.indexOf(right.code)));
    logMaxxisEvent('maxxis_deal_workflow_manual_change', {
      request_id: requestId,
      user_id: user.id,
      success: true,
      duration_ms: Date.now() - startedAt,
      operation: code,
      action_status: status,
      workflow_item_count: workflow.total,
      workflow_system_completed: workflow.items.filter((entry) => entry.source === 'system' && entry.status === 'completed').length,
    });
    return json({ success: true, workflow }, 200, origin);
  } catch (error) {
    logMaxxisEvent('maxxis_deal_workflow_manual_change', {
      request_id: requestId,
      success: false,
      duration_ms: Date.now() - startedAt,
      error_code: error instanceof Error ? error.message : 'WORKFLOW_FAILED',
    });
    return json({ success: false, error: 'WORKFLOW_FAILED' }, 500, origin);
  }
}
