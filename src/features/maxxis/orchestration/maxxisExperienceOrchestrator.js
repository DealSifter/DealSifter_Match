import { MAXXIS_AVATAR_STATES } from '../avatar/maxxisAvatarStates';
import { selectMaxxisNextInteraction } from '../nextInteraction/maxxisNextInteractionEngine';
import { MAXXIS_NEXT_INTERACTION_TYPES } from '../nextInteraction/maxxisNextInteractionRules';
import {
  MAXXIS_EXPERIENCE_ACTION_PHASES,
  MAXXIS_EXPERIENCE_ATTENTION,
  MAXXIS_EXPERIENCE_CONTENT,
  MAXXIS_EXPERIENCE_LIMITS,
  MAXXIS_EXPERIENCE_MODES,
  MAXXIS_EXPERIENCE_REASONS,
} from './maxxisExperienceTypes';

const CLOSED_PROPERTY_STATES = new Set(['CLOSED', 'SOLD', 'ARCHIVED', 'INACTIVE', 'DELETED', 'UNAVAILABLE']);
const EXPIRED_FRESHNESS = new Set(['EXPIRED', 'MISSING', 'UNAVAILABLE']);
const MESSAGING_ACTION = /(DRAFT_PROVIDER|SEND_PROVIDER|PROVIDER_MESSAGE)/;
const PROVIDER_REPLY_CODES = new Set(['PROVIDER_REPLIED', 'CONVERSATION_CHANGED', 'NEW_PROVIDER_RESPONSE']);

function token(value, max = 100) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9:_-]+/g, '_').slice(0, max);
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function technicalId(value) {
  const clean = String(value || '').trim();
  return /^[a-zA-Z0-9:_-]{1,120}$/.test(clean) ? clean : '';
}

function contentType(value) {
  const clean = token(value, 60);
  if (PROVIDER_REPLY_CODES.has(clean)) return MAXXIS_EXPERIENCE_CONTENT.PROVIDER_REPLY;
  if (clean === 'PROVIDER_QUOTE_DETECTED') return MAXXIS_EXPERIENCE_CONTENT.PROVIDER_QUOTE;
  return MAXXIS_EXPERIENCE_CONTENT[clean] || clean;
}

function semanticFact(type, candidate = {}) {
  const code = token(candidate.code || candidate.signalCode || type, 60);
  const canonicalCode = PROVIDER_REPLY_CODES.has(code) ? 'PROVIDER_REPLIED' : code;
  const entityId = technicalId(candidate.serviceId || candidate.conversationId || candidate.propertyId || candidate.entityId || candidate.targetId);
  return token(candidate.semanticKey, 140) || `${canonicalCode || type}:${entityId || 'GLOBAL'}`;
}

function normalizeContent(candidate, fallbackType = '') {
  if (!candidate) return null;
  const raw = candidate === true ? {} : candidate;
  const type = contentType(raw.type || raw.contentType || raw.code || fallbackType);
  if (!type) return null;
  const source = token(raw.source || 'CURRENT', 30);
  const freshness = token(raw.freshness || 'FRESH', 20);
  return Object.freeze({
    type,
    semanticKey: semanticFact(type, raw),
    source,
    freshness,
    priority: Number(raw.priority || 0),
    requiredCapability: token(raw.requiredCapability || raw.capability, 60),
    value: raw.value ?? raw.data ?? raw,
  });
}

