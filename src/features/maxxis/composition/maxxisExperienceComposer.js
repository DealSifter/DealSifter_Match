import { MAXXIS_EXPERIENCE_MODES } from '../orchestration/maxxisExperienceTypes';
import { getMaxxisExperienceCopy, MAXXIS_COMPOSITION_DENSITIES } from './maxxisExperienceTemplates';

const KNOWN_MODES = new Set(Object.values(MAXXIS_EXPERIENCE_MODES));
const BLOCKED_KEYS = /email|phone|telephone|whatsapp|contact|address|messagebody|draft|token/i;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE = /(?:\+?\d[\d ().-]{7,}\d)/g;
const TAG_RE = /<[^>]*>/g;
const URL_RE = /\b(?:https?:\/\/|www\.)\S+/gi;

export const MAXXIS_COMPOSITION_LIMITS = Object.freeze({
  EVIDENCE: 3,
  STATUS_ITEMS: 3,
  SECONDARY_ACTIONS: 2,
  FOLLOW_UPS: 3,
});

function list(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value, max = 240) {
  const printable = [...String(value ?? '')].map((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? ' ' : character;
  }).join('');
  const clean = printable
    .replace(TAG_RE, ' ')
    .replace(EMAIL_RE, '[protected]')
    .replace(PHONE_RE, '[protected]')
    .replace(URL_RE, '[protected]')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean.length <= max) return clean;
  const sentences = clean.match(/[^.!?]+[.!?]?/g) || [];
  const semantic = sentences.reduce((result, sentence) => {
    const candidate = `${result} ${sentence.trim()}`.trim();
    return candidate.length <= max ? candidate : result;
  }, '');
  return semantic;
}

