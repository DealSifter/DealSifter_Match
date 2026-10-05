import { describe, expect, it } from 'vitest';
import {
  buildMaxxisSmartActions,
  dedupeMaxxisSmartActionsByLatestMessage,
  findSmartActionTargetService,
  safeSmartActionAnalytics,
} from './maxxisSmartActions';

const SERVICE_ID = '22222222-2222-4222-8222-222222222222';
const PROPERTY_ID = '11111111-1111-4111-8111-111111111111';

function sourceWithService(contactAccess, overrides = {}) {
  return {
    type: 'property_details',
    data: {
      property: { id: PROPERTY_ID, type: 'SFR', city: 'Dallas', state: 'TX', status: 'active', ...(overrides.property || {}) },
      missingFields: ['description'],
      metrics: null,
      analysis: { attentionPoints: ['description_missing'], missingInformation: ['description'], positiveSignals: [], limitations: [] },
      serviceNeeds: [{ serviceType: 'General Contractor', reasonCode: 'rehab_reported', confidence: 'high' }],
      serviceMatches: [{
        serviceType: 'General Contractor',
        services: [{
          id: SERVICE_ID,
          serviceId: SERVICE_ID,
          title: 'Rehab Partner',
          serviceType: 'General Contractor',
          contactAccess,
        }],
      }],
      workflow: { items: [{ code: 'inspection_completed', status: 'pending' }] },
      nextBestAction: { nextBestAction: { code: 'review_missing_property_data', priority: 'high' } },
    },
  };
}

