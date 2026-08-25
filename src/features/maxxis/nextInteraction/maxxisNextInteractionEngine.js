import {
  MAXXIS_NEXT_ACTION_TO_INTERACTION,
  MAXXIS_NEXT_INTERACTION_CONFIDENCE,
  MAXXIS_NEXT_INTERACTION_PRIORITY,
  MAXXIS_NEXT_INTERACTION_REASONS,
  MAXXIS_NEXT_INTERACTION_TYPES,
} from './maxxisNextInteractionRules';

const CLOSED_PROPERTY_STATES = new Set(['CLOSED', 'SOLD', 'ARCHIVED', 'INACTIVE', 'DELETED', 'UNAVAILABLE']);
const STALE_STATES = new Set(['STALE', 'EXPIRED', 'MISSING', 'UNAVAILABLE', 'REVIEWED', 'CONSUMED', 'DISMISSED']);
const PROVIDER_REPLY_CODES = new Set(['PROVIDER_REPLIED', 'PROVIDER_REPLY_DETECTED', 'NEW_PROVIDER_RESPONSE', 'CONVERSATION_CHANGED']);
const CHANGE_CODES = new Set(['DEAL_CONTEXT_UPDATED', 'WORKFLOW_ITEM_CHANGED', 'NEW_ACTION_AVAILABLE', 'PROVIDER_UNLOCKED']);
const GAP_CODES = new Set(['NEW_DEAL_GAP', 'IMPORTANT_MISSING_INFORMATION', 'DEAL_GAP_ADDED']);

const list = (value) => (Array.isArray(value) ? value : []);

function token(value, max = 80) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9:_-]+/g, '_').slice(0, max);
}

function technicalId(value) {
  const clean = String(value || '').trim();
  return /^[a-zA-Z0-9:_-]{1,120}$/.test(clean) ? clean : '';
}

function freshness(value) {
  return token(value || 'FRESH', 20);
}

function isFresh(value, now) {
  if (!value) return true;
  if (value.reviewed === true || value.consumed === true || value.dismissed === true || STALE_STATES.has(freshness(value.freshness || value.status))) return false;
  const expiresAt = Date.parse(String(value.expiresAt || ''));
  return !(Number.isFinite(expiresAt) && Number.isFinite(now) && expiresAt <= now);
}

function entityRef(value = {}) {
  const type = token(value.entityType || (value.serviceId ? 'SERVICE' : value.conversationId ? 'CONVERSATION' : value.propertyId ? 'PROPERTY' : ''), 30);
  const id = technicalId(value.entityId || value.serviceId || value.conversationId || value.propertyId || value.targetId);
  return type && id ? Object.freeze({ type, id }) : null;
}

function actionTarget(action = {}) {
  return entityRef({
    serviceId: action.target?.serviceId,
    propertyId: action.target?.propertyId,
    targetId: action.targetId,
  });
}

function normalizeAction(action) {
  if (!action?.code || action.enabled !== true || String(action.state || 'available').toLowerCase() !== 'available') return null;
  const code = token(action.code, 60);
  if (!MAXXIS_NEXT_ACTION_TO_INTERACTION[code]) return null;
  return Object.freeze({
    code,
    capability: token(action.capability || code, 80),
    semanticKey: token(action.semanticKey || `${action.capability || code}:${actionTarget(action)?.id || 'GLOBAL'}`, 140),
    confirmationRequired: action.confirmationRequired === true,
  });
}

function availableActions(input) {
  const actions = [...list(input.smartActions), ...(input.nextBestAction?.action ? [input.nextBestAction.action] : [])]
    .map(normalizeAction)
    .filter(Boolean);
  return new Map(actions.map((action) => [action.code, action]));
}

function supportingFacts(values) {
  return Object.freeze([...new Set(values.map((value) => token(value, 80)).filter(Boolean))].sort().slice(0, 6));
}

