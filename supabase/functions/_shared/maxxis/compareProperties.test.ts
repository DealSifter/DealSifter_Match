import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { calculateDealMetrics } from './dealMetrics.ts';
import {
  comparePropertiesWithLookup,
  resolveComparePropertiesInput,
  validateComparePropertiesInput,
} from './compareProperties.ts';
import type { PropertyDetailsLookupResult } from './propertyDetails.ts';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';
const D = '44444444-4444-4444-8444-444444444444';

function details(
  id: string,
  values: { price?: number | null; sqft?: string; rehab?: number | null; capRate?: number | null } = {},
): PropertyDetailsLookupResult {
  const property = {
    id,
    type: 'Single Family',
    city: id === A ? 'Dallas' : id === B ? 'Austin' : 'Houston',
    state: 'TX',
    zip: '75201',
    price: values.price === undefined ? 120_000 : values.price,
    beds: 3,
    baths: 2,
    sqft: values.sqft === undefined ? '1500' : values.sqft,
    improvement: '',
    lot: '',
    dealTag: 'Wholesale',
    objective: 'Fix & Flip',
    rehab: values.rehab === undefined ? 25_000 : values.rehab,
    capRate: values.capRate === undefined ? 7.25 : values.capRate,
    description: '',
    markets: ['Dallas, TX'],
    images: [],
    published: true,
    dealClosed: false,
  };
  return {
    found: true,
    property,
    missingFields: [],
    metrics: calculateDealMetrics({
      price: property.price,
      sqft: property.sqft,
      rehab: property.rehab,
      capRate: property.capRate,
    }),
    analysis: null,
  };
}

function lookupFor(results: Record<string, PropertyDetailsLookupResult>) {
  return vi.fn(async (propertyId: string) => results[propertyId] || {
    found: false,
    property: null,
    missingFields: [],
    metrics: null,
  });
}

