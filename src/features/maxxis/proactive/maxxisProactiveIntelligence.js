import { buildMaxxisDealGaps, normalizeMaxxisDealIntelligenceSource } from '../intelligence/maxxisDealIntelligence';
import { buildMaxxisSmartActions } from '../actions/maxxisSmartActions';

export const MAXXIS_PROACTIVE_SIGNAL_CODES = Object.freeze({
  PROVIDER_REPLIED: 'PROVIDER_REPLIED',
  PROVIDER_QUOTE_DETECTED: 'PROVIDER_QUOTE_DETECTED',
  NEW_DEAL_GAP: 'NEW_DEAL_GAP',
  WORKFLOW_ITEM_CHANGED: 'WORKFLOW_ITEM_CHANGED',
  PROVIDER_UNLOCKED: 'PROVIDER_UNLOCKED',
  SERVICE_MATCH_AVAILABLE: 'SERVICE_MATCH_AVAILABLE',
  PENDING_ACTION_EXPIRING: 'PENDING_ACTION_EXPIRING',
  DEAL_CONTEXT_UPDATED: 'DEAL_CONTEXT_UPDATED',
  IMPORTANT_MISSING_INFORMATION: 'IMPORTANT_MISSING_INFORMATION',
  NEW_ACTION_AVAILABLE: 'NEW_ACTION_AVAILABLE',
});

export const MAXXIS_PROACTIVE_SEVERITY = Object.freeze({
  INFO: 'INFO',
  RELEVANT: 'RELEVANT',
  IMPORTANT: 'IMPORTANT',
});

export const MAXXIS_PROACTIVE_DEFAULT_CONFIG = Object.freeze({
  enabled: false,
  proactiveEnabled: true,
  proactiveLevel: 'controlled',
  cooldownMs: 90_000,
  maxPerSession: 2,
  maxAgeMs: 15 * 60_000,
  autoDismissMs: 90_000,
});

const MESSAGE_COPY = Object.freeze({
  PROVIDER_REPLIED: {
    text: { en: 'Your provider replied.', pt: 'Seu provider respondeu.', es: 'Tu provider respondio.' },
    cta: { en: 'Review reply', pt: 'Revisar resposta', es: 'Revisar respuesta' },
  },
  PROVIDER_QUOTE_DETECTED: {
    text: { en: 'A provider sent a quote.', pt: 'Um provider enviou uma quote.', es: 'Un provider envio una cotizacion.' },
    cta: { en: 'Review', pt: 'Revisar', es: 'Revisar' },
  },
  SERVICE_MATCH_AVAILABLE: {
    text: { en: 'I found providers that match this property.', pt: 'Encontrei providers que combinam com esta propriedade.', es: 'Encontre providers que encajan con esta propiedad.' },
    cta: { en: 'View', pt: 'Ver', es: 'Ver' },
  },
  NEW_DEAL_GAP: {
    text: { en: 'I noticed something worth reviewing.', pt: 'Notei algo que vale revisar.', es: 'Note algo que vale revisar.' },
    cta: { en: 'Review', pt: 'Revisar', es: 'Revisar' },
  },
  WORKFLOW_ITEM_CHANGED: {
    text: { en: 'Your deal progress changed.', pt: 'O progresso do seu deal mudou.', es: 'El progreso de tu deal cambio.' },
    cta: { en: 'Review', pt: 'Revisar', es: 'Revisar' },
  },
  PROVIDER_UNLOCKED: {
    text: { en: 'A provider contact is ready.', pt: 'Um contato de provider esta pronto.', es: 'Un contacto de provider esta listo.' },
    cta: { en: 'View', pt: 'Ver', es: 'Ver' },
  },
  PENDING_ACTION_EXPIRING: {
    text: { en: 'A pending Maxxis action needs your decision.', pt: 'Uma acao pendente do Maxxis precisa da sua decisao.', es: 'Una accion pendiente de Maxxis necesita tu decision.' },
    cta: { en: 'Review', pt: 'Revisar', es: 'Revisar' },
  },
  DEAL_CONTEXT_UPDATED: {
    text: { en: 'Deal context changed.', pt: 'O contexto do deal mudou.', es: 'El contexto del deal cambio.' },
    cta: { en: 'View', pt: 'Ver', es: 'Ver' },
  },
  IMPORTANT_MISSING_INFORMATION: {
    text: { en: 'I noticed missing information worth reviewing.', pt: 'Notei informacoes ausentes que valem revisao.', es: 'Note informacion faltante que vale revisar.' },
    cta: { en: 'Review', pt: 'Revisar', es: 'Revisar' },
  },
  NEW_ACTION_AVAILABLE: {
    text: { en: 'A Maxxis action is available.', pt: 'Uma acao do Maxxis esta disponivel.', es: 'Una accion de Maxxis esta disponible.' },
    cta: { en: 'View', pt: 'Ver', es: 'Ver' },
  },
});

