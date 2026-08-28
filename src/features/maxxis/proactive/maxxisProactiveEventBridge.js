const TECHNICAL_ID_RE = /^[a-zA-Z0-9:_-]{1,120}$/;

export const MAXXIS_PROACTIVE_SIGNAL_SOURCE_MAP = Object.freeze({
  PROVIDER_REPLIED: Object.freeze({ source: 'chat_realtime', event: 'incoming_message', safePayload: ['conversationId', 'messageId'], freshnessMs: 15 * 60_000 }),
  PROVIDER_QUOTE_DETECTED: Object.freeze({ source: 'conversation_analysis', event: 'structured_quote_detected', safePayload: ['conversationId', 'serviceId'], freshnessMs: 15 * 60_000 }),
  SERVICE_MATCH_AVAILABLE: Object.freeze({ source: 'service_matching', event: 'matching_result_available', safePayload: ['propertyId', 'serviceId'], freshnessMs: 15 * 60_000 }),
  NEW_DEAL_GAP: Object.freeze({ source: 'deal_intelligence', event: 'deal_gap_recalculated', safePayload: ['propertyId'], freshnessMs: 15 * 60_000 }),
  WORKFLOW_ITEM_CHANGED: Object.freeze({ source: 'deal_workflow', event: 'workflow_update', safePayload: ['propertyId'], freshnessMs: 15 * 60_000 }),
  PROVIDER_UNLOCKED: Object.freeze({ source: 'unlock_entitlement', event: 'unlock_confirmed', safePayload: ['propertyId', 'serviceId'], freshnessMs: 15 * 60_000 }),
  NEW_ACTION_AVAILABLE: Object.freeze({ source: 'smart_action_eligibility', event: 'eligible_action_changed', safePayload: ['propertyId', 'serviceId'], freshnessMs: 15 * 60_000 }),
  IMPORTANT_MISSING_INFORMATION: Object.freeze({ source: 'deal_advisor', event: 'important_gap_detected', safePayload: ['propertyId'], freshnessMs: 15 * 60_000 }),
  PENDING_ACTION_EXPIRING: Object.freeze({ source: 'pending_action_state', event: 'pending_action_near_expiry', safePayload: ['propertyId', 'serviceId'], freshnessMs: 10 * 60_000 }),
  DEAL_CONTEXT_UPDATED: Object.freeze({ source: 'trusted_app_context', event: 'trusted_context_changed', safePayload: ['propertyId', 'serviceId', 'conversationId'], freshnessMs: 5 * 60_000 }),
});

function technicalId(value) {
  const normalized = String(value || '').trim();
  return TECHNICAL_ID_RE.test(normalized) ? normalized : '';
}