describe('Phase 3D compareProperties', () => {
  it('returns a structured comparison for two valid properties', async () => {
    const result = await comparePropertiesWithLookup(
      { propertyIds: [A, B] },
      lookupFor({ [A]: details(A, { price: 100_000 }), [B]: details(B, { price: 120_000 }) }),
    );
    expect(result.properties).toHaveLength(2);
    expect(result.comparison.price).toEqual({
      source: 'stored',
      comparable: true,
      comparedPropertyIds: [A, B],
      unavailablePropertyIds: [],
      lowestPropertyIds: [A],
      highestPropertyIds: [B],
    });
  });

  it('compares three valid properties in their requested order', async () => {
    const result = await comparePropertiesWithLookup(
      { propertyIds: [A, B, C] },
      lookupFor({
        [A]: details(A, { sqft: '1000' }),
        [B]: details(B, { sqft: '1800' }),
        [C]: details(C, { sqft: '1400' }),
      }),
    );
    expect(result.properties.map((item) => item.id)).toEqual([A, B, C]);
    expect(result.comparison.sqft.highestPropertyIds).toEqual([B]);
  });

  it('refuses a comparison with only one property', () => {
    expect(() => validateComparePropertiesInput({ propertyIds: [A] }))
      .toThrow('PROPERTY_COMPARISON_MIN_REQUIRED');
  });

  it('safely rejects more than the maximum of three properties', () => {
    expect(() => validateComparePropertiesInput({ propertyIds: [A, B, C, D] }))
      .toThrow('PROPERTY_COMPARISON_LIMIT_EXCEEDED');
  });

  it('rejects a property outside trusted context without performing a lookup', async () => {
    const lookup = lookupFor({ [A]: details(A), [D]: details(D) });
    expect(() => resolveComparePropertiesInput({ propertyIds: [A, D] }, [A, B, C]))
      .toThrow('PROPERTY_COMPARISON_CONTEXT_MISMATCH');
    expect(lookup).not.toHaveBeenCalled();
  });

  it('identifies B as the objectively lowest price per sqft', async () => {
    const result = await comparePropertiesWithLookup(
      { propertyIds: [A, B] },
      lookupFor({
        [A]: details(A, { price: 80_000, sqft: '1000' }),
        [B]: details(B, { price: 70_000, sqft: '1000' }),
      }),
    );
    expect(result.properties[0].metrics.metrics.pricePerSqft.value).toBe(80);
    expect(result.properties[1].metrics.metrics.pricePerSqft.value).toBe(70);
    expect(result.comparison.pricePerSqft.lowestPropertyIds).toEqual([B]);
  });

  it('returns every property involved in an exact tie', async () => {
    const result = await comparePropertiesWithLookup(
      { propertyIds: [A, B] },
      lookupFor({
        [A]: details(A, { price: 80_000, sqft: '1000' }),
        [B]: details(B, { price: 80_000, sqft: '1000' }),
      }),
    );
    expect(result.comparison.pricePerSqft.lowestPropertyIds).toEqual([A, B]);
    expect(result.comparison.pricePerSqft.highestPropertyIds).toEqual([A, B]);
  });

  it('does not treat a property with an unavailable metric as a worse value', async () => {
    const result = await comparePropertiesWithLookup(
      { propertyIds: [A, B] },
      lookupFor({
        [A]: details(A, { price: 80_000, sqft: '1000' }),
        [B]: details(B, { price: 70_000, sqft: '' }),
      }),
    );
    expect(result.comparison.pricePerSqft).toEqual(expect.objectContaining({
      comparable: false,
      comparedPropertyIds: [A],
      unavailablePropertyIds: [B],
      lowestPropertyIds: [],
      highestPropertyIds: [],
    }));
  });

  it('compares cap rate only as stored data', async () => {
    const result = await comparePropertiesWithLookup(
      { propertyIds: [A, B] },
      lookupFor({
        [A]: details(A, { capRate: 6.5 }),
        [B]: details(B, { capRate: 7.2 }),
      }),
    );
    expect(result.comparison.capRate.source).toBe('stored');
    expect(result.comparison.capRate.highestPropertyIds).toEqual([B]);
    expect(result.properties.every((item) => item.metrics.metrics.capRate.source === 'stored')).toBe(true);
  });

  it('keeps metric calculation and interpretive choices outside Gemini', () => {
    const compareSource = readFileSync(new URL('./compareProperties.ts', import.meta.url), 'utf8');
    const chatSource = readFileSync(new URL('../../maxxis-chat/index.ts', import.meta.url), 'utf8');
    const registrySource = readFileSync(new URL('./toolRegistry.ts', import.meta.url), 'utf8');
    expect(registrySource).toContain('(propertyId) => getPropertyDetailsForAuthenticatedUser({ propertyId }, authHeader, authenticated.client, authenticated.userId)');
    expect(compareSource).not.toContain('calculateDealMetrics');
    expect(chatSource).toContain('Never calculate comparison values');
    expect(chatSource).toContain('Never choose a preferred property');
  });

  it('whitelists comparison fields even if an upstream object gains protected data', async () => {
    const protectedDetails = details(A) as PropertyDetailsLookupResult & { property: Record<string, unknown> };
    protectedDetails.property.email = 'private@example.com';
    protectedDetails.property.ownerName = 'Private Owner';
    protectedDetails.property.unlockCost = 30;
    const result = await comparePropertiesWithLookup(
      { propertyIds: [A, B] },
      lookupFor({ [A]: protectedDetails, [B]: details(B) }),
    );
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('private@example.com');
    expect(serialized).not.toContain('Private Owner');
    expect(serialized).not.toContain('unlockCost');
  });

  it('returns a generic unavailable error when a property cannot be read', async () => {
    await expect(comparePropertiesWithLookup(
      { propertyIds: [A, B] },
      lookupFor({ [A]: details(A) }),
    )).rejects.toThrow('PROPERTY_COMPARISON_UNAVAILABLE');
  });
});
