import { describe, expect, it } from 'vitest';
import { calculatePropertyMatch, PROPERTY_MATCH_WEIGHTS } from './calculatePropertyMatch.ts';

const profile = {
  targetMarkets: ['Dallas, TX'],
  priceRange: '100_200k',
  propertyTypes: ['Single Family'],
  strategies: ['Fix & Flip'],
};

const property = {
  city: 'Dallas',
  state: 'TX',
  markets: ['TX'],
  price: 175_000,
  type: 'SFR',
  objective: 'Fix&Flip',
};

describe('calculatePropertyMatch', () => {
  it('uses weights that total exactly 100', () => {
    expect(Object.values(PROPERTY_MATCH_WEIGHTS).reduce((total, weight) => total + weight, 0)).toBe(100);
  });

  it('returns a high score for a highly compatible property', () => {
    const result = calculatePropertyMatch(profile, property);
    expect(result.score).toBe(100);
    expect(result.classification).toBe('excellent');
    expect(result.reasons.every((item) => item.status === 'matched')).toBe(true);
  });

  it('loses only the location criterion outside the desired market', () => {
    const result = calculatePropertyMatch(profile, { ...property, city: 'Miami', state: 'FL', markets: ['FL'] });
    expect(result.score).toBe(65);
    expect(result.reasons.filter((item) => item.status === 'not_matched').map((item) => item.key)).toEqual(['market']);
  });

  it('marks a price outside the configured range as incompatible', () => {
    const result = calculatePropertyMatch(profile, { ...property, price: 450_000 });
    expect(result.score).toBe(75);
    expect(result.reasons.find((item) => item.key === 'price')?.status).toBe('not_matched');
  });

  it('marks a different property type as incompatible', () => {
    const result = calculatePropertyMatch(profile, { ...property, type: 'Land' });
    expect(result.score).toBe(75);
    expect(result.reasons.find((item) => item.key === 'property_type')?.status).toBe('not_matched');
  });

  it('does not penalize missing property data', () => {
    const result = calculatePropertyMatch(profile, { ...property, price: null });
    expect(result.score).toBe(100);
    expect(result.evaluatedWeight).toBe(75);
    expect(result.reasons.find((item) => item.key === 'price')?.status).toBe('not_evaluated');
  });

  it('normalizes a partial profile over only evaluable criteria', () => {
    const result = calculatePropertyMatch({ targetMarkets: ['TX'] }, property);
    expect(result.score).toBe(100);
    expect(result.evaluatedCriteria).toBe(1);
    expect(result.evaluatedWeight).toBe(35);
  });

  it('does not invent a score when the profile is absent', () => {
    const result = calculatePropertyMatch(null, property);
    expect(result.score).toBeNull();
    expect(result.classification).toBe('unavailable');
    expect(result.calculable).toBe(false);
  });

  it('always returns a finite score inside the 0-100 range when calculable', () => {
    const cases = [
      calculatePropertyMatch(profile, property),
      calculatePropertyMatch(profile, { ...property, city: 'Miami', state: 'FL', markets: ['FL'], price: 900_000, type: 'Land', objective: 'Rent' }),
      calculatePropertyMatch({ targetMarkets: ['TX'] }, property),
    ];
    cases.forEach((result) => {
      if (result.score === null) throw new Error('Expected a calculable score.');
      expect(Number.isFinite(result.score)).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });
});
