import { captureOperationalMetric } from '../../../lib/observability';
import { MAXXIS_DEAL_MEMORY_STORAGE_PREFIX as POLICY_MEMORY_STORAGE_PREFIX } from '../../../lib/localStoragePolicy';
import {
  buildMaxxisDealGaps,
  normalizeMaxxisDealIntelligenceSource,
} from '../intelligence/maxxisDealIntelligence';

export const MAXXIS_DEAL_MEMORY_VERSION = 1;
export const MAXXIS_DEAL_MEMORY_STORAGE_PREFIX = POLICY_MEMORY_STORAGE_PREFIX;
export const MAXXIS_DEAL_MEMORY_MAX_BYTES = 4 * 1024;
export const MAXXIS_DEAL_MEMORY_MAX_DEALS = 100;
export const MAXXIS_DEAL_MEMORY_FRESH_MS = 24 * 60 * 60 * 1000;
export const MAXXIS_DEAL_MEMORY_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACCOUNT_RE = /^[a-zA-Z0-9_-]{1,120}$/;
const CODE_RE = /^[A-Z][A-Z0-9_-]{0,79}$/;
const FORBIDDEN_KEY_RE = /(email|phone|whatsapp|address|contact_value|message_body|chat_history|gemini|user_prompt|quote_body|full_name|secret|token)/i;
const EMAIL_RE = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;
const ALLOWED_ROOT_KEYS = new Set([
  'memoryVersion',
  'propertyId',
  'lastReviewedAt',
  'expiresAt',
  'lastInteractionType',
  'lastKnownDealState',
  'lastKnownWorkflowProgress',
  'lastKnownGapCodes',
  'lastKnownProviderServiceIds',
  'lastKnownContactAccessStates',
  'lastKnownConversationState',
  'lastKnownNextBestActionCode',
  'lastKnownMetricAvailability',
  'lastKnownAdvisorAttentionCodes',
]);

const CHANGE_COPY = Object.freeze({
  en: {
    title: 'Deal memory',
    previous: 'Last checkpoint',
    open: 'What was open',
    stillOpen: 'Still open',
    changed: 'What changed',
    next: 'Current next step',
    noChanges: 'No meaningful structured changes were detected since your last review.',
    noMemory: 'There is no previous checkpoint for this deal yet. I saved the current structured state for your next review.',
    unavailable: 'I could not verify this deal against the current authorized data, so I did not show stored details.',
    forgetTitle: 'Forget this deal memory?',
    forgetBody: 'This only removes the Maxxis Deal AI continuity snapshot for this deal. It does not delete the deal, workflow, messages, providers, or unlocks.',
    confirm: 'Forget memory',
    cancel: 'Keep memory',
    forgotten: 'The Maxxis Deal AI continuity snapshot for this deal was removed.',
    nothingToForget: 'There is no Maxxis Deal AI continuity snapshot to remove for this deal.',
    currentContextRequired: 'Open a deal before asking Maxxis Deal AI to recall or forget its continuity snapshot.',
    followChanged: 'What changed?',
    followOpen: 'What is still open?',
    followNext: 'Review next step',
  },
  pt: {
    title: 'Memoria do deal',
    previous: 'Ultimo checkpoint',
    open: 'O que estava aberto',
    stillOpen: 'Ainda aberto',
    changed: 'O que mudou',
    next: 'Proximo passo atual',
    noChanges: 'Nenhuma mudanca estruturada relevante foi detectada desde a ultima revisao.',
    noMemory: 'Ainda nao existe um checkpoint anterior para este deal. Salvei o estado estruturado atual para a proxima revisao.',
    unavailable: 'Nao consegui validar este deal nos dados autorizados atuais; por isso, nao exibi detalhes armazenados.',
    forgetTitle: 'Esquecer a memoria deste deal?',
    forgetBody: 'Isto remove somente o snapshot de continuidade do Maxxis Deal AI. Nao exclui o deal, workflow, mensagens, providers ou desbloqueios.',
    confirm: 'Esquecer memoria',
    cancel: 'Manter memoria',
    forgotten: 'O snapshot de continuidade do Maxxis Deal AI para este deal foi removido.',
    nothingToForget: 'Nao existe snapshot de continuidade do Maxxis Deal AI para remover neste deal.',
    currentContextRequired: 'Abra um deal antes de pedir ao Maxxis Deal AI para recuperar ou esquecer sua memoria de continuidade.',
    followChanged: 'O que mudou?',
    followOpen: 'O que continua aberto?',
    followNext: 'Revisar proximo passo',
  },
  es: {
    title: 'Memoria del deal',
    previous: 'Ultimo checkpoint',
    open: 'Lo que estaba abierto',
    stillOpen: 'Sigue abierto',
    changed: 'Lo que cambio',
    next: 'Siguiente paso actual',
    noChanges: 'No se detectaron cambios estructurados relevantes desde la ultima revision.',
    noMemory: 'Todavia no existe un checkpoint anterior para este deal. Guarde el estado estructurado actual para la proxima revision.',
    unavailable: 'No pude validar este deal con los datos autorizados actuales, asi que no mostre detalles almacenados.',
    forgetTitle: 'Olvidar la memoria de este deal?',
    forgetBody: 'Esto elimina solo el snapshot de continuidad de Maxxis Deal AI. No elimina el deal, workflow, mensajes, providers ni desbloqueos.',
    confirm: 'Olvidar memoria',
    cancel: 'Conservar memoria',
    forgotten: 'Se elimino el snapshot de continuidad de Maxxis Deal AI para este deal.',
    nothingToForget: 'No existe un snapshot de continuidad de Maxxis Deal AI para eliminar en este deal.',
    currentContextRequired: 'Abre un deal antes de pedir a Maxxis Deal AI que recuerde u olvide su memoria de continuidad.',
    followChanged: 'Que cambio?',
    followOpen: 'Que sigue abierto?',
    followNext: 'Revisar siguiente paso',
  },
});

