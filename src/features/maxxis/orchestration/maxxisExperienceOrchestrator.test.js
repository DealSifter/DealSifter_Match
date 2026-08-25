import { describe, expect, it, vi } from 'vitest';
import { MAXXIS_AVATAR_STATES } from '../avatar/maxxisAvatarStates';
import { orchestrateMaxxisExperience, safeMaxxisExperienceAnalytics } from './maxxisExperienceOrchestrator';
import { MAXXIS_EXPERIENCE_ATTENTION, MAXXIS_EXPERIENCE_MODES } from './maxxisExperienceTypes';

const PROPERTY_ID = '11111111-1111-4111-8111-111111111111';
const SERVICE_ID = '22222222-2222-4222-8222-222222222222';

function snapshot(overrides = {}) {
  return { propertyId: PROPERTY_ID, freshness: 'FRESH', ...overrides };
}

function action(code, priority = 50, overrides = {}) {
  return {
    code,
    capability: code,
    enabled: true,
    state: 'available',
    priority,
    target: { propertyId: PROPERTY_ID, ...overrides.target },
    ...overrides,
  };
}

function decide(overrides = {}) {
  return orchestrateMaxxisExperience({
    maxxisEnabled: true,
    maxxisOpen: true,
    preferences: { proactiveEnabled: true },
    killSwitches: { messagingEnabled: true, contactUnlockEnabled: true },
    ...overrides,
  });
}

