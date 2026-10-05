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
  EXPLAIN_METRICS: 'EXPLAIN_METRICS',
  DEAL_SNAPSHOT: 'DEAL_SNAPSHOT',
  VIEW_PROVIDERS: 'VIEW_PROVIDERS',
  UNLOCK_PROVIDER_CONTACT: 'UNLOCK_PROVIDER_CONTACT',
  DRAFT_PROVIDER_MESSAGE: 'DRAFT_PROVIDER_MESSAGE',
  REVIEW_PROVIDER_REPLY: 'REVIEW_PROVIDER_REPLY',
  DRAFT_PROVIDER_REPLY: 'DRAFT_PROVIDER_REPLY',
  COMPARE_PROPERTIES: 'COMPARE_PROPERTIES',
  REVIEW_WORKFLOW: 'REVIEW_WORKFLOW',
  REVIEW_NEXT_STEP: 'REVIEW_NEXT_STEP',
});

export const MAXXIS_ACTION_TYPES = Object.freeze({
  INFORMATION: 'INFORMATION',
  INPUT_REQUIRED: 'INPUT_REQUIRED',
  CALCULATION: 'CALCULATION',
  COMPARISON: 'COMPARISON',
  CONFLICT_RESOLUTION: 'CONFLICT_RESOLUTION',
  SCENARIO: 'SCENARIO',
  NAVIGATION: 'NAVIGATION',
});

