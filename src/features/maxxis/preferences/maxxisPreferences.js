import { MAXXIS_AVATAR_ANIMATION_INTENSITY } from '../avatar/maxxisAvatarStates';
import {
  MAXXIS_AVATAR_SIZE,
  normalizeMaxxisAvatarSize,
} from '../avatar/maxxisAvatarSizing';

export { MAXXIS_AVATAR_SIZE, normalizeMaxxisAvatarSize } from '../avatar/maxxisAvatarSizing';

export const MAXXIS_PREFERENCE_KEYS = Object.freeze({
  PROACTIVE_ENABLED: 'proactiveEnabled',
  ANIMATION_ENABLED: 'animationEnabled',
  ANIMATION_INTENSITY: 'animationIntensity',
  AVATAR_SIZE: 'avatarSize',
});

export const MAXXIS_ANIMATION_INTENSITIES = Object.freeze({
  SUBTLE: MAXXIS_AVATAR_ANIMATION_INTENSITY.SUBTLE,
  NORMAL: MAXXIS_AVATAR_ANIMATION_INTENSITY.NORMAL,
});

export const DEFAULT_MAXXIS_PREFERENCES = Object.freeze({
  proactiveEnabled: true,
  animationEnabled: true,
  animationIntensity: MAXXIS_ANIMATION_INTENSITIES.SUBTLE,
  avatarSize: MAXXIS_AVATAR_SIZE.DEFAULT,
});

export function normalizeMaxxisPreferences(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const requestedIntensity = String(input.animationIntensity || '').trim().toUpperCase();
  return {
    proactiveEnabled: Boolean(input.proactiveEnabled ?? DEFAULT_MAXXIS_PREFERENCES.proactiveEnabled),
    animationEnabled: Boolean(input.animationEnabled ?? DEFAULT_MAXXIS_PREFERENCES.animationEnabled),
    animationIntensity: Object.values(MAXXIS_ANIMATION_INTENSITIES).includes(requestedIntensity)
      ? requestedIntensity
      : DEFAULT_MAXXIS_PREFERENCES.animationIntensity,
    avatarSize: normalizeMaxxisAvatarSize(input.avatarSize),
  };
}

export function resolveEffectiveMaxxisPreferences({
  preferences,
  proactiveFeatureEnabled = false,
  reducedMotion = false,
} = {}) {
  const normalized = normalizeMaxxisPreferences(preferences);
  const animationEnabled = normalized.animationEnabled && !reducedMotion;
  return Object.freeze({
    ...normalized,
    proactiveEnabled: Boolean(proactiveFeatureEnabled && normalized.proactiveEnabled),
    animationEnabled,
    animationIntensity: animationEnabled
      ? normalized.animationIntensity
      : MAXXIS_AVATAR_ANIMATION_INTENSITY.OFF,
    proactiveFeatureEnabled: Boolean(proactiveFeatureEnabled),
    reducedMotion: Boolean(reducedMotion),
  });
}

export function getMaxxisPreferenceValueCategory(key, value) {
  if (key === MAXXIS_PREFERENCE_KEYS.ANIMATION_INTENSITY) {
    return value === MAXXIS_ANIMATION_INTENSITIES.NORMAL ? 'normal' : 'subtle';
  }
  if (key === MAXXIS_PREFERENCE_KEYS.AVATAR_SIZE) {
    const size = normalizeMaxxisAvatarSize(value);
    if (size >= MAXXIS_AVATAR_SIZE.MAX) return 'maximum';
    if (size > MAXXIS_AVATAR_SIZE.DEFAULT) return 'enlarged';
    return 'default';
  }
  return value === true ? 'enabled' : 'disabled';
}