describe('Maxxis Experience Orchestrator', () => {
  it('1. keeps a passively opened property silent', () => {
    const result = decide({ maxxisOpen: false, dealSnapshot: snapshot() });
    expect(result).toMatchObject({ mode: 'PASSIVE', primaryContent: null, primaryAction: null, attentionMode: 'NONE', avatarStateHint: 'OBSERVING' });
  });

  it('2. makes the snapshot primary when the user asks for status', () => {
    const result = decide({ explicitUserIntent: { code: 'STATUS', requested: true }, dealSnapshot: snapshot(), dealGaps: [{ code: 'MISSING_ARV' }] });
    expect(result.primaryContent.type).toBe('DEAL_SNAPSHOT');
    expect(result.secondaryContent[0].type).toBe('DEAL_GAP');
    expect(result.mode).toBe('ANALYSIS');
  });

  it('3. preserves a focused metric request', () => {
    const result = decide({ explicitUserIntent: { code: 'CAP_RATE', requested: true, focus: 'METRIC' }, dealSnapshot: snapshot(), metric: { code: 'CAP_RATE' } });
    expect(result.primaryContent.type).toBe('METRIC');
  });

  it('4. selects one provider reply for proactive change review', () => {
    const result = decide({ maxxisOpen: false, proactiveSignal: { code: 'PROVIDER_REPLIED', serviceId: SERVICE_ID }, attentionResult: { shouldSurface: true, allowBubble: true, priority: 90 } });
    expect(result).toMatchObject({ mode: 'CHANGE_REVIEW', attentionMode: 'BUBBLE', avatarStateHint: 'NOTICED' });
    expect(result.primaryContent.type).toBe('PROVIDER_REPLY');
  });

  it('5. preserves an Attention Controller bubble suppression', () => {
    const result = decide({ maxxisOpen: false, proactiveSignal: { code: 'PROVIDER_REPLIED', serviceId: SERVICE_ID }, attentionResult: { shouldSurface: true, allowBubble: false } });
    expect(result.attentionMode).toBe('NONE');
  });

  it('6. routes a provider reply into chat when Maxxis is open', () => {
    const result = decide({ proactiveSignal: { code: 'PROVIDER_REPLIED', serviceId: SERVICE_ID }, attentionResult: { shouldSurface: true, allowBubble: true } });
    expect(result).toMatchObject({ mode: 'PROVIDER_REVIEW', attentionMode: 'IN_CHAT' });
  });

  it('7. selects requested memory recall without competing analysis', () => {
    const result = decide({ explicitUserIntent: { code: 'WHERE_WERE_WE', requested: true }, memoryRecall: { propertyId: PROPERTY_ID }, dealSnapshot: snapshot() });
    expect(result.mode).toBe('MEMORY_RECALL');
    expect(result.primaryContent.type).toBe('MEMORY_RECALL');
    expect(result.secondaryContent.every((item) => item.type !== 'DEAL_SNAPSHOT')).toBe(true);
  });

  it('8. lets current state win over conflicting memory for the same fact', () => {
    const semanticKey = `PROVIDER_UNLOCKED:${SERVICE_ID}`;
    const result = decide({
      explicitUserIntent: { code: 'WHAT_CHANGED', requested: true },
      contents: [
        { type: 'MEMORY_CHANGE', semanticKey, source: 'MEMORY', value: { status: 'LOCKED' }, priority: 80 },
        { type: 'MEMORY_CHANGE', semanticKey, source: 'CURRENT', value: { status: 'UNLOCKED' }, priority: 70 },
      ],
    });
    expect(result.primaryContent.source).toBe('CURRENT');
    expect(result.primaryContent.value.status).toBe('UNLOCKED');
  });

  it('9. makes unlock confirmation dominant and suppresses smart actions', () => {
    const result = decide({ pendingConfirmation: true, actionState: { phase: 'CONFIRMATION', code: 'UNLOCK_PROVIDER_CONTACT' }, smartActions: [action('DRAFT_PROVIDER_MESSAGE')] });
    expect(result).toMatchObject({ mode: 'ACTION_CONFIRMATION', primaryAction: null, avatarStateHint: 'WAITING' });
  });

  it('10. exposes only a newly available action after unlock success', () => {
    const result = decide({ actionState: { phase: 'SUCCESS', code: 'UNLOCK_PROVIDER_CONTACT' }, smartActions: [action('UNLOCK_PROVIDER_CONTACT', 90, { state: 'completed' }), action('DRAFT_PROVIDER_MESSAGE', 80)] });
    expect(result).toMatchObject({ mode: 'ACTION_RESULT', avatarStateHint: 'SUCCESS' });
    expect(result.primaryAction.code).toBe('DRAFT_PROVIDER_MESSAGE');
  });

  it('11. coordinates message draft preparation', () => {
    const result = decide({ actionState: { phase: 'PREPARATION', code: 'DRAFT_PROVIDER_MESSAGE' } });
    expect(result).toMatchObject({ mode: 'ACTION_PREPARATION', avatarStateHint: 'PROCESSING' });
  });

  it('12. coordinates message confirmation without secondary actions', () => {
    const result = decide({ actionState: { phase: 'CONFIRMATION', code: 'SEND_PROVIDER_MESSAGE' }, smartActions: [action('VIEW_DEAL_GAPS')] });
    expect(result.mode).toBe('ACTION_CONFIRMATION');
    expect(result.secondaryActions).toEqual([]);
  });

  it('13. coordinates message success feedback', () => {
    const result = decide({ actionState: { phase: 'SUCCESS', code: 'SEND_PROVIDER_MESSAGE' } });
    expect(result).toMatchObject({ mode: 'ACTION_RESULT', avatarStateHint: 'SUCCESS' });
  });

  it('14. isolates an explicit workflow review', () => {
    const result = decide({ explicitUserIntent: { code: 'WORKFLOW', requested: true }, workflowState: { propertyId: PROPERTY_ID }, dealSnapshot: snapshot() });
    expect(result.primaryContent.type).toBe('WORKFLOW');
    expect(result.mode).toBe('WORKFLOW_REVIEW');
  });

  it('15. isolates an explicit property comparison', () => {
    const result = decide({ explicitUserIntent: { code: 'COMPARISON', requested: true }, comparison: { code: 'PROPERTY_SET' } });
    expect(result).toMatchObject({ mode: 'COMPARISON', primaryContent: { type: 'COMPARISON' } });
  });

  it.each(['CLOSED', 'UNAVAILABLE'])(
    '%s property remains passive without an explicit request',
    (propertyStatus) => {
      const result = decide({ maxxisOpen: false, currentState: { propertyStatus }, proactiveSignal: { code: 'NEW_DEAL_GAP', propertyId: PROPERTY_ID }, attentionResult: { shouldSurface: true, allowBubble: true } });
      expect(result.mode).toBe('PASSIVE');
    },
  );

  it('18. selects only the highest-ranked fact from multiple signals', () => {
    const result = decide({
      maxxisOpen: false,
      proactiveSignal: { code: 'PROVIDER_REPLIED', serviceId: SERVICE_ID },
      attentionResult: { shouldSurface: true, allowBubble: true, priority: 95 },
      contents: [{ type: 'DEAL_GAP', code: 'MISSING_ARV', priority: 40 }],
    });
    expect(result.primaryContent.type).toBe('PROVIDER_REPLY');
    expect(result.secondaryContent).toHaveLength(1);
  });

  it('19. deduplicates semantically equivalent provider reply content', () => {
    const result = decide({
      explicitUserIntent: { code: 'REVIEW_PROVIDER_REPLY', requested: true },
      contents: [
        { type: 'PROVIDER_REPLY', code: 'PROVIDER_REPLIED', serviceId: SERVICE_ID, source: 'CURRENT', priority: 90 },
        { type: 'PROVIDER_REPLY', code: 'CONVERSATION_CHANGED', serviceId: SERVICE_ID, source: 'MEMORY', priority: 80 },
      ],
    });
    expect([result.primaryContent, ...result.secondaryContent]).toHaveLength(1);
  });

  it('20. deduplicates actions by capability and target', () => {
    const duplicate = action('REVIEW_NEXT_STEP', 70, { capability: 'next_best_action' });
    const result = decide({ explicitUserIntent: { code: 'STATUS', requested: true }, dealSnapshot: snapshot(), smartActions: [duplicate, { ...duplicate, code: 'NBA_REVIEW', priority: 60 }] });
    expect([result.primaryAction, ...result.secondaryActions].filter(Boolean)).toHaveLength(1);
  });

  it('21. never promotes stale content to primary', () => {
    const result = decide({ explicitUserIntent: { code: 'STATUS', requested: true }, dealSnapshot: snapshot({ freshness: 'STALE' }) });
    expect(result.mode).toBe('PASSIVE');
    expect(result.primaryContent).toBeNull();
  });

  it('22. degrades safely when an engine result is missing', () => {
    expect(decide({ explicitUserIntent: { code: 'STATUS', requested: true } }).mode).toBe('PASSIVE');
  });

  it('23. respects the messaging kill switch', () => {
    const result = decide({ explicitUserIntent: { code: 'STATUS', requested: true }, dealSnapshot: snapshot(), killSwitches: { messagingEnabled: false }, smartActions: [action('DRAFT_PROVIDER_MESSAGE'), action('VIEW_DEAL_GAPS', 40)] });
    expect([result.primaryAction, ...result.secondaryActions].map((item) => item?.code)).toEqual(['VIEW_DEAL_GAPS']);
  });

  it('24. respects the contact unlock kill switch', () => {
    const result = decide({ explicitUserIntent: { code: 'STATUS', requested: true }, dealSnapshot: snapshot(), killSwitches: { contactUnlockEnabled: false }, smartActions: [action('UNLOCK_PROVIDER_CONTACT'), action('VIEW_DEAL_GAPS', 40)] });
    expect([result.primaryAction, ...result.secondaryActions].map((item) => item?.code)).toEqual(['VIEW_DEAL_GAPS']);
  });

  it('25. respects proactive preference OFF', () => {
    const result = decide({ maxxisOpen: false, preferences: { proactiveEnabled: false }, proactiveSignal: { code: 'PROVIDER_REPLIED', serviceId: SERVICE_ID }, attentionResult: { shouldSurface: true, allowBubble: true } });
    expect(result.attentionMode).toBe('NONE');
  });

  it('26. falls back to current snapshot when requested memory is unavailable', () => {
    const result = decide({ explicitUserIntent: { code: 'WHERE_WERE_WE', requested: true }, memoryRecall: { freshness: 'UNAVAILABLE' }, dealSnapshot: snapshot() });
    expect(result).toMatchObject({ mode: 'ANALYSIS', primaryContent: { type: 'DEAL_SNAPSHOT', source: 'CURRENT' } });
  });

  it('27. supports partial trusted context', () => {
    const result = decide({ explicitUserIntent: { code: 'STATUS', requested: true }, dealSnapshot: { freshness: 'FRESH' } });
    expect(result.primaryContent.type).toBe('DEAL_SNAPSHOT');
  });

  it('28. has no account state to leak across resets', () => {
    const input = { explicitUserIntent: { code: 'STATUS', requested: true }, dealSnapshot: snapshot() };
    expect(decide({ ...input, accountKey: 'account-a' })).toEqual(decide({ ...input, accountKey: 'account-b' }));
  });

  it('29. returns deterministic decisions for identical inputs', () => {
    const input = { explicitUserIntent: { code: 'STATUS', requested: true }, dealSnapshot: snapshot(), smartActions: [action('VIEW_DEAL_GAPS')] };
    expect(decide(input)).toEqual(decide(input));
  });

  it('30. performs zero network, storage, Gemini, Supabase or navigation side effects', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const storage = { getItem: vi.fn(), setItem: vi.fn() };
    const navigation = vi.fn();
    decide({ explicitUserIntent: { code: 'STATUS', requested: true }, dealSnapshot: snapshot(), storage, navigation, gemini: vi.fn(), supabase: {} });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(navigation).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('integrates the WOW flow as one dominant moment at each step', () => {
    const dayOne = decide({ explicitUserIntent: { code: 'STATUS', requested: true }, dealSnapshot: snapshot(), dealGaps: [{ code: 'MISSING_ARV' }], smartActions: [action('REVIEW_NEXT_STEP')] });
    const reply = decide({ maxxisOpen: false, proactiveSignal: { code: 'PROVIDER_REPLIED', serviceId: SERVICE_ID }, attentionResult: { shouldSurface: true, allowBubble: true } });
    const opened = decide({ explicitUserIntent: { code: 'REVIEW_PROVIDER_REPLY', requested: true }, conversationState: { serviceId: SERVICE_ID }, smartActions: [action('DRAFT_PROVIDER_REPLY')] });
    const waiting = decide({ actionState: { phase: 'CONFIRMATION', code: 'SEND_PROVIDER_MESSAGE' } });
    const success = decide({ actionState: { phase: 'SUCCESS', code: 'SEND_PROVIDER_MESSAGE' } });
    expect([dayOne.mode, reply.mode, opened.mode, waiting.mode, success.mode]).toEqual(['ANALYSIS', 'CHANGE_REVIEW', 'PROVIDER_REVIEW', 'ACTION_CONFIRMATION', 'ACTION_RESULT']);
    expect(reply.attentionMode).toBe('BUBBLE');
    expect(waiting.avatarStateHint).toBe(MAXXIS_AVATAR_STATES.WAITING);
    expect(success.avatarStateHint).toBe(MAXXIS_AVATAR_STATES.SUCCESS);
  });

  it('integrates the returning-session memory WOW flow without duplicate reply', () => {
    const result = decide({
      explicitUserIntent: { code: 'WHERE_WERE_WE', requested: true },
      memoryRecall: { propertyId: PROPERTY_ID },
      memoryChanges: [
        { code: 'PROVIDER_REPLIED', serviceId: SERVICE_ID, semanticKey: `PROVIDER_REPLIED:${SERVICE_ID}` },
        { code: 'CONVERSATION_CHANGED', serviceId: SERVICE_ID, semanticKey: `PROVIDER_REPLIED:${SERVICE_ID}` },
      ],
      nextBestAction: { code: 'REVIEW_NEXT_STEP' },
    });
    expect(result.mode).toBe(MAXXIS_EXPERIENCE_MODES.MEMORY_RECALL);
    expect(result.primaryContent.type).toBe('MEMORY_RECALL');
    expect(result.secondaryContent).toHaveLength(2);
    expect(new Set(result.secondaryContent.map((item) => item.semanticKey)).size).toBe(2);
  });

  it('keeps observability aggregated and identifier-free', () => {
    const telemetry = safeMaxxisExperienceAnalytics(decide({ explicitUserIntent: { code: 'STATUS', requested: true }, dealSnapshot: snapshot(), smartActions: [action('VIEW_DEAL_GAPS')] }), 1.4);
    expect(telemetry).toEqual({ experience_mode: 'ANALYSIS', primary_content_type: 'DEAL_SNAPSHOT', primary_action_code: 'VIEW_DEAL_GAPS', decision_reason: 'EXPLICIT_USER_INTENT', decision_duration_ms: 1 });
    expect(JSON.stringify(telemetry)).not.toContain(PROPERTY_ID);
  });

  it('returns disabled-safe without content or actions', () => {
    const result = decide({ maxxisEnabled: false, dealSnapshot: snapshot(), smartActions: [action('VIEW_DEAL_GAPS')] });
    expect(result).toMatchObject({ mode: MAXXIS_EXPERIENCE_MODES.PASSIVE, attentionMode: MAXXIS_EXPERIENCE_ATTENTION.NONE, avatarStateHint: MAXXIS_AVATAR_STATES.IDLE });
  });
});
