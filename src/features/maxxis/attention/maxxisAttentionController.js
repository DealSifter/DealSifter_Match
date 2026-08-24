import {
  MAXXIS_ATTENTION_DEFAULTS,
  MAXXIS_ATTENTION_REASON_CODES,
  cleanMaxxisAttentionToken,
  isMaxxisCriticalModal,
  isMaxxisImportantTypingSurface,
  isMaxxisSensitiveSurface,
  normalizeMaxxisAttentionIntensity,
} from './maxxisAttentionRules';
import {
  MAXXIS_AVATAR_ANIMATION_INTENSITY,
  MAXXIS_AVATAR_STATES,
} from '../avatar/maxxisAvatarStates';

function decision({
  allowAnimation,
  allowBubble,
  visualIntensity,
  deferAttention = false,
  reasonCode,
  retryAfterMs = 0,
}) {
  return Object.freeze({
    allowAnimation: Boolean(allowAnimation),
    allowBubble: Boolean(allowBubble),
    visualIntensity,
    deferAttention: Boolean(deferAttention),
    reasonCode,
    retryAfterMs: Math.max(0, Number(retryAfterMs) || 0),
  });
}

export function resolveMaxxisAttentionPolicy(inputs = {}) {
  const transactionActive = Boolean(inputs.checkoutActive || inputs.sensitiveTransactionActive);
  const intensity = normalizeMaxxisAttentionIntensity(inputs.animationIntensity);
  const motionSuppressed = Boolean(inputs.reducedMotion)
    || intensity === MAXXIS_AVATAR_ANIMATION_INTENSITY.OFF;
  const quiet = (reasonCode, { deferAttention = false, retryAfterMs = 0 } = {}) => decision({
    allowAnimation: false,
    allowBubble: false,
    visualIntensity: MAXXIS_AVATAR_ANIMATION_INTENSITY.OFF,
    deferAttention,
    reasonCode,
    retryAfterMs,
  });
  const defer = (reasonCode, retryAfterMs = 0) => quiet(reasonCode, {
    deferAttention: Boolean(inputs.hasSignal),
    retryAfterMs,
  });

  if (inputs.hasSignal && inputs.proactiveEnabled === false) {
    return decision({
      allowAnimation: !motionSuppressed,
      allowBubble: false,
      visualIntensity: motionSuppressed ? MAXXIS_AVATAR_ANIMATION_INTENSITY.OFF : intensity,
      reasonCode: MAXXIS_ATTENTION_REASON_CODES.PROACTIVITY_DISABLED,
    });
  }
  if (isMaxxisCriticalModal(inputs)) return defer(MAXXIS_ATTENTION_REASON_CODES.CRITICAL_MODAL);
  if (transactionActive) return defer(MAXXIS_ATTENTION_REASON_CODES.SENSITIVE_SURFACE);
  if (inputs.formSubmitting || inputs.onboardingSaving) {
    return defer(MAXXIS_ATTENTION_REASON_CODES.FORM_SUBMITTING);
  }
  if (inputs.confirmationActive) return defer(MAXXIS_ATTENTION_REASON_CODES.CONFIRMATION_ACTIVE);
  if (inputs.navigationTransition) {
    return defer(MAXXIS_ATTENTION_REASON_CODES.NAVIGATION_TRANSITION, inputs.navigationRetryAfterMs);
  }
  if (inputs.mobileKeyboardOpen) return defer(MAXXIS_ATTENTION_REASON_CODES.MOBILE_KEYBOARD);
  if (inputs.mobileViewportCongested) return defer(MAXXIS_ATTENTION_REASON_CODES.MOBILE_CONGESTED);
  if (inputs.userTyping && isMaxxisImportantTypingSurface(inputs)) {
    return defer(MAXXIS_ATTENTION_REASON_CODES.USER_TYPING);
  }
  if (isMaxxisSensitiveSurface({ ...inputs, checkoutActive: transactionActive })) {
    return defer(MAXXIS_ATTENTION_REASON_CODES.SENSITIVE_SURFACE);
  }
  if (inputs.maxxisOpen) {
    return decision({
      allowAnimation: !motionSuppressed,
      allowBubble: false,
      visualIntensity: motionSuppressed ? MAXXIS_AVATAR_ANIMATION_INTENSITY.OFF : intensity,
      reasonCode: MAXXIS_ATTENTION_REASON_CODES.MAXXIS_OPEN,
    });
  }
  if (inputs.hasSignal && inputs.bubbleActive) return defer(MAXXIS_ATTENTION_REASON_CODES.ACTIVE_BUBBLE);

  const avatarState = String(inputs.avatarState || '').toUpperCase();
  if (inputs.hasSignal && avatarState === MAXXIS_AVATAR_STATES.PROCESSING) {
    return decision({
      allowAnimation: !motionSuppressed,
      allowBubble: false,
      visualIntensity: motionSuppressed ? MAXXIS_AVATAR_ANIMATION_INTENSITY.OFF : intensity,
      deferAttention: true,
      reasonCode: MAXXIS_ATTENTION_REASON_CODES.PROCESSING_ACTIVE,
    });
  }
  if (inputs.hasSignal && avatarState === MAXXIS_AVATAR_STATES.WAITING) {
    return defer(MAXXIS_ATTENTION_REASON_CODES.WAITING_ACTIVE);
  }
  if (inputs.hasSignal && avatarState === MAXXIS_AVATAR_STATES.SUCCESS) {
    return defer(MAXXIS_ATTENTION_REASON_CODES.SUCCESS_ACTIVE);
  }

  const now = Number(inputs.now || Date.now());
  const recentEvents = Array.isArray(inputs.recentAttentionEvents)
    ? inputs.recentAttentionEvents.filter((event) => now - Number(event.at || 0) < Number(inputs.attentionWindowMs || MAXXIS_ATTENTION_DEFAULTS.attentionWindowMs))
    : [];
  const transientKind = cleanMaxxisAttentionToken(inputs.attentionKind, 20).toUpperCase();
  const latestKindAt = (kind) => recentEvents
    .filter((event) => event.kind === kind)
    .reduce((latest, event) => Math.max(latest, Number(event.at || 0)), 0);

  if (transientKind === MAXXIS_AVATAR_STATES.SUCCESS) {
    const fatigueMs = Number(inputs.successFatigueMs || MAXXIS_ATTENTION_DEFAULTS.successFatigueMs);
    const remaining = fatigueMs - (now - latestKindAt(MAXXIS_AVATAR_STATES.SUCCESS));
    if (remaining > 0) return quiet(MAXXIS_ATTENTION_REASON_CODES.SUCCESS_FATIGUE);
  }
  if (transientKind === MAXXIS_AVATAR_STATES.NOTICED) {
    const cooldownMs = Number(inputs.transientAttentionCooldownMs || MAXXIS_ATTENTION_DEFAULTS.transientAttentionCooldownMs);
    const remaining = cooldownMs - (now - latestKindAt(MAXXIS_AVATAR_STATES.NOTICED));
    if (remaining > 0) return defer(MAXXIS_ATTENTION_REASON_CODES.NOTICED_FATIGUE, remaining);
  }
  if (transientKind && recentEvents.length >= Number(inputs.maxTransientAnimationsPerWindow || MAXXIS_ATTENTION_DEFAULTS.maxTransientAnimationsPerWindow)) {
    const oldestAt = Math.min(...recentEvents.map((event) => Number(event.at || now)));
    return defer(
      MAXXIS_ATTENTION_REASON_CODES.ATTENTION_BUDGET,
      Number(inputs.attentionWindowMs || MAXXIS_ATTENTION_DEFAULTS.attentionWindowMs) - (now - oldestAt),
    );
  }

  return decision({
    allowAnimation: !motionSuppressed,
    allowBubble: inputs.proactiveEnabled !== false,
    visualIntensity: motionSuppressed ? MAXXIS_AVATAR_ANIMATION_INTENSITY.OFF : intensity,
    reasonCode: MAXXIS_ATTENTION_REASON_CODES.ALLOWED,
  });
}