export function readMaxxisProactiveFlagOverrides() {
  const adminReviewEnabled = import.meta.env.VITE_MAXXIS_PROACTIVE_REVIEW === 'true';
  if ((!import.meta.env.DEV && !adminReviewEnabled) || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem('ds_feature_flag_overrides');
    const parsed = raw ? JSON.parse(raw) : null;
    const overrides = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    if (adminReviewEnabled || window.localStorage.getItem('ds_e2e_maxxis_proactive') === '1') {
      return { ...overrides, maxxis_proactive_insights: true };
    }
    return Object.keys(overrides).length ? overrides : null;
  } catch {
    return null;
  }
}

export const MAXXIS_PREFERENCES_COPY = Object.freeze({
  en: Object.freeze({
    title: 'Maxxis Deal AI preferences',
    sectionTitle: 'MAXXIS DEAL AI',
    sectionDescription: 'Choose how Maxxis Deal AI notifies you and presents avatar motion.',
    proactiveLabel: 'Proactive insights',
    proactiveDescription: 'Let Maxxis Deal AI notify you when something relevant is found.',
    proactiveUnavailable: 'Proactive insights are not currently available.',
    animationsLabel: 'Maxxis Deal AI animations',
    animationsDescription: 'Show subtle avatar motion.',
    intensityLabel: 'Intensity',
    subtle: 'Subtle',
    normal: 'Normal',
    avatarSizeLabel: 'Avatar size',
    avatarSizeValue: (value) => `Avatar size: ${value.toFixed(2)}x`,
    moreSettings: 'More settings',
    openSettings: 'Open Maxxis Deal AI preferences',
    saving: 'Saving preferences…',
    saveFailed: 'Could not save remotely. Your current session settings remain active.',
  }),
  pt: Object.freeze({
    title: 'Preferências do Maxxis Deal AI',
    sectionTitle: 'MAXXIS DEAL AI',
    sectionDescription: 'Escolha como o Maxxis Deal AI avisa você e apresenta os movimentos do avatar.',
    proactiveLabel: 'Insights proativos',
    proactiveDescription: 'Permitir que o Maxxis Deal AI avise quando encontrar algo relevante.',
    proactiveUnavailable: 'Os insights proativos não estão disponíveis no momento.',
    animationsLabel: 'Animações do Maxxis Deal AI',
    animationsDescription: 'Mostrar movimentos sutis do avatar.',
    intensityLabel: 'Intensidade',
    subtle: 'Sutil',
    normal: 'Normal',
    avatarSizeLabel: 'Tamanho do avatar',
    avatarSizeValue: (value) => `Tamanho do avatar: ${value.toFixed(2)}x`,
    moreSettings: 'Mais configurações',
    openSettings: 'Abrir preferências do Maxxis Deal AI',
    saving: 'Salvando preferências…',
    saveFailed: 'Não foi possível salvar remotamente. As configurações continuam ativas nesta sessão.',
  }),
  es: Object.freeze({
    title: 'Preferencias de Maxxis Deal AI',
    sectionTitle: 'MAXXIS DEAL AI',
    sectionDescription: 'Elige cómo Maxxis Deal AI te avisa y presenta los movimientos del avatar.',
    proactiveLabel: 'Insights proactivos',
    proactiveDescription: 'Permitir que Maxxis Deal AI avise cuando encuentre algo relevante.',
    proactiveUnavailable: 'Los insights proactivos no están disponibles en este momento.',
    animationsLabel: 'Animaciones de Maxxis Deal AI',
    animationsDescription: 'Mostrar movimientos sutiles del avatar.',
    intensityLabel: 'Intensidad',
    subtle: 'Sutil',
    normal: 'Normal',
    avatarSizeLabel: 'Tamaño del avatar',
    avatarSizeValue: (value) => `Tamaño del avatar: ${value.toFixed(2)}x`,
    moreSettings: 'Más configuraciones',
    openSettings: 'Abrir preferencias de Maxxis Deal AI',
    saving: 'Guardando preferencias…',
    saveFailed: 'No se pudo guardar de forma remota. La configuración sigue activa en esta sesión.',
  }),
});

export function getMaxxisPreferencesCopy(language = 'en') {
  return MAXXIS_PREFERENCES_COPY[language] || MAXXIS_PREFERENCES_COPY.en;
}
