import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createMaxxisAttentionController,
  resolveMaxxisAttentionPolicy,
  safeMaxxisAttentionAnalytics,
} from './maxxisAttentionController';
import { MAXXIS_ATTENTION_REASON_CODES } from './maxxisAttentionRules';

function allowed(overrides = {}) {
  return resolveMaxxisAttentionPolicy({
    proactiveEnabled: true,
    currentSurface: 'dashboard',
    currentSubview: 'feed_deck',
    avatarState: 'OBSERVING',
    animationIntensity: 'NORMAL',
    hasSignal: true,
    now: 10_000,
    ...overrides,
  });
}

function candidate(id, priority = 50, expiresAt = 70_000) {
  return {
    signal: { dedupeKey: id, code: 'PROVIDER_REPLIED' },
    attention: { priority, expiresAt },
  };
}

afterEach(() => vi.useRealTimers());

describe('Maxxis attention safety policy', () => {
  it('allows one relevant bubble during normal property browsing', () => {
    expect(allowed()).toMatchObject({
      allowBubble: true,
      allowAnimation: true,
      deferAttention: false,
      reasonCode: MAXXIS_ATTENTION_REASON_CODES.ALLOWED,
    });
  });

  it.each([
    [{ activeModal: 'checkout' }, MAXXIS_ATTENTION_REASON_CODES.CRITICAL_MODAL],
    [{ checkoutActive: true }, MAXXIS_ATTENTION_REASON_CODES.SENSITIVE_SURFACE],
    [{ onboardingSaving: true }, MAXXIS_ATTENTION_REASON_CODES.FORM_SUBMITTING],
    [{ formSubmitting: true }, MAXXIS_ATTENTION_REASON_CODES.FORM_SUBMITTING],
    [{ confirmationActive: true }, MAXXIS_ATTENTION_REASON_CODES.CONFIRMATION_ACTIVE],
    [{ navigationTransition: true }, MAXXIS_ATTENTION_REASON_CODES.NAVIGATION_TRANSITION],
    [{ mobileKeyboardOpen: true }, MAXXIS_ATTENTION_REASON_CODES.MOBILE_KEYBOARD],
    [{ mobileViewportCongested: true }, MAXXIS_ATTENTION_REASON_CODES.MOBILE_CONGESTED],
    [{ currentSurface: 'onboarding' }, MAXXIS_ATTENTION_REASON_CODES.SENSITIVE_SURFACE],
  ])('defers attention under a sensitive condition %#', (inputs, reasonCode) => {
    expect(allowed(inputs)).toMatchObject({ allowBubble: false, deferAttention: true, reasonCode });
  });

  it('defers typing only on important form/chat surfaces', () => {
    expect(allowed({ userTyping: true, currentSubview: 'human_chat' }).reasonCode)
      .toBe(MAXXIS_ATTENTION_REASON_CODES.USER_TYPING);
    expect(allowed({ userTyping: true, currentSurface: 'dashboard' }).allowBubble).toBe(true);
  });

  it.each([
    ['PROCESSING', MAXXIS_ATTENTION_REASON_CODES.PROCESSING_ACTIVE],
    ['WAITING', MAXXIS_ATTENTION_REASON_CODES.WAITING_ACTIVE],
    ['SUCCESS', MAXXIS_ATTENTION_REASON_CODES.SUCCESS_ACTIVE],
  ])('does not compete with functional avatar state %s', (avatarState, reasonCode) => {
    expect(allowed({ avatarState })).toMatchObject({ allowBubble: false, deferAttention: true, reasonCode });
  });

  it('suppresses external attention while Maxxis is open but preserves real internal animation', () => {
    expect(allowed({ maxxisOpen: true, avatarState: 'PROCESSING' })).toMatchObject({
      allowBubble: false,
      allowAnimation: true,
      deferAttention: false,
      reasonCode: MAXXIS_ATTENTION_REASON_CODES.MAXXIS_OPEN,
    });
    expect(allowed({ maxxisOpen: true, activeModal: 'checkout' })).toMatchObject({
      allowBubble: false,
      allowAnimation: false,
      reasonCode: MAXXIS_ATTENTION_REASON_CODES.CRITICAL_MODAL,
    });
  });

  it('keeps bubble eligibility separate from OFF and reduced-motion animation preferences', () => {
    expect(allowed({ animationIntensity: 'OFF' })).toMatchObject({ allowBubble: true, allowAnimation: false, visualIntensity: 'OFF' });
    expect(allowed({ reducedMotion: true })).toMatchObject({ allowBubble: true, allowAnimation: false, visualIntensity: 'OFF' });
    expect(allowed({ animationIntensity: 'NORMAL', activeModal: 'unlock' })).toMatchObject({ allowBubble: false, allowAnimation: false });
  });

  it('respects future proactivity preference without disabling normal avatar animation', () => {
    expect(allowed({ proactiveEnabled: false })).toMatchObject({
      allowBubble: false,
      allowAnimation: true,
      reasonCode: MAXXIS_ATTENTION_REASON_CODES.PROACTIVITY_DISABLED,
    });
    expect(allowed({ proactiveEnabled: false, hasSignal: false })).toMatchObject({ allowBubble: false, allowAnimation: true });
  });

  it('applies deterministic noticed, success and global animation fatigue', () => {
    const recentAttentionEvents = [{ kind: 'NOTICED', at: 9_000 }];
    expect(allowed({ attentionKind: 'NOTICED', recentAttentionEvents })).toMatchObject({
      allowAnimation: false,
      reasonCode: MAXXIS_ATTENTION_REASON_CODES.NOTICED_FATIGUE,
      retryAfterMs: 1_400,
    });
    expect(allowed({ attentionKind: 'SUCCESS', recentAttentionEvents: [{ kind: 'SUCCESS', at: 9_000 }] }).reasonCode)
      .toBe(MAXXIS_ATTENTION_REASON_CODES.SUCCESS_FATIGUE);
    expect(allowed({ attentionKind: 'NOTICED', recentAttentionEvents: [
      { kind: 'SUCCESS', at: 2_000 }, { kind: 'PROCESSING', at: 3_000 }, { kind: 'WAITING', at: 4_000 },
    ] }).reasonCode).toBe(MAXXIS_ATTENTION_REASON_CODES.ATTENTION_BUDGET);
  });

  it('returns PII-free aggregate analytics only', () => {
    expect(safeMaxxisAttentionAnalytics(allowed(), {
      surface: 'matches', signalCode: 'PROVIDER_REPLIED', animationIntensity: 'NORMAL', email: 'hidden@example.com',
    })).toEqual({
      reasonCode: 'ATTENTION_ALLOWED', surface: 'matches', signalCode: 'PROVIDER_REPLIED', intensity: 'NORMAL',
    });
  });
});

