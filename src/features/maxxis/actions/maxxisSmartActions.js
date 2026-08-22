import {
  buildMaxxisDealGaps,
  buildMaxxisInsights,
  normalizeMaxxisDealIntelligenceSource,
} from '../intelligence/maxxisDealIntelligence';

export const MAXXIS_SMART_ACTION_STATES = Object.freeze({
  AVAILABLE: 'available',
  BLOCKED: 'blocked',
  PENDING: 'pending',
  COMPLETED: 'completed',
  UNAVAILABLE: 'unavailable',
});

export const MAXXIS_SMART_ACTION_CODES = Object.freeze({
  VIEW_DEAL_GAPS: 'VIEW_DEAL_GAPS',
  EXPLAIN_INSIGHT: 'EXPLAIN_INSIGHT',
  VIEW_PROVIDERS: 'VIEW_PROVIDERS',
  UNLOCK_PROVIDER_CONTACT: 'UNLOCK_PROVIDER_CONTACT',
  DRAFT_PROVIDER_MESSAGE: 'DRAFT_PROVIDER_MESSAGE',
  REVIEW_PROVIDER_REPLY: 'REVIEW_PROVIDER_REPLY',
  DRAFT_PROVIDER_REPLY: 'DRAFT_PROVIDER_REPLY',
  COMPARE_PROPERTIES: 'COMPARE_PROPERTIES',
  REVIEW_WORKFLOW: 'REVIEW_WORKFLOW',
  REVIEW_NEXT_STEP: 'REVIEW_NEXT_STEP',
});

