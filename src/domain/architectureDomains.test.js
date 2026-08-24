import { describe, expect, it } from 'vitest';
import { normalizeMaxxisResponsePayload } from './maxxis/responseTypes';
import { DEFAULT_USER_PREFERENCES, normalizeUserPreferences } from './profile/userPreferences';

describe('extracted architecture domains', () => {
  it('normalizes nested preferences without mutating defaults', () => {
    const result = normalizeUserPreferences({ map: { initialZoom: 99 }, privacy: { readReceipts: false } });
    expect(result.map.initialZoom).toBe(13);
    expect(result.privacy.readReceipts).toBe(false);
    expect(result.maxxis).toEqual({ proactiveEnabled: true, animationEnabled: true, animationIntensity: 'SUBTLE' });
    expect(DEFAULT_USER_PREFERENCES.map.initialZoom).toBe(4);
  });

  it('accepts supported Maxxis capabilities', () => {
    expect(normalizeMaxxisResponsePayload('services', { services: [] }))
      .toEqual({ type: 'services', data: { services: [] } });
  });

  it('fails closed for malformed or unknown Maxxis responses', () => {
    expect(normalizeMaxxisResponsePayload('services', { services: null }))
      .toEqual({ type: 'text', data: null });
    expect(normalizeMaxxisResponsePayload('unknown', {}))
      .toEqual({ type: 'text', data: null });
  });
});
