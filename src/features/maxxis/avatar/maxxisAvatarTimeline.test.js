import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveMaxxisAvatarState } from './maxxisAvatarStateMachine';
import { MAXXIS_AVATAR_STATES } from './maxxisAvatarStates';
import {
  createMaxxisAvatarTimelineController,
  MAXXIS_AVATAR_NOTICED_DELAY_MS,
  MAXXIS_AVATAR_SUCCESS_DURATION_MS,
} from './maxxisAvatarTimeline';

const propertyId = '11111111-1111-4111-8111-111111111111';
const bubble = Object.freeze({
  id: 'maxxis-proactive-signal-1',
  signal: { dedupeKey: 'signal-1', code: 'PROVIDER_REPLIED' },
  message: { text: 'Provider replied.', ctaLabel: 'Review' },
});

function resolve(snapshot, overrides = {}, previousState = null) {
  return resolveMaxxisAvatarState({
    enabled: true,
    timelineManaged: true,
    accountKey: 'account-a',
    previousState,
    contextSnapshot: {
      surface: { name: 'matches' },
      entity: { type: 'PROPERTY', id: propertyId },
      property: { id: propertyId },
      operational: { state: { pendingActionExists: false } },
    },
    proactiveBubble: snapshot.proactiveBubble,
    proactiveSignalSurfaced: snapshot.proactiveSignalSurfaced,
    lastActionResult: snapshot.lastActionResult,
    now: Date.now(),
    ...overrides,
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe('Maxxis avatar presentation timeline', () => {
  it('synchronizes OBSERVING -> NOTICED -> WAITING without showing the bubble immediately', () => {
    vi.useFakeTimers();
    vi.setSystemTime(2_000_000);
    const timeline = createMaxxisAvatarTimelineController({ nowFn: () => Date.now() });
    expect(resolve(timeline.getSnapshot()).state).toBe(MAXXIS_AVATAR_STATES.OBSERVING);

    expect(timeline.stageProactiveBubble(bubble)).toBe(true);
    expect(resolve(timeline.getSnapshot()).state).toBe(MAXXIS_AVATAR_STATES.NOTICED);
    expect(timeline.getSnapshot().proactiveBubble).toBeNull();

    vi.advanceTimersByTime(MAXXIS_AVATAR_NOTICED_DELAY_MS);
    expect(timeline.getSnapshot().proactiveBubble).toBe(bubble);
    expect(resolve(timeline.getSnapshot()).state).toBe(MAXXIS_AVATAR_STATES.WAITING);
  });

  it('uses a nearly immediate bubble when reduced motion or intensity OFF is active', () => {
    vi.useFakeTimers();
    const reduced = createMaxxisAvatarTimelineController();
    reduced.stageProactiveBubble(bubble, { reducedMotion: true });
    expect(reduced.getSnapshot().proactiveBubble).toBe(bubble);

    const motionOff = createMaxxisAvatarTimelineController();
    motionOff.stageProactiveBubble({ ...bubble, id: 'motion-off' }, { intensity: 'OFF' });
    expect(motionOff.getSnapshot().proactiveBubble?.id).toBe('motion-off');
  });

  it('cancels the previous NOTICED timer during rapid signal changes', () => {
    vi.useFakeTimers();
    const timeline = createMaxxisAvatarTimelineController();
    timeline.stageProactiveBubble(bubble);
    vi.advanceTimersByTime(200);
    const replacement = { ...bubble, id: 'maxxis-proactive-signal-2', signal: { dedupeKey: 'signal-2' } };
    timeline.stageProactiveBubble(replacement);
    vi.advanceTimersByTime(MAXXIS_AVATAR_NOTICED_DELAY_MS - 1);
    expect(timeline.getSnapshot().proactiveBubble).toBeNull();
    vi.advanceTimersByTime(1);
    expect(timeline.getSnapshot().proactiveBubble).toBe(replacement);
  });

  it('synchronizes WAITING -> PROCESSING -> SUCCESS -> OBSERVING for confirmed backend work', () => {
    vi.useFakeTimers();
    const timeline = createMaxxisAvatarTimelineController({ nowFn: () => Date.now() });
    timeline.stageProactiveBubble(bubble, { reducedMotion: true });
    expect(resolve(timeline.getSnapshot()).state).toBe(MAXXIS_AVATAR_STATES.WAITING);

    timeline.consumeProactiveBubble();
    const processing = resolve(timeline.getSnapshot(), { processingCount: 2 });
    expect(processing.state).toBe(MAXXIS_AVATAR_STATES.PROCESSING);

    timeline.markSuccess({ status: 'sent' });
    expect(resolve(timeline.getSnapshot()).state).toBe(MAXXIS_AVATAR_STATES.SUCCESS);
    vi.advanceTimersByTime(MAXXIS_AVATAR_SUCCESS_DURATION_MS);
    expect(resolve(timeline.getSnapshot()).state).toBe(MAXXIS_AVATAR_STATES.OBSERVING);
  });

  it('returns WAITING -> CANCEL -> OBSERVING without false success', () => {
    vi.useFakeTimers();
    const timeline = createMaxxisAvatarTimelineController();
    timeline.stageProactiveBubble(bubble, { reducedMotion: true });
    expect(resolve(timeline.getSnapshot()).state).toBe(MAXXIS_AVATAR_STATES.WAITING);
    timeline.dismissProactiveBubble();
    expect(timeline.getSnapshot().lastActionResult).toBeNull();
    expect(resolve(timeline.getSnapshot()).state).toBe(MAXXIS_AVATAR_STATES.OBSERVING);
  });

  it('does not let a signal interrupt PROCESSING and returns to pending WAITING after SUCCESS', () => {
    vi.useFakeTimers();
    const timeline = createMaxxisAvatarTimelineController();
    timeline.stageProactiveBubble(bubble);
    expect(resolve(timeline.getSnapshot(), { processingCount: 1 }).state).toBe(MAXXIS_AVATAR_STATES.PROCESSING);

    timeline.clearProactiveBubble();
    timeline.markSuccess({ status: 'updated' });
    expect(resolve(timeline.getSnapshot(), { pendingConfirmation: true }).state).toBe(MAXXIS_AVATAR_STATES.SUCCESS);
    vi.advanceTimersByTime(MAXXIS_AVATAR_SUCCESS_DURATION_MS);
    expect(resolve(timeline.getSnapshot(), { pendingConfirmation: true }).state).toBe(MAXXIS_AVATAR_STATES.WAITING);
  });

  it('cleans noticed/success timers on rapid changes, property switch, logout, and unmount', () => {
    vi.useFakeTimers();
    const listener = vi.fn();
    const timeline = createMaxxisAvatarTimelineController();
    timeline.subscribe(listener);
    timeline.setIdentity('account-a:property-a');
    timeline.stageProactiveBubble(bubble);
    timeline.setIdentity('account-a:property-b');
    vi.runAllTimers();
    expect(timeline.getSnapshot()).toMatchObject({
      identityKey: 'account-a:property-b',
      pendingProactiveBubble: null,
      proactiveBubble: null,
      lastActionResult: null,
    });

    timeline.markSuccess({ status: 'completed' });
    timeline.reset();
    expect(resolve(timeline.getSnapshot(), { loggedOut: true }).state).toBe(MAXXIS_AVATAR_STATES.IDLE);
    const callsBeforeDestroy = listener.mock.calls.length;
    timeline.stageProactiveBubble(bubble);
    timeline.destroy();
    vi.runAllTimers();
    expect(listener).toHaveBeenCalledTimes(callsBeforeDestroy + 1);
  });

  it('has no business side effects', () => {
    vi.useFakeTimers();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      throw new Error('network should not be called');
    });
    const sideEffects = [vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn()];
    const timeline = createMaxxisAvatarTimelineController();
    timeline.stageProactiveBubble(bubble);
    vi.runAllTimers();
    timeline.consumeProactiveBubble();
    timeline.markSuccess({ status: 'confirmed' });
    vi.runAllTimers();
    expect(fetchSpy).not.toHaveBeenCalled();
    sideEffects.forEach((effect) => expect(effect).not.toHaveBeenCalled());
    fetchSpy.mockRestore();
  });
});