function candidate(type, reasonCode, priority, source, raw = {}, action = null, facts = []) {
  const ref = entityRef(raw) || actionTarget(raw.action || {});
  const semanticKey = token(raw.semanticKey || raw.dedupeKey || `${type}:${ref?.type || 'GLOBAL'}:${ref?.id || 'NONE'}`, 140);
  return Object.freeze({
    interactionType: type,
    reasonCode,
    priority,
    confidence: priority >= MAXXIS_NEXT_INTERACTION_PRIORITY.IMPORTANT_GAP
      ? MAXXIS_NEXT_INTERACTION_CONFIDENCE.HIGH
      : priority >= MAXXIS_NEXT_INTERACTION_PRIORITY.METRIC_EXPLANATION
        ? MAXXIS_NEXT_INTERACTION_CONFIDENCE.MEDIUM
        : MAXXIS_NEXT_INTERACTION_CONFIDENCE.LOW,
    source: token(source, 30),
    entityRef: ref,
    suggestedAction: action,
    supportingFacts: supportingFacts(facts),
    expiresAt: Number.isFinite(Date.parse(String(raw.expiresAt || ''))) ? new Date(raw.expiresAt).toISOString() : null,
    semanticKey,
  });
}

function passive(reasonCode = MAXXIS_NEXT_INTERACTION_REASONS.NO_ACTIONABLE_CHANGE) {
  return candidate(
    MAXXIS_NEXT_INTERACTION_TYPES.PASSIVE,
    reasonCode,
    MAXXIS_NEXT_INTERACTION_PRIORITY.PASSIVE,
    'PASSIVE',
  );
}

function attachContinuityEntity(interaction, continuity = {}) {
  if (!interaction || interaction.entityRef || interaction.interactionType === MAXXIS_NEXT_INTERACTION_TYPES.PASSIVE) return interaction;
  const ref = entityRef({
    serviceId: continuity.serviceId,
    conversationId: continuity.conversationRef,
    propertyId: continuity.propertyId,
  });
  return ref ? Object.freeze({ ...interaction, entityRef: ref }) : interaction;
}

function explicitInteraction(intent, actions) {
  const code = token(intent.code || intent.type, 60);
  let type = MAXXIS_NEXT_INTERACTION_TYPES.REVIEW_CHANGE;
  if (/MEMORY|WHERE_WERE_WE|WHAT_CHANGED|RESUME/.test(code)) type = MAXXIS_NEXT_INTERACTION_TYPES.RESUME_CONTEXT;
  else if (/PROVIDER_REPLY|CONVERSATION|REPLY/.test(code)) type = MAXXIS_NEXT_INTERACTION_TYPES.REVIEW_PROVIDER_REPLY;
  else if (/UNLOCK/.test(code)) type = MAXXIS_NEXT_INTERACTION_TYPES.REVIEW_UNLOCK;
  else if (/DRAFT|PREPARE|MESSAGE/.test(code)) type = MAXXIS_NEXT_INTERACTION_TYPES.PREPARE_MESSAGE;
  else if (/PROVIDER|SERVICE/.test(code)) type = MAXXIS_NEXT_INTERACTION_TYPES.REVIEW_PROVIDERS;
  else if (/WORKFLOW|NEXT_STEP/.test(code)) type = MAXXIS_NEXT_INTERACTION_TYPES.CONTINUE_WORKFLOW;
  else if (/COMPARE|COMPARISON/.test(code)) type = MAXXIS_NEXT_INTERACTION_TYPES.REVIEW_COMPARISON;
  else if (/METRIC|CAP_RATE|WHY|EXPLAIN/.test(code)) type = MAXXIS_NEXT_INTERACTION_TYPES.EXPLAIN_METRIC;
  else if (/GAP|MISSING/.test(code)) type = MAXXIS_NEXT_INTERACTION_TYPES.REVIEW_DEAL_GAP;
  const action = [...actions.values()].find((item) => MAXXIS_NEXT_ACTION_TO_INTERACTION[item.code] === type) || null;
  return candidate(type, MAXXIS_NEXT_INTERACTION_REASONS.USER_REQUESTED, MAXXIS_NEXT_INTERACTION_PRIORITY.EXPLICIT_INTENT, 'USER_INTENT', intent, action, [`INTENT_${code || 'CURRENT'}`]);
}

function primarySignal(input, now) {
  const signals = [input.proactiveSignal, ...list(input.proactiveSignals), ...list(input.changes), ...list(input.memoryChanges)].filter(Boolean);
  return signals.filter((signal) => isFresh(signal, now)).sort((left, right) => {
    const leftPriority = Number(left.priority || left.occurredAt || 0);
    const rightPriority = Number(right.priority || right.occurredAt || 0);
    return rightPriority - leftPriority || token(left.code).localeCompare(token(right.code));
  })[0] || null;
}

