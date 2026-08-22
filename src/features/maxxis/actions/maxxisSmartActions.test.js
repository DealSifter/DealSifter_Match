import { describe, expect, it } from 'vitest';
import {
  buildMaxxisSmartActions,
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

describe('Maxxis smart actions eligibility', () => {
  it('surfaces provider viewing from a snapshot without jumping to unlock', () => {
    const actions = buildMaxxisSmartActions(sourceWithService({ status: 'locked', cost: 1 }), { surface: 'snapshot', maxVisible: 3 });

    expect(actions.map((action) => action.code)).toContain('VIEW_PROVIDERS');
    expect(actions.map((action) => action.code)).not.toContain('UNLOCK_PROVIDER_CONTACT');
    expect(actions.length).toBeLessThanOrEqual(3);
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
});
