import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { determineNextBestAction, type NextBestActionInput } from './nextBestAction.ts';

const nextBestActionSource = readFileSync(new URL('./nextBestAction.ts', import.meta.url), 'utf8');
const chatSource = readFileSync(new URL('../../maxxis-chat/index.ts', import.meta.url), 'utf8');
const assistantSource = [
  readFileSync(new URL('../../../../src/components/maxxis/MaxxisAssistant.jsx', import.meta.url), 'utf8'),
  readFileSync(new URL('../../../../src/components/maxxis/MaxxisCapabilities.jsx', import.meta.url), 'utf8'),
].join('\n');

const baseProperty = {
  id: '11111111-1111-4111-8111-111111111111',
  published: true,
  dealClosed: false,
  city: 'Dallas',
  state: 'TX',
  type: 'Single Family',
};

function decide(input: Partial<NextBestActionInput>) {
  return determineNextBestAction({
    property: baseProperty,
    missingFields: [],
    serviceNeeds: [],
    serviceMatches: null,
    ...input,
  });
}

const rehabNeed = {
  serviceType: 'General Contractor' as const,
  reasonCode: 'rehab_reported' as const,
  confidence: 'high' as const,
  sourceSignals: ['property.rehab' as const],
};

const lockedProviderMatch = [{
  serviceType: 'General Contractor' as const,
  confidence: 'high' as const,
  services: [{
    id: '22222222-2222-4222-8222-222222222222',
    title: 'Dallas Rehab Team',
    serviceType: 'General Contractor',
    description: '',
    price: null,
    markets: ['Dallas, TX'],
    image: '',
    contactAccess: { status: 'locked' as const, cost: 1, currency: 'nuggets' as const },
    fit: {
      score: 80,
      classification: 'good_fit' as const,
      calculable: true,
      reasons: [],
      evaluatedCriteria: 2,
      possibleCriteria: 2,
      earnedPoints: 80,
      evaluatedWeight: 100,
    },
  }],
}];

const unlockedProviderMatch = [{
  ...lockedProviderMatch[0],
  services: [{
    ...lockedProviderMatch[0].services[0],
    contactAccess: { status: 'already_unlocked' as const, cost: 0, currency: 'nuggets' as const },
  }],
}];

describe('Phase 4A Next Best Action', () => {
  it('returns review_missing_property_data when critical property data is missing', () => {
    const result = decide({ missingFields: ['price', 'images'] });
    expect(result.nextBestAction?.code).toBe('review_missing_property_data');
    expect(result.nextBestAction?.priority).toBe('high');
    expect(result.nextBestAction?.actionable).toBe(false);
  });

  it('returns search_service_provider when a service need exists but providers were not searched', () => {
    const result = decide({ serviceNeeds: [rehabNeed], serviceMatches: null });
    expect(result.nextBestAction?.code).toBe('search_service_provider');
    expect(result.nextBestAction?.priority).toBe('medium');
  });

  it('returns unlock_provider_contact when a matched provider is locked', () => {
    const result = decide({ serviceNeeds: [rehabNeed], serviceMatches: lockedProviderMatch });
    expect(result.nextBestAction?.code).toBe('unlock_provider_contact');
    expect(result.nextBestAction?.requiresConfirmation).toBe(true);
    expect(result.nextBestAction?.target?.serviceId).toBe('22222222-2222-4222-8222-222222222222');
  });

  it('returns draft_provider_message when provider is unlocked and no conversation exists', () => {
    const result = decide({ serviceNeeds: [rehabNeed], serviceMatches: unlockedProviderMatch, conversationState: 'no_conversation' });
    expect(result.nextBestAction?.code).toBe('draft_provider_message');
    expect(result.nextBestAction?.requiresConfirmation).toBe(false);
  });

  it('does not suggest a provider reply when a message was sent and no provider reply is detected', () => {
    const result = decide({ serviceNeeds: [rehabNeed], serviceMatches: unlockedProviderMatch, conversationState: 'message_sent_waiting_reply' });
    expect(result.conversationState).toBe('message_sent_waiting_reply');
    expect(result.nextBestAction?.code).not.toMatch(/reply/);
    expect(result.alternativeActions.map((item) => item.code)).not.toContain('send_reviewed_reply');
  });

  it('keeps a high-priority missing-data review ahead of a low-priority waiting state', () => {
    const result = decide({
      missingFields: ['price'],
      conversationState: 'message_sent_waiting_reply',
    });
    expect(result.nextBestAction?.code).toBe('review_missing_property_data');
    expect(result.nextBestAction?.priority).toBe('high');
  });

  it('returns review_provider_reply when the provider has replied', () => {
    const result = decide({
      serviceNeeds: [rehabNeed],
      serviceMatches: unlockedProviderMatch,
      conversationState: 'provider_replied',
      providerReplyFound: true,
      providerOpenItems: ['Can you send photos?'],
    });
    expect(result.nextBestAction?.code).toBe('review_provider_reply');
    expect(result.nextBestAction?.priority).toBe('high');
  });

  it('does not suggest a duplicate unlock when one is already pending', () => {
    const result = decide({
      serviceNeeds: [rehabNeed],
      serviceMatches: lockedProviderMatch,
      pendingActions: [{ actionType: 'unlock_provider_contact', serviceId: '22222222-2222-4222-8222-222222222222', status: 'pending' }],
    });
    expect(result.nextBestAction?.code).toBe('action_pending');
    expect(result.nextBestAction?.reasonCode).toBe('unlock_provider_contact_pending');
  });

  it('returns no operational action when the property is closed', () => {
    const result = decide({ property: { ...baseProperty, dealClosed: true } });
    expect(result.nextBestAction).toBeNull();
    expect(result.alternativeActions).toEqual([]);
  });

  it('keeps Gemini from choosing or changing the next best action', () => {
    expect(chatSource).toContain('Next Best Action');
    expect(chatSource).toContain('Gemini must never choose');
    expect(nextBestActionSource).not.toMatch(/callGemini|gemini|model/i);
  });

  it('does not execute actions, consume Nuggets, send messages, or create workflow status', () => {
    expect(nextBestActionSource).not.toMatch(/insert\s+into|update\s+public|delete\s+from|rpc\(|chat_messages|nuggets|consume|deduct|deal_status|pipeline_stage|negotiation_stage/i);
    expect(assistantSource).toContain('NextBestActionCard');
    const cardSource = assistantSource.includes('function NextBestActionCard')
      ? assistantSource.split('function NextBestActionCard')[1].split('function ProviderUnlockControls')[0]
      : '';
    expect(cardSource).not.toMatch(/prepareMaxxisProvider|confirmMaxxisProvider|cancelMaxxisProvider|consume|deduct|chat_messages/i);
  });
});