const asArray = (value) => (Array.isArray(value) ? value : []);
const uniqueSorted = (items) => Array.from(new Set(items.filter(Boolean))).sort();
const copyFor = (language) => CHANGE_COPY[language] || CHANGE_COPY.en;
const cleanUuid = (value) => (UUID_RE.test(String(value || '').trim()) ? String(value).trim().toLowerCase() : '');

function safeCode(value) {
  const clean = String(value || '')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase()
    .slice(0, 80);
  if (!CODE_RE.test(clean) || FORBIDDEN_KEY_RE.test(clean)) return '';
  return clean;
}

function bytes(value) {
  const text = JSON.stringify(value);
  return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(text).length : text.length;
}

function forbiddenMemoryInput(value, root = true) {
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return false;
  if (typeof value === 'string') {
    const clean = value.trim();
    if (UUID_RE.test(clean) || CODE_RE.test(clean.toUpperCase()) || Number.isFinite(Date.parse(clean)) && /^\d{4}-\d{2}-\d{2}T/.test(clean)) return false;
    return EMAIL_RE.test(clean) || PHONE_RE.test(clean);
  }
  if (Array.isArray(value)) return value.some((item) => forbiddenMemoryInput(item, false));
  if (typeof value !== 'object') return true;
  return Object.entries(value).some(([key, item]) => (
    (root && !ALLOWED_ROOT_KEYS.has(key))
    || FORBIDDEN_KEY_RE.test(key)
    || forbiddenMemoryInput(item, false)
  ));
}

function normalizeTimestamp(value, fallback) {
  const timestamp = Date.parse(String(value || ''));
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : new Date(fallback).toISOString();
}

function normalizeWorkflow(value = {}) {
  const completed = Math.max(0, Math.floor(Number(value.completed) || 0));
  const total = Math.max(completed, Math.floor(Number(value.total) || 0));
  return {
    completed,
    total,
    pendingCodes: uniqueSorted(asArray(value.pendingCodes).map(safeCode)).slice(0, 20),
  };
}

