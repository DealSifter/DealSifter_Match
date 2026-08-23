import {
  MAXXIS_AVATAR_ANIMATION_INTENSITY,
  MAXXIS_AVATAR_ASSET_KEYS,
  MAXXIS_AVATAR_STATE_PRECEDENCE,
  MAXXIS_AVATAR_STATES,
  MAXXIS_AVATAR_TRANSIENT_MS,
  MAXXIS_AVATAR_TRANSITIONS,
  MAXXIS_AVATAR_VISUAL_STATE_MODES,
  isMaxxisAvatarState,
} from './maxxisAvatarStates';

const DEFAULT_AVATAR_INTENSITY = MAXXIS_AVATAR_ANIMATION_INTENSITY.SUBTLE;

function cleanText(value, maxLength = 120) {
  return String(value || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function cleanState(value) {
  const state = cleanText(value, 40).toUpperCase();
  return isMaxxisAvatarState(state) ? state : MAXXIS_AVATAR_STATES.IDLE;
}

function normalizeIntensity(value) {
  const intensity = cleanText(value || DEFAULT_AVATAR_INTENSITY, 20).toUpperCase();
  return MAXXIS_AVATAR_ANIMATION_INTENSITY[intensity] || DEFAULT_AVATAR_INTENSITY;
}

function hasActiveContext(context = {}) {
  if (context.activeContext === true || context.contextActive === true) return true;
  const contextSnapshot = context.contextSnapshot || {};
  const appContext = context.appContext || {};
  const entity = contextSnapshot.entity || appContext.entity || {};
  const surface = contextSnapshot.surface || appContext.surface || {};
  const property = contextSnapshot.property || {};
  const provider = contextSnapshot.provider || {};
  const activeSurface = ['dashboard', 'feed', 'matches', 'map', 'mapview'].includes(cleanText(surface.name || surface.page || context.currentSurface, 40).toLowerCase());
  return Boolean(
    cleanText(context.propertyId || property.id || appContext.entity?.propertyId || '', 80)
    || cleanText(context.serviceId || provider.serviceId || appContext.entity?.serviceId || '', 80)
    || cleanText(context.conversationId || appContext.entity?.conversationId || '', 80)
    || cleanText(context.profileScope || appContext.entity?.profileScope || '', 80)
    || (entity.type && entity.type !== 'NONE')
    || activeSurface
  );
}

export function countMaxxisAvatarProcessingSources(context = {}) {
  const sources = [
    context.loading || context.requestInProgress || context.isLoading || context.isExecuting || context.processing,
    context.activeProviderUnlockId,
    context.activeProviderDraftId,
    context.activeProviderMessageSendId,
    context.activeProviderConversationAnalysisId,
    context.activeWorkflowItemCode,
    context.activeProfileActionId,
    context.exportingAnalysisId,
  ];
  const explicitCount = Math.max(0, Number(context.processingCount || context.activeOperationCount || 0));
  return Math.max(explicitCount, sources.filter(Boolean).length);
}

function hasProcessing(context = {}) {
  return countMaxxisAvatarProcessingSources(context) > 0;
}

function hasWaiting(context = {}, processing = false) {
  if (processing) return false;
  const smartActions = Array.isArray(context.smartActions) ? context.smartActions : [];
  return Boolean(
    context.pendingConfirmation
    || context.pendingAction
    || context.awaitingUserDecision
    || context.pendingProviderUnlock
    || context.pendingProviderMessageSend
    || context.pendingProfileSuggestion
    || context.proactiveBubble
    || context.proactiveBubbleActive
    || context.contextSnapshot?.operational?.state?.pendingActionExists
    || smartActions.some((action) => ['prepared', 'pending', 'waiting', 'confirmation'].includes(cleanText(action?.state, 30).toLowerCase()))
  );
}

function hasNoticed(context = {}) {
  if (context.open || context.maxxisOpen || context.proactiveBubbleDismissed || context.bubbleDismissed) return false;
  return Boolean(
    context.proactiveSignalSurfaced
    || context.noticedSignal
  );
}

function hasSuccess(context = {}) {
  const result = context.lastActionResult || context.actionResult || {};
  const status = cleanText(result.status || context.lastActionStatus, 40).toLowerCase();
  const occurredAt = Number(result.at || result.occurredAt || context.lastActionAt || 0);
  const maxAgeMs = Number(context.successTransientMs || MAXXIS_AVATAR_TRANSIENT_MS.SUCCESS || 0);
  const now = Number(context.now || Date.now());
  if (occurredAt > 0 && maxAgeMs > 0 && now - occurredAt > maxAgeMs) return false;
  return Boolean(
    context.actionSucceeded
    || result.succeeded === true
    || result.success === true
    || ['success', 'completed', 'confirmed', 'sent', 'unlocked', 'updated'].includes(status)
  );
}

function buildAvatarState({
  state,
  reason,
  now,
  visualStateMode,
  intensity,
  previousState = '',
  accountKey = '',
  transitionAllowed = true,
}) {
  const clean = cleanState(state);
  const transientMs = MAXXIS_AVATAR_TRANSIENT_MS[clean] || 0;
  return Object.freeze({
    state: clean,
    reason: cleanText(reason || 'default', 80),
    transient: transientMs > 0,
    transientUntil: transientMs > 0 ? Number(now || Date.now()) + transientMs : 0,
    assetKey: MAXXIS_AVATAR_ASSET_KEYS[clean],
    visualStateMode,
    intensity,
    accountKey: cleanText(accountKey, 120),
    transition: Object.freeze({
      from: cleanState(previousState),
      to: clean,
      allowed: Boolean(transitionAllowed),
      at: Number(now || Date.now()),
    }),
  });
}

function resolveVisualStateMode(context = {}) {
  return context.prefersReducedMotion || context.reducedMotion
    ? MAXXIS_AVATAR_VISUAL_STATE_MODES.REDUCED
    : MAXXIS_AVATAR_VISUAL_STATE_MODES.NORMAL;
}

function selectRawState(context = {}) {
  if (context.enabled === false || context.loggedOut) {
    return { state: MAXXIS_AVATAR_STATES.IDLE, reason: context.loggedOut ? 'logout' : 'disabled' };
  }

  const processing = hasProcessing(context);
  if (hasSuccess(context)) return { state: MAXXIS_AVATAR_STATES.SUCCESS, reason: 'confirmed_action_success' };
  if (hasWaiting(context, processing)) return { state: MAXXIS_AVATAR_STATES.WAITING, reason: 'awaiting_user_decision' };
  if (processing) return { state: MAXXIS_AVATAR_STATES.PROCESSING, reason: 'request_in_progress' };
  if (hasNoticed(context)) return { state: MAXXIS_AVATAR_STATES.NOTICED, reason: 'proactive_signal_ready' };
  if (hasActiveContext(context)) return { state: MAXXIS_AVATAR_STATES.OBSERVING, reason: 'active_context' };
  return { state: MAXXIS_AVATAR_STATES.IDLE, reason: 'no_active_context' };
}

export function isValidMaxxisAvatarTransition(fromState, toState) {
  const from = cleanState(fromState);
  const to = cleanState(toState);
  if (from === to) return true;
  return Boolean(MAXXIS_AVATAR_TRANSITIONS[from]?.includes(to));
}

export function compareMaxxisAvatarStatePriority(leftState, rightState) {
  const left = MAXXIS_AVATAR_STATE_PRECEDENCE[cleanState(leftState)] || 0;
  const right = MAXXIS_AVATAR_STATE_PRECEDENCE[cleanState(rightState)] || 0;
  return left - right;
}

export function resolveMaxxisAvatarState(context = {}) {
  const now = Number(context.now || Date.now());
  const previous = context.previousState || {};
  const previousState = cleanState(previous.state);
  const visualStateMode = resolveVisualStateMode(context);
  const intensity = normalizeIntensity(context.animationIntensity || context.intensity);

  if (previous.accountKey && context.accountKey && previous.accountKey !== context.accountKey) {
    return buildAvatarState({
      state: MAXXIS_AVATAR_STATES.IDLE,
      reason: 'account_switch',
      now,
      visualStateMode,
      intensity,
      previousState,
      accountKey: context.accountKey,
    });
  }

  const selected = selectRawState(context);
  const selectedState = cleanState(selected.state);
  const shouldClearTransient = Boolean(
    context.bubbleDismissed
    || context.proactiveBubbleDismissed
    || context.loggedOut
    || context.enabled === false
    || context.open
    || context.maxxisOpen
  );

  if (!context.timelineManaged && !shouldClearTransient && previous.transient && Number(previous.transientUntil || 0) > now) {
    const selectedPriority = MAXXIS_AVATAR_STATE_PRECEDENCE[selectedState] || 0;
    const previousPriority = MAXXIS_AVATAR_STATE_PRECEDENCE[previousState] || 0;
    if (previousPriority >= selectedPriority && !hasSuccess(context)) {
      return buildAvatarState({
        state: previousState,
        reason: previous.reason || 'transient_hold',
        now: Number(previous.transition?.at || now),
        visualStateMode,
        intensity,
        previousState,
        accountKey: context.accountKey,
      });
    }
  }

  const transitionAllowed = isValidMaxxisAvatarTransition(previousState, selectedState);
  return buildAvatarState({
    state: selectedState,
    reason: selected.reason,
    now,
    visualStateMode,
    intensity,
    previousState,
    accountKey: context.accountKey,
    transitionAllowed,
  });
}

export function deriveMaxxisAvatarStateContext(context = {}) {
  return Object.freeze({
    hasActiveContext: hasActiveContext(context),
    processing: hasProcessing(context),
    waiting: hasWaiting(context, hasProcessing(context)),
    noticed: hasNoticed(context),
    success: hasSuccess(context),
    visualStateMode: resolveVisualStateMode(context),
    intensity: normalizeIntensity(context.animationIntensity || context.intensity),
  });
}
