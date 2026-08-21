export const MAXXIS_CONTEXT_VERSION = 1;
export const MAXXIS_CONTEXT_MAX_BYTES = 4096;
export const MAXXIS_CONTEXT_FRESH_MS = 5 * 60 * 1000;

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SURFACE_BY_PAGE = {
  admin: 'settings',
  dashboard: 'dashboard',
  landing: 'unknown',
  mapview: 'map',
  matches: 'matches',
  onboarding: 'onboarding',
  pricing: 'settings',
  privacy: 'settings',
  settings: 'settings',
  terms: 'settings',
};

const SURFACE_ROUTE_BY_NAME = {
  chat: '/matches',
  dashboard: '/dashboard',
  feed: '/dashboard',
  map: '/map',
  matches: '/matches',
  onboarding: '/onboarding',
  profile: '/settings',
  property: '/matches',
  settings: '/settings',
  unknown: '/unknown',
};

const CONTEXTUAL_REFERENCE_RE = /\b(this|that|these|those|it|them|last|second|third|provider|contractor|property|deal|workflow|unlock|contact|conversation|chat|esse|essa|este|esta|esses|essas|eles|elas|ultimo|ultima|segundo|terceiro|imovel|provedor|prestador|contratista|propiedad|ultimo)\b/i;
const SURFACE_QUESTION_RE = /(what am i seeing|what page|where am i|current screen|current page|o que estou vendo|qual tela|onde estou|que pagina|que estoy viendo|pantalla actual|pagina actual)/i;

