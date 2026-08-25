export const MAXXIS_CONTINUITY_VERSION = 1;
export const MAXXIS_CONTINUITY_TTL_MS = 10 * 60 * 1000;

export const MAXXIS_CONTINUITY_SURFACES = Object.freeze({
  PROPERTY: 'PROPERTY',
  MATCHES: 'MATCHES',
  PROVIDER: 'PROVIDER',
  HUMAN_CHAT: 'HUMAN_CHAT',
  WORKFLOW: 'WORKFLOW',
  MAXXIS: 'MAXXIS',
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TECHNICAL_RE = /^[a-zA-Z0-9:_-]{1,120}$/;
const PROVIDER_MESSAGE_TYPES = new Set(['provider_message_sent', 'provider_message_draft', 'provider_conversation_analysis', 'smart_provider_actions']);

const list = (value) => (Array.isArray(value) ? value : []);
const uuid = (value) => (UUID_RE.test(String(value || '').trim()) ? String(value).trim().toLowerCase() : '');
const technical = (value) => (TECHNICAL_RE.test(String(value || '').trim()) ? String(value).trim() : '');
const code = (value, max = 80) => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9:_-]+/g, '_').slice(0, max);

function uniqueUuids(values, max = 12) {
  return [...new Set(list(values).map(uuid).filter(Boolean))].slice(0, max);
}

export function normalizeMaxxisContinuitySurface(surface = {}) {
  const page = String(typeof surface === 'string' ? surface : surface.page || '').toLowerCase();
  const subview = String(typeof surface === 'object' ? surface.subview || '' : '').toLowerCase();
  if (subview === 'human_chat' || page === 'chat') return MAXXIS_CONTINUITY_SURFACES.HUMAN_CHAT;
  if (subview.includes('provider') || page === 'provider') return MAXXIS_CONTINUITY_SURFACES.PROVIDER;
  if (subview.includes('workflow') || page === 'workflow') return MAXXIS_CONTINUITY_SURFACES.WORKFLOW;
  if (page === 'maxxis') return MAXXIS_CONTINUITY_SURFACES.MAXXIS;
  if (page === 'matches') return MAXXIS_CONTINUITY_SURFACES.MATCHES;
  return MAXXIS_CONTINUITY_SURFACES.PROPERTY;
}

export function normalizeMaxxisContinuitySnapshot(input = {}, { now = Date.now() } = {}) {
  const propertyId = uuid(input.propertyId);
  if (!propertyId) return null;
  const updatedAt = Number(input.updatedAt || now);
  const safeUpdatedAt = Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : now;
  const expiresAt = safeUpdatedAt + MAXXIS_CONTINUITY_TTL_MS;
  return Object.freeze({
    continuityVersion: MAXXIS_CONTINUITY_VERSION,
    propertyId,
    serviceId: uuid(input.serviceId),
    conversationRef: technical(input.conversationRef || input.conversationId),
    relatedPropertyIds: Object.freeze(uniqueUuids(input.relatedPropertyIds).filter((id) => id !== propertyId)),
    lastInteractionType: code(input.lastInteractionType || 'CONTEXT_REVIEW'),
    lastActionCode: code(input.lastActionCode),
    lastExperienceMode: code(input.lastExperienceMode),
    sourceSurface: normalizeMaxxisContinuitySurface(input.sourceSurface || input.surface),
    updatedAt: safeUpdatedAt,
    expiresAt,
    freshness: safeUpdatedAt + MAXXIS_CONTINUITY_TTL_MS > now ? 'FRESH' : 'EXPIRED',
  });
}

function propertyFromData(data = {}) {
  return uuid(data.propertyId || data.property?.id || data.propertySummary?.id || data.sourceData?.property?.id);
}

function serviceIdsFromData(data = {}) {
  const source = data.sourceData || data;
  return uniqueUuids([
    data.serviceId,
    ...list(source.services).map((service) => service?.id || service?.serviceId),
    ...list(source.serviceMatches).flatMap((match) => list(match?.services).map((service) => service?.id || service?.serviceId)),
  ], 20);
}

export function buildMaxxisContinuityEvidence(messages = [], propertyId = '') {
  const expectedPropertyId = uuid(propertyId);
  const serviceIds = [];
  let latestProviderContext = null;
  for (let index = 0; index < list(messages).length; index += 1) {
    const message = messages[index] || {};
    const data = message.data || {};
    const messagePropertyId = propertyFromData(data);
    if (!expectedPropertyId || messagePropertyId !== expectedPropertyId) continue;
    const messageServiceIds = serviceIdsFromData(data);
    serviceIds.push(...messageServiceIds);
    if (!PROVIDER_MESSAGE_TYPES.has(String(message.type || '')) || !messageServiceIds.length) continue;
    const directServiceId = uuid(data.serviceId);
    if (message.type === 'smart_provider_actions' && !directServiceId) continue;
    latestProviderContext = {
      propertyId: expectedPropertyId,
      serviceId: directServiceId || messageServiceIds[0],
      conversationRef: technical(data.conversationId || data.messageId || `SERVICE:${directServiceId || messageServiceIds[0]}`),
    };
  }
  return Object.freeze({
    propertyId: expectedPropertyId,
    serviceIds: Object.freeze(uniqueUuids(serviceIds, 20)),
    latestProviderContext: latestProviderContext ? Object.freeze(latestProviderContext) : null,
  });
}