function normalizeContactStates(value = []) {
  return asArray(value)
    .map((item) => ({
      serviceId: cleanUuid(item?.serviceId),
      status: ['LOCKED', 'UNLOCKED', 'UNKNOWN'].includes(String(item?.status || '').toUpperCase())
        ? String(item.status).toUpperCase()
        : 'UNKNOWN',
    }))
    .filter((item) => item.serviceId)
    .sort((left, right) => left.serviceId.localeCompare(right.serviceId))
    .slice(0, 20);
}

export function normalizeMaxxisDealMemory(snapshot, { now = Date.now(), rejectUnsafe = true } = {}) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
  if (rejectUnsafe && forbiddenMemoryInput(snapshot)) return null;
  const propertyId = cleanUuid(snapshot.propertyId);
  if (!propertyId) return null;
  const lastReviewedAt = normalizeTimestamp(snapshot.lastReviewedAt, now);
  const expiresAt = normalizeTimestamp(snapshot.expiresAt, Date.parse(lastReviewedAt) + MAXXIS_DEAL_MEMORY_RETENTION_MS);
  const normalized = {
    memoryVersion: MAXXIS_DEAL_MEMORY_VERSION,
    propertyId,
    lastReviewedAt,
    expiresAt,
    lastInteractionType: safeCode(snapshot.lastInteractionType) || 'DEAL_REVIEW',
    lastKnownDealState: safeCode(snapshot.lastKnownDealState) || 'ACTIVE',
    lastKnownWorkflowProgress: normalizeWorkflow(snapshot.lastKnownWorkflowProgress),
    lastKnownGapCodes: uniqueSorted(asArray(snapshot.lastKnownGapCodes).map(safeCode)).slice(0, 24),
    lastKnownProviderServiceIds: uniqueSorted(asArray(snapshot.lastKnownProviderServiceIds).map(cleanUuid)).slice(0, 20),
    lastKnownContactAccessStates: normalizeContactStates(snapshot.lastKnownContactAccessStates),
    lastKnownConversationState: safeCode(snapshot.lastKnownConversationState) || 'NO_CONVERSATION',
    lastKnownNextBestActionCode: safeCode(snapshot.lastKnownNextBestActionCode),
    lastKnownMetricAvailability: uniqueSorted(asArray(snapshot.lastKnownMetricAvailability).map(safeCode)).slice(0, 12),
    lastKnownAdvisorAttentionCodes: uniqueSorted(asArray(snapshot.lastKnownAdvisorAttentionCodes).map(safeCode)).slice(0, 12),
  };
  return bytes(normalized) <= MAXXIS_DEAL_MEMORY_MAX_BYTES ? Object.freeze(normalized) : null;
}

function workflowProgress(source) {
  const items = asArray(source?.workflow?.items);
  const completed = Number.isFinite(Number(source?.workflow?.completed))
    ? Number(source.workflow.completed)
    : items.filter((item) => String(item?.status || '').toLowerCase() === 'completed').length;
  const total = Number.isFinite(Number(source?.workflow?.total)) ? Number(source.workflow.total) : items.length;
  return {
    completed,
    total,
    pendingCodes: items
      .filter((item) => String(item?.status || '').toLowerCase() !== 'completed')
      .map((item) => safeCode(item?.code)),
  };
}

function providerState(source) {
  const services = asArray(source?.serviceMatches).flatMap((match) => asArray(match?.services));
  return {
    ids: services.map((service) => cleanUuid(service?.id || service?.serviceId)),
    contactStates: services
      .filter((service) => service?.contactAccess?.status)
      .map((service) => ({
        serviceId: cleanUuid(service?.id || service?.serviceId),
        status: String(service.contactAccess.status).toUpperCase(),
      })),
  };
}

function metricAvailability(source) {
  const metrics = source?.metrics?.metrics || {};
  return [
    metrics?.pricePerSqft?.calculable ? 'PRICE_PER_SQFT' : '',
    metrics?.acquisitionPlusRehab?.calculable ? 'ACQUISITION_PLUS_REHAB' : '',
    metrics?.capRate?.calculable ? 'CAP_RATE' : '',
  ].filter(Boolean);
}

