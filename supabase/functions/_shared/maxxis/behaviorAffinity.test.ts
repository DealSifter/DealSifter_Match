import { describe, expect, it } from 'vitest';
import {
  applyBehaviorAdjustment,
  calculateBehaviorAdjustment,
  calculateBehaviorAffinity,
  MAX_BEHAVIOR_ADJUSTMENT,
  MIN_BEHAVIOR_ACTIONS,
} from './behaviorAffinity.ts';
import type { UserPropertyBehaviorAction } from './types.ts';

const makeAction = (id: number, overrides = {}): UserPropertyBehaviorAction => ({
  action: 'interested',
  signal: 'positive',
  entityId: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
  updatedAt: '2026-08-10T12:00:00.000Z',
  property: {
    id: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
    city: 'Miami',
    state: 'FL',
    price: 150_000,
    type: 'SFR',
    objective: 'Fix&Flip',
    ...overrides,
  },
});

describe('behavioral property affinity', () => {
  it('keeps adjustment zero without history', () => {
    const affinity = calculateBehaviorAffinity([]);
    expect(affinity.available).toBe(false);
    expect(calculateBehaviorAdjustment(affinity, {}).adjustment).toBe(0);
  });

  it(`does not infer behavior below ${MIN_BEHAVIOR_ACTIONS} actions`, () => {
    const affinity = calculateBehaviorAffinity([1, 2, 3, 4].map((id) => makeAction(id)));
    expect(affinity.available).toBe(false);
    expect(calculateBehaviorAdjustment(affinity, makeAction(5).property).reasons).toEqual([]);
  });

  it('applies a small positive adjustment for a consistently similar property', () => {
    const affinity = calculateBehaviorAffinity([1, 2, 3, 4, 5].map((id) => makeAction(id)));
    const result = calculateBehaviorAdjustment(affinity, makeAction(6).property);
    expect(affinity.available).toBe(true);
    expect(result.adjustment).toBe(MAX_BEHAVIOR_ADJUSTMENT);
    expect(result.reasons).toHaveLength(4);
    expect(result.reasons.every((reason) => reason.effect > 0)).toBe(true);
  });

  it('applies a small negative adjustment when a property opposes consistent recent tendencies', () => {
    const affinity = calculateBehaviorAffinity([1, 2, 3, 4, 5].map((id) => makeAction(id)));
    const result = calculateBehaviorAdjustment(affinity, {
      city: 'Dallas',
      state: 'TX',
      price: 900_000,
      type: 'Land',
      objective: 'Rent',
    });
    expect(result.adjustment).toBe(-MAX_BEHAVIOR_ADJUSTMENT);
    expect(result.reasons.every((reason) => reason.effect < 0)).toBe(true);
  });

  it('clamps structural 95 plus behavior 10 to 100', () => {
    expect(applyBehaviorAdjustment(95, 10)).toBe(100);
  });

  it('clamps structural 5 minus behavior 10 to 0', () => {
    expect(applyBehaviorAdjustment(5, -10)).toBe(0);
  });
});
