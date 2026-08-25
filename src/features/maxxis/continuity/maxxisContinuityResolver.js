import { sanitizeMaxxisContextSnapshot } from '../context/maxxisContextSnapshot';
import {
  MAXXIS_CONTINUITY_TTL_MS,
  normalizeMaxxisContinuitySnapshot,
} from './maxxisContinuityContext';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TECHNICAL_RE = /^[a-zA-Z0-9:_-]{1,120}$/;
const CLOSED_STATES = new Set(['CLOSED', 'SOLD', 'ARCHIVED', 'INACTIVE', 'DELETED', 'UNAVAILABLE']);

const list = (value) => (Array.isArray(value) ? value : []);
const uuid = (value) => (UUID_RE.test(String(value || '').trim()) ? String(value).trim().toLowerCase() : '');
const technical = (value) => (TECHNICAL_RE.test(String(value || '').trim()) ? String(value).trim() : '');
const accountKey = (value) => technical(value);
const token = (value, max = 80) => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9:_-]+/g, '_').slice(0, max);

export function createMaxxisContinuitySession(currentAccountKey = '') {
  return Object.freeze({ accountKey: accountKey(currentAccountKey), activePropertyId: '', snapshots: Object.freeze({}) });
}

export function resetMaxxisContinuitySession(_session, nextAccountKey = '') {
  return createMaxxisContinuitySession(nextAccountKey);
}

export function captureMaxxisContinuity(session, input = {}, options = {}) {
  const nextAccountKey = accountKey(options.accountKey || session?.accountKey);
  const current = session?.accountKey === nextAccountKey ? session : createMaxxisContinuitySession(nextAccountKey);
  if (!nextAccountKey) return createMaxxisContinuitySession('');
  const propertyId = uuid(input.propertyId);
  if (!propertyId) return current;
  const previous = current.snapshots?.[propertyId] || null;
  const snapshot = normalizeMaxxisContinuitySnapshot({
    ...previous,
    ...input,
    propertyId,
    serviceId: input.clearProvider ? '' : (uuid(input.serviceId) || previous?.serviceId || ''),
    conversationRef: input.clearProvider ? '' : (technical(input.conversationRef) || previous?.conversationRef || ''),
    relatedPropertyIds: input.relatedPropertyIds?.length ? input.relatedPropertyIds : previous?.relatedPropertyIds,
    updatedAt: input.updatedAt || options.now,
  }, { now: options.now });
  if (!snapshot) return current;
  return Object.freeze({
    accountKey: nextAccountKey,
    activePropertyId: propertyId,
    snapshots: Object.freeze({ ...current.snapshots, [propertyId]: snapshot }),
  });
}

function memoryContext(memory, propertyId) {
  if (!memory || uuid(memory.propertyId) !== propertyId) return null;
  return Object.freeze({
    propertyId,
    serviceId: '',
    conversationRef: '',
    relatedPropertyIds: Object.freeze([]),
    lastInteractionType: token(memory.lastInteractionType || 'DEAL_MEMORY'),
    lastActionCode: token(memory.lastKnownNextBestActionCode),
    lastExperienceMode: 'MEMORY_RECALL',
    sourceSurface: 'MAXXIS',
    updatedAt: Date.parse(String(memory.lastReviewedAt || '')) || 0,
    expiresAt: Date.parse(String(memory.expiresAt || '')) || 0,
    freshness: 'MEMORY',
  });
}

export function resolveMaxxisContinuity(session, {
  accountKey: requestedAccountKey = '',
  currentContext = {},
  dealMemory = null,
  allowedServiceIds = [],
  now = Date.now(),
} = {}) {
  const requested = accountKey(requestedAccountKey);
  if (!requested || requested !== session?.accountKey) return Object.freeze({ status: 'NONE', reasonCode: 'ACCOUNT_MISMATCH', source: 'NONE', context: null });
  const propertyStatus = token(currentContext.propertyStatus, 30);
  if (currentContext.available === false || CLOSED_STATES.has(propertyStatus)) return Object.freeze({ status: 'NONE', reasonCode: 'ENTITY_UNAVAILABLE', source: 'NONE', context: null });
  const currentPropertyId = uuid(currentContext.propertyId);
  const propertyId = currentPropertyId || uuid(session.activePropertyId);
  if (!propertyId) return Object.freeze({ status: 'NONE', reasonCode: 'NO_PROPERTY_CONTEXT', source: 'NONE', context: null });
  const currentServiceId = uuid(currentContext.serviceId);
  const currentConversationRef = technical(currentContext.conversationRef || currentContext.conversationId);
  const stored = session.snapshots?.[propertyId] || null;
  const storedFresh = Boolean(stored && stored.expiresAt > now && stored.updatedAt + MAXXIS_CONTINUITY_TTL_MS > now);
  const allowed = new Set(list(allowedServiceIds).map(uuid).filter(Boolean));
  const storedServiceId = storedFresh && stored?.serviceId && allowed.has(stored.serviceId) ? stored.serviceId : '';
  if (currentPropertyId || currentServiceId || currentConversationRef) {
    const serviceId = currentServiceId || storedServiceId;
    const context = Object.freeze({
      ...(storedFresh ? stored : {}),
      propertyId,
      serviceId,
      conversationRef: currentConversationRef || (serviceId ? stored?.conversationRef || '' : ''),
      freshness: 'FRESH',
    });
    return Object.freeze({ status: 'RESOLVED', reasonCode: storedFresh ? 'CURRENT_WITH_CONTINUITY' : 'CURRENT_CONTEXT', source: currentServiceId || currentConversationRef ? 'CURRENT' : storedFresh ? 'CURRENT_WITH_CONTINUITY' : 'CURRENT', context });
  }
  if (storedFresh) {
    const context = Object.freeze({ ...stored, serviceId: storedServiceId, conversationRef: storedServiceId ? stored.conversationRef : '' });
    return Object.freeze({ status: 'RESOLVED', reasonCode: 'FRESH_CONTINUITY', source: 'CONTINUITY', context });
  }
  const fallback = memoryContext(dealMemory, propertyId);
  if (fallback) return Object.freeze({ status: 'RESOLVED', reasonCode: 'DEAL_MEMORY_FALLBACK', source: 'MEMORY', context: fallback });
  return Object.freeze({ status: stored ? 'EXPIRED' : 'NONE', reasonCode: stored ? 'CONTINUITY_EXPIRED' : 'NO_CONTINUITY', source: 'NONE', context: null });
}

