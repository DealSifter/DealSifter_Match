import {
  MAXXIS_AVATAR_ANIMATION_INTENSITY,
  MAXXIS_AVATAR_STATES,
  MAXXIS_AVATAR_VISUAL_STATE_MODES,
  isMaxxisAvatarState,
} from './maxxisAvatarStates';

export const MAXXIS_AVATAR_ANIMATION_TOKENS = Object.freeze({
  [MAXXIS_AVATAR_STATES.IDLE]: 'idle-loop',
  [MAXXIS_AVATAR_STATES.OBSERVING]: 'observing-once',
  [MAXXIS_AVATAR_STATES.PROCESSING]: 'processing-loop',
  [MAXXIS_AVATAR_STATES.NOTICED]: 'noticed-once',
  [MAXXIS_AVATAR_STATES.WAITING]: 'waiting-loop',
  [MAXXIS_AVATAR_STATES.SUCCESS]: 'success-once',
});

export const MAXXIS_AVATAR_CROSSFADE_MS = 160;

function normalizeState(state) {
  const normalized = String(state || '').trim().toUpperCase();
  return isMaxxisAvatarState(normalized) ? normalized : MAXXIS_AVATAR_STATES.IDLE;
}

function normalizeIntensity(intensity) {
  const normalized = String(intensity || MAXXIS_AVATAR_ANIMATION_INTENSITY.SUBTLE).trim().toUpperCase();
  return MAXXIS_AVATAR_ANIMATION_INTENSITY[normalized]
    || MAXXIS_AVATAR_ANIMATION_INTENSITY.SUBTLE;
}

export function resolveMaxxisAvatarPresentation({
  state,
  intensity,
  visualStateMode,
  prefersReducedMotion = false,
} = {}) {
  const normalizedState = normalizeState(state);
  const normalizedIntensity = normalizeIntensity(intensity);
  const reducedMotion = Boolean(
    prefersReducedMotion
    || visualStateMode === MAXXIS_AVATAR_VISUAL_STATE_MODES.REDUCED
  );
  const motionEnabled = !reducedMotion
    && normalizedIntensity !== MAXXIS_AVATAR_ANIMATION_INTENSITY.OFF;

  return Object.freeze({
    state: normalizedState,
    intensity: normalizedIntensity,
    reducedMotion,
    motionEnabled,
    animationToken: motionEnabled
      ? MAXXIS_AVATAR_ANIMATION_TOKENS[normalizedState]
      : 'none',
    transitionMs: motionEnabled ? MAXXIS_AVATAR_CROSSFADE_MS : 0,
    className: [
      `maxxis-avatar-motion--${normalizedState.toLowerCase()}`,
      `maxxis-avatar-motion--${normalizedIntensity.toLowerCase()}`,
      motionEnabled ? 'maxxis-avatar-motion--enabled' : 'maxxis-avatar-motion--off',
    ].join(' '),
  });
}

