import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildMaxxisDealMemorySnapshot,
  cleanupMaxxisDealMemories,
  composeMaxxisDealMemoryRecall,
  detectMaxxisDealMemoryChanges,
  detectMaxxisDealMemoryIntent,
  forgetMaxxisDealMemory,
  getMaxxisDealMemoryFreshness,
  MAXXIS_DEAL_MEMORY_MAX_BYTES,
  MAXXIS_DEAL_MEMORY_MAX_DEALS,
  MAXXIS_DEAL_MEMORY_RETENTION_MS,
  normalizeMaxxisDealMemory,
  readMaxxisDealMemory,
  resolveUnambiguousMaxxisDealMemoryPropertyId,
  upsertMaxxisDealMemory,
} from './maxxisDealMemory';

const PROPERTY_A = '11111111-1111-4111-8111-111111111111';
const PROPERTY_B = '22222222-2222-4222-8222-222222222222';
const SERVICE_A = '33333333-3333-4333-8333-333333333333';
const NOW = Date.parse('2026-08-24T12:00:00.000Z');

function memory(patch = {}) {
  return {
    memoryVersion: 1,
    propertyId: PROPERTY_A,
    lastReviewedAt: new Date(NOW).toISOString(),
    expiresAt: new Date(NOW + MAXXIS_DEAL_MEMORY_RETENTION_MS).toISOString(),
    lastInteractionType: 'DEAL_REVIEW',
    lastKnownDealState: 'ACTIVE',
    lastKnownWorkflowProgress: { completed: 0, total: 2, pendingCodes: ['INSPECTION_COMPLETED'] },
    lastKnownGapCodes: ['WORKFLOW_PENDING_INSPECTION_COMPLETED'],
    lastKnownProviderServiceIds: [SERVICE_A],
    lastKnownContactAccessStates: [{ serviceId: SERVICE_A, status: 'LOCKED' }],
    lastKnownConversationState: 'NO_CONVERSATION',
    lastKnownNextBestActionCode: 'REVIEW_WORKFLOW',
    lastKnownMetricAvailability: ['CAP_RATE'],
    lastKnownAdvisorAttentionCodes: [],
    ...patch,
  };
}

function payload(patch = {}) {
  return {
    type: 'deal_copilot_overview',
    data: {
      propertySummary: { id: PROPERTY_A, city: 'Dallas', address: 'Private street' },
      workflow: {
        status: 'active',
        items: [
          { code: 'inspection_completed', label: 'Inspection', status: 'pending' },
          { code: 'provider_replied', label: 'Provider replied', status: 'pending' },
        ],
      },
      serviceSummary: {
        needs: [{ serviceType: 'General Contractor' }],
        providers: [{ serviceId: SERVICE_A, title: 'Private Provider' }],
      },
      metricsSummary: { metrics: { capRate: { calculable: true, value: 6.5 } } },
      advisorSummary: { attentionPoints: ['missing_inspection'] },
      conversationSummary: null,
      nextBestAction: { nextBestAction: { code: 'review_workflow' } },
      ...patch,
    },
  };
}

function createStorage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    key: (index) => [...values.keys()][index] ?? null,
    values,
  };
}

