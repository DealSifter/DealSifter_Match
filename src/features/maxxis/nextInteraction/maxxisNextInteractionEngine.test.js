import { describe, expect, it, vi } from 'vitest';
import { composeMaxxisExperience } from '../composition/maxxisExperienceComposer';
import { orchestrateMaxxisExperience } from '../orchestration/maxxisExperienceOrchestrator';
import { selectMaxxisNextInteraction } from './maxxisNextInteractionEngine';

const PROPERTY_ID = '11111111-1111-4111-8111-111111111111';
const SERVICE_ID = '22222222-2222-4222-8222-222222222222';

function action(code, overrides = {}) {
  return {
    code,
    capability: code.toLowerCase(),
    enabled: true,
    state: 'available',
    priority: 50,
    target: { propertyId: PROPERTY_ID, ...overrides.target },
    ...overrides,
  };
}

describe('Maxxis Next Best Interaction Engine', () => {
  it('keeps explicit user intent sovereign over a provider reply', () => {
    const result = selectMaxxisNextInteraction({
      explicitUserIntent: { code: 'CAP_RATE', requested: true },
      proactiveSignal: { code: 'PROVIDER_REPLIED', serviceId: SERVICE_ID },
      smartActions: [action('REVIEW_PROVIDER_REPLY'), action('EXPLAIN_INSIGHT')],
    });
    expect(result).toMatchObject({ interactionType: 'EXPLAIN_METRIC', reasonCode: 'USER_REQUESTED', confidence: 'HIGH' });
  });

  it.each([
    ['pending confirmation', { pendingConfirmation: true, actionState: { phase: 'CONFIRMATION', code: 'UNLOCK_PROVIDER_CONTACT' } }, 'REVIEW_PENDING_ACTION', 'PENDING_CONFIRMATION'],
    ['provider reply', { proactiveSignal: { code: 'PROVIDER_REPLIED', serviceId: SERVICE_ID }, smartActions: [action('REVIEW_PROVIDER_REPLY')] }, 'REVIEW_PROVIDER_REPLY', 'NEW_PROVIDER_REPLY'],
    ['deal gap', { dealGaps: [{ code: 'MISSING_REHAB', propertyId: PROPERTY_ID }], smartActions: [action('VIEW_DEAL_GAPS')] }, 'REVIEW_DEAL_GAP', 'IMPORTANT_GAP'],
    ['workflow continuation', { workflowState: { status: 'OPEN', propertyId: PROPERTY_ID }, smartActions: [action('REVIEW_WORKFLOW')] }, 'CONTINUE_WORKFLOW', 'WORKFLOW_OPEN'],
    ['provider help', { smartActions: [action('VIEW_PROVIDERS')] }, 'REVIEW_PROVIDERS', 'PROVIDER_HELP_AVAILABLE'],
    ['metric explanation', { metric: { code: 'CAP_RATE', propertyId: PROPERTY_ID }, smartActions: [action('EXPLAIN_INSIGHT')] }, 'EXPLAIN_METRIC', 'METRIC_EXPLANATION_AVAILABLE'],
    ['memory continuation', { memoryRecall: { propertyId: PROPERTY_ID, freshness: 'FRESH' } }, 'RESUME_CONTEXT', 'MEMORY_CONTINUATION'],
  ])('selects %s only from supported state', (_label, input, interactionType, reasonCode) => {
    expect(selectMaxxisNextInteraction(input)).toMatchObject({ interactionType, reasonCode });
  });

  it('uses an eligible provider action as the actionable response to a rehab gap', () => {
    const result = selectMaxxisNextInteraction({
      dealGaps: [{ code: 'MISSING_REHAB', propertyId: PROPERTY_ID }],
      smartActions: [action('VIEW_DEAL_GAPS'), action('VIEW_PROVIDERS')],
    });
    expect(result).toMatchObject({ interactionType: 'REVIEW_PROVIDERS', reasonCode: 'IMPORTANT_GAP', suggestedAction: { code: 'VIEW_PROVIDERS' } });
  });

  it.each([
    ['stale memory', { memoryRecall: { propertyId: PROPERTY_ID, freshness: 'STALE' } }],
    ['reviewed change', { proactiveSignal: { code: 'DEAL_CONTEXT_UPDATED', reviewed: true, propertyId: PROPERTY_ID } }],
    ['expired event', { now: 2_000, proactiveSignal: { code: 'PROVIDER_REPLIED', serviceId: SERVICE_ID, expiresAt: new Date(1_000).toISOString() } }],
  ])('ignores %s', (_label, input) => {
    expect(selectMaxxisNextInteraction(input).interactionType).toBe('PASSIVE');
  });

  it('deduplicates semantically equivalent candidates into one deterministic selection', () => {
    const input = {
      proactiveSignals: [
        { code: 'PROVIDER_REPLIED', serviceId: SERVICE_ID, dedupeKey: 'reply:service' },
        { code: 'CONVERSATION_CHANGED', serviceId: SERVICE_ID, dedupeKey: 'reply:service' },
      ],
      smartActions: [action('REVIEW_PROVIDER_REPLY')],
    };
    expect(selectMaxxisNextInteraction(input)).toEqual(selectMaxxisNextInteraction(input));
    expect(selectMaxxisNextInteraction(input).semanticKey).toBe('REPLY:SERVICE');
  });

  it('does not promote a blocked locked-provider action', () => {
    const result = selectMaxxisNextInteraction({ smartActions: [action('UNLOCK_PROVIDER_CONTACT', { enabled: false, state: 'blocked' })] });
    expect(result.interactionType).toBe('PASSIVE');
  });

  it('suggests but never executes or leaks financial unlock data', () => {
    const execute = vi.fn();
    const debit = vi.fn();
    const result = selectMaxxisNextInteraction({
      explicitUserIntent: { code: 'UNLOCK_PROVIDER', requested: true },
      smartActions: [action('UNLOCK_PROVIDER_CONTACT', { confirmationRequired: true, nuggetCost: 25, execute, debit, target: { serviceId: SERVICE_ID } })],
    });
    expect(result).toMatchObject({ interactionType: 'REVIEW_UNLOCK', suggestedAction: { code: 'UNLOCK_PROVIDER_CONTACT', confirmationRequired: true } });
    expect(JSON.stringify(result)).not.toMatch(/nugget|cost|execute|debit/i);
    expect(execute).not.toHaveBeenCalled();
    expect(debit).not.toHaveBeenCalled();
  });

  it.each(['CLOSED', 'UNAVAILABLE'])('keeps a %s property passive without explicit intent', (propertyStatus) => {
    expect(selectMaxxisNextInteraction({ currentState: { propertyStatus }, dealGaps: [{ code: 'MISSING_REHAB' }] }).reasonCode).toBe('PROPERTY_UNAVAILABLE');
  });

  it('preserves attention suppression and proactive OFF in the Orchestrator', () => {
    const base = { maxxisOpen: false, proactiveSignal: { code: 'PROVIDER_REPLIED', serviceId: SERVICE_ID }, attentionResult: { shouldSurface: true, allowBubble: false } };
    expect(orchestrateMaxxisExperience(base).attentionMode).toBe('NONE');
    expect(orchestrateMaxxisExperience({ ...base, attentionResult: { shouldSurface: true, allowBubble: true }, preferences: { proactiveEnabled: false } }).attentionMode).toBe('NONE');
  });

  it('returns PASSIVE when no useful interaction exists', () => {
    expect(selectMaxxisNextInteraction({ dealSnapshot: { propertyId: PROPERTY_ID } })).toMatchObject({ interactionType: 'PASSIVE', reasonCode: 'NO_ACTIONABLE_CHANGE' });
  });

  it('is independent from PT/EN/ES presentation language', () => {
    const input = { dealGaps: [{ code: 'MISSING_ARV', propertyId: PROPERTY_ID }], smartActions: [action('VIEW_DEAL_GAPS')] };
    expect(selectMaxxisNextInteraction({ ...input, language: 'pt' })).toEqual(selectMaxxisNextInteraction({ ...input, language: 'en' }));
    expect(selectMaxxisNextInteraction({ ...input, language: 'es' })).toEqual(selectMaxxisNextInteraction({ ...input, language: 'en' }));
  });

  it('returns a sanitized serializable contract without PII', () => {
    const result = selectMaxxisNextInteraction({ proactiveSignal: { code: 'PROVIDER_REPLIED', serviceId: SERVICE_ID, email: 'private@example.com', phone: '+1 555 555 5555', messageBody: 'secret' } });
    expect(() => JSON.stringify(result)).not.toThrow();
    expect(JSON.stringify(result)).not.toMatch(/private|example|555|secret|messageBody/i);
  });

  it('has zero network, Gemini, Supabase, storage or navigation side effects', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const sideEffect = vi.fn();
    selectMaxxisNextInteraction({
      explicitUserIntent: { code: 'STATUS', requested: true },
      fetch: sideEffect,
      gemini: sideEffect,
      supabase: { from: sideEffect },
      storage: { getItem: sideEffect, setItem: sideEffect },
      navigate: sideEffect,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(sideEffect).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('integrates the WOW journey through Engine, Orchestrator and Composer', () => {
    const providers = action('VIEW_PROVIDERS', { priority: 90 });
    const reviewReply = action('REVIEW_PROVIDER_REPLY', { priority: 84, target: { serviceId: SERVICE_ID } });
    const workflow = action('REVIEW_WORKFLOW', { priority: 62 });

    const gapDecision = orchestrateMaxxisExperience({
      maxxisOpen: true,
      dealGaps: [{ code: 'MISSING_REHAB', propertyId: PROPERTY_ID }],
      smartActions: [providers],
    });
    const gapComposition = composeMaxxisExperience({ decision: gapDecision, facts: { missingItems: ['MISSING_REHAB'] } });
    expect(gapDecision.nextInteraction.interactionType).toBe('REVIEW_PROVIDERS');
    expect(gapComposition.primaryAction.code).toBe('VIEW_PROVIDERS');

    const replyDecision = orchestrateMaxxisExperience({
      maxxisOpen: true,
      proactiveSignal: { code: 'PROVIDER_REPLIED', serviceId: SERVICE_ID, dedupeKey: 'reply-1' },
      conversationState: { code: 'PROVIDER_REPLIED', serviceId: SERVICE_ID },
      smartActions: [reviewReply, providers],
    });
    expect(replyDecision).toMatchObject({ mode: 'PROVIDER_REVIEW', nextInteraction: { interactionType: 'REVIEW_PROVIDER_REPLY' } });
    expect(replyDecision.primaryAction.code).toBe('REVIEW_PROVIDER_REPLY');

    const continued = orchestrateMaxxisExperience({
      maxxisOpen: true,
      proactiveSignal: { code: 'PROVIDER_REPLIED', serviceId: SERVICE_ID, dedupeKey: 'reply-1', consumed: true },
      workflowState: { status: 'OPEN', propertyId: PROPERTY_ID },
      smartActions: [workflow],
    });
    expect(continued).toMatchObject({ mode: 'WORKFLOW_REVIEW', nextInteraction: { interactionType: 'CONTINUE_WORKFLOW' }, primaryAction: { code: 'REVIEW_WORKFLOW' } });
    expect([continued.primaryContent, ...continued.secondaryContent].filter(Boolean).map((item) => item.semanticKey).length).toBe(new Set([continued.primaryContent, ...continued.secondaryContent].filter(Boolean).map((item) => item.semanticKey)).size);
  });
});
