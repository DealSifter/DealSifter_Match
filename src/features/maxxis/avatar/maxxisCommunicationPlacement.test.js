import { describe, expect, it } from 'vitest';
import { maxxisCommunicationCopy, placeMaxxisCommunication } from './maxxisCommunicationPlacement';
import { resolveMaxxisAvatarState, resolveMaxxisConversationalState } from './maxxisAvatarStateMachine';
import { createMaxxisAvatarTimelineController } from './maxxisAvatarTimeline';
import { vi } from 'vitest';

describe('Avatar-anchored conversational communication', () => {
  it.each([360, 390, 430, 768, 1440])('keeps the bubble adjacent and inside a %ipx viewport', (width) => {
    const anchor = { left: width - 80, right: width - 18, top: 590, bottom: 652 };
    const result = placeMaxxisCommunication({ anchor, viewport: { left: 0, top: 0, width, height: 720 }, height: 160 });
    const left = anchor.left + result.left; const top = anchor.top + result.top;
    expect(left).toBeGreaterThanOrEqual(12);
    expect(left + result.width).toBeLessThanOrEqual(width - 12);
    expect(top).toBeGreaterThanOrEqual(12);
    expect(top + 160).toBeLessThanOrEqual(708);
    expect(result.side).toBe(width < 768 ? 'above' : 'left');
    expect(width < 768 ? anchor.top - (top + 160) : anchor.left - (left + result.width)).toBe(12);
  });
  it.each(['left', 'right'])('follows an avatar moved to the %s edge', (side) => {
    const anchor = { left: side === 'left' ? 18 : 950, right: side === 'left' ? 80 : 1012, top: 400, bottom: 462 };
    const result = placeMaxxisCommunication({ anchor, viewport: { left: 0, top: 0, width: 1040, height: 700 } });
    expect(result.side).toBe(side === 'left' ? 'right' : 'left');
  });
  it('uses a below fallback at the top edge and aligns the speech tail with the avatar', () => {
    const anchor = { left: 310, right: 372, top: 14, bottom: 76 };
    const result = placeMaxxisCommunication({ anchor, viewport: { left: 0, top: 0, width: 390, height: 700 } });
    expect(result.side).toBe('below');
    expect(anchor.top + result.top - anchor.bottom).toBe(12);
    expect(result.tail).toBeGreaterThan(18);
  });
  it('accounts for zoom/keyboard visual viewport and bottom navigation bounds', () => {
    const anchor = { left: 300, right: 362, top: 290, bottom: 352 };
    const result = placeMaxxisCommunication({ anchor, viewport: { left: 0, top: 80, width: 390, height: 300 }, height: 140 });
    expect(anchor.top + result.top).toBeGreaterThanOrEqual(92);
    expect(anchor.top + result.top + 140).toBeLessThanOrEqual(368);
  });
  it('suppresses orphaned or congested communication', () => {
    expect(placeMaxxisCommunication({ anchor: { left: 900, right: 962, top: 400, bottom: 462 }, viewport: { left: 0, top: 0, width: 390, height: 700 } }).visible).toBe(false);
  });
  it('uses actual enlarged artwork bounds rather than constant avatar dimensions', () => {
    const anchor = { left: 900, right: 962, top: 500, bottom: 562 };
    const avatar = { left: 850, right: 1012, top: 450, bottom: 612 };
    const result = placeMaxxisCommunication({ anchor, avatar, viewport: { left: 0, top: 0, width: 1040, height: 700 } });
    expect(anchor.left + result.left + result.width).toBe(avatar.left - 12);
  });
  it('keeps complete short copy, with no analytical truncation or new Gemini copy', () => {
    expect(maxxisCommunicationCopy({ text: 'Falta taxa de juros. Quer informar agora?' })).toBe('Falta taxa de juros. Quer informar agora?');
    expect(maxxisCommunicationCopy({ text: `Um sinal específico. ${'detalhes '.repeat(40)}` })).toBe('Um sinal específico.');
    expect(maxxisCommunicationCopy({ text: 'a'.repeat(500), ctaLabel: 'Ver análise' })).toBe('Ver análise');
  });
  it.each([
    [{}, 'IDLE', 'IDLE'], [{ contextObservationActive: true }, 'OBSERVING', 'OBSERVING'],
    [{ loading: true }, 'PROCESSING', 'THINKING'], [{ communicationPhase: 'EXPANDING' }, 'WAITING', 'COMMUNICATING'],
    [{ communicationPhase: 'WAITING' }, 'WAITING', 'WAITING_FOR_USER'],
    [{ loading: true, proactiveActionInProgress: true }, 'PROCESSING', 'ACTION_IN_PROGRESS'],
    [{ lastActionResult: { success: true } }, 'SUCCESS', 'RESULT_READY'],
    [{ lastActionResult: { success: true, visualPhase: 'POSITIVE_FEEDBACK' } }, 'SUCCESS', 'POSITIVE_FEEDBACK'],
  ])('maps real application context to conversational state %s', (context, visual, expected) => {
    expect(resolveMaxxisConversationalState(context, visual)).toBe(expected);
  });
  it('returns IDLE after observation/dismissal and when proactive insights are OFF', () => {
    expect(resolveMaxxisAvatarState({ contextObservationActive: false, contextSnapshot: { property: { id: 'p' } } }).state).toBe('IDLE');
    expect(resolveMaxxisConversationalState({ proactiveEnabled: false }, 'OBSERVING')).toBe('IDLE');
    expect(resolveMaxxisConversationalState({ loading: true, proactiveEnabled: false }, 'PROCESSING')).toBe('THINKING');
    expect(resolveMaxxisAvatarState({ loading: true, lastActionResult: { success: true } }).state).toBe('PROCESSING');
  });
  it('result ready progresses to positive feedback without fake work or external acquisition', () => {
    vi.useFakeTimers();
    const network = vi.spyOn(globalThis, 'fetch');
    try {
      const timeline = createMaxxisAvatarTimelineController();
      timeline.markSuccess({ status: 'completed' });
      expect(timeline.getSnapshot().lastActionResult.visualPhase).toBe('RESULT_READY');
      vi.advanceTimersByTime(280);
      expect(timeline.getSnapshot().lastActionResult.visualPhase).toBe('POSITIVE_FEEDBACK');
      vi.advanceTimersByTime(600);
      expect(timeline.getSnapshot().lastActionResult).toBeNull();
      expect(network).not.toHaveBeenCalled();
      timeline.destroy();
    } finally { network.mockRestore(); vi.useRealTimers(); }
  });
});