const SENSITIVE_SURFACES = new Set(['landing', 'onboarding', 'pricing', 'settings', 'admin', 'privacy', 'terms']);
const ACTIONFUL_SIGNAL_CODES = new Set([
  'PROVIDER_REPLIED',
  'PROVIDER_QUOTE_DETECTED',
  'NEW_DEAL_GAP',
  'WORKFLOW_ITEM_CHANGED',
  'PROVIDER_UNLOCKED',
  'SERVICE_MATCH_AVAILABLE',
  'PENDING_ACTION_EXPIRING',
  'IMPORTANT_MISSING_INFORMATION',
  'NEW_ACTION_AVAILABLE',
]);

function cleanText(value, maxLength = 90) {
  return String(value || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function cleanTechnicalId(value) {
  const clean = cleanText(value, 120);
  return /^[a-zA-Z0-9:_-]{1,120}$/.test(clean) ? clean : '';
}

function cleanEntityType(value) {
  const clean = cleanText(value || 'product', 30).toUpperCase().replace(/[^A-Z_]/g, '');
  return clean || 'PRODUCT';
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueSignals(signals) {
  const seen = new Set();
  const result = [];
  signals.forEach((signal) => {
    if (!signal?.dedupeKey || seen.has(signal.dedupeKey)) return;
    seen.add(signal.dedupeKey);
    result.push(signal);
  });
  return result;
}

function sourceFromEvent(value) {
  const source = cleanText(value, 40).toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return source || 'app_state';
}

function normalizeSeverity(value, fallback = 'RELEVANT') {
  const severity = cleanText(value || fallback, 20).toUpperCase();
  return MAXXIS_PROACTIVE_SEVERITY[severity] || fallback;
}

function normalizeSignal(raw = {}, fallback = {}) {
  const code = cleanText(raw.code || fallback.code, 60).toUpperCase();
  if (!MAXXIS_PROACTIVE_SIGNAL_CODES[code]) return null;
  const entityType = cleanEntityType(raw.entityType || fallback.entityType || 'PROPERTY');
  const entityId = cleanTechnicalId(raw.entityId || fallback.entityId || '');
  const source = sourceFromEvent(raw.source || fallback.source);
  const occurredAt = Number(raw.occurredAt || fallback.occurredAt || Date.now());
  const safeOccurredAt = Number.isFinite(occurredAt) && occurredAt > 0 ? occurredAt : Date.now();
  const evidence = {
    hasStructuredSource: Boolean(raw.evidence?.hasStructuredSource ?? fallback.evidence?.hasStructuredSource ?? true),
    actionAvailable: raw.evidence?.actionAvailable !== false && fallback.evidence?.actionAvailable !== false,
    propertyId: cleanTechnicalId(raw.evidence?.propertyId || fallback.evidence?.propertyId || (entityType === 'PROPERTY' ? entityId : '')),
    serviceId: cleanTechnicalId(raw.evidence?.serviceId || fallback.evidence?.serviceId || (entityType === 'SERVICE' ? entityId : '')),
    conversationId: cleanTechnicalId(raw.evidence?.conversationId || fallback.evidence?.conversationId || (entityType === 'CONVERSATION' ? entityId : '')),
  };
  const dedupeKey = cleanTechnicalId(raw.dedupeKey || fallback.dedupeKey || `${code}:${entityType}:${entityId || evidence.propertyId || evidence.serviceId || 'none'}:${source}`);
  if (!dedupeKey) return null;
  return {
    code,
    entityType,
    entityId,
    source,
    occurredAt: safeOccurredAt,
    evidence,
    severity: normalizeSeverity(raw.severity, fallback.severity || 'RELEVANT'),
    dedupeKey,
  };
}

function latestStructuredDealMessage(messages = []) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== 'assistant' || message?.error) continue;
    const source = normalizeMaxxisDealIntelligenceSource({ type: message.type, data: message.data });
    if (source?.property || source?.comparison) return message;
  }
  return null;
}