function conversationState(source) {
  if (source?.conversationSummary?.providerReplyFound === true) return 'PROVIDER_REPLIED';
  const items = asArray(source?.workflow?.items);
  if (items.some((item) => item?.code === 'provider_replied' && item?.status === 'completed')) return 'PROVIDER_REPLIED';
  if (items.some((item) => item?.code === 'provider_contacted' && item?.status === 'completed')) return 'WAITING_PROVIDER_REPLY';
  return source?.conversationSummary ? 'CONVERSATION_ACTIVE' : 'NO_CONVERSATION';
}

export function buildMaxxisDealMemorySnapshot(payload, {
  now = Date.now(),
  interactionType = 'DEAL_REVIEW',
} = {}) {
  const source = normalizeMaxxisDealIntelligenceSource(payload);
  const propertyId = cleanUuid(source?.property?.id);
  if (!source || !propertyId) return null;
  const provider = providerState(source);
  const action = source?.nextBestAction?.nextBestAction || source?.nextBestAction || {};
  const workflowState = String(source?.workflow?.status || '').toUpperCase();
  const dealState = source?.property?.dealClosed === true || source?.property?.deal_closed === true
    ? 'CLOSED'
    : (['ACTIVE', 'CLOSED', 'UNAVAILABLE'].includes(workflowState) ? workflowState : 'ACTIVE');
  return normalizeMaxxisDealMemory({
    memoryVersion: MAXXIS_DEAL_MEMORY_VERSION,
    propertyId,
    lastReviewedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + MAXXIS_DEAL_MEMORY_RETENTION_MS).toISOString(),
    lastInteractionType: interactionType,
    lastKnownDealState: dealState,
    lastKnownWorkflowProgress: workflowProgress(source),
    lastKnownGapCodes: buildMaxxisDealGaps(source).map((gap) => gap.code),
    lastKnownProviderServiceIds: provider.ids,
    lastKnownContactAccessStates: provider.contactStates,
    lastKnownConversationState: conversationState(source),
    lastKnownNextBestActionCode: action?.code || '',
    lastKnownMetricAvailability: metricAvailability(source),
    lastKnownAdvisorAttentionCodes: asArray(source?.advisor?.attentionPoints),
  });
}

const sameArray = (left, right) => JSON.stringify(asArray(left).slice().sort()) === JSON.stringify(asArray(right).slice().sort());

function contactStateMap(snapshot) {
  return new Map(asArray(snapshot?.lastKnownContactAccessStates).map((item) => [item.serviceId, item.status]));
}