describe('Maxxis Deal AI smart actions eligibility', () => {
  it('replaces generic snapshot actions with prioritized decision-gap actions', () => {
    const source = sourceWithService({ status: 'locked', cost: 1 });
    source.data.structuredAnalysis = {
      decisionActions: [
        { code: 'RESOLVE_EXIT_VALUE_EVIDENCE', gapCode: 'FLIP_exit_value_evidence',
          label: 'Revisar comparáveis', why: 'Exit value blocks the spread.', unlocks: 'EXIT_SPREAD', criticality: 'CRITICAL' },
        { code: 'RESOLVE_RENOVATION_SCOPE', gapCode: 'FLIP_renovation_scope',
          label: 'Validar reforma', why: 'Scope validates the benchmark.', unlocks: 'REHAB_BENCHMARK_VALIDATION',
          criticality: 'IMPORTANT', inputField: 'renovation_scope' },
      ],
    };

    const actions = buildMaxxisSmartActions(source, { surface: 'snapshot', maxVisible: 3 });
    expect(actions.map((action) => action.label)).toEqual(['Revisar comparáveis', 'Validar reforma']);
    expect(actions.every((action) => action.code.startsWith('DECISION_'))).toBe(true);
    expect(actions.map((action) => action.code)).not.toEqual(expect.arrayContaining(['VIEW_DEAL_GAPS', 'EXPLAIN_INSIGHT']));
  });

  it('removes a completed decision action and advances to the next one', () => {
    const source = sourceWithService({ status: 'locked', cost: 1 });
    source.data.structuredAnalysis = { decisionActions: [
      { code: 'RESOLVE_EXIT', gapCode: 'FLIP_EXIT', label: 'Review exit evidence', criticality: 'CRITICAL' },
      { code: 'RESOLVE_REHAB', gapCode: 'FLIP_REHAB', label: 'Validate rehab', criticality: 'IMPORTANT' },
    ] };
    const actions = buildMaxxisSmartActions(source, {
      surface: 'snapshot', completedActionCodes: ['DECISION_RESOLVE_EXIT'],
    });
    expect(actions.map((action) => action.code)).toEqual(['DECISION_RESOLVE_REHAB']);
  });

  it('surfaces provider viewing from a snapshot without jumping to unlock', () => {
    const actions = buildMaxxisSmartActions(sourceWithService({ status: 'locked', cost: 1 }), { surface: 'snapshot', maxVisible: 3 });

    expect(actions.map((action) => action.code)).toContain('VIEW_PROVIDERS');
    expect(actions.map((action) => action.code)).not.toContain('UNLOCK_PROVIDER_CONTACT');
    expect(actions.length).toBeLessThanOrEqual(3);
  });

  it('uses canonical action metadata and suppresses completed one-shot actions at the same state version', () => {
    const source = sourceWithService({ status: 'locked', cost: 1 });
    source.data.metrics = {
      metrics: {
        pricePerSqft: { calculable: true, value: 133, source: 'calculated' },
        acquisitionPlusRehab: { calculable: true, value: 276000, source: 'calculated' },
        capRate: { calculable: false, reason: 'missing_input', missingInputs: ['capRate'] },
      },
    };
    const actions = buildMaxxisSmartActions(source, { surface: 'snapshot', maxVisible: 3 });
    const explain = actions.find((action) => action.code === 'EXPLAIN_METRICS');

    expect(explain).toEqual(expect.objectContaining({
      type: 'INFORMATION',
      status: 'AVAILABLE',
      consumesOnExecution: true,
      generatedFromStateVersion: expect.stringMatching(/^v/),
      id: expect.stringContaining('EXPLAIN_METRICS'),
    }));
    expect(actions.map((action) => action.label)).not.toContain('Por que?');
    expect(actions).toHaveLength(3);

    const afterCompleted = buildMaxxisSmartActions(source, {
      surface: 'snapshot',
      maxVisible: 3,
      completedActionIds: [explain.id],
    });
    expect(afterCompleted.map((action) => action.code)).not.toContain('EXPLAIN_METRICS');
  });

  it('allows unlock but blocks draft when provider contact is locked', () => {
    const actions = buildMaxxisSmartActions(sourceWithService({ status: 'locked', cost: 1 }), { surface: 'providers', maxVisible: 10 });

    expect(actions).toContainEqual(expect.objectContaining({
      code: 'UNLOCK_PROVIDER_CONTACT',
      state: 'available',
      confirmationRequired: true,
      enabled: true,
    }));
    expect(actions).toContainEqual(expect.objectContaining({
      code: 'DRAFT_PROVIDER_MESSAGE',
      state: 'blocked',
      enabled: false,
    }));
  });

  it('hides unlock and enables draft when provider is already unlocked', () => {
    const actions = buildMaxxisSmartActions(sourceWithService({ status: 'already_unlocked', contact: { email: 'hidden@example.test' } }), { surface: 'providers', maxVisible: 10 });

    expect(actions).toContainEqual(expect.objectContaining({ code: 'UNLOCK_PROVIDER_CONTACT', state: 'completed', enabled: false }));
    expect(actions).toContainEqual(expect.objectContaining({ code: 'DRAFT_PROVIDER_MESSAGE', state: 'available', enabled: true }));
  });

  it('marks unlock pending when a confirmation is already open', () => {
    const actions = buildMaxxisSmartActions(sourceWithService({ status: 'locked', cost: 1 }), {
      surface: 'providers',
      maxVisible: 10,
      pendingProviderUnlock: { serviceId: SERVICE_ID },
    });

    expect(actions).toContainEqual(expect.objectContaining({ code: 'UNLOCK_PROVIDER_CONTACT', state: 'pending', enabled: false }));
  });

  it('blocks operational actions for closed or unavailable property context', () => {
    const actions = buildMaxxisSmartActions(
      sourceWithService({ status: 'locked', cost: 1 }, { property: { status: 'closed' } }),
      { surface: 'providers', maxVisible: 10 },
    );

    expect(actions).toContainEqual(expect.objectContaining({ code: 'UNLOCK_PROVIDER_CONTACT', state: 'unavailable', enabled: false }));
    expect(actions).toContainEqual(expect.objectContaining({ code: 'DRAFT_PROVIDER_MESSAGE', state: 'unavailable', enabled: false }));
  });

  it('returns no actions without structured or actionable context', () => {
    expect(buildMaxxisSmartActions({ type: 'text', data: null })).toEqual([]);
  });

  it('supports reply review from sent-message context without message body', () => {
    const actions = buildMaxxisSmartActions({ type: 'provider_message_sent', data: { serviceId: SERVICE_ID, propertyId: PROPERTY_ID, body: 'do not track' } });

    expect(actions).toEqual([expect.objectContaining({ code: 'REVIEW_PROVIDER_REPLY', enabled: true })]);
  });

  it('resolves target services deterministically', () => {
    const action = { code: 'UNLOCK_PROVIDER_CONTACT', target: { serviceId: SERVICE_ID } };

    expect(findSmartActionTargetService(sourceWithService({ status: 'locked' }), action)).toEqual(expect.objectContaining({ id: SERVICE_ID }));
  });

  it('sanitizes smart action analytics properties without PII payloads', () => {
    const safe = safeSmartActionAnalytics(
      { code: 'UNLOCK_PROVIDER_CONTACT', state: 'available', capability: 'provider_contact_unlock' },
      { result: 'success', surface: 'matches', contextVersion: 1, duration: 25, messageBody: 'secret' },
    );

    expect(safe).toEqual(expect.objectContaining({
      action_code: 'UNLOCK_PROVIDER_CONTACT',
      action_state: 'available',
      action_result: 'success',
      surface: 'matches',
      context_version: 1,
      duration_ms: 25,
    }));
    expect(JSON.stringify(safe)).not.toMatch(/secret|email|phone|body/i);
  });

  it('keeps only the latest equivalent action for the same target across messages', () => {
    const review = {
      code: 'REVIEW_PROVIDER_REPLY',
      capability: 'provider_conversation_analysis',
      target: { propertyId: PROPERTY_ID, serviceId: SERVICE_ID },
    };
    const otherProperty = '33333333-3333-4333-8333-333333333333';
    const visible = dedupeMaxxisSmartActionsByLatestMessage([
      { messageId: 'older', actions: [review] },
      { messageId: 'newer', actions: [{ ...review }] },
      { messageId: 'other-property', actions: [{ ...review, target: { ...review.target, propertyId: otherProperty } }] },
    ]);

    expect(visible.older).toEqual([]);
    expect(visible.newer).toEqual([review]);
    expect(visible['other-property']).toHaveLength(1);
  });
});
