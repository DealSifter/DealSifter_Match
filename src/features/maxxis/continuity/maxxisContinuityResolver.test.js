import { describe, expect, it, vi } from 'vitest';
import { selectMaxxisNextInteraction } from '../nextInteraction/maxxisNextInteractionEngine';
import {
  buildMaxxisContinuityEvidence,
  MAXXIS_CONTINUITY_TTL_MS,
  normalizeMaxxisContinuitySnapshot,
} from './maxxisContinuityContext';
import {
  applyMaxxisContinuityToContextSnapshot,
  captureMaxxisContinuity,
  createMaxxisContinuitySession,
  resetMaxxisContinuitySession,
  resolveMaxxisContinuity,
  resolveMaxxisContinuityReference,
  shouldDiscardMaxxisPendingConfirmation,
} from './maxxisContinuityResolver';

const ACCOUNT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ACCOUNT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PROPERTY_A = '11111111-1111-4111-8111-111111111111';
const PROPERTY_B = '22222222-2222-4222-8222-222222222222';
const PROPERTY_C = '33333333-3333-4333-8333-333333333333';
const SERVICE_X = '44444444-4444-4444-8444-444444444444';
const SERVICE_Y = '55555555-5555-4555-8555-555555555555';
const NOW = 1_800_000_000_000;

function sessionWithA(overrides = {}) {
  return captureMaxxisContinuity(createMaxxisContinuitySession(ACCOUNT_A), {
    propertyId: PROPERTY_A,
    serviceId: SERVICE_X,
    conversationRef: `SERVICE:${SERVICE_X}`,
    relatedPropertyIds: [PROPERTY_B],
    lastInteractionType: 'PROVIDER_REVIEW',
    lastActionCode: 'REVIEW_PROVIDER_REPLY',
    lastExperienceMode: 'PROVIDER_REVIEW',
    sourceSurface: { page: 'matches', subview: 'human_chat' },
    ...overrides,
  }, { accountKey: ACCOUNT_A, now: NOW });
}

