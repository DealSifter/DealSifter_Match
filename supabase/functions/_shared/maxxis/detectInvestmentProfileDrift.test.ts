import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { calculateBehaviorAffinity } from './behaviorAffinity.ts';
import { detectInvestmentProfileDrift } from './detectInvestmentProfileDrift.ts';
import type { MaxxisInvestmentProfile, UserPropertyBehaviorAction } from './types.ts';

const makeAction = (id: number, state: string, overrides = {}): UserPropertyBehaviorAction => ({
  action: 'interested',
  signal: 'positive',
  entityId: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
  updatedAt: '2026-08-10T12:00:00.000Z',
  property: {
    id: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
    city: state === 'AL' ? 'Birmingham' : state === 'TX' ? 'Dallas' : 'Miami',
    state,
    price: 150_000,
    type: 'SFR',
    objective: 'Fix&Flip',
    ...overrides,
  },
});

const profile: MaxxisInvestmentProfile = {
  targetMarkets: ['FL'],
  propertyTypes: ['Single Family'],
  strategies: ['Fix & Flip'],
  priceRange: '100_200k',
};

describe('Investment Profile drift detection', () => {
  it('suggests adding Alabama after strong Alabama behavior', () => {
    const actions = [
      ...Array.from({ length: 8 }, (_, index) => makeAction(index + 1, 'AL')),
      makeAction(9, 'FL'),
    ];
    const result = detectInvestmentProfileDrift(profile, calculateBehaviorAffinity(actions));
    expect(result.hasDrift).toBe(true);
    expect(result.suggestions).toEqual([expect.objectContaining({
      dimension: 'market',
      operation: 'add_market',
      suggestedValue: 'AL',
      confidence: 'high',
      evidenceCount: 8,
    })]);
  });

  it('does not duplicate Alabama when the profile already contains it', () => {
    const actions = Array.from({ length: 5 }, (_, index) => makeAction(index + 1, 'AL'));
    const result = detectInvestmentProfileDrift({ ...profile, targetMarkets: ['Florida', 'Alabama'] }, calculateBehaviorAffinity(actions));
    expect(result).toEqual({ hasDrift: false, suggestions: [] });
  });

  it('does not infer market drift from dispersed behavior', () => {
    const actions = [makeAction(1, 'AL'), makeAction(2, 'AL'), makeAction(3, 'TX'), makeAction(4, 'TX'), makeAction(5, 'FL')];
    const result = detectInvestmentProfileDrift(profile, calculateBehaviorAffinity(actions));
    expect(result).toEqual({ hasDrift: false, suggestions: [] });
  });

  it('does not suggest below the Phase 2D threshold', () => {
    const actions = Array.from({ length: 4 }, (_, index) => makeAction(index + 1, 'AL'));
    expect(detectInvestmentProfileDrift(profile, calculateBehaviorAffinity(actions))).toEqual({ hasDrift: false, suggestions: [] });
  });

  it('suggests adding Land when the real mapping is unambiguous', () => {
    const actions = Array.from({ length: 5 }, (_, index) => makeAction(index + 1, 'FL', { type: 'Land' }));
    const result = detectInvestmentProfileDrift(profile, calculateBehaviorAffinity(actions));
    expect(result.suggestions).toEqual([expect.objectContaining({
      dimension: 'property_type',
      operation: 'add_property_type',
      suggestedValue: 'Land',
      confidence: 'high',
    })]);
  });

  it('returns no drift when behavior is compatible with the profile', () => {
    const actions = Array.from({ length: 5 }, (_, index) => makeAction(index + 1, 'FL'));
    expect(detectInvestmentProfileDrift(profile, calculateBehaviorAffinity(actions))).toEqual({ hasDrift: false, suggestions: [] });
  });

  it('is pure, does not mutate the profile, and contains no database write path', () => {
    const input = structuredClone(profile);
    const before = structuredClone(input);
    const actions = Array.from({ length: 5 }, (_, index) => makeAction(index + 1, 'AL'));
    detectInvestmentProfileDrift(input, calculateBehaviorAffinity(actions));
    expect(input).toEqual(before);
    const source = readFileSync(new URL('./detectInvestmentProfileDrift.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/createClient|\.from\(|\.insert\(|\.update\(|\.upsert\(|\.rpc\(/);
  });

  it('calculates confidence and suggestedValue without Gemini', () => {
    const actions = Array.from({ length: 5 }, (_, index) => makeAction(index + 1, 'AL'));
    const first = detectInvestmentProfileDrift(profile, calculateBehaviorAffinity(actions));
    const second = detectInvestmentProfileDrift(profile, calculateBehaviorAffinity(actions));
    expect(first).toEqual(second);
    expect(first.suggestions[0]).toMatchObject({ suggestedValue: 'AL', confidence: 'high' });
    const source = readFileSync(new URL('./detectInvestmentProfileDrift.ts', import.meta.url), 'utf8');
    expect(source.toLowerCase()).not.toContain('gemini');
  });
});