function humanizeCodeLabel(value) {
  const clean = cleanText(value, 160);
  if (/^[A-Z0-9]{2,5}$/.test(clean)) return clean;
  return /^[A-Z0-9_:-]+$/.test(clean)
    ? clean.toLowerCase().replace(/[_:-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
    : clean;
}

function safeLabel(item) {
  if (typeof item === 'string') return humanizeCodeLabel(item);
  if (!item || typeof item !== 'object') return '';
  const label = item.label || item.title || item.code || item.reason || '';
  return humanizeCodeLabel(label);
}

function uniqueLabels(items, max) {
  const seen = new Set();
  return list(items).map(safeLabel).filter(Boolean).filter((label) => {
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, max);
}

function safeObject(source = {}) {
  return Object.entries(source || {}).reduce((result, [key, value]) => {
    if (!BLOCKED_KEYS.test(key)) result[key] = value;
    return result;
  }, {});
}

function normalizeFacts(raw = {}) {
  const facts = safeObject(raw);
  const property = safeObject(facts.property || {});
  const provider = safeObject(facts.provider || {});
  const action = safeObject(facts.action || {});
  return Object.freeze({
    property: Object.freeze({
      type: cleanText(property.type || property.propertyType, 60),
      city: cleanText(property.city, 60),
      state: cleanText(property.state, 30),
      beds: Number.isFinite(Number(property.beds ?? property.bedrooms)) ? Number(property.beds ?? property.bedrooms) : null,
      price: Number.isFinite(Number(property.price)) ? Number(property.price) : null,
    }),
    missingItems: Object.freeze(uniqueLabels(facts.missingItems, MAXXIS_COMPOSITION_LIMITS.STATUS_ITEMS)),
    evidence: Object.freeze(uniqueLabels(facts.evidence, MAXXIS_COMPOSITION_LIMITS.EVIDENCE)),
    statusItems: Object.freeze(uniqueLabels(facts.statusItems, MAXXIS_COMPOSITION_LIMITS.STATUS_ITEMS)),
    changes: Object.freeze(uniqueLabels(facts.changes, MAXXIS_COMPOSITION_LIMITS.STATUS_ITEMS)),
    openItems: Object.freeze(uniqueLabels(facts.openItems, MAXXIS_COMPOSITION_LIMITS.STATUS_ITEMS)),
    provider: Object.freeze({
      replied: provider.replied === true || String(provider.status || '').toUpperCase() === 'REPLY_RECEIVED',
      locked: provider.locked !== false && String(provider.accessStatus || '').toUpperCase() !== 'UNLOCKED',
      serviceFit: cleanText(provider.serviceFit, 120),
    }),
    action: Object.freeze({
      code: cleanText(action.code || action.actionCode, 60).toUpperCase(),
      status: cleanText(action.status, 40).toUpperCase(),
      nuggetCost: Number.isFinite(Number(action.nuggetCost)) && Number(action.nuggetCost) >= 0 ? Number(action.nuggetCost) : null,
    }),
    metric: Object.freeze({
      question: cleanText(facts.metric?.question, 100),
      value: cleanText(facts.metric?.value, 80),
      explanation: cleanText(facts.metric?.explanation, 180),
    }),
    comparison: Object.freeze(uniqueLabels(facts.comparison, MAXXIS_COMPOSITION_LIMITS.EVIDENCE)),
    requestedDetail: facts.requestedDetail === true,
  });
}

function propertySummary(property, language) {
  const parts = [];
  if (property.beds !== null) parts.push(language === 'pt' ? `${property.beds} quartos` : language === 'es' ? `${property.beds} habitaciones` : `${property.beds}-bed`);
  if (property.type) parts.push(property.type);
  const place = [property.city, property.state].filter(Boolean).join(', ');
  if (place) parts.push(place);
  if (!parts.length) return '';
  if (language === 'pt') return `Voce esta analisando ${parts.join(' em ')}.`;
  if (language === 'es') return `Estas analizando ${parts.join(' en ')}.`;
  return `You are reviewing ${parts.join(' in ')}.`;
}

function buildNarrative(mode, facts, copy, language) {
  const missingCount = facts.missingItems.length;
  const openCount = facts.openItems.length;
  const actionCode = facts.action.code;
  if (mode === MAXXIS_EXPERIENCE_MODES.CONTEXTUAL) return [propertySummary(facts.property, language) || copy.context];
  if (mode === MAXXIS_EXPERIENCE_MODES.ANALYSIS) {
    if (facts.metric.question || facts.metric.explanation) return [facts.metric.explanation || facts.metric.value || copy.metric];
    return [propertySummary(facts.property, language), missingCount ? copy.missing(missingCount) : copy.context].filter(Boolean);
  }
  if (mode === MAXXIS_EXPERIENCE_MODES.CHANGE_REVIEW) return [facts.changes.length ? copy.memoryChanged(facts.changes.length) : copy.context, openCount ? copy.workflow(openCount) : ''].filter(Boolean);
  if (mode === MAXXIS_EXPERIENCE_MODES.PROVIDER_REVIEW) return [copy.providerReady, facts.provider.locked ? copy.providerLocked : ''].filter(Boolean);
  if (mode === MAXXIS_EXPERIENCE_MODES.ACTION_PREPARATION) return [copy.prepared];
  if (mode === MAXXIS_EXPERIENCE_MODES.ACTION_CONFIRMATION) {
    return [actionCode === 'UNLOCK_PROVIDER_CONTACT' && facts.action.nuggetCost !== null ? copy.unlockCost(facts.action.nuggetCost) : '', copy.confirm].filter(Boolean);
  }
  if (mode === MAXXIS_EXPERIENCE_MODES.ACTION_RESULT) {
    if (facts.action.status === 'FAILURE') return [copy.failure];
    if (actionCode === 'UNLOCK_PROVIDER_CONTACT') return [copy.unlocked];
    if (/MESSAGE|SEND/.test(actionCode)) return [copy.sent];
    return [copy.success];
  }
  if (mode === MAXXIS_EXPERIENCE_MODES.MEMORY_RECALL) return [copy.memory, facts.changes.length ? copy.memoryChanged(facts.changes.length) : '', openCount ? copy.workflow(openCount) : ''].filter(Boolean);
  if (mode === MAXXIS_EXPERIENCE_MODES.WORKFLOW_REVIEW) return [openCount ? copy.workflow(openCount) : copy.context];
  if (mode === MAXXIS_EXPERIENCE_MODES.COMPARISON) return [copy.comparison];
  return [copy.unknown];
}

function densityFor(mode, requested, supplied) {
  const normalized = String(supplied || '').toUpperCase();
  if (Object.values(MAXXIS_COMPOSITION_DENSITIES).includes(normalized)) return normalized;
  if (requested) return MAXXIS_COMPOSITION_DENSITIES.DETAILED;
  if ([MAXXIS_EXPERIENCE_MODES.ACTION_CONFIRMATION, MAXXIS_EXPERIENCE_MODES.ACTION_RESULT, MAXXIS_EXPERIENCE_MODES.ACTION_PREPARATION].includes(mode)) return MAXXIS_COMPOSITION_DENSITIES.COMPACT;
  return MAXXIS_COMPOSITION_DENSITIES.STANDARD;
}

function actionView(action, copy) {
  if (!action?.code) return null;
  const code = cleanText(action.code, 60).toUpperCase();
  return Object.freeze({
    code,
    label: cleanText(copy.actions[code] || action.label || code, 80),
    sourceAction: action,
  });
}

function composeActions(decision, copy) {
  const seen = new Set();
  return [decision.primaryAction, ...list(decision.secondaryActions)]
    .map((action) => actionView(action, copy))
    .filter(Boolean)
    .filter((action) => {
      const key = action.sourceAction.semanticKey || action.code;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 1 + MAXXIS_COMPOSITION_LIMITS.SECONDARY_ACTIONS);
}

function canonicalInteractionCode(value) {
  const code = String(value || '').toUpperCase();
  if (/VIEW_DEAL_GAPS|DEAL_GAPS|WHAT.*MISSING/.test(code)) return 'DEAL_GAPS';
  if (/EXPLAIN_INSIGHT|WHY_CURRENT_SIGNAL|EXPLAIN_METRICS|^WHY$/.test(code)) return 'EXPLAIN';
  if (/VIEW_PROVIDERS|SHOW_PROVIDERS|REVIEW_PROVIDERS/.test(code)) return 'PROVIDERS';
  if (/REVIEW_NEXT_STEP|REVIEW_NEXT/.test(code)) return 'NEXT_STEP';
  if (/COMPARE_PROPERTIES|COMPARE_THESE|COMPARISON/.test(code)) return 'COMPARISON';
  if (/REVIEW_PROVIDER_REPLY|PROVIDER_REPLY/.test(code)) return 'PROVIDER_REPLY';
  return code;
}

function composeFollowUps(raw, actionCodes, max) {
  const seen = new Set([...actionCodes].map(canonicalInteractionCode));
  return list(raw).map((item) => ({
    ...item,
    code: cleanText(item?.code || item?.intent, 60),
    label: cleanText(item?.label, 80),
  })).filter((item) => item.code && item.label).filter((item) => {
    const key = canonicalInteractionCode(item.code || item.intent);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, max);
}

function removeHeadlineDuplicate(headline, sentences) {
  const normalizedHeadline = headline.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return sentences.filter((sentence) => sentence.toLowerCase().replace(/[^a-z0-9]+/g, '') !== normalizedHeadline);
}

export function composeMaxxisExperience({ decision, language = 'en', facts: rawFacts = {}, followUps = [], density = '' } = {}) {
  const mode = String(decision?.mode || '').toUpperCase();
  if (!KNOWN_MODES.has(mode)) return Object.freeze({ status: 'FALLBACK', reason: 'UNKNOWN_MODE' });
  if (mode === MAXXIS_EXPERIENCE_MODES.PASSIVE) {
    return Object.freeze({ status: 'COMPOSED', mode, headline: '', summary: '', evidence: Object.freeze([]), statusItems: Object.freeze([]), primaryAction: null, secondaryActions: Object.freeze([]), followUps: Object.freeze([]), tone: 'CALM', presentationHints: Object.freeze({ density: MAXXIS_COMPOSITION_DENSITIES.COMPACT, render: false }) });
  }
  try {
    const copy = getMaxxisExperienceCopy(language);
    const facts = normalizeFacts(rawFacts);
    const resolvedDensity = densityFor(mode, facts.requestedDetail, density);
    const headline = cleanText(copy.modes[mode] || copy.unknown, 100);
    const narrative = removeHeadlineDuplicate(headline, buildNarrative(mode, facts, copy, language));
    const summaryLimit = mode === MAXXIS_EXPERIENCE_MODES.ACTION_CONFIRMATION
      ? 2
      : resolvedDensity === MAXXIS_COMPOSITION_DENSITIES.COMPACT ? 1 : resolvedDensity === MAXXIS_COMPOSITION_DENSITIES.DETAILED ? 3 : 2;
    const actions = composeActions(decision, copy);
    const maxFollowUps = resolvedDensity === MAXXIS_COMPOSITION_DENSITIES.COMPACT ? 2 : MAXXIS_COMPOSITION_LIMITS.FOLLOW_UPS;
    const prioritizedChanges = [...facts.changes].sort((left, right) => Number(/provider|reply/i.test(right)) - Number(/provider|reply/i.test(left)));
    const statusItems = mode === MAXXIS_EXPERIENCE_MODES.MEMORY_RECALL
      ? [prioritizedChanges[0], facts.openItems[0], facts.statusItems[0]].filter(Boolean)
      : [...facts.changes, ...facts.openItems, ...facts.missingItems, ...facts.statusItems];
    const uniqueStatusItems = statusItems.filter((item, index, all) => all.indexOf(item) === index);
    const combinedItemBudget = resolvedDensity === MAXXIS_COMPOSITION_DENSITIES.COMPACT ? 1 : MAXXIS_COMPOSITION_LIMITS.STATUS_ITEMS;
    const statusBudget = mode === MAXXIS_EXPERIENCE_MODES.ANALYSIS && uniqueStatusItems.length
      ? 1
      : combinedItemBudget;
    const selectedStatusItems = uniqueStatusItems.slice(0, statusBudget);
    const evidenceCandidates = mode === MAXXIS_EXPERIENCE_MODES.COMPARISON ? facts.comparison : facts.evidence;
    const selectedEvidence = evidenceCandidates.slice(0, Math.max(0, combinedItemBudget - selectedStatusItems.length));
    return Object.freeze({
      status: 'COMPOSED',
      mode,
      headline,
      summary: narrative.slice(0, summaryLimit).join(' '),
      evidence: Object.freeze(selectedEvidence),
      statusItems: Object.freeze(selectedStatusItems),
      primaryAction: actions[0] || null,
      secondaryActions: Object.freeze(actions.slice(1)),
      followUps: Object.freeze(composeFollowUps(followUps, new Set(actions.map((action) => action.code)), maxFollowUps)),
      tone: 'CALM',
      presentationHints: Object.freeze({ density: resolvedDensity, render: true, progressiveDisclosure: true }),
    });
  } catch {
    return Object.freeze({ status: 'FALLBACK', reason: 'COMPOSITION_FAILED' });
  }
}

export function safeMaxxisCompositionAnalytics(composition = {}) {
  const contentCount = [composition.headline, composition.summary, ...list(composition.evidence), ...list(composition.statusItems)].filter(Boolean).length;
  const actionCount = [composition.primaryAction, ...list(composition.secondaryActions)].filter(Boolean).length;
  return Object.freeze({
    composition_mode: cleanText(composition.mode, 40).toUpperCase(),
    density: cleanText(composition.presentationHints?.density, 20).toUpperCase(),
    content_count: contentCount,
    action_count: actionCount,
  });
}

function messageLabels(items) {
  return list(items).map((item) => item?.label || item?.title || item?.evidence || item?.code || item).filter(Boolean);
}

export function buildMaxxisMessageCompositionBridge(message = {}) {
  const mode = String(message?.compositionMode || '').toUpperCase();
  if (!KNOWN_MODES.has(mode) || mode === MAXXIS_EXPERIENCE_MODES.PASSIVE) return null;
  const data = message.data || {};
  const source = data.sourceData || data;
  const property = source.property || source.propertySummary || {};
  const facts = {
    property: {
      type: property.type || property.propertyType,
      city: property.city,
      state: property.state,
      beds: property.beds ?? property.bedrooms,
      price: property.price,
    },
    missingItems: messageLabels(data.gaps || source.missingFields),
    evidence: messageLabels(data.insights || data.tradeoffs),
    changes: messageLabels(data.whatChanged),
    openItems: messageLabels(data.currentOpenCodes || source.workflow?.pendingCodes),
    statusItems: messageLabels(data.currentNextStepCode ? [data.currentNextStepCode] : []),
    provider: {
      replied: source.status === 'reply_received' || Boolean(source.sourceSignalCode),
      locked: source.contactAccess?.status !== 'unlocked',
      serviceFit: source.serviceFit,
    },
    action: {
      code: data.actionCode || source.actionCode,
      status: data.status || source.status,
      nuggetCost: data.nuggetCost,
    },
    comparison: messageLabels(data.tradeoffs || source.comparison?.tradeoffs),
    metric: data.metric || {},
    requestedDetail: message.compositionDensity === MAXXIS_COMPOSITION_DENSITIES.DETAILED,
  };
  let orchestrationInput = { explicitUserIntent: { code: mode, requested: true } };
  if (mode === MAXXIS_EXPERIENCE_MODES.ANALYSIS) orchestrationInput = { ...orchestrationInput, dealSnapshot: { freshness: 'FRESH', value: facts } };
  if (mode === MAXXIS_EXPERIENCE_MODES.CONTEXTUAL) orchestrationInput = { ...orchestrationInput, contents: [{ type: 'CONTEXT', freshness: 'FRESH', value: { requested: true } }] };
  if (mode === MAXXIS_EXPERIENCE_MODES.PROVIDER_REVIEW) orchestrationInput = { ...orchestrationInput, conversationState: { freshness: 'FRESH', value: facts.provider } };
  if (mode === MAXXIS_EXPERIENCE_MODES.MEMORY_RECALL) orchestrationInput = { ...orchestrationInput, memoryRecall: { freshness: 'FRESH', requested: true, value: facts } };
  if (mode === MAXXIS_EXPERIENCE_MODES.WORKFLOW_REVIEW) orchestrationInput = { ...orchestrationInput, workflowState: { freshness: 'FRESH', value: facts.openItems } };
  if (mode === MAXXIS_EXPERIENCE_MODES.COMPARISON) orchestrationInput = { ...orchestrationInput, comparison: { freshness: 'FRESH', value: facts.comparison } };
  if (mode === MAXXIS_EXPERIENCE_MODES.CHANGE_REVIEW) orchestrationInput = { proactiveSignal: { code: 'DEAL_CONTEXT_UPDATED', freshness: 'FRESH' }, attentionResult: { shouldSurface: true }, maxxisOpen: true };
  if (mode === MAXXIS_EXPERIENCE_MODES.ACTION_PREPARATION) orchestrationInput = { actionState: { ...facts.action, phase: 'PREPARATION' } };
  if (mode === MAXXIS_EXPERIENCE_MODES.ACTION_CONFIRMATION) orchestrationInput = { actionState: { ...facts.action, phase: 'CONFIRMATION' } };
  if (mode === MAXXIS_EXPERIENCE_MODES.ACTION_RESULT) orchestrationInput = { actionState: { ...facts.action, phase: facts.action.status === 'FAILURE' ? 'FAILURE' : 'SUCCESS' } };
  return Object.freeze({ orchestrationInput: Object.freeze(orchestrationInput), facts: Object.freeze(facts) });
}