function derivedContents(input) {
  const contents = list(input.contents).map((item) => normalizeContent(item)).filter(Boolean);
  const append = (value, type, extra = {}) => {
    if (!value) return;
    contents.push(normalizeContent({ ...extra, ...(value === true ? {} : value), type }, type));
  };
  append(input.dealSnapshot, 'DEAL_SNAPSHOT', { source: 'CURRENT', priority: 80, requiredCapability: 'DEAL_INTELLIGENCE' });
  list(input.dealGaps).forEach((gap) => append(gap, 'DEAL_GAP', { source: 'CURRENT', priority: 60, requiredCapability: 'DEAL_GAPS' }));
  append(input.metric, 'METRIC', { source: 'CURRENT', priority: 90, requiredCapability: 'DEAL_METRICS' });
  append(input.nextBestAction, 'NEXT_BEST_ACTION', { source: 'CURRENT', priority: 55, requiredCapability: 'NEXT_BEST_ACTION' });
  append(input.memoryRecall, 'MEMORY_RECALL', { source: 'MEMORY', priority: 70, requiredCapability: 'MEMORY' });
  list(input.memoryChanges).forEach((change) => append(change, 'MEMORY_CHANGE', { source: 'MEMORY', priority: 58, requiredCapability: 'MEMORY' }));
  append(input.conversationState, 'PROVIDER_REPLY', { source: 'CONVERSATION', priority: 92, requiredCapability: 'PROVIDER_CONVERSATION' });
  append(input.workflowState, 'WORKFLOW', { source: 'CURRENT', priority: 65, requiredCapability: 'WORKFLOW' });
  append(input.comparison, 'COMPARISON', { source: 'CURRENT', priority: 85, requiredCapability: 'COMPARISON' });
  if (input.proactiveSignal) {
    append(input.proactiveSignal, input.proactiveSignal.code, {
      source: 'PROACTIVE',
      priority: Number(input.attentionResult?.priority || 75),
    });
  }
  if (input.actionState?.phase) {
    const phase = token(input.actionState.phase);
    const actionContentType = phase === MAXXIS_EXPERIENCE_ACTION_PHASES.CONFIRMATION
      ? MAXXIS_EXPERIENCE_CONTENT.ACTION_CONFIRMATION
      : [MAXXIS_EXPERIENCE_ACTION_PHASES.SUCCESS, MAXXIS_EXPERIENCE_ACTION_PHASES.FAILURE].includes(phase)
        ? MAXXIS_EXPERIENCE_CONTENT.ACTION_RESULT
        : MAXXIS_EXPERIENCE_CONTENT.ACTION_PREPARATION;
    append(input.actionState, actionContentType, {
      source: 'CURRENT',
      priority: 100,
      semanticKey: `ACTION:${token(input.actionState.code || input.actionState.actionCode || 'CURRENT')}`,
    });
  }
  if (input.nextInteraction?.interactionType === MAXXIS_NEXT_INTERACTION_TYPES.REVIEW_PROVIDERS) {
    append(input.nextInteraction, 'NEXT_BEST_ACTION', {
      source: 'CURRENT',
      priority: Number(input.nextInteraction.priority || 50),
      requiredCapability: input.nextInteraction.suggestedAction?.capability || 'PROVIDER_MATCHES',
      semanticKey: input.nextInteraction.semanticKey,
    });
  }
  return contents.filter(Boolean);
}

function sourceRank(source) {
  return { CURRENT: 5, CONVERSATION: 4, PROACTIVE: 3, MEMORY: 1 }[source] || 2;
}

function dedupeContents(contents) {
  const byKey = new Map();
  contents.forEach((candidate) => {
    const current = byKey.get(candidate.semanticKey);
    if (!current || sourceRank(candidate.source) > sourceRank(current.source)
      || (sourceRank(candidate.source) === sourceRank(current.source) && candidate.priority > current.priority)) {
      byKey.set(candidate.semanticKey, candidate);
    }
  });
  return [...byKey.values()].sort((left, right) => right.priority - left.priority || left.semanticKey.localeCompare(right.semanticKey));
}

function normalizeAction(action) {
  if (!action?.code || action.enabled === false || ['blocked', 'unavailable', 'completed'].includes(String(action.state || '').toLowerCase())) return null;
  const code = token(action.code, 60);
  const targetId = technicalId(action.target?.serviceId || action.target?.propertyId || action.targetId);
  return Object.freeze({
    ...action,
    code,
    semanticKey: token(action.semanticKey, 140) || `${token(action.capability || code, 70)}:${targetId || 'GLOBAL'}`,
    priority: Number(action.priority || 0),
  });
}