export function detectMaxxisDealMemoryChanges(previous, current) {
  const before = normalizeMaxxisDealMemory(previous, { rejectUnsafe: false });
  const after = normalizeMaxxisDealMemory(current, { rejectUnsafe: false });
  if (!before || !after || before.propertyId !== after.propertyId) {
    return Object.freeze({ code: 'NO_COMPARABLE_MEMORY', hasMeaningfulChanges: false, changes: [] });
  }
  const changes = [];
  const add = (code, category, evidence = {}) => changes.push(Object.freeze({
    code,
    category,
    occurredSince: before.lastReviewedAt,
    evidence: Object.freeze(evidence),
  }));
  const beforeWorkflow = before.lastKnownWorkflowProgress;
  const afterWorkflow = after.lastKnownWorkflowProgress;
  if (beforeWorkflow.completed !== afterWorkflow.completed
    || beforeWorkflow.total !== afterWorkflow.total
    || !sameArray(beforeWorkflow.pendingCodes, afterWorkflow.pendingCodes)) {
    add('WORKFLOW_PROGRESS_CHANGED', 'WORKFLOW', {
      previousCompleted: beforeWorkflow.completed,
      currentCompleted: afterWorkflow.completed,
      total: afterWorkflow.total,
    });
  }
  const beforeContacts = contactStateMap(before);
  for (const item of after.lastKnownContactAccessStates) {
    if (beforeContacts.get(item.serviceId) === 'LOCKED' && item.status === 'UNLOCKED') {
      add('PROVIDER_UNLOCKED', 'PROVIDER', { serviceId: item.serviceId });
    }
  }
  if (before.lastKnownConversationState !== 'PROVIDER_REPLIED' && after.lastKnownConversationState === 'PROVIDER_REPLIED') {
    add('PROVIDER_REPLY_DETECTED', 'CONVERSATION');
  } else if (before.lastKnownConversationState !== after.lastKnownConversationState) {
    add('CONVERSATION_STATE_CHANGED', 'CONVERSATION', { currentState: after.lastKnownConversationState });
  }
  const beforeGaps = new Set(before.lastKnownGapCodes);
  const afterGaps = new Set(after.lastKnownGapCodes);
  const addedGaps = [...afterGaps].filter((code) => !beforeGaps.has(code));
  const resolvedGaps = [...beforeGaps].filter((code) => !afterGaps.has(code));
  if (addedGaps.length) add('DEAL_GAP_ADDED', 'GAP', { gapCodes: addedGaps.slice(0, 10) });
  if (resolvedGaps.length) add('DEAL_GAP_RESOLVED', 'GAP', { gapCodes: resolvedGaps.slice(0, 10) });
  if (!sameArray(before.lastKnownMetricAvailability, after.lastKnownMetricAvailability)) {
    add('METRIC_AVAILABILITY_CHANGED', 'METRIC_AVAILABILITY', {
      availableCodes: after.lastKnownMetricAvailability,
    });
  }
  if (before.lastKnownDealState !== after.lastKnownDealState) {
    add('DEAL_STATE_CHANGED', 'DEAL_STATE', { currentState: after.lastKnownDealState });
  }
  if (before.lastKnownNextBestActionCode !== after.lastKnownNextBestActionCode) {
    add('NEXT_BEST_ACTION_CHANGED', 'WORKFLOW', { currentCode: after.lastKnownNextBestActionCode });
  }
  return Object.freeze({
    code: changes.length ? 'MEANINGFUL_CHANGES_DETECTED' : 'NO_MEANINGFUL_CHANGES',
    hasMeaningfulChanges: changes.length > 0,
    changes: Object.freeze(changes),
  });
}

export function getMaxxisDealMemoryFreshness(memory, now = Date.now()) {
  const reviewedAt = Date.parse(String(memory?.lastReviewedAt || ''));
  const expiresAt = Date.parse(String(memory?.expiresAt || ''));
  if (!Number.isFinite(reviewedAt) || (Number.isFinite(expiresAt) && expiresAt <= now) || now - reviewedAt > MAXXIS_DEAL_MEMORY_RETENTION_MS) return 'expired';
  return now - reviewedAt <= MAXXIS_DEAL_MEMORY_FRESH_MS ? 'fresh' : 'stale';
}

export function maxxisDealMemoryStorageKey(accountId) {
  const clean = String(accountId || '').trim();
  return ACCOUNT_RE.test(clean) ? `${MAXXIS_DEAL_MEMORY_STORAGE_PREFIX}${clean}` : '';
}

function readEnvelope(accountId, storage, now) {
  const key = maxxisDealMemoryStorageKey(accountId);
  if (!key || !storage) return { key, memories: {} };
  try {
    const parsed = JSON.parse(storage.getItem(key) || '{}');
    const rawMemories = parsed?.version === MAXXIS_DEAL_MEMORY_VERSION && parsed.memories && typeof parsed.memories === 'object'
      ? parsed.memories
      : {};
    const memories = {};
    Object.values(rawMemories).forEach((candidate) => {
      const memory = normalizeMaxxisDealMemory(candidate, { now, rejectUnsafe: true });
      if (memory && getMaxxisDealMemoryFreshness(memory, now) !== 'expired') memories[memory.propertyId] = memory;
    });
    return { key, memories };
  } catch {
    return { key, memories: {} };
  }
}

