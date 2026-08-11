import { describe, expect, it, vi } from 'vitest';
import { orchestratePropertySearch, sortPropertiesByMatch } from './propertySearchOrchestrator.ts';

const makeProperty = (id: string, overrides = {}) => ({
  id,
  title: 'SFR',
  city: 'Miami',
  state: 'FL',
  zip: '33101',
  price: 150_000,
  propertyType: 'SFR',
  bedrooms: 3,
  bathrooms: 2,
  sqft: '1400',
  objective: 'Fix&Flip',
  image: '',
  status: 'active' as const,
  ...overrides,
});
const floridaProfile = {
  profile: { targetMarkets: ['FL'], priceRange: '100_200k', propertyTypes: ['Single Family'], strategies: ['Fix & Flip'] },
  exists: true,
  complete: true,
};
const floridaBehavior = {
  actions: [1, 2, 3, 4, 5].map((id) => ({
    action: 'interested' as const,
    signal: 'positive' as const,
    entityId: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
    updatedAt: '2026-08-10T12:00:00.000Z',
    property: {
      id: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
      city: 'Miami',
      state: 'FL',
      price: 150_000,
      type: 'SFR',
      objective: 'Fix&Flip',
    },
  })),
  actionCount: 5,
  resolvedActionCount: 5,
  historyAvailable: true,
  windowDays: 90,
  limit: 100,
};
const alabamaBehavior = {
  ...floridaBehavior,
  actions: floridaBehavior.actions.map((action) => ({
    ...action,
    property: { ...action.property, city: 'Birmingham', state: 'AL' },
  })),
};

describe('property search orchestrator', () => {
  it('ranks compatible properties from highest score to lowest', async () => {
    const search = vi.fn().mockResolvedValue([
      makeProperty('low', { city: 'Dallas', state: 'TX', price: 450_000, propertyType: 'Land', objective: 'Rent' }),
      makeProperty('high'),
      makeProperty('medium', { price: 450_000 }),
    ]);
    const result = await orchestratePropertySearch({ limit: 10 }, true, { getProfile: async () => floridaProfile, search });
    expect(result.properties.map((item) => item.id)).toEqual(['high', 'medium', 'low']);
    expect(result.scoredProperties).toBe(3);
    expect(result.properties.every((item) => item.match?.behaviorAdjustment === 0)).toBe(true);
  });

  it('keeps explicit Alabama filters instead of profile Florida filters', async () => {
    const search = vi.fn().mockResolvedValue([makeProperty('alabama', { city: 'Birmingham', state: 'AL' })]);
    const getBehavior = vi.fn().mockResolvedValue(floridaBehavior);
    const result = await orchestratePropertySearch({ state: ['AL'], maxPrice: 250_000, limit: 10 }, true, { getProfile: async () => floridaProfile, search, getBehavior });
    expect(search).toHaveBeenCalledWith(expect.objectContaining({ state: ['AL'], maxPrice: 250_000 }));
    expect(search.mock.calls[0][0]).not.toHaveProperty('minPrice');
    expect(result.properties.map((property) => property.state)).toEqual(['AL']);
  });

  it('reads behavior once and calculates all candidate adjustments in memory', async () => {
    const search = vi.fn().mockResolvedValue([makeProperty('one'), makeProperty('two'), makeProperty('three')]);
    const getBehavior = vi.fn().mockResolvedValue(floridaBehavior);
    const result = await orchestratePropertySearch({ limit: 10 }, true, { getProfile: async () => floridaProfile, search, getBehavior });
    expect(getBehavior).toHaveBeenCalledTimes(1);
    expect(result.properties.every((property) => property.match?.structuralScore === 100)).toBe(true);
    expect(result.properties.every((property) => property.match?.behaviorAdjustment === 10)).toBe(true);
    expect(result.behaviorSignalApplied).toBe(true);
  });

  it('calculates behavior deterministically in the orchestrator without a Gemini dependency', async () => {
    const result = await orchestratePropertySearch({ limit: 10 }, true, {
      getProfile: async () => floridaProfile,
      search: async () => [makeProperty('deterministic')],
      getBehavior: async () => floridaBehavior,
    });
    expect(result.properties[0].match).toMatchObject({ structuralScore: 100, behaviorAdjustment: 10, score: 100, classification: 'excellent' });
  });

  it('exposes profile drift without changing the Phase 2D score or ranking', async () => {
    const search = vi.fn().mockResolvedValue([
      makeProperty('low', { city: 'Dallas', state: 'TX', price: 450_000, propertyType: 'Land', objective: 'Rent' }),
      makeProperty('high'),
      makeProperty('medium', { price: 450_000 }),
    ]);
    const result = await orchestratePropertySearch({ limit: 10 }, true, {
      getProfile: async () => floridaProfile,
      search,
      getBehavior: async () => alabamaBehavior,
    });
    expect(result.properties.map((item) => item.id)).toEqual(['high', 'medium', 'low']);
    expect(result.properties.map((item) => item.match?.score)).toEqual([100, 75, 0]);
    expect(result.properties.map((item) => item.match?.behaviorAdjustment)).toEqual([2, 0, -10]);
    expect(result.profileDriftDetected).toBe(true);
    expect(result.profileSuggestions).toEqual([expect.objectContaining({ operation: 'add_market', suggestedValue: 'AL' })]);
  });

  it('keeps explicit search working without a profile and without scores', async () => {
    const search = vi.fn().mockResolvedValue([makeProperty('plain')]);
    const result = await orchestratePropertySearch({ state: ['TX'], limit: 10 }, false, {
      getProfile: async () => ({ profile: null, exists: false, complete: false }),
      search,
    });
    expect(result.properties).toHaveLength(1);
    expect(result.properties[0]).not.toHaveProperty('match');
    expect(result.profileAvailable).toBe(false);
  });

  it('requires a profile for a personalized search and does not query properties', async () => {
    const search = vi.fn();
    const result = await orchestratePropertySearch({ limit: 10 }, true, {
      getProfile: async () => ({ profile: null, exists: false, complete: false }),
      search,
    });
    expect(result.requiresProfile).toBe(true);
    expect(result.properties).toEqual([]);
    expect(search).not.toHaveBeenCalled();
  });

  it('marks insufficient property data unavailable without inventing a score', async () => {
    const search = vi.fn().mockResolvedValue([makeProperty('missing', { city: '', state: '', price: 0, propertyType: '', objective: '' })]);
    const result = await orchestratePropertySearch({ limit: 10 }, false, { getProfile: async () => floridaProfile, search });
    expect(result.properties[0].match?.score).toBeNull();
    expect(result.properties[0].match?.classification).toBe('unavailable');
  });

  it('sorts scores 90, 72, 55 and keeps unavailable scores last', () => {
    const withMatch = (id: string, score: number | null) => makeProperty(id, { match: { score, classification: score === null ? 'unavailable' : 'good', calculable: score !== null, reasons: [], evaluatedCriteria: 1, possibleCriteria: 1, earnedPoints: score || 0, evaluatedWeight: 100 } });
    expect(sortPropertiesByMatch([withMatch('55', 55), withMatch('none', null), withMatch('90', 90), withMatch('72', 72)]).map((item) => item.id)).toEqual(['90', '72', '55', 'none']);
  });
});