function selectActions(input, mode) {
  if ([MAXXIS_EXPERIENCE_MODES.PASSIVE, MAXXIS_EXPERIENCE_MODES.ACTION_CONFIRMATION].includes(mode)) return [];
  const switches = input.killSwitches || {};
  const preferredCode = token(input.nextInteraction?.suggestedAction?.code, 60);
  const seen = new Set();
  return [...list(input.smartActions), ...(input.nextBestAction?.action ? [input.nextBestAction.action] : [])]
    .map(normalizeAction)
    .filter(Boolean)
    .filter((action) => switches.messagingEnabled !== false || !MESSAGING_ACTION.test(action.code))
    .filter((action) => switches.contactUnlockEnabled !== false || action.code !== 'UNLOCK_PROVIDER_CONTACT')
    .filter((action) => {
      if (seen.has(action.semanticKey)) return false;
      seen.add(action.semanticKey);
      return true;
    })
    .sort((left, right) => Number(right.code === preferredCode) - Number(left.code === preferredCode)
      || right.priority - left.priority || left.code.localeCompare(right.code))
    .slice(0, 1 + MAXXIS_EXPERIENCE_LIMITS.SECONDARY_ACTIONS);
}

function explicitMode(intent = {}) {
  const code = token(intent.code || intent.type, 60);
  if (/MEMORY|WHERE_WERE_WE|WHAT_CHANGED/.test(code)) return MAXXIS_EXPERIENCE_MODES.MEMORY_RECALL;
  if (/PROVIDER|REPLY|CONVERSATION/.test(code)) return MAXXIS_EXPERIENCE_MODES.PROVIDER_REVIEW;
  if (/WORKFLOW/.test(code)) return MAXXIS_EXPERIENCE_MODES.WORKFLOW_REVIEW;
  if (/COMPARE|COMPARISON/.test(code)) return MAXXIS_EXPERIENCE_MODES.COMPARISON;
  if (/STATUS|ANALYSIS|METRIC|CAP_RATE|DEAL_GAP|SNAPSHOT/.test(code)) return MAXXIS_EXPERIENCE_MODES.ANALYSIS;
  return MAXXIS_EXPERIENCE_MODES.CONTEXTUAL;
}

function nextInteractionMode(nextInteraction = {}, input = {}) {
  const type = token(nextInteraction.interactionType, 60);
  if (type === MAXXIS_NEXT_INTERACTION_TYPES.REVIEW_PROVIDER_REPLY) {
    return input.maxxisOpen ? MAXXIS_EXPERIENCE_MODES.PROVIDER_REVIEW : MAXXIS_EXPERIENCE_MODES.CHANGE_REVIEW;
  }
  if ([MAXXIS_NEXT_INTERACTION_TYPES.REVIEW_CHANGE, MAXXIS_NEXT_INTERACTION_TYPES.REVIEW_DEAL_GAP].includes(type)) return MAXXIS_EXPERIENCE_MODES.CHANGE_REVIEW;
  if (type === MAXXIS_NEXT_INTERACTION_TYPES.REVIEW_PENDING_ACTION) return MAXXIS_EXPERIENCE_MODES.ACTION_CONFIRMATION;
  if (type === MAXXIS_NEXT_INTERACTION_TYPES.CONTINUE_WORKFLOW) return MAXXIS_EXPERIENCE_MODES.WORKFLOW_REVIEW;
  if ([MAXXIS_NEXT_INTERACTION_TYPES.REVIEW_PROVIDERS, MAXXIS_NEXT_INTERACTION_TYPES.EXPLAIN_METRIC, MAXXIS_NEXT_INTERACTION_TYPES.REVIEW_UNLOCK].includes(type)) return MAXXIS_EXPERIENCE_MODES.ANALYSIS;
  if (type === MAXXIS_NEXT_INTERACTION_TYPES.PREPARE_MESSAGE) return MAXXIS_EXPERIENCE_MODES.ACTION_PREPARATION;
  if (type === MAXXIS_NEXT_INTERACTION_TYPES.RESUME_CONTEXT) return MAXXIS_EXPERIENCE_MODES.MEMORY_RECALL;
  if (type === MAXXIS_NEXT_INTERACTION_TYPES.REVIEW_COMPARISON) return MAXXIS_EXPERIENCE_MODES.COMPARISON;
  return MAXXIS_EXPERIENCE_MODES.PASSIVE;
}