function writeEnvelope(key, memories, storage, now) {
  if (!key || !storage) return false;
  const sorted = Object.values(memories)
    .sort((left, right) => Date.parse(right.lastReviewedAt) - Date.parse(left.lastReviewedAt))
    .slice(0, MAXXIS_DEAL_MEMORY_MAX_DEALS);
  const limited = Object.fromEntries(sorted.map((memory) => [memory.propertyId, memory]));
  storage.setItem(key, JSON.stringify({ version: MAXXIS_DEAL_MEMORY_VERSION, updatedAt: new Date(now).toISOString(), memories: limited }));
  return true;
}

export function readMaxxisDealMemory(accountId, propertyId, {
  storage = typeof window !== 'undefined' ? window.localStorage : null,
  now = Date.now(),
} = {}) {
  const cleanPropertyId = cleanUuid(propertyId);
  const envelope = readEnvelope(accountId, storage, now);
  if (!cleanPropertyId || !envelope.key) return { memory: null, freshness: 'missing' };
  const memory = envelope.memories[cleanPropertyId] || null;
  return { memory, freshness: memory ? getMaxxisDealMemoryFreshness(memory, now) : 'missing' };
}

export function resolveUnambiguousMaxxisDealMemoryPropertyId(accountId, {
  storage = typeof window !== 'undefined' ? window.localStorage : null,
  now = Date.now(),
} = {}) {
  const envelope = readEnvelope(accountId, storage, now);
  const propertyIds = Object.keys(envelope.memories);
  return propertyIds.length === 1 ? propertyIds[0] : '';
}

export function upsertMaxxisDealMemory(accountId, snapshot, {
  storage = typeof window !== 'undefined' ? window.localStorage : null,
  now = Date.now(),
} = {}) {
  const memory = normalizeMaxxisDealMemory(snapshot, { now, rejectUnsafe: true });
  const envelope = readEnvelope(accountId, storage, now);
  if (!memory || !envelope.key) return { ok: false, reason: 'INVALID_OR_UNSAFE_MEMORY', memory: null };
  const previous = envelope.memories[memory.propertyId] || null;
  const changes = previous ? detectMaxxisDealMemoryChanges(previous, memory) : null;
  try {
    writeEnvelope(envelope.key, { ...envelope.memories, [memory.propertyId]: memory }, storage, now);
    captureOperationalMetric('maxxis.memory', {
      success: true,
      result: previous ? 'updated' : 'created',
      freshness: getMaxxisDealMemoryFreshness(memory, now),
      change_count: changes?.changes?.length || 0,
    });
    return { ok: true, created: !previous, memory, previous, changes };
  } catch {
    captureOperationalMetric('maxxis.memory', { success: false, result: 'update_failed' });
    return { ok: false, reason: 'STORAGE_WRITE_FAILED', memory: null };
  }
}

export function forgetMaxxisDealMemory(accountId, propertyId, {
  storage = typeof window !== 'undefined' ? window.localStorage : null,
  now = Date.now(),
} = {}) {
  const cleanPropertyId = cleanUuid(propertyId);
  const envelope = readEnvelope(accountId, storage, now);
  if (!cleanPropertyId || !envelope.key || !envelope.memories[cleanPropertyId]) return false;
  delete envelope.memories[cleanPropertyId];
  try {
    writeEnvelope(envelope.key, envelope.memories, storage, now);
    captureOperationalMetric('maxxis.memory', { success: true, result: 'forgotten' });
    return true;
  } catch {
    captureOperationalMetric('maxxis.memory', { success: false, result: 'forget_failed' });
    return false;
  }
}

