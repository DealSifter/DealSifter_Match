import { describe, expect, it, vi } from 'vitest';
import { fetchPropertyIntelligence, isPropertyIntelligenceId } from './propertyIntelligenceService';

const PROPERTY_ID = '11111111-1111-4111-8111-111111111111';

describe('Property Intelligence frontend service', () => {
  it('accepts only canonical property ids', () => {
    expect(isPropertyIntelligenceId(PROPERTY_ID)).toBe(true);
    expect(isPropertyIntelligenceId('property-1')).toBe(false);
  });

  it('passes only propertyId to the backend authority', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { success: true, state: 'locked', entitled: false }, error: null });
    await expect(fetchPropertyIntelligence(PROPERTY_ID, invoke)).resolves.toMatchObject({ state: 'locked' });
    expect(invoke).toHaveBeenCalledWith({ propertyId: PROPERTY_ID });
  });

  it('does not accept malformed or invented backend payloads', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { fields: { assessedValue: 500000 } }, error: null });
    await expect(fetchPropertyIntelligence(PROPERTY_ID, invoke)).rejects.toThrow('PROPERTY_INTELLIGENCE_UNAVAILABLE');
  });

  it('deduplicates concurrent StrictMode requests for the same property', async () => {
    let release;
    const invoke = vi.fn(() => new Promise((resolve) => { release = resolve; }));
    const first = fetchPropertyIntelligence(PROPERTY_ID, invoke);
    const second = fetchPropertyIntelligence(PROPERTY_ID, invoke);
    expect(invoke).toHaveBeenCalledTimes(1);
    release({ data: { success: true, state: 'locked', entitled: false }, error: null });
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});
