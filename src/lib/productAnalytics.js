import { trackAppEvent } from './adminEventTracking';
import {
  PRODUCT_EVENTS,
  PRODUCT_EVENT_TAXONOMY_VERSION,
  SAFE_PRODUCT_PROPERTY_KEYS,
} from '../domain/analytics/productEvents';

const DEDUPE_TTL_MS = 30 * 60 * 1000;
const recentEvents = new Map();
const forbiddenKeyPattern = /(email|phone|whatsapp|address|contact|body|message|prompt|profile|stripe|payment|secret|token)/i;
const emailPattern = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/i;
const phonePattern = /(?:\+?\d[\d\s().-]{7,}\d)/;

const cleanTechnicalId = (value) => {
  const clean = String(value || '').trim();
  return /^[a-zA-Z0-9:_-]{1,120}$/.test(clean) ? clean : '';
};

export function sanitizeProductProperties(properties = {}) {
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return {};
  const safe = {};
  for (const key of SAFE_PRODUCT_PROPERTY_KEYS) {
    if (!(key in properties) || forbiddenKeyPattern.test(key)) continue;
    const value = properties[key];
    if (typeof value === 'boolean') safe[key] = value;
    else if (typeof value === 'number' && Number.isFinite(value)) safe[key] = value;
    else if (typeof value === 'string') {
      const clean = value.trim().slice(0, 80);
      if (clean && !emailPattern.test(clean) && !phonePattern.test(clean)) safe[key] = clean;
    }
  }
  return safe;
}

function wasRecentlyTracked(key, now) {
  for (const [storedKey, timestamp] of recentEvents) {
    if (now - timestamp > DEDUPE_TTL_MS) recentEvents.delete(storedKey);
  }
  if (recentEvents.has(key)) return true;
  recentEvents.set(key, now);
  return false;
}

export async function trackProductEvent(eventName, {
  entityType = 'product',
  entityId = '',
  properties = {},
  dedupeKey = '',
  transport = trackAppEvent,
  now = Date.now(),
} = {}) {
  const event = PRODUCT_EVENTS[eventName];
  if (!event || typeof transport !== 'function') return false;
  const cleanEntityId = cleanTechnicalId(entityId);
  const key = cleanTechnicalId(dedupeKey) || `${eventName}:${cleanEntityId || 'none'}`;
  if (wasRecentlyTracked(key, now)) return false;
  const metadata = sanitizeProductProperties({
    ...properties,
    funnel_step: event.stage,
    taxonomy_version: PRODUCT_EVENT_TAXONOMY_VERSION,
  });
  try {
    return await transport(eventName, {
      entityType: cleanTechnicalId(entityType) || 'product',
      entityId: cleanEntityId || null,
      metadata,
    }) !== false;
  } catch {
    return false;
  }
}

export function resetProductEventDedupeForTests() {
  recentEvents.clear();
}