function decisionMode(input, contents) {
  const phase = token(input.actionState?.phase, 30);
  if (phase === MAXXIS_EXPERIENCE_ACTION_PHASES.CONFIRMATION || input.pendingConfirmation) {
    return [MAXXIS_EXPERIENCE_MODES.ACTION_CONFIRMATION, MAXXIS_EXPERIENCE_REASONS.ACTION_CONFIRMATION];
  }
  if ([MAXXIS_EXPERIENCE_ACTION_PHASES.PREPARATION, MAXXIS_EXPERIENCE_ACTION_PHASES.PROCESSING].includes(phase)) {
    return [MAXXIS_EXPERIENCE_MODES.ACTION_PREPARATION, MAXXIS_EXPERIENCE_REASONS.ACTION_PREPARATION];
  }
  if ([MAXXIS_EXPERIENCE_ACTION_PHASES.SUCCESS, MAXXIS_EXPERIENCE_ACTION_PHASES.FAILURE].includes(phase)) {
    return [MAXXIS_EXPERIENCE_MODES.ACTION_RESULT, MAXXIS_EXPERIENCE_REASONS.ACTION_RESULT];
  }
  const intent = input.explicitUserIntent || {};
  if (intent.requested || intent.code || intent.type) {
    const mode = explicitMode(intent);
    return [mode, mode === MAXXIS_EXPERIENCE_MODES.MEMORY_RECALL
      ? MAXXIS_EXPERIENCE_REASONS.MEMORY_REQUESTED
      : MAXXIS_EXPERIENCE_REASONS.EXPLICIT_USER_INTENT];
  }
  if (input.nextInteraction?.interactionType && input.nextInteraction.interactionType !== MAXXIS_NEXT_INTERACTION_TYPES.PASSIVE) {
    return [nextInteractionMode(input.nextInteraction, input), MAXXIS_EXPERIENCE_REASONS.NEXT_INTERACTION_SELECTED];
  }
  if (input.proactiveSignal && input.attentionResult?.shouldSurface !== false) {
    const provider = /PROVIDER_(REPLIED|QUOTE)/.test(token(input.proactiveSignal.code));
    return [input.maxxisOpen && provider ? MAXXIS_EXPERIENCE_MODES.PROVIDER_REVIEW : MAXXIS_EXPERIENCE_MODES.CHANGE_REVIEW, MAXXIS_EXPERIENCE_REASONS.RELEVANT_CHANGE];
  }
  if (input.memoryRecall?.requested) return [MAXXIS_EXPERIENCE_MODES.MEMORY_RECALL, MAXXIS_EXPERIENCE_REASONS.MEMORY_REQUESTED];
  if (contents.some((item) => item.type === MAXXIS_EXPERIENCE_CONTENT.CONTEXT && item.value?.requested)) {
    return [MAXXIS_EXPERIENCE_MODES.CONTEXTUAL, MAXXIS_EXPERIENCE_REASONS.CONTEXT_AVAILABLE];
  }
  return [MAXXIS_EXPERIENCE_MODES.PASSIVE, MAXXIS_EXPERIENCE_REASONS.NO_TRUSTED_CONTENT];
}