function timestamp(value, fallback = Date.now()) {
  const parsed = new Date(value || 0).getTime();
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function stableFingerprint(value) {
  const text = JSON.stringify(value || '');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function trustedDealVersion(property = {}) {
  return stableFingerprint([
    property.updatedAt || property.updated_at || '',
    property.status || '',
    property.isActive ?? property.is_active ?? true,
    property.dealClosed ?? property.deal_closed ?? false,
    property.price ?? null,
    property.estimatedRehab ?? property.estimated_rehab ?? null,
    property.bedrooms ?? property.beds ?? null,
    property.bathrooms ?? property.baths ?? null,
    property.sqft ?? null,
    property.objective || '',
  ]);
}

export function createMaxxisProactiveRuntimeEvent(codeInput, input = {}, now = Date.now()) {
  const code = String(codeInput || '').trim().toUpperCase();
  const definition = MAXXIS_PROACTIVE_SIGNAL_SOURCE_MAP[code];
  if (!definition) return null;
  const entityId = technicalId(input.entityId || input.propertyId || input.serviceId || input.conversationId);
  const entityType = String(input.entityType || (input.serviceId ? 'SERVICE' : input.conversationId ? 'CONVERSATION' : 'PROPERTY')).toUpperCase();
  const propertyId = technicalId(input.propertyId || input.evidence?.propertyId || (entityType === 'PROPERTY' ? entityId : ''));
  const serviceId = technicalId(input.serviceId || input.evidence?.serviceId || (entityType === 'SERVICE' ? entityId : ''));
  const conversationId = technicalId(input.conversationId || input.evidence?.conversationId || (entityType === 'CONVERSATION' ? entityId : ''));
  const dedupePart = technicalId(input.dedupeKey || input.eventId || entityId);
  if (!dedupePart) return null;
  const dedupeKey = dedupePart.startsWith(`${code}:`) ? dedupePart : `${code}:${dedupePart}`;
  return {
    code,
    entityType,
    entityId,
    source: definition.source,
    event: definition.event,
    occurredAt: timestamp(input.occurredAt, now),
    freshnessMs: definition.freshnessMs,
    severity: String(input.severity || 'RELEVANT').toUpperCase(),
    dedupeKey,
    evidence: {
      propertyId,
      serviceId,
      conversationId,
      actionAvailable: input.actionAvailable !== false,
      hasStructuredSource: true,
    },
  };
}

export function buildMaxxisTrustedDealContextEvents(previousVersions = {}, properties = [], now = Date.now()) {
  const versions = {};
  const events = [];
  (Array.isArray(properties) ? properties : []).forEach((property) => {
    const propertyId = technicalId(property?.id);
    if (!propertyId) return;
    const version = trustedDealVersion(property);
    versions[propertyId] = version;
    if (!previousVersions?.[propertyId] || previousVersions[propertyId] === version) return;
    const event = createMaxxisProactiveRuntimeEvent('DEAL_CONTEXT_UPDATED', {
      entityType: 'PROPERTY',
      entityId: propertyId,
      propertyId,
      eventId: `${propertyId}:${version}`,
      occurredAt: now,
      severity: 'RELEVANT',
    }, now);
    if (event) events.push(event);
  });
  return { versions, events: events.slice(0, 5) };
}

export function buildMaxxisProactiveEventsFromChatNotifications(notifications = [], now = Date.now()) {
  return (Array.isArray(notifications) ? notifications : [])
    .filter((notification) => notification?.source === 'chat_realtime' && notification?.read !== true)
    .map((notification) => {
      const conversationId = technicalId(notification.ownerId);
      const messageId = technicalId(notification.latestMessageId);
      if (!conversationId || !messageId) return null;
      return createMaxxisProactiveRuntimeEvent('PROVIDER_REPLIED', {
        entityType: 'CONVERSATION',
        entityId: conversationId,
        conversationId,
        eventId: `provider-reply:${messageId}`,
        occurredAt: timestamp(notification.occurredAt, now),
        severity: 'RELEVANT',
      }, now);
    })
    .filter(Boolean);
}

export function buildMaxxisProactiveEventsFromConversations(conversations = {}, now = Date.now()) {
  if (!conversations || typeof conversations !== 'object' || Array.isArray(conversations)) return [];
  return Object.entries(conversations).map(([conversationIdInput, messages]) => {
    const conversationId = technicalId(conversationIdInput);
    const incoming = (Array.isArray(messages) ? messages : []).filter((message) => message?.from !== 'me');
    const latest = incoming[incoming.length - 1];
    const messageId = technicalId(latest?.id);
    if (!conversationId || !messageId) return null;
    return createMaxxisProactiveRuntimeEvent('PROVIDER_REPLIED', {
      entityType: 'CONVERSATION',
      entityId: conversationId,
      conversationId,
      eventId: `provider-reply:${messageId}`,
      occurredAt: timestamp(latest?.createdAt, now),
      severity: 'RELEVANT',
    }, now);
  }).filter(Boolean);
}

export function buildMaxxisProactiveEventsFromRuntime({ chatNotifications = [], conversations = {}, runtimeEvents = [], now = Date.now() } = {}) {
  const events = [
    ...buildMaxxisProactiveEventsFromChatNotifications(chatNotifications, now),
    ...buildMaxxisProactiveEventsFromConversations(conversations, now),
    ...(Array.isArray(runtimeEvents) ? runtimeEvents : []).map((event) => (
      createMaxxisProactiveRuntimeEvent(event?.code, event, now)
    )).filter(Boolean),
  ];
  const seen = new Set();
  return events.filter((event) => {
    if (!event?.dedupeKey || seen.has(event.dedupeKey)) return false;
    seen.add(event.dedupeKey);
    return true;
  }).slice(-30);
}

export default buildMaxxisProactiveEventsFromChatNotifications;