describe('Maxxis attention session controller', () => {
  it('keeps at most one deferred signal and retains the highest priority', () => {
    const controller = createMaxxisAttentionController({ nowFn: () => 10_000 });
    controller.setScope('account-a', 'property-a');
    controller.defer(candidate('low', 30));
    controller.defer(candidate('high', 80));
    controller.defer(candidate('middle', 50));
    expect(controller.getSnapshot().deferred.signal.dedupeKey).toBe('high');
    expect(controller.consumeDeferred().signal.dedupeKey).toBe('high');
    expect(controller.peekDeferred()).toBeNull();
  });

  it('silently expires stale deferred attention', () => {
    let now = 10_000;
    const controller = createMaxxisAttentionController({ nowFn: () => now, config: { deferredSignalMaxAgeMs: 1_000 } });
    controller.setScope('account-a', 'property-a');
    controller.defer(candidate('reply', 80, 50_000), now);
    now += 1_001;
    expect(controller.peekDeferred()).toBeNull();
  });

  it('clears deferred state on property switch and all state on account/logout reset', () => {
    const controller = createMaxxisAttentionController({ nowFn: () => 10_000 });
    controller.setScope('account-a', 'property-a');
    controller.defer(candidate('reply-a'));
    controller.markPresented('NOTICED');
    controller.setScope('account-a', 'property-b');
    expect(controller.getSnapshot().deferred).toBeNull();
    expect(controller.getSnapshot().recentAttentionEvents).toHaveLength(1);
    controller.setScope('account-b', 'property-b');
    expect(controller.getSnapshot().recentAttentionEvents).toHaveLength(0);
    controller.defer(candidate('reply-b'));
    controller.reset();
    expect(controller.getSnapshot()).toMatchObject({ deferred: null, recentAttentionEvents: [] });
  });

  it('centralizes retry timer replacement and destroy cleanup', () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const controller = createMaxxisAttentionController();
    controller.scheduleRetry(callback, 500);
    controller.scheduleRetry(callback, 800);
    vi.advanceTimersByTime(500);
    expect(callback).not.toHaveBeenCalled();
    controller.destroy();
    vi.advanceTimersByTime(500);
    expect(callback).not.toHaveBeenCalled();
  });

  it('is presentation-only and exposes no business side-effect methods', () => {
    const controller = createMaxxisAttentionController();
    expect(Object.keys(controller)).not.toEqual(expect.arrayContaining([
      'sendMessage', 'unlockProvider', 'debitNuggets', 'updateWorkflow', 'invokeSmartAction',
    ]));
  });
});
