import { describe, expect, it, vi } from 'vitest';
import {
  MAXXIS_AVATAR_ANIMATION_INTENSITY,
  MAXXIS_AVATAR_ASSET_KEYS,
  MAXXIS_AVATAR_STATES,
  MAXXIS_AVATAR_VISUAL_STATE_MODES,
} from './maxxisAvatarStates';
import {
  compareMaxxisAvatarStatePriority,
  countMaxxisAvatarProcessingSources,
  deriveMaxxisAvatarStateContext,
  isValidMaxxisAvatarTransition,
  resolveMaxxisAvatarState,
} from './maxxisAvatarStateMachine';

const now = 2_000_000;
const propertyId = '11111111-1111-4111-8111-111111111111';
const serviceId = '22222222-2222-4222-8222-222222222222';

function context(overrides = {}) {
  return {
    now,
    accountKey: 'acct-a',
    enabled: true,
    contextSnapshot: {
      surface: { name: 'matches' },
      entity: { type: 'PROPERTY', id: propertyId },
      property: { id: propertyId },
      provider: { serviceId },
      operational: { state: { pendingActionExists: false } },
    },
    appContext: {
      surface: { page: 'matches' },
      entity: { propertyId, serviceId },
    },
    ...overrides,
  };
}

describe('Maxxis avatar state machine', () => {
  it('resolves idle when there is no active context or work', () => {
    const state = resolveMaxxisAvatarState({ now, accountKey: 'acct-a', enabled: true });
    expect(state).toMatchObject({
      state: MAXXIS_AVATAR_STATES.IDLE,
      reason: 'no_active_context',
      transient: false,
      assetKey: MAXXIS_AVATAR_ASSET_KEYS.IDLE,
    });
  });

  it('resolves observing when Maxxis has active context but is not calling attention', () => {
    expect(resolveMaxxisAvatarState(context()).state).toBe(MAXXIS_AVATAR_STATES.OBSERVING);
  });

  it('resolves processing from existing Maxxis loading/execution flags', () => {
    const state = resolveMaxxisAvatarState(context({ loading: true }));
    expect(state).toMatchObject({ state: MAXXIS_AVATAR_STATES.PROCESSING, reason: 'request_in_progress' });
  });

  it('resolves noticed for an approved proactive signal before its bubble is visible', () => {
    const state = resolveMaxxisAvatarState(context({ proactiveSignalSurfaced: { dedupeKey: 'signal-1' } }));
    expect(state).toMatchObject({
      state: MAXXIS_AVATAR_STATES.NOTICED,
      reason: 'proactive_signal_ready',
      transient: true,
      assetKey: MAXXIS_AVATAR_ASSET_KEYS.NOTICED,
    });
    expect(state.transientUntil).toBeGreaterThan(now);
  });

  it('resolves waiting when Maxxis is awaiting an explicit user decision', () => {
    expect(resolveMaxxisAvatarState(context({ pendingProviderUnlock: { serviceId } })).state).toBe(MAXXIS_AVATAR_STATES.WAITING);
    expect(resolveMaxxisAvatarState(context({ smartActions: [{ code: 'SEND', state: 'confirmation' }] })).state).toBe(MAXXIS_AVATAR_STATES.WAITING);
    expect(resolveMaxxisAvatarState(context({ proactiveBubble: { id: 'bubble-1' } })).state).toBe(MAXXIS_AVATAR_STATES.WAITING);
  });

  it('resolves success only from completed/confirmed action results', () => {
    const state = resolveMaxxisAvatarState(context({ lastActionResult: { status: 'completed' } }));
    expect(state).toMatchObject({
      state: MAXXIS_AVATAR_STATES.SUCCESS,
      reason: 'confirmed_action_success',
      transient: true,
      assetKey: MAXXIS_AVATAR_ASSET_KEYS.SUCCESS,
    });
    expect(resolveMaxxisAvatarState(context({ lastActionResult: { status: 'cancelled' } })).state).toBe(MAXXIS_AVATAR_STATES.OBSERVING);
  });

  it('applies deterministic precedence without using state as business logic', () => {
    expect(compareMaxxisAvatarStatePriority(MAXXIS_AVATAR_STATES.SUCCESS, MAXXIS_AVATAR_STATES.WAITING)).toBeGreaterThan(0);
    expect(compareMaxxisAvatarStatePriority(MAXXIS_AVATAR_STATES.WAITING, MAXXIS_AVATAR_STATES.PROCESSING)).toBeGreaterThan(0);
    expect(compareMaxxisAvatarStatePriority(MAXXIS_AVATAR_STATES.PROCESSING, MAXXIS_AVATAR_STATES.OBSERVING)).toBeGreaterThan(0);
    expect(resolveMaxxisAvatarState(context({
      proactiveBubble: { id: 'bubble-1' },
      pendingConfirmation: true,
    })).state).toBe(MAXXIS_AVATAR_STATES.WAITING);
  });

  it('keeps processing above observing and does not treat backend latency as waiting', () => {
    const state = resolveMaxxisAvatarState(context({
      loading: true,
      pendingProviderUnlock: { serviceId },
    }));
    expect(state.state).toBe(MAXXIS_AVATAR_STATES.PROCESSING);
  });

  it('tracks concurrent operation sources until all work has ended', () => {
    expect(countMaxxisAvatarProcessingSources(context({
      activeProviderUnlockId: serviceId,
      activeWorkflowItemCode: 'INSPECTION',
    }))).toBe(2);
    expect(resolveMaxxisAvatarState(context({ processingCount: 2 })).state).toBe(MAXXIS_AVATAR_STATES.PROCESSING);
    expect(resolveMaxxisAvatarState(context({ processingCount: 1 })).state).toBe(MAXXIS_AVATAR_STATES.PROCESSING);
    expect(resolveMaxxisAvatarState(context({ processingCount: 0 })).state).toBe(MAXXIS_AVATAR_STATES.OBSERVING);
  });

  it('keeps waiting above noticed when user confirmation is pending', () => {
    const state = resolveMaxxisAvatarState(context({
      proactiveBubble: { id: 'bubble-1' },
      pendingProviderMessageSend: { messageId: 'message-1' },
    }));
    expect(state.state).toBe(MAXXIS_AVATAR_STATES.WAITING);
  });

  it('holds success as a transient state and then returns to contextual observing', () => {
    const success = resolveMaxxisAvatarState(context({ lastActionResult: { success: true } }));
    const held = resolveMaxxisAvatarState(context({
      previousState: success,
      now: success.transientUntil - 1,
    }));
    expect(held.state).toBe(MAXXIS_AVATAR_STATES.SUCCESS);

    const expired = resolveMaxxisAvatarState(context({
      previousState: success,
      now: success.transientUntil + 1,
    }));
    expect(expired.state).toBe(MAXXIS_AVATAR_STATES.OBSERVING);
  });

  it('clears noticed after bubble dismissal and when Maxxis opens', () => {
    const noticed = resolveMaxxisAvatarState(context({ proactiveSignalSurfaced: true }));
    expect(resolveMaxxisAvatarState(context({
      previousState: noticed,
      proactiveSignalSurfaced: true,
      bubbleDismissed: true,
    })).state).toBe(MAXXIS_AVATAR_STATES.OBSERVING);
    expect(resolveMaxxisAvatarState(context({
      proactiveSignalSurfaced: true,
      open: true,
    })).state).toBe(MAXXIS_AVATAR_STATES.OBSERVING);
  });

  it('resets safely on account switch and logout', () => {
    const previous = resolveMaxxisAvatarState(context({ accountKey: 'acct-a', proactiveSignalSurfaced: true }));
    expect(resolveMaxxisAvatarState(context({
      previousState: previous,
      accountKey: 'acct-b',
    }))).toMatchObject({ state: MAXXIS_AVATAR_STATES.IDLE, reason: 'account_switch' });
    expect(resolveMaxxisAvatarState(context({ loggedOut: true }))).toMatchObject({ state: MAXXIS_AVATAR_STATES.IDLE, reason: 'logout' });
  });

  it('returns reduced-motion and future intensity metadata without changing avatar state', () => {
    const state = resolveMaxxisAvatarState(context({
      prefersReducedMotion: true,
      animationIntensity: 'NORMAL',
    }));
    expect(state.state).toBe(MAXXIS_AVATAR_STATES.OBSERVING);
    expect(state.visualStateMode).toBe(MAXXIS_AVATAR_VISUAL_STATE_MODES.REDUCED);
    expect(state.intensity).toBe(MAXXIS_AVATAR_ANIMATION_INTENSITY.NORMAL);

    const derived = deriveMaxxisAvatarStateContext(context({ reducedMotion: true, intensity: 'OFF' }));
    expect(derived).toMatchObject({
      hasActiveContext: true,
      visualStateMode: MAXXIS_AVATAR_VISUAL_STATE_MODES.REDUCED,
      intensity: MAXXIS_AVATAR_ANIMATION_INTENSITY.OFF,
    });
  });

  it('never returns unknown states even with unknown input', () => {
    const state = resolveMaxxisAvatarState({
      now,
      previousState: { state: 'ERROR', transient: true, transientUntil: now + 1_000 },
      animationIntensity: 'LOUD',
    });
    expect(Object.values(MAXXIS_AVATAR_STATES)).toContain(state.state);
    expect(state.state).toBe(MAXXIS_AVATAR_STATES.IDLE);
    expect(state.intensity).toBe(MAXXIS_AVATAR_ANIMATION_INTENSITY.SUBTLE);
  });

  it('declares the expected transition contract', () => {
    expect(isValidMaxxisAvatarTransition('IDLE', 'OBSERVING')).toBe(true);
    expect(isValidMaxxisAvatarTransition('OBSERVING', 'PROCESSING')).toBe(true);
    expect(isValidMaxxisAvatarTransition('PROCESSING', 'SUCCESS')).toBe(true);
    expect(isValidMaxxisAvatarTransition('SUCCESS', 'OBSERVING')).toBe(true);
    expect(isValidMaxxisAvatarTransition('OBSERVING', 'NOTICED')).toBe(true);
    expect(isValidMaxxisAvatarTransition('NOTICED', 'WAITING')).toBe(true);
    expect(isValidMaxxisAvatarTransition('WAITING', 'PROCESSING')).toBe(true);
  });

  it('does not send messages, debit nuggets, unlock, update workflow, profile, or execute smart actions', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      throw new Error('fetch should not be called');
    });
    const callbacks = {
      sendMessage: vi.fn(),
      debitNugget: vi.fn(),
      unlock: vi.fn(),
      updateWorkflow: vi.fn(),
      updateProfile: vi.fn(),
      executeSmartAction: vi.fn(),
    };

    const state = resolveMaxxisAvatarState(context({
      proactiveBubble: { id: 'bubble-1' },
      pendingProviderUnlock: { serviceId },
      lastActionResult: { status: 'completed' },
      callbacks,
    }));

    expect(state.state).toBe(MAXXIS_AVATAR_STATES.SUCCESS);
    expect(fetchSpy).not.toHaveBeenCalled();
    Object.values(callbacks).forEach((callback) => expect(callback).not.toHaveBeenCalled());
    fetchSpy.mockRestore();
  });
});
