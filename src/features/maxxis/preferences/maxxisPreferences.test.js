import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_MAXXIS_PREFERENCES,
  getMaxxisPreferenceValueCategory,
  getMaxxisPreferencesCopy,
  normalizeMaxxisPreferences,
  readMaxxisProactiveFlagOverrides,
  resolveEffectiveMaxxisPreferences,
} from './maxxisPreferences';

afterEach(() => vi.unstubAllGlobals());

describe('Maxxis interaction preferences', () => {
  it('uses safe product defaults and rejects invalid intensity values', () => {
    expect(normalizeMaxxisPreferences()).toEqual(DEFAULT_MAXXIS_PREFERENCES);
    expect(normalizeMaxxisPreferences({
      proactiveEnabled: false,
      animationEnabled: false,
      animationIntensity: 'LOUD',
    })).toEqual({
      proactiveEnabled: false,
      animationEnabled: false,
      animationIntensity: 'SUBTLE',
    });
  });

  it('applies global feature flag precedence over the user preference', () => {
    expect(resolveEffectiveMaxxisPreferences({
      preferences: { proactiveEnabled: true },
      proactiveFeatureEnabled: false,
    }).proactiveEnabled).toBe(false);
    expect(resolveEffectiveMaxxisPreferences({
      preferences: { proactiveEnabled: true },
      proactiveFeatureEnabled: true,
    }).proactiveEnabled).toBe(true);
  });

  it.each([
    [true, true],
    [true, false],
    [false, true],
    [false, false],
  ])('keeps proactivity %s and animation %s independent', (proactiveEnabled, animationEnabled) => {
    const effective = resolveEffectiveMaxxisPreferences({
      preferences: { proactiveEnabled, animationEnabled, animationIntensity: 'NORMAL' },
      proactiveFeatureEnabled: true,
    });
    expect(effective.proactiveEnabled).toBe(proactiveEnabled);
    expect(effective.animationEnabled).toBe(animationEnabled);
    expect(effective.animationIntensity).toBe(animationEnabled ? 'NORMAL' : 'OFF');
  });

  it('lets reduced motion win visually without changing the stored preference', () => {
    const stored = normalizeMaxxisPreferences({ animationEnabled: true, animationIntensity: 'NORMAL' });
    const effective = resolveEffectiveMaxxisPreferences({
      preferences: stored,
      proactiveFeatureEnabled: true,
      reducedMotion: true,
    });
    expect(effective.animationEnabled).toBe(false);
    expect(effective.animationIntensity).toBe('OFF');
    expect(stored).toMatchObject({ animationEnabled: true, animationIntensity: 'NORMAL' });
  });

  it('preserves the chosen intensity while animations are disabled', () => {
    const stored = normalizeMaxxisPreferences({ animationEnabled: false, animationIntensity: 'NORMAL' });
    expect(stored.animationIntensity).toBe('NORMAL');
    expect(resolveEffectiveMaxxisPreferences({ preferences: stored }).animationIntensity).toBe('OFF');
    expect(resolveEffectiveMaxxisPreferences({
      preferences: { ...stored, animationEnabled: true },
    }).animationIntensity).toBe('NORMAL');
  });

  it('provides complete user-facing PT, EN and ES copy with safe analytics categories', () => {
    for (const language of ['pt', 'en', 'es']) {
      const copy = getMaxxisPreferencesCopy(language);
      expect(copy.proactiveLabel).toBeTruthy();
      expect(copy.animationsLabel).toBeTruthy();
      expect(copy.subtle).toBeTruthy();
      expect(copy.normal).toBeTruthy();
    }
    expect(getMaxxisPreferenceValueCategory('proactiveEnabled', false)).toBe('disabled');
    expect(getMaxxisPreferenceValueCategory('animationIntensity', 'NORMAL')).toBe('normal');
  });

  it('merges simultaneous DEV-only proactivity and Deal Memory overrides', () => {
    const values = new Map([
      ['ds_e2e_maxxis_proactive', '1'],
      ['ds_feature_flag_overrides', JSON.stringify({ maxxis_deal_memory: true })],
    ]);
    vi.stubGlobal('window', { localStorage: { getItem: (key) => values.get(key) || null } });

    expect(readMaxxisProactiveFlagOverrides()).toEqual({
      maxxis_deal_memory: true,
      maxxis_proactive_insights: true,
    });
  });
});