function propertyStatusFromMessage(message = {}) {
  const data = message?.data || {};
  return cleanText(data.property?.status || data.property?.state || data.propertySummary?.status || '', 30).toLowerCase();
}

function isClosedPropertyContext({ appContext = {}, messages = [] } = {}) {
  const operationalStatus = cleanText(appContext?.operational?.propertyStatus || appContext?.entity?.propertyStatus || '', 30).toLowerCase();
  const messageStatus = propertyStatusFromMessage(latestStructuredDealMessage(messages));
  return ['closed', 'sold', 'archived', 'inactive', 'deleted', 'unavailable'].includes(operationalStatus || messageStatus);
}

export function buildMaxxisProactiveSignals({
  contextSnapshot = {},
  appContext = {},
  messages = [],
  now = Date.now(),
  accountKey = '',
} = {}) {
  if (isClosedPropertyContext({ appContext, messages })) return [];
  const entity = contextSnapshot.entity || {};
  const focusedPropertyId = cleanTechnicalId(
    contextSnapshot.property?.id
    || (entity.type === 'PROPERTY' ? entity.id : '')
    || appContext?.entity?.propertyId
    || '',
  );
  const focusedServiceId = cleanTechnicalId(
    contextSnapshot.provider?.serviceId
    || (entity.type === 'SERVICE' ? entity.id : '')
    || appContext?.entity?.serviceId
    || '',
  );
  const accountPrefix = cleanTechnicalId(accountKey) || 'session';
  const explicitEvents = [
    ...asArray(appContext?.proactiveEvents),
    ...asArray(appContext?.operational?.proactiveEvents),
  ];
  const explicitSignals = explicitEvents
    .map((event) => normalizeSignal({
      ...event,
      dedupeKey: `${accountPrefix}:${event?.code}:${event?.dedupeKey || event?.entityId || event?.serviceId || event?.propertyId || focusedPropertyId || focusedServiceId || now}`,
    }, {
      entityType: event?.entityType || (event?.serviceId ? 'SERVICE' : 'PROPERTY'),
      entityId: event?.entityId || event?.serviceId || event?.propertyId || focusedPropertyId || focusedServiceId,
      source: event?.source || 'app_state',
      occurredAt: event?.occurredAt || now,
      evidence: {
        propertyId: event?.propertyId || focusedPropertyId,
        serviceId: event?.serviceId || focusedServiceId,
        actionAvailable: true,
      },
      dedupeKey: `${accountPrefix}:${event?.code}:${event?.dedupeKey || event?.entityId || event?.serviceId || event?.propertyId || focusedPropertyId || focusedServiceId || now}`,
    }))
    .filter(Boolean);

  const signals = [...explicitSignals];
  const operational = contextSnapshot.operational || {};
  const capabilities = operational.capabilities || {};
  const state = operational.state || {};
  const latestDealMessage = latestStructuredDealMessage(messages);
  const latestDealSource = latestDealMessage ? normalizeMaxxisDealIntelligenceSource({ type: latestDealMessage.type, data: latestDealMessage.data }) : null;
  const dealGaps = latestDealSource ? buildMaxxisDealGaps(latestDealSource) : [];
  const smartActions = latestDealSource ? buildMaxxisSmartActions({ type: latestDealMessage.type, data: latestDealMessage.data }, { maxVisible: 3 }) : [];

  if (state.providerReplyAvailable) {
    signals.push(normalizeSignal({}, {
      code: 'PROVIDER_REPLIED',
      entityType: focusedServiceId ? 'SERVICE' : 'PROPERTY',
      entityId: focusedServiceId || focusedPropertyId,
      source: 'conversation',
      occurredAt: now,
      severity: 'RELEVANT',
      evidence: { propertyId: focusedPropertyId, serviceId: focusedServiceId, actionAvailable: true },
      dedupeKey: `${accountPrefix}:PROVIDER_REPLIED:${focusedServiceId || focusedPropertyId || 'context'}`,
    }));
  }
  if (state.contactAccessState === 'already_unlocked' || state.contactAccessState === 'unlocked') {
    signals.push(normalizeSignal({}, {
      code: 'PROVIDER_UNLOCKED',
      entityType: focusedServiceId ? 'SERVICE' : 'PROPERTY',
      entityId: focusedServiceId || focusedPropertyId,
      source: 'unlock',
      occurredAt: now,
      severity: 'INFO',
      evidence: { propertyId: focusedPropertyId, serviceId: focusedServiceId, actionAvailable: true },
      dedupeKey: `${accountPrefix}:PROVIDER_UNLOCKED:${focusedServiceId || focusedPropertyId || 'context'}`,
    }));
  }
  if (capabilities.providerMatches && appContext?.operational?.serviceMatchAvailable === true) {
    signals.push(normalizeSignal({}, {
      code: 'SERVICE_MATCH_AVAILABLE',
      entityType: 'PROPERTY',
      entityId: focusedPropertyId,
      source: 'service_matches',
      occurredAt: now,
      severity: 'RELEVANT',
      evidence: { propertyId: focusedPropertyId, serviceId: focusedServiceId, actionAvailable: true },
      dedupeKey: `${accountPrefix}:SERVICE_MATCH_AVAILABLE:${focusedPropertyId || 'context'}`,
    }));
  }
  if (dealGaps.length || appContext?.operational?.newDealGapAvailable === true) {
    signals.push(normalizeSignal({}, {
      code: dealGaps.some((gap) => gap?.category === 'DATA') ? 'IMPORTANT_MISSING_INFORMATION' : 'NEW_DEAL_GAP',
      entityType: 'PROPERTY',
      entityId: focusedPropertyId,
      source: 'deal_gaps',
      occurredAt: now,
      severity: dealGaps.some((gap) => gap?.category === 'DATA') ? 'IMPORTANT' : 'RELEVANT',
      evidence: { propertyId: focusedPropertyId, serviceId: focusedServiceId, actionAvailable: true },
      dedupeKey: `${accountPrefix}:NEW_DEAL_GAP:${focusedPropertyId || latestDealMessage?.id || 'context'}`,
    }));
  }
  if (appContext?.operational?.workflowChanged === true) {
    signals.push(normalizeSignal({}, {
      code: 'WORKFLOW_ITEM_CHANGED',
      entityType: 'PROPERTY',
      entityId: focusedPropertyId,
      source: 'workflow',
      occurredAt: now,
      severity: 'INFO',
      evidence: { propertyId: focusedPropertyId, actionAvailable: true },
      dedupeKey: `${accountPrefix}:WORKFLOW_ITEM_CHANGED:${focusedPropertyId || 'context'}`,
    }));
  }
  if (smartActions.some((action) => action?.enabled) && appContext?.operational?.newActionAvailable === true) {
    signals.push(normalizeSignal({}, {
      code: 'NEW_ACTION_AVAILABLE',
      entityType: focusedPropertyId ? 'PROPERTY' : 'PRODUCT',
      entityId: focusedPropertyId,
      source: 'smart_actions',
      occurredAt: now,
      severity: 'INFO',
      evidence: { propertyId: focusedPropertyId, serviceId: focusedServiceId, actionAvailable: true },
      dedupeKey: `${accountPrefix}:NEW_ACTION_AVAILABLE:${focusedPropertyId || latestDealMessage?.id || 'context'}`,
    }));
  }

  return uniqueSignals(signals.filter(Boolean));
}