function workflowIsOpen(workflow = {}) {
  const state = token(workflow.status || workflow.state, 30);
  return workflow.open === true || workflow.pending === true || list(workflow.items).some((item) => !['COMPLETED', 'CLOSED', 'CANCELLED'].includes(token(item.status, 30))) || ['OPEN', 'ACTIVE', 'PENDING', 'IN_PROGRESS'].includes(state);
}

function dedupeAndSelect(candidates) {
  const byKey = new Map();
  candidates.forEach((item) => {
    const current = byKey.get(item.semanticKey);
    if (!current || item.priority > current.priority || (item.priority === current.priority && item.source < current.source)) byKey.set(item.semanticKey, item);
  });
  return [...byKey.values()].sort((left, right) => right.priority - left.priority || left.semanticKey.localeCompare(right.semanticKey))[0] || passive();
}

export function selectMaxxisNextInteraction(input = {}) {
  const now = Number(input.now);
  const actions = availableActions(input);
  const intent = input.explicitUserIntent || {};
  const requested = intent.requested === true || Boolean(intent.code || intent.type);
  const propertyStatus = token(input.currentState?.propertyStatus || input.contextSnapshot?.entity?.propertyStatus, 30);
  if (CLOSED_PROPERTY_STATES.has(propertyStatus) && !requested && !input.pendingConfirmation && !input.actionState?.phase) {
    return passive(MAXXIS_NEXT_INTERACTION_REASONS.PROPERTY_UNAVAILABLE);
  }
  if (requested) return attachContinuityEntity(explicitInteraction(intent, actions), input.continuityContext);

  const candidates = [];
  const actionPhase = token(input.actionState?.phase, 30);
  if (input.pendingConfirmation || actionPhase === 'CONFIRMATION') {
    candidates.push(candidate(
      MAXXIS_NEXT_INTERACTION_TYPES.REVIEW_PENDING_ACTION,
      MAXXIS_NEXT_INTERACTION_REASONS.PENDING_CONFIRMATION,
      MAXXIS_NEXT_INTERACTION_PRIORITY.PENDING_CONFIRMATION,
      'ACTION',
      input.actionState || {},
      null,
      [`ACTION_${token(input.actionState?.code || input.actionState?.actionCode || 'PENDING')}`],
    ));
  }

  const signal = primarySignal(input, now);
  const signalCode = token(signal?.code || signal?.signalCode, 60);
  if (signal && PROVIDER_REPLY_CODES.has(signalCode)) {
    candidates.push(candidate(MAXXIS_NEXT_INTERACTION_TYPES.REVIEW_PROVIDER_REPLY, MAXXIS_NEXT_INTERACTION_REASONS.NEW_PROVIDER_REPLY, MAXXIS_NEXT_INTERACTION_PRIORITY.PROVIDER_REPLY, 'CONVERSATION', signal, actions.get('REVIEW_PROVIDER_REPLY') || null, [signalCode]));
  } else if (signalCode === 'PENDING_ACTION_EXPIRING') {
    candidates.push(candidate(MAXXIS_NEXT_INTERACTION_TYPES.REVIEW_PENDING_ACTION, MAXXIS_NEXT_INTERACTION_REASONS.PENDING_ACTION_EXPIRING, MAXXIS_NEXT_INTERACTION_PRIORITY.EXPIRING_ACTION, 'PROACTIVE', signal, null, [signalCode]));
  } else if (signal && GAP_CODES.has(signalCode)) {
    const providerHelp = actions.get('VIEW_PROVIDERS') || null;
    candidates.push(candidate(providerHelp ? MAXXIS_NEXT_INTERACTION_TYPES.REVIEW_PROVIDERS : MAXXIS_NEXT_INTERACTION_TYPES.REVIEW_DEAL_GAP, MAXXIS_NEXT_INTERACTION_REASONS.IMPORTANT_GAP, MAXXIS_NEXT_INTERACTION_PRIORITY.IMPORTANT_GAP, 'CHANGE', signal, providerHelp || actions.get('VIEW_DEAL_GAPS') || null, [signalCode]));
  } else if (signal && CHANGE_CODES.has(signalCode)) {
    candidates.push(candidate(MAXXIS_NEXT_INTERACTION_TYPES.REVIEW_CHANGE, MAXXIS_NEXT_INTERACTION_REASONS.MEANINGFUL_CHANGE, MAXXIS_NEXT_INTERACTION_PRIORITY.MEANINGFUL_CHANGE, 'CHANGE', signal, null, [signalCode]));
  }

  if (isFresh(input.conversationState, now) && (input.conversationState?.replied === true || PROVIDER_REPLY_CODES.has(token(input.conversationState?.status || input.conversationState?.code)))) {
    candidates.push(candidate(MAXXIS_NEXT_INTERACTION_TYPES.REVIEW_PROVIDER_REPLY, MAXXIS_NEXT_INTERACTION_REASONS.NEW_PROVIDER_REPLY, MAXXIS_NEXT_INTERACTION_PRIORITY.PROVIDER_REPLY, 'CONVERSATION', input.conversationState, actions.get('REVIEW_PROVIDER_REPLY') || null, ['PROVIDER_REPLIED']));
  }

  const gaps = list(input.dealGaps).filter((gap) => isFresh(gap, now));
  if (gaps.length) {
    const gap = gaps.slice().sort((left, right) => Number(right.priority || 0) - Number(left.priority || 0) || token(left.code).localeCompare(token(right.code)))[0];
    const providerHelp = actions.get('VIEW_PROVIDERS') || null;
    candidates.push(candidate(providerHelp ? MAXXIS_NEXT_INTERACTION_TYPES.REVIEW_PROVIDERS : MAXXIS_NEXT_INTERACTION_TYPES.REVIEW_DEAL_GAP, MAXXIS_NEXT_INTERACTION_REASONS.IMPORTANT_GAP, MAXXIS_NEXT_INTERACTION_PRIORITY.IMPORTANT_GAP, 'CURRENT', gap, providerHelp || actions.get('VIEW_DEAL_GAPS') || null, [gap.code || 'DEAL_GAP']));
  }

  if (isFresh(input.workflowState, now) && workflowIsOpen(input.workflowState) && actions.has('REVIEW_WORKFLOW')) {
    candidates.push(candidate(MAXXIS_NEXT_INTERACTION_TYPES.CONTINUE_WORKFLOW, MAXXIS_NEXT_INTERACTION_REASONS.WORKFLOW_OPEN, MAXXIS_NEXT_INTERACTION_PRIORITY.WORKFLOW, 'CURRENT', input.workflowState, actions.get('REVIEW_WORKFLOW'), ['WORKFLOW_OPEN']));
  }
  if (actions.has('VIEW_PROVIDERS')) {
    candidates.push(candidate(MAXXIS_NEXT_INTERACTION_TYPES.REVIEW_PROVIDERS, MAXXIS_NEXT_INTERACTION_REASONS.PROVIDER_HELP_AVAILABLE, MAXXIS_NEXT_INTERACTION_PRIORITY.PROVIDER_HELP, 'CURRENT', input.contextSnapshot?.entity || {}, actions.get('VIEW_PROVIDERS'), ['PROVIDER_HELP_ELIGIBLE']));
  }
  if (input.metric && isFresh(input.metric, now) && actions.has('EXPLAIN_INSIGHT')) {
    candidates.push(candidate(MAXXIS_NEXT_INTERACTION_TYPES.EXPLAIN_METRIC, MAXXIS_NEXT_INTERACTION_REASONS.METRIC_EXPLANATION_AVAILABLE, MAXXIS_NEXT_INTERACTION_PRIORITY.METRIC_EXPLANATION, 'CURRENT', input.metric, actions.get('EXPLAIN_INSIGHT'), ['METRIC_AVAILABLE']));
  }
  const memory = input.memoryRecall || input.memory;
  if (memory && isFresh(memory, now) && !['STALE', 'EXPIRED'].includes(freshness(input.memoryFreshness || memory.freshness))) {
    candidates.push(candidate(MAXXIS_NEXT_INTERACTION_TYPES.RESUME_CONTEXT, MAXXIS_NEXT_INTERACTION_REASONS.MEMORY_CONTINUATION, MAXXIS_NEXT_INTERACTION_PRIORITY.MEMORY, 'MEMORY', memory, actions.get('REVIEW_NEXT_STEP') || null, ['MEMORY_AVAILABLE']));
  }
  return attachContinuityEntity(dedupeAndSelect(candidates), input.continuityContext);
}