export const MAXXIS_SMART_ACTION_CATALOG = Object.freeze({
  VIEW_DEAL_GAPS: {
    capability: 'deal_gap_intelligence',
    priority: 78,
    type: MAXXIS_ACTION_TYPES.INPUT_REQUIRED,
    consumesOnExecution: true,
    confirmationRequired: false,
    requiredContext: ['structured_deal'],
    labels: { en: "What's needed to calculate?", pt: 'O que falta para calcular?', es: 'Que falta para calcular?' },
  },
  EXPLAIN_INSIGHT: {
    capability: 'deal_insight_explanation',
    priority: 66,
    type: MAXXIS_ACTION_TYPES.INFORMATION,
    consumesOnExecution: true,
    confirmationRequired: false,
    requiredContext: ['structured_deal'],
    labels: { en: 'Why this attention point?', pt: 'Por que este ponto importa?', es: 'Por que importa este punto?' },
  },
  EXPLAIN_METRICS: {
    capability: 'deal_metric_explanation',
    priority: 74,
    type: MAXXIS_ACTION_TYPES.INFORMATION,
    consumesOnExecution: true,
    confirmationRequired: false,
    requiredContext: ['deal_metrics'],
    labels: { en: 'Explain visible metrics', pt: 'Explicar metricas visiveis', es: 'Explicar metricas visibles' },
  },
  DEAL_SNAPSHOT: {
    capability: 'deal_snapshot',
    priority: 32,
    type: MAXXIS_ACTION_TYPES.INFORMATION,
    consumesOnExecution: true,
    confirmationRequired: false,
    requiredContext: ['structured_deal'],
    labels: { en: 'Current deal snapshot', pt: 'Snapshot atual do deal', es: 'Snapshot actual del deal' },
  },
  VIEW_PROVIDERS: {
    capability: 'provider_matches',
    priority: 92,
    type: MAXXIS_ACTION_TYPES.NAVIGATION,
    consumesOnExecution: false,
    confirmationRequired: false,
    requiredContext: ['service_needs_or_matches'],
    labels: { en: 'Show providers', pt: 'Mostrar providers', es: 'Mostrar providers' },
  },
  UNLOCK_PROVIDER_CONTACT: {
    capability: 'provider_contact_unlock',
    priority: 90,
    type: MAXXIS_ACTION_TYPES.NAVIGATION,
    consumesOnExecution: false,
    confirmationRequired: true,
    requiredContext: ['service_id', 'locked_contact'],
    labels: { en: 'Unlock contact', pt: 'Desbloquear contato', es: 'Desbloquear contacto' },
  },
  DRAFT_PROVIDER_MESSAGE: {
    capability: 'provider_message_draft',
    priority: 86,
    type: MAXXIS_ACTION_TYPES.NAVIGATION,
    consumesOnExecution: false,
    confirmationRequired: false,
    requiredContext: ['service_id', 'property_id', 'unlocked_contact'],
    labels: { en: 'Draft message', pt: 'Gerar draft', es: 'Crear borrador' },
  },
  REVIEW_PROVIDER_REPLY: {
    capability: 'provider_conversation_analysis',
    priority: 84,
    type: MAXXIS_ACTION_TYPES.NAVIGATION,
    consumesOnExecution: false,
    confirmationRequired: false,
    requiredContext: ['service_id', 'conversation'],
    labels: { en: 'Review reply', pt: 'Revisar resposta', es: 'Revisar respuesta' },
  },
  DRAFT_PROVIDER_REPLY: {
    capability: 'provider_reply_draft',
    priority: 82,
    type: MAXXIS_ACTION_TYPES.NAVIGATION,
    consumesOnExecution: false,
    confirmationRequired: false,
    requiredContext: ['service_id', 'property_id', 'conversation_analysis'],
    labels: { en: 'Draft response', pt: 'Gerar resposta', es: 'Crear respuesta' },
  },
  COMPARE_PROPERTIES: {
    capability: 'property_comparison',
    priority: 64,
    type: MAXXIS_ACTION_TYPES.COMPARISON,
    consumesOnExecution: true,
    confirmationRequired: false,
    requiredContext: ['comparison_set'],
    labels: { en: 'Compare', pt: 'Comparar', es: 'Comparar' },
  },
  REVIEW_WORKFLOW: {
    capability: 'deal_workflow',
    priority: 62,
    type: MAXXIS_ACTION_TYPES.NAVIGATION,
    consumesOnExecution: false,
    confirmationRequired: false,
    requiredContext: ['workflow'],
    labels: { en: 'Review workflow', pt: 'Revisar workflow', es: 'Revisar workflow' },
  },
  REVIEW_NEXT_STEP: {
    capability: 'next_best_action',
    priority: 72,
    type: MAXXIS_ACTION_TYPES.NAVIGATION,
    consumesOnExecution: false,
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

function stableStateVersion(source = {}) {
  const property = source?.property || source?.raw?.property || {};
  const metricSet = source?.metrics?.metrics || {};
  const parts = [
    property.id || property.propertyId || '',
    property.price ?? '',
    property.sqft ?? '',
    metricSet.pricePerSqft?.value ?? metricSet.pricePerSqft?.reason ?? '',
    metricSet.acquisitionPlusRehab?.value ?? metricSet.acquisitionPlusRehab?.reason ?? '',
    metricSet.capRate?.value ?? metricSet.capRate?.reason ?? '',
    asArray(source?.missingFields).join(','),
    asArray(source?.advisor?.missingInformation).join(','),
    asArray(source?.advisor?.attentionPoints).join(','),
  ].join('|');
  let hash = 0;
  for (let index = 0; index < parts.length; index += 1) {
    hash = ((hash * 31) + parts.charCodeAt(index)) >>> 0;
  }
  return `v${hash.toString(36)}`;
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
  const status = String(overrides.status || state || '').toUpperCase();
  const generatedFromStateVersion = String(overrides.generatedFromStateVersion || 'v0');
  const propertyId = String(overrides.propertyId || overrides.target?.propertyId || '').trim();
  return {
    id: [code, propertyId || 'global', generatedFromStateVersion].join(':'),
    code,
    type: overrides.type || catalog.type || MAXXIS_ACTION_TYPES.INFORMATION,
    capability: catalog.capability,
    state,
    status,
    priority: Number(overrides.priority ?? catalog.priority ?? 0),
    reason: String(overrides.reason || '').slice(0, 180),
    requiredContext: asArray(overrides.requiredContext || catalog.requiredContext),
    confirmationRequired: Boolean(overrides.confirmationRequired ?? catalog.confirmationRequired),
    consumesOnExecution: Boolean(overrides.consumesOnExecution ?? catalog.consumesOnExecution),
    generatedFromStateVersion,
    enabled: state === MAXXIS_SMART_ACTION_STATES.AVAILABLE,
    label,
    intent: String(overrides.intent || code).toLowerCase(),
    target: overrides.target || null,
    payload: overrides.payload || null,
  };
}

function makeDecisionAction(action = {}, propertyId = '') {
  const code = String(action.code || action.gapCode || '').trim();
  if (!code || !String(action.label || '').trim()) return null;
  const generatedFromStateVersion = String(action.generatedFromStateVersion || 'decision');
  const actionCode = `DECISION_${code}`;
  return {
    id: [actionCode, propertyId || 'global', generatedFromStateVersion].join(':'),
    code: actionCode,
    type: MAXXIS_ACTION_TYPES.INPUT_REQUIRED,
    capability: 'decision_gap_resolution',
    state: MAXXIS_SMART_ACTION_STATES.AVAILABLE,
    status: 'AVAILABLE',
    priority: action.criticality === 'CRITICAL' ? 110 : action.criticality === 'IMPORTANT' ? 100 : 80,
    reason: String(action.why || '').slice(0, 300),
    requiredContext: ['deal_decision_context'],
    confirmationRequired: false,
    consumesOnExecution: true,
    generatedFromStateVersion,
    enabled: true,
    label: String(action.label),
    intent: 'decision_gap_resolution',
    target: {
      propertyId,
      gapCode: String(action.gapCode || ''),
      inputField: String(action.inputField || ''),
      source: String(action.source || ''),
      unlocks: String(action.unlocks || ''),
      prompt: String(action.why || action.label || ''),
    },
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
  const generatedFromStateVersion = String(options.analysisStateVersion || stableStateVersion(source));
  const operational = isPropertyOperational(source);
  const completedActionCodes = new Set(asArray(options.completedActionCodes).map((code) => String(code)));
  const completedActionIds = new Set(asArray(options.completedActionIds).map((id) => String(id)));
  const isCompleted = (action) => completedActionCodes.has(action?.code) || completedActionIds.has(action?.id);
  const structured = source?.raw?.structuredAnalysis || sourceInput?.data?.structuredAnalysis
    || sourceInput?.structuredAnalysis || null;
  const decisionActions = asArray(structured?.decisionActions)
    .map((action) => makeDecisionAction(action, propertyId)).filter(Boolean);

  if (decisionActions.length && surface !== 'providers') {
    return orderActions(decisionActions.filter((action) => !isCompleted(action)), maxVisible);
  }

  if (gaps.length) {
    const primaryGap = [...gaps].sort((left, right) => {
      const rank = (gap) => String(gap.category || '') === 'DATA' ? 3 : String(gap.category || '') === 'DUE_DILIGENCE' ? 2 : 1;
      return rank(right) - rank(left);
    })[0];
    actions.push(makeAction('VIEW_DEAL_GAPS', 'available', {
      reason: primaryGap?.evidence || 'Deal gaps are available from loaded structured data.',
      propertyId,
      generatedFromStateVersion,
      target: { propertyId, gapCode: primaryGap?.code || '', source: primaryGap?.source || '' },
    }, language));
  }
  const importantInsight = insights.find((insight) => insight.actionable || insight.priority === 'high') || null;
  if (importantInsight) {
    actions.push(makeAction('EXPLAIN_INSIGHT', 'available', {
      reason: importantInsight.evidence,
      propertyId,
      generatedFromStateVersion,
      target: { propertyId, insightCode: importantInsight.code },
    }, language));
  }
  if (source?.metrics?.metrics) {
    actions.push(makeAction('EXPLAIN_METRICS', 'available', {
      reason: 'Visible deal metrics can be explained from loaded structured data.',
      propertyId,
      generatedFromStateVersion,
      target: { propertyId },
    }, language));
  }
  if (source?.comparison) {
    actions.push(makeAction('COMPARE_PROPERTIES', 'available', { reason: 'Comparison set is loaded.', propertyId, generatedFromStateVersion }, language));
  }
  if (asArray(source?.serviceNeeds).length || services.length) {
    actions.push(makeAction('VIEW_PROVIDERS', surface === 'providers' ? 'completed' : 'available', {
      reason: services.length ? 'Provider matches are loaded.' : 'Service needs are loaded.',
      propertyId,
      generatedFromStateVersion,
    }, language));
  }
  if (asArray(source?.workflow?.items).length) {
    actions.push(makeAction('REVIEW_WORKFLOW', 'available', { reason: 'Deal workflow is loaded.', propertyId, generatedFromStateVersion }, language));
  }
  if (source?.nextBestAction?.nextBestAction || source?.nextBestAction?.code) {
    actions.push(makeAction('REVIEW_NEXT_STEP', 'available', { reason: 'Next Best Action is loaded.', propertyId, generatedFromStateVersion }, language));
  }
  actions.push(makeAction('DEAL_SNAPSHOT', 'available', {
    reason: 'A concise one-shot deal snapshot can be shown.',
    propertyId,
    generatedFromStateVersion,
    target: { propertyId },
  }, language));

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

  return orderActions(actions.filter((action) => !isCompleted(action)), maxVisible);
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

function smartActionVisibilityKey(action = {}) {
  const target = action.target || {};
  return [
    String(action.capability || action.code || '').trim(),
    String(target.propertyId || '').trim(),
    String(target.serviceId || '').trim(),
    String(target.conversationId || '').trim(),
  ].join(':');
}

export function dedupeMaxxisSmartActionsByLatestMessage(entries = []) {
  const visibleByMessageId = {};
  const claimed = new Set();
  for (let index = asArray(entries).length - 1; index >= 0; index -= 1) {
    const entry = entries[index] || {};
    const messageId = String(entry.messageId || '').trim();
    if (!messageId) continue;
    visibleByMessageId[messageId] = Object.freeze(asArray(entry.actions).filter((action) => {
      const key = smartActionVisibilityKey(action);
      if (!key || claimed.has(key)) return false;
      claimed.add(key);
      return true;
    }));
  }
  return Object.freeze(visibleByMessageId);
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
