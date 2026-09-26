import { describe, expect, it } from 'vitest';
import {
  NATIONAL_REHAB_BENCHMARK_2026,
  REHAB_BENCHMARK_METADATA_2026,
  REHAB_COST_BENCHMARKS_2026,
  benchmarkScopeForCondition,
  estimateRehabBenchmark2026,
  sanityCheckRehabAgainstBenchmark2026,
} from './rehabCostBenchmarks2026.ts';

describe('DealSifter 2026 rehabilitation benchmark', () => {
  it('contains exactly all 50 states and the required low-confidence metadata', () => {
    expect(Object.keys(REHAB_COST_BENCHMARKS_2026)).toHaveLength(50);
    expect(REHAB_BENCHMARK_METADATA_2026).toMatchObject({
      version: '2026.1', currency: 'USD', unit: 'USD_PER_SQFT', geography: 'US_STATE',
      sourceType: 'USER_CURATED_REFERENCE', sourceYear: 2026, sourceCitationStatus: 'UNSOURCED',
      confidence: 'LOW', usage: 'SECONDARY_HEURISTIC_ONLY',
    });
  });

  it('preserves the national reference values', () => {
    expect(NATIONAL_REHAB_BENCHMARK_2026).toEqual({
      LIGHT_REHAB: { average: 33.93, low: 25, high: 60 },
      STANDARD_RENOVATION: { average: 65.27, low: 48, high: 116 },
      FULL_RENOVATION: { average: 117.57, low: 88, high: 208 },
      NEW_CONSTRUCTION: { average: 185.4, low: 138, high: 328 },
    });
  });

  it('preserves California Full, Hawaii New, and Mississippi Light values', () => {
    expect(REHAB_COST_BENCHMARKS_2026.California.FULL_RENOVATION).toEqual({ average: 180, low: 144, high: 216 });
    expect(REHAB_COST_BENCHMARKS_2026.Hawaii.NEW_CONSTRUCTION).toEqual({ average: 328, low: 268, high: 388 });
    expect(REHAB_COST_BENCHMARKS_2026.Mississippi.LIGHT_REHAB).toEqual({ average: 25, low: 19, high: 31 });
  });

  it('does not automatically map as-is, high-end, or turn-key conditions', () => {
    expect(benchmarkScopeForCondition('AS_IS')).toBeNull();
    expect(benchmarkScopeForCondition('HIGH_END')).toBeNull();
    expect(benchmarkScopeForCondition('TURN_KEY')).toBeNull();
  });

  it('calculates the California example deterministically with no provider call', () => {
    expect(estimateRehabBenchmark2026({ state: 'CA', livingAreaSqft: 1680, condition: 'FULL_RENOVATION' })).toMatchObject({
      state: 'California', scope: 'FULL_RENOVATION', low: 241920, mid: 302400, high: 362880,
      provenance: 'ESTIMATED', source: 'USER_CURATED_REHAB_BENCHMARK_2026', confidence: 'LOW',
      usage: 'REFERENCE_ONLY', providerCalls: 0,
    });
  });

  it('requires a supported state, positive area, and mapped scope', () => {
    expect(estimateRehabBenchmark2026({ state: 'CA', livingAreaSqft: 1680, condition: 'AS_IS' })).toBeNull();
    expect(estimateRehabBenchmark2026({ state: 'XX', livingAreaSqft: 1680, condition: 'FULL_RENOVATION' })).toBeNull();
    expect(estimateRehabBenchmark2026({ state: 'CA', livingAreaSqft: 0, condition: 'FULL_RENOVATION' })).toBeNull();
  });

  it.each([
    [200000, 'BELOW_REFERENCE_RANGE'],
    [300000, 'WITHIN_REFERENCE_RANGE'],
    [400000, 'ABOVE_REFERENCE_RANGE'],
  ])('classifies %s only as a heuristic sanity check', (rehab, classification) => {
    const estimate = estimateRehabBenchmark2026({ state: 'CA', livingAreaSqft: 1680, condition: 'FULL_RENOVATION' });
    expect(sanityCheckRehabAgainstBenchmark2026(rehab, estimate)).toMatchObject({ classification });
  });
});