export function cleanupMaxxisDealMemories(accountId, options = {}) {
  const storage = options.storage || (typeof window !== 'undefined' ? window.localStorage : null);
  const now = options.now || Date.now();
  const envelope = readEnvelope(accountId, storage, now);
  if (!envelope.key) return 0;
  const before = (() => {
    try { return Object.keys(JSON.parse(storage.getItem(envelope.key) || '{}')?.memories || {}).length; } catch { return 0; }
  })();
  try { writeEnvelope(envelope.key, envelope.memories, storage, now); } catch { return 0; }
  return Math.max(0, before - Object.keys(envelope.memories).length);
}

export function detectMaxxisDealMemoryIntent(message = '', forcedIntent = '') {
  const forced = String(forcedIntent || '').toUpperCase();
  if (forced === 'MEMORY_RECALL' || forced === 'MEMORY_WHAT_CHANGED' || forced === 'MEMORY_STILL_OPEN' || forced === 'MEMORY_FORGET') return forced;
  const text = String(message || '').trim().toLowerCase();
  if (!text) return '';
  if (/\b(forget|delete|remove|erase|clear)\b.*\b(deal\s+)?memory\b|\b(esquecer|apagar|remover)\b.*\bmem[oó]ria\b|\b(olvidar|borrar|eliminar)\b.*\bmemoria\b/i.test(text)) return 'MEMORY_FORGET';
  if (/\bwhat\s+changed\b|\bo\s+que\s+mudou\b|\bqu[eé]\s+cambi[oó]\b/i.test(text)) return 'MEMORY_WHAT_CHANGED';
  if (/\bwhat(?:'s|\s+is)\s+still\s+open\b|\bo\s+que\s+(?:continua|ainda\s+esta)\s+aberto\b|\bqu[eé]\s+sigue\s+abierto\b/i.test(text)) return 'MEMORY_STILL_OPEN';
  if (/\bwhere\s+were\s+we\b|\bresume\s+this\s+deal\b|\bcontinue\s+this\s+deal\b|\bonde\s+paramos\b|\bretom(?:ar|e)\s+(?:este\s+)?deal\b|\bdonde\s+(?:nos\s+)?quedamos\b|\bresume\s+(?:este\s+)?deal\b/i.test(text)) return 'MEMORY_RECALL';
  return '';
}

export function buildMaxxisDealMemoryFollowUps(language = 'en') {
  const t = copyFor(language);
  return [
    { code: 'memory_what_changed', intent: 'MEMORY_WHAT_CHANGED', label: t.followChanged, evidence: 'DEAL_MEMORY' },
    { code: 'memory_still_open', intent: 'MEMORY_STILL_OPEN', label: t.followOpen, evidence: 'DEAL_MEMORY' },
    { code: 'review_next', intent: 'review_next', label: t.followNext, evidence: 'DEAL_MEMORY' },
  ];
}

export function composeMaxxisDealMemoryRecall({ previous, current, changes, freshness = 'fresh', language = 'en' }) {
  const t = copyFor(language);
  const openCodesFor = (memory) => uniqueSorted([
    ...asArray(memory?.lastKnownWorkflowProgress?.pendingCodes),
    ...asArray(memory?.lastKnownGapCodes).filter((code) => !String(code).startsWith('WORKFLOW_PENDING_')),
  ]).slice(0, 12);
  const openCodes = openCodesFor(current);
  const changeItems = asArray(changes?.changes).map((item) => ({ code: item.code, category: item.category }));
  return {
    content: previous ? t.title : t.noMemory,
    type: 'deal_memory_recall',
    data: {
      lastReviewedAt: previous?.lastReviewedAt || null,
      freshness,
      whatWasOpenCodes: previous ? openCodesFor(previous) : [],
      whatChanged: changeItems,
      noMeaningfulChanges: Boolean(previous && !changeItems.length),
      currentOpenCodes: openCodes,
      currentNextStepCode: current?.lastKnownNextBestActionCode || '',
      labels: { previous: t.previous, open: t.open, stillOpen: t.stillOpen, changed: t.changed, next: t.next, noChanges: t.noChanges },
    },
    followUps: buildMaxxisDealMemoryFollowUps(language),
  };
}

export function maxxisDealMemoryCopy(language = 'en') {
  return copyFor(language);
}
