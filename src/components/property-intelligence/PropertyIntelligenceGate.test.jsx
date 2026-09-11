import { describe, expect, it, vi, afterEach } from 'vitest';
import React from 'react';
import { PropertyIntelligenceGate } from './PropertyIntelligenceGate';
import { PropertyIntelligenceSection } from './PropertyIntelligenceSection';
import {
  isPropertyIntelligenceEnabled,
  parsePropertyIntelligenceEnabled,
  PROPERTY_INTELLIGENCE_FLAG_NAME,
} from '../../lib/propertyIntelligenceFeatureFlag';

const PROPERTY_ID = '11111111-1111-4111-8111-111111111111';

describe('Property Intelligence frontend feature kill switch', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('fails closed unless the flag is explicitly true', () => {
    expect(parsePropertyIntelligenceEnabled(undefined)).toBe(false);
    expect(parsePropertyIntelligenceEnabled('')).toBe(false);
    expect(parsePropertyIntelligenceEnabled('false')).toBe(false);
    expect(parsePropertyIntelligenceEnabled('foo')).toBe(false);
    expect(parsePropertyIntelligenceEnabled('TRUE')).toBe(true);
    expect(parsePropertyIntelligenceEnabled(' true ')).toBe(true);
  });

  it('reads the Vite frontend flag from a single helper', () => {
    vi.stubEnv(PROPERTY_INTELLIGENCE_FLAG_NAME, 'false');
    expect(isPropertyIntelligenceEnabled()).toBe(false);

    vi.stubEnv(PROPERTY_INTELLIGENCE_FLAG_NAME, 'true');
    expect(isPropertyIntelligenceEnabled()).toBe(true);

    vi.stubEnv(PROPERTY_INTELLIGENCE_FLAG_NAME, 'invalid');
    expect(isPropertyIntelligenceEnabled()).toBe(false);
  });

  it('does not create the section or call loaders when disabled', () => {
    const loadIntelligence = vi.fn();
    const element = PropertyIntelligenceGate({
      propertyId: PROPERTY_ID,
      loadIntelligence,
      enabled: false,
    });

    expect(element).toBeNull();
    expect(loadIntelligence).not.toHaveBeenCalled();
  });

  it('preserves the existing section flow when enabled', () => {
    const loadIntelligence = vi.fn();
    const element = PropertyIntelligenceGate({
      propertyId: PROPERTY_ID,
      loadIntelligence,
      enabled: true,
    });

    expect(React.isValidElement(element)).toBe(true);
    expect(element.type).toBe(PropertyIntelligenceSection);
    expect(element.props.propertyId).toBe(PROPERTY_ID);
    expect(element.props.loadIntelligence).toBe(loadIntelligence);
    expect(loadIntelligence).not.toHaveBeenCalled();
  });
});
