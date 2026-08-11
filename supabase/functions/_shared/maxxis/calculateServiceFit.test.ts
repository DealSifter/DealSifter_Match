import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { calculateServiceFit, rankServicesByFit } from './calculateServiceFit.ts';
import type { MaxxisServiceResult, PropertyServiceNeed, ServiceFitResult } from './types.ts';

const need = (serviceType = 'General Contractor') => ({ serviceType }) as Pick<PropertyServiceNeed, 'serviceType'>;

function service(
  id: string,
  serviceType = 'General Contractor',
  markets: string[] = ['Dallas, TX'],
  price = 500,
): MaxxisServiceResult {
  return {
    id,
    title: `Published service ${id}`,
    serviceType,
    description: 'Public service description.',
    price,
    markets,
    image: 'https://cdn.example.com/service.jpg',
  };
}

function fit(score: number | null): ServiceFitResult {
  return {
    score,
    classification: score === null ? 'unavailable' : score >= 80 ? 'strong_fit' : score >= 60 ? 'good_fit' : score >= 40 ? 'moderate_fit' : 'low_fit',
    calculable: score !== null,
    reasons: [],
    evaluatedCriteria: score === null ? 0 : 2,
    possibleCriteria: 2,
    earnedPoints: score || 0,
    evaluatedWeight: score === null ? 0 : 100,
  };
}

describe('Phase 3H calculateServiceFit', () => {
  it('scores an exact service type with city coverage as 100 strong fit', () => {
    const result = calculateServiceFit({
      serviceNeed: need(),
      propertyContext: { city: 'Dallas', state: 'TX' },
      service: service('city'),
    });
    expect(result).toMatchObject({ score: 100, classification: 'strong_fit', calculable: true, earnedPoints: 100, evaluatedWeight: 100 });
    expect(result.reasons.map((reason) => reason.detail)).toEqual(['exact_service_type', 'city_coverage']);
  });

  it('gives partial location points for exact service type with state-only coverage', () => {
    const city = calculateServiceFit({ serviceNeed: need(), propertyContext: { city: 'Dallas', state: 'TX' }, service: service('city') });
    const state = calculateServiceFit({ serviceNeed: need(), propertyContext: { city: 'Dallas', state: 'TX' }, service: service('state', 'General Contractor', ['TX']) });
    expect(state).toMatchObject({ score: 85, classification: 'strong_fit', earnedPoints: 85, evaluatedWeight: 100 });
    expect(state.reasons[1]).toMatchObject({ detail: 'state_coverage', points: 25, maxPoints: 40 });
    expect(state.score).toBeLessThan(city.score as number);
  });

  it('does not award category points to an incompatible service type', () => {
    const result = calculateServiceFit({
      serviceNeed: need('Photography'),
      propertyContext: { city: 'Dallas', state: 'TX' },
      service: service('contractor'),
    });
    expect(result).toMatchObject({ score: 40, classification: 'moderate_fit', earnedPoints: 40, evaluatedWeight: 100 });
    expect(result.reasons[0]).toMatchObject({ status: 'not_matched', detail: 'different_service_type', points: 0 });
  });

  it('marks absent market data as not evaluated without penalizing the known criterion', () => {
    const result = calculateServiceFit({
      serviceNeed: need(),
      propertyContext: { city: 'Dallas', state: 'TX' },
      service: service('missing-market', 'General Contractor', []),
    });
    expect(result).toMatchObject({ score: 100, classification: 'strong_fit', evaluatedCriteria: 1, possibleCriteria: 2, earnedPoints: 60, evaluatedWeight: 60 });
    expect(result.reasons[1]).toMatchObject({ status: 'not_evaluated', detail: 'missing_data', matched: null });
  });

  it('does not let a lower listed price increase fit', () => {
    const input = { serviceNeed: need(), propertyContext: { city: 'Dallas', state: 'TX' } };
    const lowerPrice = calculateServiceFit({ ...input, service: service('lower', 'General Contractor', ['TX'], 100) });
    const higherPrice = calculateServiceFit({ ...input, service: service('higher', 'General Contractor', ['TX'], 5_000) });
    expect(lowerPrice).toEqual(higherPrice);
  });

  it('ranks calculable services by descending fit score', () => {
    const ranked = rankServicesByFit([
      { id: 'sixty', fit: fit(60) },
      { id: 'ninety', fit: fit(90) },
      { id: 'seventy-five', fit: fit(75) },
    ]);
    expect(ranked.map((item) => item.id)).toEqual(['ninety', 'seventy-five', 'sixty']);
  });

  it('preserves source order when fit scores tie', () => {
    const ranked = rankServicesByFit([
      { id: 'first', fit: fit(85) },
      { id: 'second', fit: fit(85) },
      { id: 'third', fit: fit(85) },
    ]);
    expect(ranked.map((item) => item.id)).toEqual(['first', 'second', 'third']);
  });

  it('returns unavailable when no criterion has enough data', () => {
    const result = calculateServiceFit({
      serviceNeed: need(''),
      propertyContext: { city: '', state: '' },
      service: service('empty', '', []),
    });
    expect(result).toMatchObject({ score: null, classification: 'unavailable', calculable: false, evaluatedCriteria: 0, earnedPoints: 0, evaluatedWeight: 0 });
    expect(result.reasons.every((reason) => reason.status === 'not_evaluated')).toBe(true);
  });

  it('never copies protected provider fields into the fit result', () => {
    const unsafe = Object.assign(service('safe'), {
      phone: '+15555555555', email: 'private@example.com', owner: { id: 'private' }, unlockCost: 30,
    });
    const result = calculateServiceFit({ serviceNeed: need(), propertyContext: { city: 'Dallas', state: 'TX' }, service: unsafe });
    expect(JSON.stringify(result)).not.toMatch(/phone|email|owner|unlock|contact/i);
    expect(Object.keys(result)).toEqual(['score', 'classification', 'calculable', 'reasons', 'evaluatedCriteria', 'possibleCriteria', 'earnedPoints', 'evaluatedWeight']);
  });

  it('keeps scoring and ranking in deterministic backend code under Gemini restrictions', () => {
    const matchingSource = readFileSync(new URL('./findServicesForPropertyNeeds.ts', import.meta.url), 'utf8');
    const chatSource = readFileSync(new URL('../../maxxis-chat/index.ts', import.meta.url), 'utf8');
    expect(matchingSource).toContain('calculateServiceFit({');
    expect(matchingSource).toContain('rankServicesByFit(');
    expect(chatSource).toContain('Never calculate, recalculate, estimate, modify, override, or invent a Service Fit score');
    expect(chatSource).toContain('not provider quality, reputation, endorsement, or a recommendation');
  });
});