function modeContentTypes(mode, intent = {}) {
  const requestedType = contentType(intent.contentType || intent.focus);
  if (requestedType) return [requestedType];
  return {
    ANALYSIS: ['DEAL_SNAPSHOT', 'METRIC', 'DEAL_GAP', 'NEXT_BEST_ACTION'],
    CHANGE_REVIEW: ['PROVIDER_REPLY', 'PROVIDER_QUOTE', 'MEMORY_CHANGE', 'DEAL_GAP', 'WORKFLOW'],
    PROVIDER_REVIEW: ['PROVIDER_REPLY', 'PROVIDER_QUOTE'],
    MEMORY_RECALL: ['MEMORY_RECALL', 'MEMORY_CHANGE', 'NEXT_BEST_ACTION'],
    WORKFLOW_REVIEW: ['WORKFLOW', 'NEXT_BEST_ACTION'],
    COMPARISON: ['COMPARISON'],
    ACTION_PREPARATION: ['ACTION_PREPARATION'],
    ACTION_CONFIRMATION: ['ACTION_CONFIRMATION'],
    ACTION_RESULT: ['ACTION_RESULT'],
    CONTEXTUAL: ['CONTEXT'],
  }[mode] || [];
}

function chooseContents(contents, mode, intent) {
  if (mode === MAXXIS_EXPERIENCE_MODES.PASSIVE) return [];
  const allowed = modeContentTypes(mode, intent);
  const ranked = contents
    .filter((item) => allowed.includes(item.type))
    .sort((left, right) => allowed.indexOf(left.type) - allowed.indexOf(right.type) || right.priority - left.priority);
  const primary = ranked.find((item) => item.freshness !== 'STALE' && !EXPIRED_FRESHNESS.has(item.freshness)) || null;
  const secondary = ranked
    .filter((item) => item !== primary && !EXPIRED_FRESHNESS.has(item.freshness))
    .slice(0, MAXXIS_EXPERIENCE_LIMITS.SECONDARY_CONTENT);
  return primary ? [primary, ...secondary] : [];
}

function attentionMode(input, mode) {
  if (mode === MAXXIS_EXPERIENCE_MODES.PASSIVE) return MAXXIS_EXPERIENCE_ATTENTION.NONE;
  if (input.maxxisOpen) return MAXXIS_EXPERIENCE_ATTENTION.IN_CHAT;
  if (mode === MAXXIS_EXPERIENCE_MODES.CHANGE_REVIEW
    && input.preferences?.proactiveEnabled !== false
    && input.attentionResult?.allowBubble !== false
    && input.attentionResult?.shouldSurface !== false) return MAXXIS_EXPERIENCE_ATTENTION.BUBBLE;
  return MAXXIS_EXPERIENCE_ATTENTION.NONE;
}

function avatarHint(mode) {
  if (mode === MAXXIS_EXPERIENCE_MODES.ACTION_CONFIRMATION) return MAXXIS_AVATAR_STATES.WAITING;
  if (mode === MAXXIS_EXPERIENCE_MODES.ACTION_PREPARATION) return MAXXIS_AVATAR_STATES.PROCESSING;
  if (mode === MAXXIS_EXPERIENCE_MODES.ACTION_RESULT) return MAXXIS_AVATAR_STATES.SUCCESS;
  if (mode === MAXXIS_EXPERIENCE_MODES.CHANGE_REVIEW) return MAXXIS_AVATAR_STATES.NOTICED;
  return MAXXIS_AVATAR_STATES.OBSERVING;
}