describe('Maxxis cross-surface continuity', () => {
  it('normalizes an allowlisted snapshot and discards PII payloads', () => {
    const snapshot = normalizeMaxxisContinuitySnapshot({ propertyId: PROPERTY_A, serviceId: SERVICE_X, email: 'private@example.com', messageBody: 'secret', stripePayload: { token: 'x' } }, { now: NOW });
    expect(snapshot).toMatchObject({ propertyId: PROPERTY_A, serviceId: SERVICE_X, freshness: 'FRESH' });
    expect(JSON.stringify(snapshot)).not.toMatch(/private|example|secret|stripe|token/i);
  });

  it.each([
    ['same property', { currentContext: { propertyId: PROPERTY_A }, allowedServiceIds: [SERVICE_X] }, 'CURRENT_WITH_CONTINUITY', PROPERTY_A, SERVICE_X],
    ['provider handoff', { currentContext: { propertyId: PROPERTY_A, serviceId: SERVICE_X }, allowedServiceIds: [SERVICE_X] }, 'CURRENT_WITH_CONTINUITY', PROPERTY_A, SERVICE_X],
    ['conversation handoff', { currentContext: { propertyId: PROPERTY_A, conversationRef: `SERVICE:${SERVICE_X}` }, allowedServiceIds: [SERVICE_X] }, 'CURRENT_WITH_CONTINUITY', PROPERTY_A, SERVICE_X],
    ['reopen Maxxis', { currentContext: {}, allowedServiceIds: [SERVICE_X] }, 'FRESH_CONTINUITY', PROPERTY_A, SERVICE_X],
  ])('resolves %s without losing authority', (_label, input, reasonCode, propertyId, serviceId) => {
    const result = resolveMaxxisContinuity(sessionWithA(), { accountKey: ACCOUNT_A, now: NOW + 1_000, ...input });
    expect(result).toMatchObject({ status: 'RESOLVED', reasonCode, context: { propertyId, serviceId } });
  });

  it('isolates a property switch and recovers A only after returning to A', () => {
    const first = sessionWithA();
    const switched = captureMaxxisContinuity(first, { propertyId: PROPERTY_B, lastInteractionType: 'DEAL_REVIEW' }, { accountKey: ACCOUNT_A, now: NOW + 1_000 });
    const onB = resolveMaxxisContinuity(switched, { accountKey: ACCOUNT_A, currentContext: { propertyId: PROPERTY_B }, allowedServiceIds: [SERVICE_X], now: NOW + 2_000 });
    const onA = resolveMaxxisContinuity(switched, { accountKey: ACCOUNT_A, currentContext: { propertyId: PROPERTY_A }, allowedServiceIds: [SERVICE_X], now: NOW + 2_000 });
    expect(onB.context).toMatchObject({ propertyId: PROPERTY_B, serviceId: '' });
    expect(onA.context).toMatchObject({ propertyId: PROPERTY_A, serviceId: SERVICE_X });
  });

  it('lets current trusted provider context override continuity', () => {
    const result = resolveMaxxisContinuity(sessionWithA(), { accountKey: ACCOUNT_A, currentContext: { propertyId: PROPERTY_A, serviceId: SERVICE_Y }, allowedServiceIds: [SERVICE_X, SERVICE_Y], now: NOW + 1_000 });
    expect(result).toMatchObject({ source: 'CURRENT', context: { serviceId: SERVICE_Y } });
  });

  it('uses fresh continuity before deal memory', () => {
    const result = resolveMaxxisContinuity(sessionWithA(), { accountKey: ACCOUNT_A, currentContext: {}, allowedServiceIds: [SERVICE_X], dealMemory: { propertyId: PROPERTY_A, lastInteractionType: 'OLD_MEMORY' }, now: NOW + 1_000 });
    expect(result).toMatchObject({ source: 'CONTINUITY', context: { lastInteractionType: 'PROVIDER_REVIEW' } });
  });

  it('falls back to deal memory only after continuity expires', () => {
    const result = resolveMaxxisContinuity(sessionWithA(), { accountKey: ACCOUNT_A, currentContext: {}, allowedServiceIds: [SERVICE_X], dealMemory: { propertyId: PROPERTY_A, lastInteractionType: 'DEAL_REVIEW', lastReviewedAt: new Date(NOW).toISOString() }, now: NOW + MAXXIS_CONTINUITY_TTL_MS + 1 });
    expect(result).toMatchObject({ source: 'MEMORY', reasonCode: 'DEAL_MEMORY_FALLBACK', context: { serviceId: '' } });
  });

  it('reports expired continuity when no fallback exists', () => {
    const result = resolveMaxxisContinuity(sessionWithA(), { accountKey: ACCOUNT_A, currentContext: {}, now: NOW + MAXXIS_CONTINUITY_TTL_MS + 1 });
    expect(result).toMatchObject({ status: 'EXPIRED', reasonCode: 'CONTINUITY_EXPIRED', context: null });
  });

  it.each([
    ['account switch', ACCOUNT_B],
    ['logout', ''],
  ])('resets continuity on %s', (_label, nextAccount) => {
    const reset = resetMaxxisContinuitySession(sessionWithA(), nextAccount);
    expect(reset).toEqual({ accountKey: nextAccount, activePropertyId: '', snapshots: {} });
    expect(resolveMaxxisContinuity(reset, { accountKey: nextAccount, currentContext: {} }).context).toBeNull();
  });

  it.each(['CLOSED', 'UNAVAILABLE'])('discards an unavailable %s entity', (propertyStatus) => {
    expect(resolveMaxxisContinuity(sessionWithA(), { accountKey: ACCOUNT_A, currentContext: { propertyId: PROPERTY_A, propertyStatus }, allowedServiceIds: [SERVICE_X], now: NOW + 1_000 })).toMatchObject({ status: 'NONE', reasonCode: 'ENTITY_UNAVAILABLE' });
  });

  it('keeps action code but invalidates stale or authority-mismatched confirmations', () => {
    expect(sessionWithA().snapshots[PROPERTY_A].lastActionCode).toBe('REVIEW_PROVIDER_REPLY');
    expect(shouldDiscardMaxxisPendingConfirmation({ pending: { serviceId: SERVICE_X }, previousAccountKey: ACCOUNT_A, accountKey: ACCOUNT_A, previousPropertyId: PROPERTY_A, propertyId: PROPERTY_B, allowedServiceIds: [SERVICE_X], now: NOW })).toBe(true);
    expect(shouldDiscardMaxxisPendingConfirmation({ pending: { serviceId: SERVICE_X, expiresAt: new Date(NOW - 1).toISOString() }, previousAccountKey: ACCOUNT_A, accountKey: ACCOUNT_A, previousPropertyId: PROPERTY_A, propertyId: PROPERTY_A, allowedServiceIds: [SERVICE_X], now: NOW })).toBe(true);
  });

  it('resolves this provider only when continuity is authorized and unambiguous', () => {
    const resolution = resolveMaxxisContinuity(sessionWithA(), { accountKey: ACCOUNT_A, currentContext: { propertyId: PROPERTY_A }, allowedServiceIds: [SERVICE_X], now: NOW + 1_000 });
    expect(resolveMaxxisContinuityReference('What about this provider?', resolution, { candidateServiceIds: [SERVICE_X] })).toMatchObject({ status: 'resolved', intent: 'PROVIDER_REFERENCE', entity: { type: 'SERVICE', id: SERVICE_X } });
    expect(resolveMaxxisContinuityReference('What about this provider?', { ...resolution, context: { ...resolution.context, serviceId: '' } }, { candidateServiceIds: [SERVICE_X, SERVICE_Y] })).toMatchObject({ status: 'ambiguous', count: 2 });
  });

  it('resolves the second compared property and clarifies when it is ambiguous', () => {
    const resolution = resolveMaxxisContinuity(sessionWithA(), { accountKey: ACCOUNT_A, currentContext: { propertyId: PROPERTY_A }, allowedServiceIds: [SERVICE_X], now: NOW + 1_000 });
    expect(resolveMaxxisContinuityReference('And the second property?', resolution)).toMatchObject({ status: 'resolved', entity: { type: 'PROPERTY', id: PROPERTY_B } });
    const ambiguous = { ...resolution, context: { ...resolution.context, relatedPropertyIds: [PROPERTY_B, PROPERTY_C] } };
    expect(resolveMaxxisContinuityReference('And the second property?', ambiguous)).toMatchObject({ status: 'ambiguous', count: 2 });
  });

  it('collects only provider evidence belonging to the active property', () => {
    const evidence = buildMaxxisContinuityEvidence([
      { type: 'provider_message_sent', data: { propertyId: PROPERTY_A, serviceId: SERVICE_X, conversationId: 'conversation:a' } },
      { type: 'provider_message_sent', data: { propertyId: PROPERTY_B, serviceId: SERVICE_Y, conversationId: 'conversation:b' } },
    ], PROPERTY_A);
    expect(evidence).toMatchObject({ propertyId: PROPERTY_A, serviceIds: [SERVICE_X], latestProviderContext: { serviceId: SERVICE_X, conversationRef: 'conversation:a' } });
  });

  it('enriches the existing context snapshot without changing its schema', () => {
    const resolution = resolveMaxxisContinuity(sessionWithA(), { accountKey: ACCOUNT_A, currentContext: { propertyId: PROPERTY_A }, allowedServiceIds: [SERVICE_X], now: NOW + 1_000 });
    const merged = applyMaxxisContinuityToContextSnapshot({ property: { id: PROPERTY_A }, entity: { type: 'PROPERTY', id: PROPERTY_A } }, resolution);
    expect(merged).toMatchObject({ property: { id: PROPERTY_A }, provider: { serviceId: SERVICE_X }, entity: { type: 'SERVICE', id: SERVICE_X } });
    expect(merged.continuity).toBeUndefined();
  });

  it('helps Next Interaction resolve an existing candidate without creating one', () => {
    const continuityContext = sessionWithA().snapshots[PROPERTY_A];
    const selected = selectMaxxisNextInteraction({
      explicitUserIntent: { code: 'STATUS', requested: true },
      continuityContext,
    });
    expect(selected).toMatchObject({ interactionType: 'REVIEW_CHANGE', entityRef: { type: 'SERVICE', id: SERVICE_X } });
    expect(selectMaxxisNextInteraction({ continuityContext }).interactionType).toBe('PASSIVE');
  });

  it('has zero side effects, network, Gemini, Supabase or storage access', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const sideEffect = vi.fn();
    resolveMaxxisContinuity(sessionWithA(), { accountKey: ACCOUNT_A, currentContext: {}, allowedServiceIds: [SERVICE_X], fetch: sideEffect, gemini: sideEffect, supabase: sideEffect, storage: sideEffect, now: NOW + 1_000 });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(sideEffect).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
