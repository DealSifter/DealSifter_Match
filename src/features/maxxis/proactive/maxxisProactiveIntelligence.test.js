import { describe, expect, it } from 'vitest';
import {
  buildMaxxisProactiveSignals,
  composeMaxxisProactiveMessage,
  createMaxxisProactiveSessionMemory,
  evaluateMaxxisProactiveAttention,
  markMaxxisProactiveSignalDismissed,
  markMaxxisProactiveSignalSurfaced,
  resetMaxxisProactiveSessionIfNeeded,
  safeProactiveAnalytics,
  selectMaxxisProactiveCandidate,
} from './maxxisProactiveIntelligence';

const propertyId = '11111111-1111-4111-8111-111111111111';
const otherPropertyId = '22222222-2222-4222-8222-222222222222';
const serviceId = '33333333-3333-4333-8333-333333333333';
const now = 1_800_000;

function context(overrides = {}) {
  return {
    contextVersion: 2,
    surface: { name: 'matches', route: '/matches', subview: 'property' },
    entity: { type: 'PROPERTY', id: propertyId },
    property: { id: propertyId },
    operational: {
      capabilities: {
        propertyDetails: true,
        providerMatches: true,
        serviceNeeds: true,
        workflow: true,
      },
      state: {
        contactAccessState: 'locked',
        providerReplyAvailable: false,
        pendingActionExists: false,
      },
    },
    ...overrides,
  };
}

function signal(overrides = {}) {
  return buildMaxxisProactiveSignals({
    contextSnapshot: context(),
    appContext: {
      proactiveEvents: [{
        code: 'PROVIDER_REPLIED',
        propertyId,
        serviceId,
        source: 'conversation',
        occurredAt: now,
        dedupeKey: 'reply-1',
      }],
    },
    now,
    accountKey: 'acct-a',
    ...overrides,
  })[0];
}

const enabledConfig = { enabled: true, cooldownMs: 90_000, maxPerSession: 2, maxAgeMs: 15 * 60_000 };

