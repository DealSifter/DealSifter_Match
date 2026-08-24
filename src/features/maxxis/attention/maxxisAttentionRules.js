import {
  MAXXIS_AVATAR_ANIMATION_INTENSITY,
  MAXXIS_AVATAR_STATES,
} from '../avatar/maxxisAvatarStates';

export const MAXXIS_ATTENTION_REASON_CODES = Object.freeze({
  ALLOWED: 'ATTENTION_ALLOWED',
  PROACTIVITY_DISABLED: 'PROACTIVITY_DISABLED',
  MAXXIS_OPEN: 'MAXXIS_OPEN',
  CRITICAL_MODAL: 'CRITICAL_MODAL',
  SENSITIVE_SURFACE: 'SENSITIVE_SURFACE',
  USER_TYPING: 'USER_TYPING',
  FORM_SUBMITTING: 'FORM_SUBMITTING',
  NAVIGATION_TRANSITION: 'NAVIGATION_TRANSITION',
  MOBILE_KEYBOARD: 'MOBILE_KEYBOARD',
  MOBILE_CONGESTED: 'MOBILE_CONGESTED',
  ACTIVE_BUBBLE: 'ACTIVE_BUBBLE',
  CONFIRMATION_ACTIVE: 'CONFIRMATION_ACTIVE',
  PROCESSING_ACTIVE: 'PROCESSING_ACTIVE',
  WAITING_ACTIVE: 'WAITING_ACTIVE',
  SUCCESS_ACTIVE: 'SUCCESS_ACTIVE',
  ATTENTION_BUDGET: 'ATTENTION_BUDGET',
  NOTICED_FATIGUE: 'NOTICED_FATIGUE',
  SUCCESS_FATIGUE: 'SUCCESS_FATIGUE',
  STALE_SIGNAL: 'STALE_SIGNAL',
  CONTEXT_CHANGED: 'CONTEXT_CHANGED',
});

export const MAXXIS_ATTENTION_DEFAULTS = Object.freeze({
  deferredSignalMaxAgeMs: 60_000,
  navigationQuietMs: 180,
  transientAttentionCooldownMs: 2_400,
  successFatigueMs: 4_000,
  attentionWindowMs: 30_000,
  maxTransientAnimationsPerWindow: 3,
});

export const MAXXIS_ATTENTION_SENSITIVE_SURFACES = Object.freeze(new Set([
  'landing',
  'onboarding',
  'pricing',
  'settings',
  'admin',
  'privacy',
  'terms',
  'auth',
  'checkout',
  'payment',
]));

export const MAXXIS_ATTENTION_CRITICAL_MODALS = Object.freeze(new Set([
  'account-delete',
  'adminauth',
  'auth',
  'checkout',
  'consent',
  'message-confirmation',
  'onboarding-save',
  'payment',
  'profile-conflict',
  'profile-save',
  'spotlight',
  'unlock',
]));

export const MAXXIS_ATTENTION_TYPING_SURFACES = Object.freeze(new Set([
  'human_chat',
  'matches',
  'onboarding',
  'profile',
  'settings',
]));

export function cleanMaxxisAttentionToken(value, maxLength = 60) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9_:/.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, maxLength);
}

export function normalizeMaxxisAttentionIntensity(value) {
  const normalized = String(value || MAXXIS_AVATAR_ANIMATION_INTENSITY.SUBTLE).toUpperCase();
  return MAXXIS_AVATAR_ANIMATION_INTENSITY[normalized]
    || MAXXIS_AVATAR_ANIMATION_INTENSITY.SUBTLE;
}

export function isMaxxisSensitiveSurface({ currentSurface = '', currentSubview = '', checkoutActive = false } = {}) {
  if (checkoutActive) return true;
  const surface = cleanMaxxisAttentionToken(currentSurface).toLowerCase();
  const subview = cleanMaxxisAttentionToken(currentSubview).toLowerCase();
  return MAXXIS_ATTENTION_SENSITIVE_SURFACES.has(surface)
    || MAXXIS_ATTENTION_SENSITIVE_SURFACES.has(subview);
}

export function isMaxxisCriticalModal({ activeModal = '', criticalModalOpen = false } = {}) {
  if (criticalModalOpen) return true;
  return MAXXIS_ATTENTION_CRITICAL_MODALS.has(
    cleanMaxxisAttentionToken(activeModal).toLowerCase(),
  );
}

export function isMaxxisImportantTypingSurface({ currentSurface = '', currentSubview = '' } = {}) {
  const surface = cleanMaxxisAttentionToken(currentSurface).toLowerCase();
  const subview = cleanMaxxisAttentionToken(currentSubview).toLowerCase();
  return MAXXIS_ATTENTION_TYPING_SURFACES.has(surface)
    || MAXXIS_ATTENTION_TYPING_SURFACES.has(subview);
}

export function isMaxxisFunctionalAvatarState(state) {
  return [
    MAXXIS_AVATAR_STATES.PROCESSING,
    MAXXIS_AVATAR_STATES.WAITING,
    MAXXIS_AVATAR_STATES.SUCCESS,
  ].includes(String(state || '').toUpperCase());
}
