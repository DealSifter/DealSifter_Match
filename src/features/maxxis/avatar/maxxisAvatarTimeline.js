import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { MAXXIS_AVATAR_ANIMATION_INTENSITY } from './maxxisAvatarStates';

export const MAXXIS_AVATAR_NOTICED_DELAY_MS = 680;
export const MAXXIS_AVATAR_SUCCESS_DURATION_MS = 880;

const EMPTY_SNAPSHOT = Object.freeze({
  identityKey: '',
  pendingProactiveBubble: null,
  proactiveBubble: null,
  proactiveSignalSurfaced: null,
  lastActionResult: null,
});

function presentationDelay({ reducedMotion = false, intensity = '', noticedDelayMs } = {}) {
  if (reducedMotion || String(intensity).toUpperCase() === MAXXIS_AVATAR_ANIMATION_INTENSITY.OFF) return 0;
  const requested = Number(noticedDelayMs);
  if (!Number.isFinite(requested)) return MAXXIS_AVATAR_NOTICED_DELAY_MS;
  return Math.min(700, Math.max(450, requested));
}

export function createMaxxisAvatarTimelineController({
  setTimeoutFn = globalThis.setTimeout,
  clearTimeoutFn = globalThis.clearTimeout,
  nowFn = Date.now,
} = {}) {
  let snapshot = EMPTY_SNAPSHOT;
  const listeners = new Set();
  const timers = new Map();

  const emit = (patch) => {
    snapshot = Object.freeze({ ...snapshot, ...patch });
    listeners.forEach((listener) => listener());
  };

  const cancelTimer = (name) => {
    const timer = timers.get(name);
    if (timer !== undefined) clearTimeoutFn(timer);
    timers.delete(name);
  };

  const schedule = (name, callback, delayMs) => {
    cancelTimer(name);
    const timer = setTimeoutFn(() => {
      timers.delete(name);
      callback();
    }, Math.max(0, Number(delayMs) || 0));
    timers.set(name, timer);
  };

  const clearProactive = () => {
    cancelTimer('noticed');
    cancelTimer('autoDismiss');
    const current = snapshot.proactiveBubble || snapshot.pendingProactiveBubble;
    if (current || snapshot.proactiveSignalSurfaced) {
      emit({
        pendingProactiveBubble: null,
        proactiveBubble: null,
        proactiveSignalSurfaced: null,
      });
    }
    return current;
  };

  const revealBubble = (bubble, autoDismissMs) => {
    if (snapshot.pendingProactiveBubble?.id !== bubble.id) return;
    emit({
      pendingProactiveBubble: null,
      proactiveBubble: bubble,
      proactiveSignalSurfaced: null,
    });
    if (Number(autoDismissMs) > 0) schedule('autoDismiss', clearProactive, autoDismissMs);
  };

  const controller = {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    stageProactiveBubble: (bubble, options = {}) => {
      if (!bubble?.id || snapshot.lastActionResult) return false;
      if (snapshot.proactiveBubble?.id === bubble.id || snapshot.pendingProactiveBubble?.id === bubble.id) return false;
      clearProactive();
      emit({
        pendingProactiveBubble: bubble,
        proactiveBubble: null,
        proactiveSignalSurfaced: bubble.signal || { dedupeKey: bubble.id },
      });
      const delayMs = presentationDelay(options);
      if (delayMs === 0) revealBubble(bubble, options.autoDismissMs);
      else schedule('noticed', () => revealBubble(bubble, options.autoDismissMs), delayMs);
      return true;
    },
    dismissProactiveBubble: clearProactive,
    consumeProactiveBubble: clearProactive,
    clearProactiveBubble: clearProactive,
    markSuccess: (result = {}, options = {}) => {
      const nextResult = { ...result, success: true, at: Number(result.at || nowFn()) };
      cancelTimer('success');
      emit({ lastActionResult: nextResult });
      if (!options.deferExpiration) {
        schedule('success', () => emit({ lastActionResult: null }), MAXXIS_AVATAR_SUCCESS_DURATION_MS);
      }
      return nextResult;
    },
    armSuccessExpiration: () => {
      if (!snapshot.lastActionResult || timers.has('success')) return false;
      schedule('success', () => emit({ lastActionResult: null }), MAXXIS_AVATAR_SUCCESS_DURATION_MS);
      return true;
    },
    clearSuccess: () => {
      cancelTimer('success');
      if (snapshot.lastActionResult) emit({ lastActionResult: null });
    },
    setIdentity: (identityKey = '') => {
      const cleanIdentity = String(identityKey || '');
      if (snapshot.identityKey === cleanIdentity) return false;
      timers.forEach((timer) => clearTimeoutFn(timer));
      timers.clear();
      snapshot = Object.freeze({ ...EMPTY_SNAPSHOT, identityKey: cleanIdentity });
      listeners.forEach((listener) => listener());
      return true;
    },
    reset: () => {
      timers.forEach((timer) => clearTimeoutFn(timer));
      timers.clear();
      emit({
        pendingProactiveBubble: null,
        proactiveBubble: null,
        proactiveSignalSurfaced: null,
        lastActionResult: null,
      });
    },
    destroy: () => {
      timers.forEach((timer) => clearTimeoutFn(timer));
      timers.clear();
      listeners.clear();
    },
  };

  return Object.freeze(controller);
}

function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(() => (
    typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  return reducedMotion;
}

export function useMaxxisAvatarTimeline({ identityKey = '', enabled = true, intensity = '' } = {}) {
  const [controller] = useState(createMaxxisAvatarTimelineController);
  const reducedMotion = usePrefersReducedMotion();
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);

  useEffect(() => {
    controller.setIdentity(identityKey);
  }, [controller, identityKey]);

  useEffect(() => {
    if (!enabled) controller.reset();
  }, [controller, enabled]);

  useEffect(() => {
    if (snapshot.lastActionResult) controller.armSuccessExpiration();
  }, [controller, snapshot.lastActionResult]);

  useEffect(() => () => controller.destroy(), [controller]);

  const stageProactiveBubble = useCallback((bubble, options = {}) => controller.stageProactiveBubble(bubble, {
    ...options,
    reducedMotion,
    intensity,
  }), [controller, intensity, reducedMotion]);
  const markSuccess = useCallback((result = {}) => controller.markSuccess(result, {
    deferExpiration: true,
  }), [controller]);

  return Object.freeze({
    ...snapshot,
    stageProactiveBubble,
    dismissProactiveBubble: controller.dismissProactiveBubble,
    consumeProactiveBubble: controller.consumeProactiveBubble,
    clearProactiveBubble: controller.clearProactiveBubble,
    markSuccess,
    clearSuccess: controller.clearSuccess,
    reset: controller.reset,
    reducedMotion,
  });
}