export function createMaxxisProactiveSessionMemory(accountKey = '') {
  return {
    accountKey: cleanTechnicalId(accountKey),
    seenSignals: new Set(),
    dismissedSignals: new Set(),
    surfacedSignals: new Set(),
    lastBubbleAt: 0,
    surfacedCount: 0,
  };
}

export function resetMaxxisProactiveSessionIfNeeded(memory, accountKey = '') {
  const cleanAccountKey = cleanTechnicalId(accountKey);
  if (!memory || memory.accountKey === cleanAccountKey) return memory || createMaxxisProactiveSessionMemory(cleanAccountKey);
  return createMaxxisProactiveSessionMemory(cleanAccountKey);
}

function hasUsefulAction(signal = {}) {
  return ACTIONFUL_SIGNAL_CODES.has(signal.code) && signal.evidence?.actionAvailable !== false;
}

function focusedPropertyId(contextSnapshot = {}) {
  const entity = contextSnapshot.entity || {};
  return cleanTechnicalId(contextSnapshot.property?.id || (entity.type === 'PROPERTY' ? entity.id : ''));
}

function signalPropertyId(signal = {}) {
  return cleanTechnicalId(signal.evidence?.propertyId || (signal.entityType === 'PROPERTY' ? signal.entityId : ''));
}