describe('Maxxis Deal AI proactive intelligence', () => {
  it('builds structured provider reply, quote, workflow, service match and gap signals without duplicates', () => {
    const messages = [{
      id: 'deal-1',
      role: 'assistant',
      type: 'property_details',
      createdAt: new Date(now),
      data: {
        property: { id: propertyId, price: 100000, sqft: 0 },
        missingFields: ['sqft'],
        serviceNeeds: [{ serviceType: 'General Contractor' }],
        serviceMatches: [{ services: [{ id: serviceId, contactAccess: { status: 'locked' } }] }],
      },
    }];
    const signals = buildMaxxisProactiveSignals({
      contextSnapshot: context(),
      appContext: {
        operational: {
          proactiveEvents: [
            { code: 'PROVIDER_REPLIED', propertyId, serviceId, dedupeKey: 'reply-1' },
            { code: 'PROVIDER_REPLIED', propertyId, serviceId, dedupeKey: 'reply-1' },
            { code: 'PROVIDER_QUOTE_DETECTED', propertyId, serviceId, dedupeKey: 'quote-1' },
            { code: 'WORKFLOW_ITEM_CHANGED', propertyId, dedupeKey: 'workflow-1' },
            { code: 'SERVICE_MATCH_AVAILABLE', propertyId, dedupeKey: 'match-1' },
          ],
          serviceMatchAvailable: true,
          workflowChanged: true,
        },
      },
      messages,
      now,
      accountKey: 'acct-a',
    });
    expect(signals.map((item) => item.code)).toEqual(expect.arrayContaining([
      'PROVIDER_REPLIED',
      'PROVIDER_QUOTE_DETECTED',
      'WORKFLOW_ITEM_CHANGED',
      'SERVICE_MATCH_AVAILABLE',
      'IMPORTANT_MISSING_INFORMATION',
    ]));
    expect(new Set(signals.map((item) => item.dedupeKey)).size).toBe(signals.length);
  });

  it('ignores invalid events and closed property contexts', () => {
    expect(buildMaxxisProactiveSignals({
      contextSnapshot: context(),
      appContext: { proactiveEvents: [{ code: 'MADE_UP_EVENT', propertyId }] },
      now,
    })).toEqual([]);
    expect(buildMaxxisProactiveSignals({
      contextSnapshot: context(),
      appContext: { proactiveEvents: [{ code: 'PROVIDER_REPLIED', propertyId }], operational: { propertyStatus: 'closed' } },
      now,
    })).toEqual([]);
  });

  it('scopes dedupe by account to avoid account switch leakage', () => {
    const first = signal({ accountKey: 'account-one' });
    const second = signal({ accountKey: 'account-two' });
    expect(first.dedupeKey).not.toBe(second.dedupeKey);
    const memory = resetMaxxisProactiveSessionIfNeeded(createMaxxisProactiveSessionMemory('account-one'), 'account-two');
    expect(memory.accountKey).toBe('account-two');
    expect(memory.surfacedCount).toBe(0);
  });

  it('surfaces relevant same-property signals when feature is enabled and Maxxis Deal AI is closed', () => {
    const item = signal();
    const attention = evaluateMaxxisProactiveAttention(item, {
      config: enabledConfig,
      contextSnapshot: context(),
      sessionMemory: createMaxxisProactiveSessionMemory('acct-a'),
      now,
      maxxisOpen: false,
    });
    expect(attention).toMatchObject({ shouldSurface: true, reasonCode: 'RELEVANT_SAME_CONTEXT' });
    expect(attention.priority).toBeGreaterThan(60);
  });

  it('suppresses when feature is off, Maxxis Deal AI is open, signal is old, dismissed, duplicate, or on a different property', () => {
    const item = signal();
    const memory = createMaxxisProactiveSessionMemory('acct-a');
    expect(evaluateMaxxisProactiveAttention(item, { config: { ...enabledConfig, enabled: false }, contextSnapshot: context(), sessionMemory: memory, now }).reasonCode).toBe('FEATURE_DISABLED');
    expect(evaluateMaxxisProactiveAttention(item, { config: enabledConfig, contextSnapshot: context(), sessionMemory: memory, now, maxxisOpen: true }).reasonCode).toBe('MAXXIS_OPEN');
    expect(evaluateMaxxisProactiveAttention({ ...item, occurredAt: now - 20 * 60_000 }, { config: enabledConfig, contextSnapshot: context(), sessionMemory: memory, now }).reasonCode).toBe('STALE_SIGNAL');
    markMaxxisProactiveSignalDismissed(memory, item);
    expect(evaluateMaxxisProactiveAttention(item, { config: enabledConfig, contextSnapshot: context(), sessionMemory: memory, now }).reasonCode).toBe('DISMISSED');
    const duplicateMemory = createMaxxisProactiveSessionMemory('acct-a');
    markMaxxisProactiveSignalSurfaced(duplicateMemory, item, now - 100_000);
    expect(evaluateMaxxisProactiveAttention(item, { config: enabledConfig, contextSnapshot: context(), sessionMemory: duplicateMemory, now }).reasonCode).toBe('DUPLICATE');
    const differentProperty = { ...item, entityId: otherPropertyId, evidence: { ...item.evidence, propertyId: otherPropertyId }, dedupeKey: 'different-property' };
    expect(evaluateMaxxisProactiveAttention(differentProperty, { config: enabledConfig, contextSnapshot: context(), sessionMemory: createMaxxisProactiveSessionMemory(), now }).reasonCode).toBe('CONTEXT_MISMATCH');
  });

  it('suppresses recent bubble, session limit, typing, modal, onboarding and pending confirmation states', () => {
    const item = signal();
    const recentMemory = createMaxxisProactiveSessionMemory('acct-a');
    recentMemory.lastBubbleAt = now - 1_000;
    expect(evaluateMaxxisProactiveAttention(item, { config: enabledConfig, contextSnapshot: context(), sessionMemory: recentMemory, now }).reasonCode).toBe('COOLDOWN');
    const cappedMemory = createMaxxisProactiveSessionMemory('acct-a');
    cappedMemory.surfacedCount = 2;
    expect(evaluateMaxxisProactiveAttention(item, { config: enabledConfig, contextSnapshot: context(), sessionMemory: cappedMemory, now }).reasonCode).toBe('SESSION_LIMIT');
    expect(evaluateMaxxisProactiveAttention(item, { config: enabledConfig, contextSnapshot: context(), sessionMemory: createMaxxisProactiveSessionMemory(), now, userActivity: { typing: true } }).reasonCode).toBe('USER_BUSY');
    expect(evaluateMaxxisProactiveAttention(item, { config: enabledConfig, contextSnapshot: context({ surface: { name: 'matches', modal: 'checkout' } }), sessionMemory: createMaxxisProactiveSessionMemory(), now }).reasonCode).toBe('SENSITIVE_SURFACE');
    expect(evaluateMaxxisProactiveAttention(item, { config: enabledConfig, contextSnapshot: context({ surface: { name: 'onboarding' } }), sessionMemory: createMaxxisProactiveSessionMemory(), now }).reasonCode).toBe('SENSITIVE_SURFACE');
    expect(evaluateMaxxisProactiveAttention(item, { config: enabledConfig, contextSnapshot: context({ operational: { state: { pendingActionExists: true } } }), sessionMemory: createMaxxisProactiveSessionMemory(), now }).reasonCode).toBe('USER_BUSY');
  });

  it('composes controlled localized messages and never includes evidence PII', () => {
    const item = {
      ...signal(),
      evidence: {
        propertyId,
        serviceId,
        quoteAmount: '$999,999',
        contactEmail: 'provider@example.test',
        messageBody: 'Sensitive body',
      },
    };
    expect(composeMaxxisProactiveMessage(item, 'en')).toEqual({
      signalCode: 'PROVIDER_REPLIED',
      text: 'Your provider replied.',
      ctaLabel: 'Review reply',
      continuationText: 'Your provider replied about this deal. I can show what changed or help you review the response.',
    });
    expect(composeMaxxisProactiveMessage({ code: 'SERVICE_MATCH_AVAILABLE' }, 'pt').text).toBe('Encontrei providers que combinam com esta propriedade.');
    const serialized = JSON.stringify(composeMaxxisProactiveMessage(item, 'es'));
    expect(serialized).not.toMatch(/999|provider@example|Sensitive|body/i);
    expect(composeMaxxisProactiveMessage(item, 'pt').continuationText).toContain('Seu provider respondeu sobre este deal');
  });

  it('selects the highest priority candidate and returns safe analytics properties only', () => {
    const low = { ...signal(), code: 'WORKFLOW_ITEM_CHANGED', severity: 'INFO', dedupeKey: 'low' };
    const high = { ...signal(), code: 'PROVIDER_REPLIED', severity: 'IMPORTANT', dedupeKey: 'high' };
    const selected = selectMaxxisProactiveCandidate([low, high], {
      config: enabledConfig,
      contextSnapshot: context(),
      sessionMemory: createMaxxisProactiveSessionMemory('acct-a'),
      now,
    });
    expect(selected.signal.dedupeKey).toBe('high');
    expect(safeProactiveAnalytics(high, selected.attention, { surface: 'matches', contextVersion: 2 })).toEqual({
      signalCode: 'PROVIDER_REPLIED',
      surface: 'matches',
      priority: selected.attention.priority,
      reasonCode: selected.attention.reasonCode,
      contextVersion: 2,
    });
  });
});
