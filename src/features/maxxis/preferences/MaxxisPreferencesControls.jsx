import React from 'react';
import { trackProductEvent } from '../../../lib/productAnalytics';
import {
  getMaxxisPreferenceValueCategory,
  getMaxxisPreferencesCopy,
  MAXXIS_ANIMATION_INTENSITIES,
  MAXXIS_PREFERENCE_KEYS,
  normalizeMaxxisPreferences,
} from './maxxisPreferences';
import './MaxxisPreferencesControls.css';

function PreferenceToggle({ id, checked, disabled = false, label, description, onChange, testId }) {
  return (
    <label className={`maxxis-preference-row ${disabled ? 'maxxis-preference-row--disabled' : ''}`} htmlFor={id}>
      <span className="maxxis-preference-copy">
        <strong>{label}</strong>
        <span>{description}</span>
      </span>
      <input
        id={id}
        data-testid={testId}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

export function MaxxisPreferencesControls({
  preferences,
  onChange,
  language = 'en',
  proactiveFeatureEnabled = false,
  persistenceStatus = 'idle',
  surface = 'settings',
  compact = false,
}) {
  const copy = getMaxxisPreferencesCopy(language);
  const normalized = normalizeMaxxisPreferences(preferences);
  const updatePreference = (preferenceKey, value) => {
    onChange?.(preferenceKey, value);
    void trackProductEvent('maxxis_preference_changed', {
      dedupeKey: `maxxis-preference:${surface}:${preferenceKey}:${String(value)}:${Date.now()}`,
      properties: {
        preferenceKey,
        newValueCategory: getMaxxisPreferenceValueCategory(preferenceKey, value),
        surface,
      },
    });
  };

  return (
    <div className={`maxxis-preferences-controls ${compact ? 'maxxis-preferences-controls--compact' : ''}`} data-testid={`maxxis-preferences-${surface}`}>
      <PreferenceToggle
        id={`maxxis-proactive-${surface}`}
        testId={`maxxis-proactive-toggle-${surface}`}
        checked={proactiveFeatureEnabled && normalized.proactiveEnabled}
        disabled={!proactiveFeatureEnabled}
        label={copy.proactiveLabel}
        description={proactiveFeatureEnabled ? copy.proactiveDescription : copy.proactiveUnavailable}
        onChange={(value) => updatePreference(MAXXIS_PREFERENCE_KEYS.PROACTIVE_ENABLED, value)}
      />

      <PreferenceToggle
        id={`maxxis-animations-${surface}`}
        testId={`maxxis-animation-toggle-${surface}`}
        checked={normalized.animationEnabled}
        label={copy.animationsLabel}
        description={copy.animationsDescription}
        onChange={(value) => updatePreference(MAXXIS_PREFERENCE_KEYS.ANIMATION_ENABLED, value)}
      />

      <fieldset className="maxxis-intensity" disabled={!normalized.animationEnabled}>
        <legend>{copy.intensityLabel}</legend>
        <div className="maxxis-intensity-options">
          <label>
            <input
              type="radio"
              name={`maxxis-intensity-${surface}`}
              value={MAXXIS_ANIMATION_INTENSITIES.SUBTLE}
              checked={normalized.animationIntensity === MAXXIS_ANIMATION_INTENSITIES.SUBTLE}
              onChange={() => updatePreference(MAXXIS_PREFERENCE_KEYS.ANIMATION_INTENSITY, MAXXIS_ANIMATION_INTENSITIES.SUBTLE)}
            />
            <span>{copy.subtle}</span>
          </label>
          <label>
            <input
              type="radio"
              name={`maxxis-intensity-${surface}`}
              value={MAXXIS_ANIMATION_INTENSITIES.NORMAL}
              checked={normalized.animationIntensity === MAXXIS_ANIMATION_INTENSITIES.NORMAL}
              onChange={() => updatePreference(MAXXIS_PREFERENCE_KEYS.ANIMATION_INTENSITY, MAXXIS_ANIMATION_INTENSITIES.NORMAL)}
            />
            <span>{copy.normal}</span>
          </label>
        </div>
      </fieldset>

      {persistenceStatus === 'saving' ? <div className="maxxis-preference-status" role="status">{copy.saving}</div> : null}
      {persistenceStatus === 'error' ? <div className="maxxis-preference-status maxxis-preference-status--error" role="status">{copy.saveFailed}</div> : null}
    </div>
  );
}

export default MaxxisPreferencesControls;