export function evaluateMaxxisProactiveAttention(signal = {}, {
  config = {},
  contextSnapshot = {},
  sessionMemory = createMaxxisProactiveSessionMemory(),
  now = Date.now(),
  maxxisOpen = false,
  userActivity = {},
} = {}) {
  const settings = { ...MAXXIS_PROACTIVE_DEFAULT_CONFIG, ...config };
  if (!settings.enabled || settings.proactiveEnabled === false) return { shouldSurface: false, priority: 0, reasonCode: 'FEATURE_DISABLED', expiresAt: 0 };
  if (!signal?.code || !signal?.dedupeKey) return { shouldSurface: false, priority: 0, reasonCode: 'INVALID_SIGNAL', expiresAt: 0 };
  const visualSafetyManaged = settings.attentionSafetyManaged === true;
  if (!visualSafetyManaged && maxxisOpen) return { shouldSurface: false, priority: 0, reasonCode: 'MAXXIS_OPEN', expiresAt: 0 };
  const surfaceName = cleanText(contextSnapshot.surface?.name || '', 40).toLowerCase();
  const modalName = cleanText(contextSnapshot.surface?.modal || userActivity.modal || '', 60).toLowerCase();
  if (!visualSafetyManaged && (SENSITIVE_SURFACES.has(surfaceName) || modalName)) return { shouldSurface: false, priority: 0, reasonCode: 'SENSITIVE_SURFACE', expiresAt: 0 };
  if (!visualSafetyManaged && (userActivity.typing || userActivity.modalOpen || userActivity.criticalFlow || contextSnapshot.operational?.state?.pendingActionExists)) {
    return { shouldSurface: false, priority: 0, reasonCode: 'USER_BUSY', expiresAt: 0 };
  }
  const age = now - Number(signal.occurredAt || 0);
  if (age < 0 || age > settings.maxAgeMs) return { shouldSurface: false, priority: 0, reasonCode: 'STALE_SIGNAL', expiresAt: 0 };
  if (sessionMemory.dismissedSignals?.has(signal.dedupeKey)) return { shouldSurface: false, priority: 0, reasonCode: 'DISMISSED', expiresAt: 0 };
  if (sessionMemory.surfacedSignals?.has(signal.dedupeKey) || sessionMemory.seenSignals?.has(signal.dedupeKey)) {
    return { shouldSurface: false, priority: 0, reasonCode: 'DUPLICATE', expiresAt: 0 };
  }
  if (sessionMemory.lastBubbleAt && now - sessionMemory.lastBubbleAt < settings.cooldownMs) {
    return { shouldSurface: false, priority: 0, reasonCode: 'COOLDOWN', expiresAt: 0 };
  }
  if (Number(sessionMemory.surfacedCount || 0) >= settings.maxPerSession) {
    return { shouldSurface: false, priority: 0, reasonCode: 'SESSION_LIMIT', expiresAt: 0 };
  }
  if (!hasUsefulAction(signal)) return { shouldSurface: false, priority: 0, reasonCode: 'NO_USEFUL_ACTION', expiresAt: 0 };
  const focusProperty = focusedPropertyId(contextSnapshot);
  const propertyId = signalPropertyId(signal);
  if (focusProperty && propertyId && focusProperty !== propertyId && signal.severity !== 'IMPORTANT') {
    return { shouldSurface: false, priority: 0, reasonCode: 'CONTEXT_MISMATCH', expiresAt: 0 };
  }
  const priorityBySeverity = { INFO: 35, RELEVANT: 60, IMPORTANT: 80 };
  const surfaceBoost = ['dashboard', 'matches', 'map'].includes(surfaceName) ? 8 : 0;
  const sameEntityBoost = focusProperty && propertyId && focusProperty === propertyId ? 12 : 0;
  const priority = Math.min(100, (priorityBySeverity[signal.severity] || 50) + surfaceBoost + sameEntityBoost);
  return {
    shouldSurface: true,
    priority,
    reasonCode: sameEntityBoost ? 'RELEVANT_SAME_CONTEXT' : 'RELEVANT_SIGNAL',
    expiresAt: now + Math.min(settings.maxAgeMs, 10 * 60_000),
  };
}