function cleanText(value, maxLength = 80) {
  return Array.from(String(value ?? ''))
    .map((char) => (char.charCodeAt(0) < 32 ? ' ' : char))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function cleanId(value) {
  const id = cleanText(value, 80);
  return UUID_PATTERN.test(id) ? id : '';
}

function uniqueIds(values = [], maxItems = 10) {
  const seen = new Set();
  const ids = [];
  (Array.isArray(values) ? values : []).forEach((value) => {
    const id = cleanId(value);
    const key = id.toLowerCase();
    if (!id || seen.has(key)) return;
    seen.add(key);
    ids.push(id);
  });
  return ids.slice(0, maxItems);
}

function contextBytes(value) {
  try {
    return new TextEncoder().encode(JSON.stringify(value || {})).byteLength;
  } catch {
    return 0;
  }
}

function freshnessFromTimestamp(timestamp, now = Date.now()) {
  const time = Number(timestamp || 0);
  if (!Number.isFinite(time) || time <= 0) return 'unknown';
  return now - time <= MAXXIS_CONTEXT_FRESH_MS ? 'fresh' : 'stale';
}

function normalizePage(page) {
  return cleanText(page || 'unknown', 40).toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'unknown';
}

export function normalizeMaxxisSurface(input = {}) {
  const rawPage = typeof input === 'string' ? input : input.page;
  const page = normalizePage(rawPage);
  const mappedName = SURFACE_BY_PAGE[page] || page || 'unknown';
  const selectedName = cleanText(input.name || mappedName, 40).toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'unknown';
  const name = SURFACE_ROUTE_BY_NAME[selectedName] ? selectedName : (SURFACE_ROUTE_BY_NAME[mappedName] ? mappedName : 'unknown');
  const route = cleanText(input.route || SURFACE_ROUTE_BY_NAME[name] || `/${page}`, 80);
  const subview = cleanText(input.subview || (name === 'dashboard' ? 'feed_deck' : page), 80);
  const modal = cleanText(input.modal || '', 60);
  const activeConversation = cleanId(input.activeConversationId || input.conversationId);

  return {
    name,
    route,
    subview,
    ...(modal ? { modal } : {}),
    ...(activeConversation ? { activeConversationId: activeConversation } : {}),
  };
}

export function normalizeMaxxisEntity(input = {}) {
  const directType = cleanText(input.type || '', 40).toUpperCase();
  const directId = cleanText(input.id || '', 80);
  const propertyId = cleanId(input.propertyId || (directType === 'PROPERTY' ? directId : ''));
  const serviceId = cleanId(input.serviceId || (directType === 'SERVICE' || directType === 'PROVIDER' ? directId : ''));
  const conversationId = cleanId(input.conversationId || (directType === 'CONVERSATION' ? directId : ''));
  const workflowPropertyId = cleanId(input.workflowPropertyId || (directType === 'WORKFLOW' ? directId : ''));
  const profileScope = cleanText(input.profileScope || (directType === 'PROFILE' ? directId : ''), 40).toLowerCase();

  if (serviceId) return { type: 'SERVICE', id: serviceId };
  if (conversationId) return { type: 'CONVERSATION', id: conversationId };
  if (workflowPropertyId) return { type: 'WORKFLOW', id: workflowPropertyId };
  if (propertyId) return { type: 'PROPERTY', id: propertyId };
  if (profileScope) return { type: 'PROFILE', id: profileScope };
  return { type: 'NONE' };
}

function idsFromServices(services = []) {
  return uniqueIds((Array.isArray(services) ? services : [])
    .map((service) => service?.id || service?.serviceId));
}

function contactStateFromServices(services = []) {
  const states = new Set();
  (Array.isArray(services) ? services : []).forEach((service) => {
    const status = cleanText(service?.contactAccess?.status || '', 30).toLowerCase();
    if (status) states.add(status);
  });
  if (states.has('unlocked')) return 'unlocked';
  if (states.has('locked')) return 'locked';
  if (states.size) return Array.from(states).sort()[0];
  return 'unknown';
}

function collectResponseSignals(messages = [], now = Date.now()) {
  const signals = {
    latestTimestamp: 0,
    lastToolResultType: 'none',
    propertyIds: [],
    serviceIds: [],
    comparedPropertyIds: [],
    providerServiceIds: [],
    propertyDetailsAvailable: false,
    matchScoreAvailable: false,
    serviceNeedsAvailable: false,
    providerMatchesAvailable: false,
    dealAdvisorAvailable: false,
    contactAccessState: 'unknown',
    workflowProgressAvailable: false,
    providerReplyAvailable: false,
  };

  (Array.isArray(messages) ? messages : []).forEach((message) => {
    if (message?.role !== 'assistant' || message?.error) return;
    const data = message.data || {};
    const timestamp = message.createdAt instanceof Date
      ? message.createdAt.getTime()
      : Number(new Date(message.createdAt || 0).getTime());
    if (Number.isFinite(timestamp)) signals.latestTimestamp = Math.max(signals.latestTimestamp, timestamp);
    if (message.type) signals.lastToolResultType = cleanText(message.type, 60) || signals.lastToolResultType;

    const propertyId = cleanId(data.property?.id || data.propertyId || data.propertySummary?.id);
    if (propertyId) signals.propertyIds.push(propertyId);

    if (Array.isArray(data.properties)) {
      const ids = data.properties.map((property) => property?.id);
      signals.propertyIds.push(...ids);
      signals.comparedPropertyIds.push(...ids);
    }
    if (Array.isArray(data.comparedPropertyIds)) signals.comparedPropertyIds.push(...data.comparedPropertyIds);

    const services = [
      ...(Array.isArray(data.services) ? data.services : []),
      ...(Array.isArray(data.serviceMatches)
        ? data.serviceMatches.flatMap((match) => Array.isArray(match?.services) ? match.services : [])
        : []),
      ...(Array.isArray(data.serviceSummary?.providers) ? data.serviceSummary.providers : []),
    ];
    const serviceIds = idsFromServices(services);
    signals.serviceIds.push(...serviceIds);
    signals.providerServiceIds.push(...serviceIds);

    if (message.type === 'property_details' || data.property || data.propertySummary) signals.propertyDetailsAvailable = true;
    if (data.match || data.matchScore || data.metricsSummary?.metrics?.matchScore) signals.matchScoreAvailable = true;
    if (Array.isArray(data.serviceNeeds) || Array.isArray(data.serviceSummary?.needs)) signals.serviceNeedsAvailable = true;
    if (serviceIds.length) signals.providerMatchesAvailable = true;
    if (data.advisor || data.advisorSummary) signals.dealAdvisorAvailable = true;
    if (data.workflow || Array.isArray(data.workflow?.items)) signals.workflowProgressAvailable = true;
    if (message.type === 'provider_conversation_analysis' || data.providerReplyFound || data.providerReplyAvailable) signals.providerReplyAvailable = true;

    const contactState = contactStateFromServices(services);
    if (contactState !== 'unknown') signals.contactAccessState = contactState;
  });

  signals.propertyIds = uniqueIds(signals.propertyIds, 20);
  signals.serviceIds = uniqueIds(signals.serviceIds, 20);
  signals.comparedPropertyIds = uniqueIds(signals.comparedPropertyIds, 10);
  signals.providerServiceIds = uniqueIds(signals.providerServiceIds, 10);
  signals.freshness = freshnessFromTimestamp(signals.latestTimestamp, now);
  return signals;
}

export function buildMaxxisSessionMemory(input = {}) {
  const signals = collectResponseSignals(input.messages, input.now);
  const focusedPropertyId = cleanId(input.propertyId);
  const lastFocusedEntity = focusedPropertyId
    ? { type: 'PROPERTY', id: focusedPropertyId }
    : (signals.propertyIds[0]
      ? { type: 'PROPERTY', id: signals.propertyIds[0] }
      : (signals.serviceIds[0] ? { type: 'SERVICE', id: signals.serviceIds[0] } : null));

  return {
    lastPropertyIds: uniqueIds([focusedPropertyId, ...signals.propertyIds], 10),
    lastServiceIds: signals.serviceIds.slice(0, 10),
    lastComparedPropertyIds: signals.comparedPropertyIds.slice(0, 6),
    lastProviderServiceIds: signals.providerServiceIds.slice(0, 6),
    lastToolResultType: signals.lastToolResultType,
    ...(lastFocusedEntity ? { lastFocusedEntity } : {}),
  };
}

export function buildMaxxisOperationalContext(input = {}) {
  const signals = collectResponseSignals(input.messages, input.now);
  const pendingActionExists = Boolean(
    input.pendingProviderUnlock
    || input.pendingProviderMessageSend
    || input.activeProviderUnlockId
    || input.activeProviderDraftId
    || input.activeProviderMessageSendId
    || input.activeProviderConversationAnalysisId
    || input.activeWorkflowItemCode
    || input.appSignals?.pendingActionExists
  );

  return {
    capabilities: {
      propertyDetails: Boolean(signals.propertyDetailsAvailable || input.appSignals?.propertyDetailsAvailable),
      matchScore: Boolean(signals.matchScoreAvailable || input.appSignals?.matchScoreAvailable),
      serviceNeeds: Boolean(signals.serviceNeedsAvailable || input.appSignals?.serviceNeedsAvailable),
      providerMatches: Boolean(signals.providerMatchesAvailable || input.appSignals?.providerMatchesAvailable),
      dealAdvisor: Boolean(signals.dealAdvisorAvailable || input.appSignals?.dealAdvisorAvailable),
      workflow: Boolean(signals.workflowProgressAvailable || input.appSignals?.workflowProgressAvailable),
    },
    state: {
      contactAccessState: cleanText(input.appSignals?.contactAccessState || signals.contactAccessState || 'unknown', 30),
      providerReplyAvailable: Boolean(signals.providerReplyAvailable || input.appSignals?.providerReplyAvailable),
      pendingActionExists,
    },
  };
}

export function buildMaxxisFreshness(input = {}) {
  const signals = collectResponseSignals(input.messages, input.now);
  const appFreshness = input.appSignals?.freshness || {};
  return {
    surface: 'fresh',
    entity: cleanId(input.propertyId) || cleanId(input.serviceId) ? 'fresh' : 'unknown',
    operational: appFreshness.operational || signals.freshness || 'unknown',
    conversation: appFreshness.conversation || (signals.providerReplyAvailable ? signals.freshness : 'unknown'),
    workflow: appFreshness.workflow || (signals.workflowProgressAvailable ? signals.freshness : 'unknown'),
  };
}

export function buildMaxxisContextSnapshot(input = {}) {
  const surface = normalizeMaxxisSurface(input.surface || { page: input.page });
  const propertyId = cleanId(input.propertyId);
  const serviceId = cleanId(input.serviceId);
  const sessionMemory = buildMaxxisSessionMemory({ ...input, propertyId });
  const directEntity = normalizeMaxxisEntity({
    propertyId,
    serviceId,
    conversationId: input.conversationId,
    workflowPropertyId: input.workflowVisible ? propertyId : '',
    profileScope: input.profileScope,
  });
  const entity = directEntity.type !== 'NONE'
    ? directEntity
    : normalizeMaxxisEntity(sessionMemory.lastFocusedEntity || {});
  const effectivePropertyId = propertyId || (entity.type === 'PROPERTY' ? cleanId(entity.id) : '');
  const snapshot = {
    contextVersion: MAXXIS_CONTEXT_VERSION,
    surface,
    entity,
    ...(effectivePropertyId ? { property: { id: effectivePropertyId } } : {}),
    ...(serviceId ? { provider: { serviceId } } : {}),
    operational: buildMaxxisOperationalContext(input),
    sessionMemory,
    freshness: buildMaxxisFreshness({ ...input, propertyId, serviceId }),
  };
  return fitContextBudget(sanitizeMaxxisContextSnapshot(snapshot));
}

export function sanitizeMaxxisContextSnapshot(snapshot = {}) {
  const surface = normalizeMaxxisSurface(snapshot.surface || {});
  const entity = normalizeMaxxisEntity(snapshot.entity || {});
  const propertyId = cleanId(snapshot.property?.id);
  const serviceId = cleanId(snapshot.provider?.serviceId);
  const operational = snapshot.operational || {};
  const sessionMemory = snapshot.sessionMemory || {};
  const freshness = snapshot.freshness || {};

  return {
    contextVersion: MAXXIS_CONTEXT_VERSION,
    surface,
    entity,
    ...(propertyId ? { property: { id: propertyId } } : {}),
    ...(serviceId ? { provider: { serviceId } } : {}),
    operational: {
      capabilities: {
        propertyDetails: Boolean(operational.capabilities?.propertyDetails),
        matchScore: Boolean(operational.capabilities?.matchScore),
        serviceNeeds: Boolean(operational.capabilities?.serviceNeeds),
        providerMatches: Boolean(operational.capabilities?.providerMatches),
        dealAdvisor: Boolean(operational.capabilities?.dealAdvisor),
        workflow: Boolean(operational.capabilities?.workflow),
      },
      state: {
        contactAccessState: cleanText(operational.state?.contactAccessState || 'unknown', 30),
        providerReplyAvailable: Boolean(operational.state?.providerReplyAvailable),
        pendingActionExists: Boolean(operational.state?.pendingActionExists),
      },
    },
    sessionMemory: {
      lastPropertyIds: uniqueIds(sessionMemory.lastPropertyIds, 10),
      lastServiceIds: uniqueIds(sessionMemory.lastServiceIds, 10),
      lastComparedPropertyIds: uniqueIds(sessionMemory.lastComparedPropertyIds, 6),
      lastProviderServiceIds: uniqueIds(sessionMemory.lastProviderServiceIds, 6),
      lastToolResultType: cleanText(sessionMemory.lastToolResultType || 'none', 60),
      ...(sessionMemory.lastFocusedEntity
        ? { lastFocusedEntity: normalizeMaxxisEntity(sessionMemory.lastFocusedEntity) }
        : {}),
    },
    freshness: {
      surface: cleanText(freshness.surface || 'unknown', 20),
      entity: cleanText(freshness.entity || 'unknown', 20),
      operational: cleanText(freshness.operational || 'unknown', 20),
      conversation: cleanText(freshness.conversation || 'unknown', 20),
      workflow: cleanText(freshness.workflow || 'unknown', 20),
    },
  };
}

export function fitContextBudget(snapshot = {}) {
  const next = sanitizeMaxxisContextSnapshot(snapshot);
  if (contextBytes(next) <= MAXXIS_CONTEXT_MAX_BYTES) return next;
  next.sessionMemory = {
    ...next.sessionMemory,
    lastPropertyIds: next.sessionMemory.lastPropertyIds.slice(0, 3),
    lastServiceIds: next.sessionMemory.lastServiceIds.slice(0, 3),
    lastComparedPropertyIds: next.sessionMemory.lastComparedPropertyIds.slice(0, 3),
    lastProviderServiceIds: next.sessionMemory.lastProviderServiceIds.slice(0, 3),
  };
  return next;
}

export function getMaxxisContextSize(snapshot = {}) {
  return contextBytes(sanitizeMaxxisContextSnapshot(snapshot));
}

export function isSurfaceContextQuestion(message = '') {
  return SURFACE_QUESTION_RE.test(cleanText(message, 300));
}

export function shouldAttachMaxxisContext(message = '', snapshot = {}) {
  const text = cleanText(message, 300);
  if (!text) return false;
  if (isSurfaceContextQuestion(text)) return true;
  const cleanSnapshot = sanitizeMaxxisContextSnapshot(snapshot);
  const hasEntity = cleanSnapshot.entity?.type && cleanSnapshot.entity.type !== 'NONE';
  const focusedMemoryType = cleanSnapshot.sessionMemory?.lastFocusedEntity?.type || '';
  const hasMemoryEntity = Boolean(
    cleanSnapshot.property?.id
    || (focusedMemoryType && focusedMemoryType !== 'NONE')
    || cleanSnapshot.sessionMemory?.lastPropertyIds?.length
    || cleanSnapshot.sessionMemory?.lastServiceIds?.length
  );
  return Boolean((hasEntity || hasMemoryEntity) && CONTEXTUAL_REFERENCE_RE.test(text));
}

export function selectMaxxisContextForMessage(snapshot = {}, message = '') {
  if (!shouldAttachMaxxisContext(message, snapshot)) return null;
  const selected = sanitizeMaxxisContextSnapshot(snapshot);
  if (getMaxxisContextSize(selected) <= MAXXIS_CONTEXT_MAX_BYTES) return selected;
  return fitContextBudget(selected);
}

export function maxxisContextTelemetry(snapshot = {}) {
  const cleanSnapshot = sanitizeMaxxisContextSnapshot(snapshot);
  const freshnessValues = Object.values(cleanSnapshot.freshness || {});
  return {
    surface: cleanSnapshot.surface?.name || 'unknown',
    entityType: cleanSnapshot.entity?.type || 'NONE',
    contextVersion: cleanSnapshot.contextVersion,
    contextSize: getMaxxisContextSize(cleanSnapshot),
    freshnessSummary: freshnessValues.includes('stale') ? 'stale' : freshnessValues.includes('fresh') ? 'fresh' : 'unknown',
  };
}

export function describeMaxxisContext(snapshot = {}, language = 'en') {
  const cleanSnapshot = sanitizeMaxxisContextSnapshot(snapshot);
  const surfaceName = cleanSnapshot.surface?.name || 'unknown';
  const subview = cleanSnapshot.surface?.subview || 'default';
  const focusedEntity = cleanSnapshot.entity?.type && cleanSnapshot.entity.type !== 'NONE'
    ? cleanSnapshot.entity
    : cleanSnapshot.sessionMemory?.lastFocusedEntity;
  const entityType = focusedEntity?.type || 'NONE';
  const operational = cleanSnapshot.operational || {};
  const capabilities = operational.capabilities || {};
  const activeCapabilities = Object.entries(capabilities)
    .filter(([, enabled]) => Boolean(enabled))
    .map(([name]) => name);

  if (language === 'pt') {
    return [
      `Voce esta em ${surfaceName}${subview && subview !== surfaceName ? ` (${subview})` : ''}.`,
      entityType !== 'NONE' ? `O foco atual e ${entityType.toLowerCase()}.` : 'Nao ha entidade especifica em foco.',
      activeCapabilities.length ? `Contexto operacional disponivel: ${activeCapabilities.join(', ')}.` : 'Ainda nao ha contexto operacional carregado para este ponto.',
    ].join(' ');
  }
  if (language === 'es') {
    return [
      `Estas en ${surfaceName}${subview && subview !== surfaceName ? ` (${subview})` : ''}.`,
      entityType !== 'NONE' ? `El foco actual es ${entityType.toLowerCase()}.` : 'No hay una entidad especifica en foco.',
      activeCapabilities.length ? `Contexto operativo disponible: ${activeCapabilities.join(', ')}.` : 'Aun no hay contexto operativo cargado para este punto.',
    ].join(' ');
  }
  return [
    `You are on ${surfaceName}${subview && subview !== surfaceName ? ` (${subview})` : ''}.`,
    entityType !== 'NONE' ? `The current focus is ${entityType.toLowerCase()}.` : 'There is no specific entity in focus.',
    activeCapabilities.length ? `Available operational context: ${activeCapabilities.join(', ')}.` : 'No operational context is loaded for this point yet.',
  ].join(' ');
}

export function resolveMaxxisNaturalReference(message = '', snapshot = {}) {
  const text = cleanText(message, 300).toLowerCase();
  const cleanSnapshot = sanitizeMaxxisContextSnapshot(snapshot);
  const memory = cleanSnapshot.sessionMemory || {};
  const ordinal = /\b(second|2nd|segundo|segunda)\b/.test(text) ? 1
    : /\b(third|3rd|terceiro|terceira)\b/.test(text) ? 2
      : /\b(first|1st|primeiro|primeira)\b/.test(text) ? 0
        : null;

  if (/\b(provider|contractor|prestador|contratista|service|servico|servicio)\b/.test(text)) {
    const ids = memory.lastServiceIds || [];
    if (ordinal != null) {
      return ids[ordinal] ? { status: 'resolved', entity: { type: 'SERVICE', id: ids[ordinal] } } : { status: 'unresolved' };
    }
    if (ids.length === 1) return { status: 'resolved', entity: { type: 'SERVICE', id: ids[0] } };
    if (ids.length > 1) return { status: 'ambiguous', entityType: 'SERVICE', count: ids.length };
  }

  if (/\b(property|deal|imovel|propiedad|esse|essa|this|that|it)\b/.test(text)) {
    const focusedId = cleanSnapshot.property?.id || (memory.lastFocusedEntity?.type === 'PROPERTY' ? memory.lastFocusedEntity?.id : '');
    if (focusedId) return { status: 'resolved', entity: { type: 'PROPERTY', id: focusedId } };
    const ids = memory.lastPropertyIds || [];
    if (ids.length === 1) return { status: 'resolved', entity: { type: 'PROPERTY', id: ids[0] } };
    if (ids.length > 1) return { status: 'ambiguous', entityType: 'PROPERTY', count: ids.length };
  }

  return { status: 'unresolved' };
}

export function shouldResetMaxxisContextSession(previousSessionKey, nextSessionKey) {
  return cleanText(previousSessionKey, 120) !== cleanText(nextSessionKey, 120);
}