export const MAXXIS_SMART_ACTION_CATALOG = Object.freeze({
  VIEW_DEAL_GAPS: {
    capability: 'deal_gap_intelligence',
    priority: 78,
    confirmationRequired: false,
    requiredContext: ['structured_deal'],
    labels: { en: 'View gaps', pt: 'Ver gaps', es: 'Ver gaps' },
  },
  EXPLAIN_INSIGHT: {
    capability: 'deal_insight_explanation',
    priority: 66,
    confirmationRequired: false,
    requiredContext: ['structured_deal'],
    labels: { en: 'Why?', pt: 'Por que?', es: 'Por que?' },
  },
  VIEW_PROVIDERS: {
    capability: 'provider_matches',
    priority: 92,
    confirmationRequired: false,
    requiredContext: ['service_needs_or_matches'],
    labels: { en: 'Show providers', pt: 'Mostrar providers', es: 'Mostrar providers' },
  },
  UNLOCK_PROVIDER_CONTACT: {
    capability: 'provider_contact_unlock',
    priority: 90,
    confirmationRequired: true,
    requiredContext: ['service_id', 'locked_contact'],
    labels: { en: 'Unlock contact', pt: 'Desbloquear contato', es: 'Desbloquear contacto' },
  },
  DRAFT_PROVIDER_MESSAGE: {
    capability: 'provider_message_draft',
    priority: 86,
    confirmationRequired: false,
    requiredContext: ['service_id', 'property_id', 'unlocked_contact'],
    labels: { en: 'Draft message', pt: 'Gerar draft', es: 'Crear borrador' },
  },
  REVIEW_PROVIDER_REPLY: {
    capability: 'provider_conversation_analysis',
    priority: 84,
    confirmationRequired: false,
    requiredContext: ['service_id', 'conversation'],
    labels: { en: 'Review reply', pt: 'Revisar resposta', es: 'Revisar respuesta' },
  },
  DRAFT_PROVIDER_REPLY: {
    capability: 'provider_reply_draft',
    priority: 82,
    confirmationRequired: false,
    requiredContext: ['service_id', 'property_id', 'conversation_analysis'],
    labels: { en: 'Draft response', pt: 'Gerar resposta', es: 'Crear respuesta' },
  },
  COMPARE_PROPERTIES: {
    capability: 'property_comparison',
    priority: 64,
    confirmationRequired: false,
    requiredContext: ['comparison_set'],
    labels: { en: 'Compare', pt: 'Comparar', es: 'Comparar' },
  },
  REVIEW_WORKFLOW: {
    capability: 'deal_workflow',
    priority: 62,
    confirmationRequired: false,
    requiredContext: ['workflow'],
    labels: { en: 'Review workflow', pt: 'Revisar workflow', es: 'Revisar workflow' },
  },
  REVIEW_NEXT_STEP: {
    capability: 'next_best_action',
    priority: 72,
    confirmationRequired: false,
    requiredContext: ['next_best_action'],
    labels: { en: 'Review next step', pt: 'Revisar proximo passo', es: 'Revisar siguiente paso' },
  },
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function flattenServices(source = {}) {
  if (Array.isArray(source?.raw?.services)) return source.raw.services;
  return asArray(source?.serviceMatches).flatMap((match) => asArray(match?.services));
}

function propertyStatus(source = {}) {
  return String(source?.property?.status || source?.property?.state || source?.raw?.property?.status || '').trim().toLowerCase();
}

function isPropertyOperational(source = {}) {
  const status = propertyStatus(source);
  return !['closed', 'sold', 'archived', 'inactive', 'deleted', 'unavailable'].includes(status);
}

function firstServiceByAccess(source, status) {
  return flattenServices(source).find((service) => String(service?.contactAccess?.status || '').toLowerCase() === status) || null;
}

function firstLoadedService(source) {
  return flattenServices(source).find((service) => isUuid(service?.id || service?.serviceId)) || null;
}

function makeAction(code, state, overrides = {}, language = 'en') {
  const catalog = MAXXIS_SMART_ACTION_CATALOG[code];
  if (!catalog) return null;
  const label = catalog.labels?.[language] || catalog.labels?.en || code;
  return {
    code,
    capability: catalog.capability,
    state,
    priority: Number(overrides.priority ?? catalog.priority ?? 0),
    reason: String(overrides.reason || '').slice(0, 180),
    requiredContext: asArray(overrides.requiredContext || catalog.requiredContext),
    confirmationRequired: Boolean(overrides.confirmationRequired ?? catalog.confirmationRequired),
    enabled: state === MAXXIS_SMART_ACTION_STATES.AVAILABLE,
    label,
    target: overrides.target || null,
  };
}

function orderActions(actions, maxVisible) {
  const stateRank = {
    available: 0,
    pending: 1,
    blocked: 2,
    completed: 3,
    unavailable: 4,
  };
  return actions
    .filter(Boolean)
    .sort((left, right) => {
      const stateDelta = (stateRank[left.state] ?? 9) - (stateRank[right.state] ?? 9);
      if (stateDelta) return stateDelta;
      return Number(right.priority || 0) - Number(left.priority || 0);
    })
    .slice(0, Math.max(1, Number(maxVisible) || 3));
}

export function buildMaxxisSmartActions(sourceInput = {}, options = {}) {
  const language = options.language || 'en';
  const maxVisible = options.maxVisible || 3;
  const surface = String(options.surface || 'snapshot');
  const rawType = String(sourceInput?.type || '');
  const rawData = sourceInput?.data || sourceInput || {};
  if (rawType === 'provider_message_sent' && isUuid(rawData.serviceId)) {
    return orderActions([
      makeAction('REVIEW_PROVIDER_REPLY', 'available', {
        reason: 'A provider conversation can be reviewed after a sent message.',
        target: { serviceId: rawData.serviceId, propertyId: rawData.propertyId || '' },
      }, language),
    ], maxVisible);
  }
  if (rawType === 'provider_conversation_analysis' && isUuid(rawData.serviceId) && isUuid(rawData.propertyId)) {
    return orderActions([
      makeAction('DRAFT_PROVIDER_REPLY', rawData.suggestedReply ? 'available' : 'blocked', {
        reason: rawData.suggestedReply ? 'A suggested reply is available for review.' : 'No suggested reply is available.',
        target: { serviceId: rawData.serviceId, propertyId: rawData.propertyId },
      }, language),
    ], maxVisible);
  }
  const source = normalizeMaxxisDealIntelligenceSource(sourceInput) || sourceInput;
  if (!source?.property && !source?.comparison) return [];

  const actions = [];
  const gaps = buildMaxxisDealGaps(source);
  const insights = buildMaxxisInsights(source);
  const services = flattenServices(source);
  const lockedService = firstServiceByAccess(source, 'locked');
  const unlockedService = firstServiceByAccess(source, 'already_unlocked');
  const loadedService = firstLoadedService(source);
  const pendingUnlock = options.pendingProviderUnlock || null;
  const propertyId = String(source?.property?.id || source?.raw?.property?.id || '').trim();
  const operational = isPropertyOperational(source);

  if (gaps.length) {
    actions.push(makeAction('VIEW_DEAL_GAPS', 'available', { reason: 'Deal gaps are available from loaded structured data.' }, language));
  }
  if (insights.length) {
    actions.push(makeAction('EXPLAIN_INSIGHT', 'available', { reason: 'Explainable insight evidence is loaded.' }, language));
  }
  if (source?.comparison) {
    actions.push(makeAction('COMPARE_PROPERTIES', 'available', { reason: 'Comparison set is loaded.' }, language));
  }
  if (asArray(source?.serviceNeeds).length || services.length) {
    actions.push(makeAction('VIEW_PROVIDERS', surface === 'providers' ? 'completed' : 'available', {
      reason: services.length ? 'Provider matches are loaded.' : 'Service needs are loaded.',
    }, language));
  }
  if (asArray(source?.workflow?.items).length) {
    actions.push(makeAction('REVIEW_WORKFLOW', 'available', { reason: 'Deal workflow is loaded.' }, language));
  }
  if (source?.nextBestAction?.nextBestAction || source?.nextBestAction?.code) {
    actions.push(makeAction('REVIEW_NEXT_STEP', 'available', { reason: 'Next Best Action is loaded.' }, language));
  }

  if (surface === 'providers') {
    const pendingMatches = pendingUnlock?.serviceId && services.some((service) => String(service?.id || service?.serviceId || '') === String(pendingUnlock.serviceId));
    if (!operational) {
      actions.push(makeAction('UNLOCK_PROVIDER_CONTACT', 'unavailable', { reason: 'Property is not operational.' }, language));
      actions.push(makeAction('DRAFT_PROVIDER_MESSAGE', 'unavailable', { reason: 'Property is not operational.' }, language));
    } else if (pendingMatches) {
      actions.push(makeAction('UNLOCK_PROVIDER_CONTACT', 'pending', {
        reason: 'Unlock confirmation is already awaiting user decision.',
        target: { serviceId: pendingUnlock.serviceId },
      }, language));
    } else if (lockedService) {
      actions.push(makeAction('UNLOCK_PROVIDER_CONTACT', 'available', {
        reason: 'A loaded provider contact is locked.',
        target: { serviceId: lockedService.id || lockedService.serviceId, propertyId },
      }, language));
    } else if (unlockedService) {
      actions.push(makeAction('UNLOCK_PROVIDER_CONTACT', 'completed', {
        reason: 'Provider contact is already unlocked.',
        target: { serviceId: unlockedService.id || unlockedService.serviceId, propertyId },
      }, language));
    } else if (loadedService) {
      actions.push(makeAction('UNLOCK_PROVIDER_CONTACT', 'blocked', {
        reason: 'Loaded provider does not expose a lockable contact state.',
        target: { serviceId: loadedService.id || loadedService.serviceId, propertyId },
      }, language));
    }

    if (unlockedService && isUuid(propertyId)) {
      actions.push(makeAction('DRAFT_PROVIDER_MESSAGE', 'available', {
        reason: 'Provider contact is unlocked and property context is available.',
        target: { serviceId: unlockedService.id || unlockedService.serviceId, propertyId },
      }, language));
    } else if (lockedService) {
      actions.push(makeAction('DRAFT_PROVIDER_MESSAGE', 'blocked', {
        reason: 'Provider contact must be unlocked before drafting a message.',
        target: { serviceId: lockedService.id || lockedService.serviceId, propertyId },
      }, language));
    }
  }

  return orderActions(actions, maxVisible);
}

export function findSmartActionTargetService(sourceInput = {}, action = {}) {
  const source = normalizeMaxxisDealIntelligenceSource(sourceInput) || sourceInput;
  const targetServiceId = String(action?.target?.serviceId || '').trim();
  const services = flattenServices(source);
  if (targetServiceId) {
    return services.find((service) => String(service?.id || service?.serviceId || '') === targetServiceId) || null;
  }
  if (action?.code === 'DRAFT_PROVIDER_MESSAGE') return firstServiceByAccess(source, 'already_unlocked');
  if (action?.code === 'UNLOCK_PROVIDER_CONTACT') return firstServiceByAccess(source, 'locked');
  return firstLoadedService(source);
}

export function safeSmartActionAnalytics(action = {}, extra = {}) {
  return {
    action_code: String(action?.code || '').slice(0, 80),
    action_state: String(action?.state || '').slice(0, 40),
    action_capability: String(action?.capability || '').slice(0, 80),
    action_result: String(extra.result || '').slice(0, 60),
    source: String(extra.source || 'maxxis').slice(0, 40),
    surface: String(extra.surface || '').slice(0, 60),
    context_version: Number(extra.contextVersion || 0) || 0,
    duration_ms: Number(extra.duration || extra.durationMs || 0) || 0,
  };
}