function signalIdentity(signal = {}) {
  return cleanMaxxisAttentionToken(signal.dedupeKey || signal.id, 180);
}

function signalPriority(entry = {}) {
  return Number(entry.attention?.priority || entry.priority || 0) || 0;
}

export function createMaxxisAttentionController({
  nowFn = Date.now,
  setTimeoutFn = globalThis.setTimeout,
  clearTimeoutFn = globalThis.clearTimeout,
  config = {},
} = {}) {
  const settings = { ...MAXXIS_ATTENTION_DEFAULTS, ...config };
  let accountKey = '';
  let entityKey = '';
  let deferred = null;
  let recentAttentionEvents = [];
  let retryTimer = null;

  const prune = (now = nowFn()) => {
    recentAttentionEvents = recentAttentionEvents.filter(
      (event) => now - event.at < settings.attentionWindowMs,
    );
    if (deferred && (deferred.expiresAt <= now || deferred.entityKey !== entityKey)) deferred = null;
  };

  const controller = {
    setScope: (nextAccountKey = '', nextEntityKey = '') => {
      const cleanAccount = cleanMaxxisAttentionToken(nextAccountKey, 180);
      const cleanEntity = cleanMaxxisAttentionToken(nextEntityKey, 180);
      const accountChanged = accountKey !== cleanAccount;
      const entityChanged = entityKey !== cleanEntity;
      if (!accountChanged && !entityChanged) return false;
      accountKey = cleanAccount;
      entityKey = cleanEntity;
      deferred = null;
      if (accountChanged) recentAttentionEvents = [];
      if (retryTimer !== null) clearTimeoutFn(retryTimer);
      retryTimer = null;
      return true;
    },
    evaluate: (inputs = {}) => {
      const now = Number(inputs.now || nowFn());
      prune(now);
      return resolveMaxxisAttentionPolicy({
        ...settings,
        ...inputs,
        now,
        recentAttentionEvents,
      });
    },
    defer: (entry, now = nowFn()) => {
      const id = signalIdentity(entry?.signal);
      if (!id) return null;
      const expiresAt = Math.min(
        Number(entry?.attention?.expiresAt || Number.MAX_SAFE_INTEGER),
        Number(now) + settings.deferredSignalMaxAgeMs,
      );
      const candidate = Object.freeze({ ...entry, id, entityKey, expiresAt });
      if (!deferred || signalPriority(candidate) > signalPriority(deferred)) deferred = candidate;
      return deferred;
    },
    peekDeferred: (now = nowFn()) => {
      prune(Number(now));
      return deferred;
    },
    consumeDeferred: (id = '') => {
      if (!deferred || (id && deferred.id !== id)) return null;
      const current = deferred;
      deferred = null;
      return current;
    },
    discardDeferred: () => {
      deferred = null;
    },
    markPresented: (kind, now = nowFn()) => {
      const cleanKind = cleanMaxxisAttentionToken(kind, 20).toUpperCase();
      if (!cleanKind) return;
      prune(Number(now));
      recentAttentionEvents.push(Object.freeze({ kind: cleanKind, at: Number(now) }));
    },
    scheduleRetry: (callback, delayMs) => {
      if (retryTimer !== null) clearTimeoutFn(retryTimer);
      retryTimer = setTimeoutFn(() => {
        retryTimer = null;
        callback?.();
      }, Math.max(0, Number(delayMs) || 0));
    },
    reset: () => {
      deferred = null;
      recentAttentionEvents = [];
      if (retryTimer !== null) clearTimeoutFn(retryTimer);
      retryTimer = null;
    },
    destroy: () => {
      if (retryTimer !== null) clearTimeoutFn(retryTimer);
      retryTimer = null;
      deferred = null;
      recentAttentionEvents = [];
    },
    getSnapshot: () => Object.freeze({
      accountKey,
      entityKey,
      deferred,
      recentAttentionEvents: Object.freeze([...recentAttentionEvents]),
    }),
  };

  return Object.freeze(controller);
}

export function safeMaxxisAttentionAnalytics(policy = {}, inputs = {}) {
  return Object.freeze({
    reasonCode: cleanMaxxisAttentionToken(policy.reasonCode, 60),
    surface: cleanMaxxisAttentionToken(inputs.surface || inputs.currentSurface, 60),
    signalCode: cleanMaxxisAttentionToken(inputs.signalCode, 60),
    intensity: normalizeMaxxisAttentionIntensity(policy.visualIntensity || inputs.animationIntensity),
  });
}