export function resolveMaxxisContinuityReference(message = '', resolution = {}, { candidateServiceIds = [] } = {}) {
  const text = String(message || '').trim().toLowerCase();
  const context = resolution?.status === 'RESOLVED' ? resolution.context : null;
  if (!text || !context) return Object.freeze({ status: 'unresolved' });
  const second = /\b(second|2nd|segundo|segunda)\b/.test(text);
  const providerReference = /\b(this provider|that provider|the provider|provider|contractor|prestador|contratista|esse provider|este provider|ele|ela)\b/.test(text);
  const propertyReference = /\b(this property|that property|property|deal|imovel|propiedad|esse imovel|este imovel|aquele imovel)\b/.test(text);
  const continuation = /\b(and now|what now|continue|resume|go back|where were we|e agora|continuar|continue|retomar|voltar|onde paramos|y ahora|continuar|retomar|volver)\b/.test(text);
  if (second) {
    const related = list(context.relatedPropertyIds).map(uuid).filter(Boolean);
    if (related.length === 1) return Object.freeze({ status: 'resolved', intent: 'PROPERTY_REFERENCE', entity: Object.freeze({ type: 'PROPERTY', id: related[0] }), context });
    return Object.freeze({ status: related.length > 1 ? 'ambiguous' : 'unresolved', entityType: 'PROPERTY', count: related.length });
  }
  if (providerReference || continuation && context.serviceId) {
    const candidates = [...new Set(list(candidateServiceIds).map(uuid).filter(Boolean))];
    if (context.serviceId && (!candidates.length || candidates.includes(context.serviceId))) {
      return Object.freeze({ status: 'resolved', intent: continuation ? 'CONTINUE' : 'PROVIDER_REFERENCE', entity: Object.freeze({ type: 'SERVICE', id: context.serviceId }), context });
    }
    if (candidates.length > 1) return Object.freeze({ status: 'ambiguous', entityType: 'SERVICE', count: candidates.length });
    if (candidates.length === 1) return Object.freeze({ status: 'resolved', intent: 'PROVIDER_REFERENCE', entity: Object.freeze({ type: 'SERVICE', id: candidates[0] }), context });
  }
  if (propertyReference || continuation) return Object.freeze({ status: 'resolved', intent: continuation ? 'CONTINUE' : 'PROPERTY_REFERENCE', entity: Object.freeze({ type: 'PROPERTY', id: context.propertyId }), context });
  return Object.freeze({ status: 'unresolved' });
}

export function applyMaxxisContinuityToContextSnapshot(snapshot = {}, resolution = {}) {
  const context = resolution?.status === 'RESOLVED' ? resolution.context : null;
  if (!context) return sanitizeMaxxisContextSnapshot(snapshot);
  const current = sanitizeMaxxisContextSnapshot(snapshot);
  const serviceId = uuid(current.provider?.serviceId || context.serviceId);
  const propertyId = uuid(current.property?.id || context.propertyId);
  return sanitizeMaxxisContextSnapshot({
    ...current,
    entity: serviceId ? { type: 'SERVICE', id: serviceId } : propertyId ? { type: 'PROPERTY', id: propertyId } : current.entity,
    ...(propertyId ? { property: { id: propertyId } } : {}),
    ...(serviceId ? { provider: { serviceId } } : {}),
    sessionMemory: {
      ...current.sessionMemory,
      lastPropertyIds: [propertyId, ...list(context.relatedPropertyIds), ...list(current.sessionMemory?.lastPropertyIds)].filter(Boolean),
      lastServiceIds: [serviceId, ...list(current.sessionMemory?.lastServiceIds)].filter(Boolean),
      lastFocusedEntity: serviceId ? { type: 'SERVICE', id: serviceId } : propertyId ? { type: 'PROPERTY', id: propertyId } : current.sessionMemory?.lastFocusedEntity,
    },
  });
}

export function shouldDiscardMaxxisPendingConfirmation({
  pending = null,
  previousAccountKey = '',
  accountKey: nextAccountKey = '',
  previousPropertyId = '',
  propertyId = '',
  allowedServiceIds = [],
  now = Date.now(),
} = {}) {
  if (!pending) return false;
  if (accountKey(previousAccountKey) !== accountKey(nextAccountKey)) return true;
  const beforeProperty = uuid(previousPropertyId);
  const nextProperty = uuid(propertyId);
  if (beforeProperty && nextProperty && beforeProperty !== nextProperty) return true;
  const expiresAt = Date.parse(String(pending.expiresAt || ''));
  if (Number.isFinite(expiresAt) && expiresAt <= now) return true;
  const serviceId = uuid(pending.serviceId);
  const allowed = list(allowedServiceIds).map(uuid).filter(Boolean);
  return Boolean(serviceId && allowed.length && !allowed.includes(serviceId));
}