export function markMaxxisProactiveSignalSurfaced(memory, signal, now = Date.now()) {
  if (!memory || !signal?.dedupeKey) return memory;
  memory.surfacedSignals.add(signal.dedupeKey);
  memory.seenSignals.add(signal.dedupeKey);
  memory.lastBubbleAt = now;
  memory.surfacedCount = Number(memory.surfacedCount || 0) + 1;
  return memory;
}

export function markMaxxisProactiveSignalDismissed(memory, signal) {
  if (!memory || !signal?.dedupeKey) return memory;
  memory.dismissedSignals.add(signal.dedupeKey);
  memory.seenSignals.add(signal.dedupeKey);
  return memory;
}

export function composeMaxxisProactiveMessage(signal = {}, language = 'en') {
  const lang = ['en', 'pt', 'es'].includes(language) ? language : 'en';
  const copy = MESSAGE_COPY[signal.code] || MESSAGE_COPY.NEW_ACTION_AVAILABLE;
  return {
    signalCode: MAXXIS_PROACTIVE_SIGNAL_CODES[signal.code] ? signal.code : 'NEW_ACTION_AVAILABLE',
    text: copy.text[lang] || copy.text.en,
    ctaLabel: copy.cta[lang] || copy.cta.en,
  };
}

export function safeProactiveAnalytics(signal = {}, attention = {}, extra = {}) {
  return {
    signalCode: cleanText(signal.code, 60),
    surface: cleanText(extra.surface || '', 60),
    priority: Number(attention.priority || extra.priority || 0) || 0,
    reasonCode: cleanText(attention.reasonCode || extra.reasonCode || '', 60),
    contextVersion: Number(extra.contextVersion || 0) || 0,
  };
}

export function selectMaxxisProactiveCandidate(signals = [], options = {}) {
  const evaluated = signals
    .map((signal) => ({ signal, attention: evaluateMaxxisProactiveAttention(signal, options) }))
    .filter((entry) => entry.attention.shouldSurface)
    .sort((left, right) => Number(right.attention.priority || 0) - Number(left.attention.priority || 0));
  return evaluated[0] || null;
}