describe('Maxxis Deal AI deal memory model and continuity', () => {
  let storage;

  beforeEach(() => { storage = createStorage(); });

  it('builds only the allowlisted structured snapshot and excludes property/provider payloads', () => {
    const snapshot = buildMaxxisDealMemorySnapshot(payload(), { now: NOW });
    expect(snapshot).toMatchObject({
      memoryVersion: 1,
      propertyId: PROPERTY_A,
      lastKnownConversationState: 'NO_CONVERSATION',
      lastKnownProviderServiceIds: [SERVICE_A],
      lastKnownMetricAvailability: ['CAP_RATE'],
    });
    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain('Private street');
    expect(serialized).not.toContain('Private Provider');
    expect(serialized).not.toContain('Dallas');
    expect(new TextEncoder().encode(serialized).length).toBeLessThanOrEqual(MAXXIS_DEAL_MEMORY_MAX_BYTES);
  });

  it('builds from the existing property details response shape', () => {
    const details = {
      type: 'property_details',
      data: {
        property: { id: PROPERTY_A, type: 'SFR', city: 'Dallas', state: 'TX', price: 250000, sqft: 1850 },
        missingFields: [],
        metrics: {
          pricePerSqft: { calculable: true, value: 135.14, source: 'calculated' },
          acquisitionPlusRehab: { calculable: true, value: 275000, source: 'calculated' },
          capRate: { calculable: true, value: 6.5, source: 'stored' },
        },
        advisor: { positive: ['property_published'], attention: [], missing: [] },
        workflow: {
          propertyId: PROPERTY_A,
          status: 'active',
          items: [
            { code: 'inspection_completed', status: 'pending', label: 'Inspection', manual: true },
            { code: 'rehab_quote_received', status: 'pending', label: 'Rehab quote', manual: true },
            { code: 'provider_replied', status: 'pending', label: 'Provider replied', manual: false },
          ],
        },
        nextBestAction: { nextBestAction: { code: 'review_workflow', priority: 'medium' } },
        serviceNeeds: [{ serviceType: 'General Contractor', title: 'General contractor rehab review' }],
        serviceMatches: [{
          serviceType: 'General Contractor',
          services: [{ id: SERVICE_A, title: 'E2E Roofing & Rehab', contactAccess: { status: 'locked', cost: 1, currency: 'nuggets' } }],
        }],
      },
    };
    expect(buildMaxxisDealMemorySnapshot(details, { now: NOW })).not.toBeNull();
  });

  it('rejects PII, message, prompt, quote and unknown payload fields', () => {
    expect(normalizeMaxxisDealMemory({ ...memory(), email: 'owner@example.com' }, { now: NOW })).toBeNull();
    expect(normalizeMaxxisDealMemory({ ...memory(), messageBody: 'hello' }, { now: NOW })).toBeNull();
    expect(normalizeMaxxisDealMemory({ ...memory(), lastKnownNextBestActionCode: '+1 (555) 123-4567' }, { now: NOW })).toBeNull();
    expect(normalizeMaxxisDealMemory({ ...memory(), propertyPayload: { price: 1 } }, { now: NOW })).toBeNull();
  });

  it('requires a technical property UUID and fixed memory version', () => {
    expect(normalizeMaxxisDealMemory(memory({ propertyId: 'not-a-property' }), { now: NOW })).toBeNull();
    expect(normalizeMaxxisDealMemory(memory({ memoryVersion: 99 }), { now: NOW })?.memoryVersion).toBe(1);
  });

  it('isolates memory by account and property', () => {
    expect(upsertMaxxisDealMemory('account-a', memory(), { storage, now: NOW }).ok).toBe(true);
    expect(readMaxxisDealMemory('account-a', PROPERTY_A, { storage, now: NOW }).memory).toBeTruthy();
    expect(readMaxxisDealMemory('account-a', PROPERTY_B, { storage, now: NOW }).memory).toBeNull();
    expect(readMaxxisDealMemory('account-b', PROPERTY_A, { storage, now: NOW }).memory).toBeNull();
  });

  it('resolves a context-free recall only when one account-scoped deal is unambiguous', () => {
    upsertMaxxisDealMemory('account-a', memory(), { storage, now: NOW });
    expect(resolveUnambiguousMaxxisDealMemoryPropertyId('account-a', { storage, now: NOW })).toBe(PROPERTY_A);
    upsertMaxxisDealMemory('account-a', memory({ propertyId: PROPERTY_B }), { storage, now: NOW });
    expect(resolveUnambiguousMaxxisDealMemoryPropertyId('account-a', { storage, now: NOW })).toBe('');
    expect(resolveUnambiguousMaxxisDealMemoryPropertyId('account-b', { storage, now: NOW })).toBe('');
  });

  it('classifies fresh, stale and expired snapshots deterministically', () => {
    expect(getMaxxisDealMemoryFreshness(memory(), NOW + 60_000)).toBe('fresh');
    expect(getMaxxisDealMemoryFreshness(memory(), NOW + (2 * 24 * 60 * 60 * 1000))).toBe('stale');
    expect(getMaxxisDealMemoryFreshness(memory(), NOW + MAXXIS_DEAL_MEMORY_RETENTION_MS + 1)).toBe('expired');
  });

  it('cleans expired memory without affecting fresh property memory', () => {
    upsertMaxxisDealMemory('account-a', memory({
      lastReviewedAt: new Date(NOW - MAXXIS_DEAL_MEMORY_RETENTION_MS - 1).toISOString(),
      expiresAt: new Date(NOW - 1).toISOString(),
    }), { storage, now: NOW - MAXXIS_DEAL_MEMORY_RETENTION_MS - 1 });
    upsertMaxxisDealMemory('account-a', memory({ propertyId: PROPERTY_B }), { storage, now: NOW });
    expect(cleanupMaxxisDealMemories('account-a', { storage, now: NOW })).toBeGreaterThanOrEqual(0);
    expect(readMaxxisDealMemory('account-a', PROPERTY_A, { storage, now: NOW }).memory).toBeNull();
    expect(readMaxxisDealMemory('account-a', PROPERTY_B, { storage, now: NOW }).memory).toBeTruthy();
  });

  it('caps account memory at the configured deal limit using most recent reviews', () => {
    for (let index = 0; index < MAXXIS_DEAL_MEMORY_MAX_DEALS + 3; index += 1) {
      const hex = (index + 16).toString(16).padStart(8, '0');
      const propertyId = `${hex}-1111-4111-8111-${String(index + 1).padStart(12, '0')}`;
      upsertMaxxisDealMemory('account-a', memory({
        propertyId,
        lastReviewedAt: new Date(NOW + index).toISOString(),
        expiresAt: new Date(NOW + MAXXIS_DEAL_MEMORY_RETENTION_MS).toISOString(),
      }), { storage, now: NOW + index });
    }
    const raw = JSON.parse([...storage.values.values()][0]);
    expect(Object.keys(raw.memories)).toHaveLength(MAXXIS_DEAL_MEMORY_MAX_DEALS);
  });

  it('detects workflow progress without inventing financial changes', () => {
    const result = detectMaxxisDealMemoryChanges(memory(), memory({
      lastKnownWorkflowProgress: { completed: 1, total: 2, pendingCodes: [] },
    }));
    expect(result.changes.map((item) => item.code)).toContain('WORKFLOW_PROGRESS_CHANGED');
    expect(JSON.stringify(result)).not.toMatch(/price|profit|roi|arv/i);
  });

  it('detects provider unlock and provider reply from explicit structured states', () => {
    const result = detectMaxxisDealMemoryChanges(memory(), memory({
      lastKnownContactAccessStates: [{ serviceId: SERVICE_A, status: 'UNLOCKED' }],
      lastKnownConversationState: 'PROVIDER_REPLIED',
    }));
    expect(result.changes.map((item) => item.code)).toEqual(expect.arrayContaining(['PROVIDER_UNLOCKED', 'PROVIDER_REPLY_DETECTED']));
  });

  it('detects added and resolved gap codes', () => {
    const added = detectMaxxisDealMemoryChanges(memory(), memory({ lastKnownGapCodes: ['NEW_GAP'] }));
    expect(added.changes.map((item) => item.code)).toEqual(expect.arrayContaining(['DEAL_GAP_ADDED', 'DEAL_GAP_RESOLVED']));
  });

  it('detects metric availability and deal state changes', () => {
    const result = detectMaxxisDealMemoryChanges(memory(), memory({
      lastKnownMetricAvailability: ['CAP_RATE', 'PRICE_PER_SQFT'],
      lastKnownDealState: 'CLOSED',
    }));
    expect(result.changes.map((item) => item.code)).toEqual(expect.arrayContaining(['METRIC_AVAILABILITY_CHANGED', 'DEAL_STATE_CHANGED']));
  });

  it('returns a clear no meaningful changes result for equal structured states', () => {
    const result = detectMaxxisDealMemoryChanges(memory(), memory());
    expect(result).toMatchObject({ code: 'NO_MEANINGFUL_CHANGES', hasMeaningfulChanges: false, changes: [] });
  });

  it('does not compare memories from different properties', () => {
    expect(detectMaxxisDealMemoryChanges(memory(), memory({ propertyId: PROPERTY_B })).code).toBe('NO_COMPARABLE_MEMORY');
  });

  it.each([
    ['Where were we?', 'MEMORY_RECALL'],
    ['Onde paramos?', 'MEMORY_RECALL'],
    ['Resume this deal', 'MEMORY_RECALL'],
    ['What changed?', 'MEMORY_WHAT_CHANGED'],
    ['O que continua aberto?', 'MEMORY_STILL_OPEN'],
    ['Forget this deal memory', 'MEMORY_FORGET'],
  ])('recognizes controlled continuity intent %s', (message, expected) => {
    expect(detectMaxxisDealMemoryIntent(message)).toBe(expected);
  });

  it('does not interpret ordinary chat as a memory command', () => {
    expect(detectMaxxisDealMemoryIntent('What is the cap rate?')).toBe('');
  });

  it('composes fixed PT, EN and ES recall replies with safe follow-ups', () => {
    for (const language of ['pt', 'en', 'es']) {
      const result = composeMaxxisDealMemoryRecall({
        previous: memory(),
        current: memory({ lastKnownConversationState: 'PROVIDER_REPLIED' }),
        changes: detectMaxxisDealMemoryChanges(memory(), memory({ lastKnownConversationState: 'PROVIDER_REPLIED' })),
        freshness: 'stale',
        language,
      });
      expect(result.type).toBe('deal_memory_recall');
      expect(result.data.whatChanged[0].code).toBe('PROVIDER_REPLY_DETECTED');
      expect(result.followUps).toHaveLength(3);
    }
  });

  it('creates a first checkpoint and reports no prior memory', () => {
    const result = upsertMaxxisDealMemory('account-a', memory(), { storage, now: NOW });
    expect(result).toMatchObject({ ok: true, created: true, previous: null });
    const recall = composeMaxxisDealMemoryRecall({ previous: null, current: result.memory, changes: null, language: 'en' });
    expect(recall.content).toMatch(/no previous checkpoint/i);
  });

  it('forgets only the selected deal snapshot', () => {
    upsertMaxxisDealMemory('account-a', memory(), { storage, now: NOW });
    upsertMaxxisDealMemory('account-a', memory({ propertyId: PROPERTY_B }), { storage, now: NOW });
    expect(forgetMaxxisDealMemory('account-a', PROPERTY_A, { storage, now: NOW })).toBe(true);
    expect(readMaxxisDealMemory('account-a', PROPERTY_A, { storage, now: NOW }).memory).toBeNull();
    expect(readMaxxisDealMemory('account-a', PROPERTY_B, { storage, now: NOW }).memory).toBeTruthy();
  });

  it('fails closed when storage rejects a write', () => {
    const failingStorage = { ...storage, setItem: () => { throw new Error('quota'); } };
    expect(upsertMaxxisDealMemory('account-a', memory(), { storage: failingStorage, now: NOW })).toMatchObject({ ok: false, reason: 'STORAGE_WRITE_FAILED' });
  });
});