export function orchestrateMaxxisExperience(input = {}) {
  let nextInteraction = input.nextInteraction || null;
  if (!nextInteraction) {
    try {
      nextInteraction = selectMaxxisNextInteraction(input);
    } catch {
      nextInteraction = null;
    }
  }
  input = nextInteraction ? { ...input, nextInteraction } : input;
  const enabled = input.maxxisEnabled !== false && input.featureFlags?.maxxisEnabled !== false;
  if (!enabled) {
    return Object.freeze({
      mode: MAXXIS_EXPERIENCE_MODES.PASSIVE,
      primaryContent: null,
      secondaryContent: Object.freeze([]),
      primaryAction: null,
      secondaryActions: Object.freeze([]),
      attentionMode: MAXXIS_EXPERIENCE_ATTENTION.NONE,
      avatarStateHint: MAXXIS_AVATAR_STATES.IDLE,
      requiredCapabilities: Object.freeze([]),
      reasonCode: MAXXIS_EXPERIENCE_REASONS.DISABLED_SAFE,
      nextInteraction,
    });
  }
  const status = token(input.currentState?.propertyStatus || input.contextSnapshot?.entity?.propertyStatus, 30);
  const contents = dedupeContents(derivedContents(input));
  let [mode, reasonCode] = decisionMode(input, contents);
  if (CLOSED_PROPERTY_STATES.has(status) && !input.explicitUserIntent?.requested && !input.actionState?.phase) {
    mode = MAXXIS_EXPERIENCE_MODES.PASSIVE;
    reasonCode = MAXXIS_EXPERIENCE_REASONS.NO_TRUSTED_CONTENT;
  }
  let selectedContents = chooseContents(contents, mode, input.explicitUserIntent || {});
  if (mode === MAXXIS_EXPERIENCE_MODES.MEMORY_RECALL && !selectedContents.length) {
    const currentFallback = contents.filter((item) => item.source !== 'MEMORY');
    const fallbackContents = chooseContents(currentFallback, MAXXIS_EXPERIENCE_MODES.ANALYSIS, {});
    if (fallbackContents.length) {
      mode = MAXXIS_EXPERIENCE_MODES.ANALYSIS;
      reasonCode = MAXXIS_EXPERIENCE_REASONS.CONTEXT_AVAILABLE;
      selectedContents = fallbackContents;
    }
  }
  if (mode !== MAXXIS_EXPERIENCE_MODES.PASSIVE && !selectedContents.length
    && ![MAXXIS_EXPERIENCE_MODES.ACTION_CONFIRMATION, MAXXIS_EXPERIENCE_MODES.ACTION_PREPARATION, MAXXIS_EXPERIENCE_MODES.ACTION_RESULT].includes(mode)) {
    mode = MAXXIS_EXPERIENCE_MODES.PASSIVE;
    reasonCode = MAXXIS_EXPERIENCE_REASONS.NO_TRUSTED_CONTENT;
  }
  const actions = selectActions(input, mode);
  const capabilities = [...new Set([
    ...selectedContents.map((item) => item.requiredCapability),
    ...actions.flatMap((action) => list(action.requiredContext).map((item) => token(item, 60))),
  ].filter(Boolean))].sort();
  return Object.freeze({
    mode,
    primaryContent: selectedContents[0] || null,
    secondaryContent: Object.freeze(selectedContents.slice(1, 1 + MAXXIS_EXPERIENCE_LIMITS.SECONDARY_CONTENT)),
    primaryAction: actions[0] || null,
    secondaryActions: Object.freeze(actions.slice(1, 1 + MAXXIS_EXPERIENCE_LIMITS.SECONDARY_ACTIONS)),
    attentionMode: attentionMode(input, mode),
    avatarStateHint: avatarHint(mode),
    requiredCapabilities: Object.freeze(capabilities),
    reasonCode,
    nextInteraction,
  });
}

export function safeMaxxisExperienceAnalytics(decision = {}, durationMs = 0) {
  return Object.freeze({
    experience_mode: token(decision.mode, 40),
    primary_content_type: token(decision.primaryContent?.type, 60),
    primary_action_code: token(decision.primaryAction?.code, 60),
    decision_reason: token(decision.reasonCode, 60),
    decision_duration_ms: Math.max(0, Math.round(Number(durationMs) || 0)),
  });
}
