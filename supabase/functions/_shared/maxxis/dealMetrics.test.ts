import { describe, expect, it } from 'vitest';
import { calculateDealMetrics, parseDealMetricNumber } from './dealMetrics.ts';

describe('calculateDealMetrics', () => {
  it('calculates price per sqft from valid price and sqft', () => {
    const result = calculateDealMetrics({ price: 125_000, sqft: '1,500' });
    expect(result.metrics.pricePerSqft).toEqual({
      value: 83.33,
      calculable: true,
      source: 'calculated',
      missingInputs: [],
      reason: null,
    });
  });

  it('does not calculate price per sqft when sqft is missing', () => {
    const metric = calculateDealMetrics({ price: 125_000, sqft: null }).metrics.pricePerSqft;
    expect(metric).toMatchObject({ value: null, calculable: false, source: null, missingInputs: ['sqft'], reason: 'missing_inputs' });
  });

  it('does not divide by zero when sqft is zero', () => {
    const metric = calculateDealMetrics({ price: 125_000, sqft: 0 }).metrics.pricePerSqft;
    expect(metric).toMatchObject({ value: null, calculable: false, missingInputs: ['sqft'], reason: 'division_by_zero' });
  });

  it('calculates acquisition plus rehab from valid inputs', () => {
    const metric = calculateDealMetrics({ price: 80_000, rehab: 25_000 }).metrics.acquisitionPlusRehab;
    expect(metric).toEqual({ value: 105_000, calculable: true, source: 'calculated', missingInputs: [], reason: null });
  });

  it('does not assume zero when rehab is absent', () => {
    const absent = calculateDealMetrics({ price: 80_000, rehab: null }).metrics.acquisitionPlusRehab;
    const zeroFallback = calculateDealMetrics({ price: 80_000, rehab: 0 }).metrics.acquisitionPlusRehab;
    expect(absent).toMatchObject({ value: null, calculable: false, missingInputs: ['rehab'] });
    expect(zeroFallback).toMatchObject({ value: null, calculable: false, missingInputs: ['rehab'] });
  });

  it('returns registered cap rate as stored instead of recalculating it', () => {
    const metric = calculateDealMetrics({ capRate: '7.25' }).metrics.capRate;
    expect(metric).toEqual({ value: 7.25, calculable: true, source: 'stored', missingInputs: [], reason: null });
  });

  it('does not invent ARV, ROI, MAO, profit, or exit metrics', () => {
    const result = calculateDealMetrics({ price: 80_000, rehab: 25_000, sqft: '1,500', capRate: 8 });
    expect(Object.keys(result.metrics)).toEqual(['pricePerSqft', 'acquisitionPlusRehab', 'capRate']);
    expect(JSON.stringify(result).toLowerCase()).not.toMatch(/arv|roi|mao|profit|exit/);
  });

  it('parses only supported valid numeric text formats', () => {
    expect(parseDealMetricNumber('1500', 'sqft')).toBe(1500);
    expect(parseDealMetricNumber('1,500', 'sqft')).toBe(1500);
    expect(parseDealMetricNumber('$25,000', 'money')).toBe(25_000);
    expect(parseDealMetricNumber('25000', 'money')).toBe(25_000);
  });

  it('rejects ambiguous or invalid numeric text', () => {
    expect(parseDealMetricNumber('2.5 ac', 'sqft')).toBeNull();
    expect(parseDealMetricNumber('1,500 sqft', 'sqft')).toBeNull();
    expect(parseDealMetricNumber('25k', 'money')).toBeNull();
    expect(parseDealMetricNumber('1,50,0', 'money')).toBeNull();
    expect(parseDealMetricNumber('1e5', 'money')).toBeNull();
    const metric = calculateDealMetrics({ price: 125_000, sqft: '2.5 ac' }).metrics.pricePerSqft;
    expect(metric).toMatchObject({ calculable: false, reason: 'invalid_input', missingInputs: ['sqft'] });
  });

  it('never returns NaN or positive/negative Infinity', () => {
    const results = [
      calculateDealMetrics({ price: 100, sqft: 3, rehab: 25, capRate: 7.2 }),
      calculateDealMetrics({ price: Number.NaN, sqft: Number.POSITIVE_INFINITY, rehab: Number.NEGATIVE_INFINITY, capRate: Number.NaN }),
      calculateDealMetrics({ price: Number.MAX_VALUE, sqft: 1, rehab: Number.MAX_VALUE, capRate: 101 }),
      calculateDealMetrics({ price: '999999999999999999999999', sqft: '0', rehab: 'invalid', capRate: 'Infinity' }),
    ];
    const numbers = results.flatMap((result) => (
      Object.values(result.metrics).map((metric) => metric.value).filter((value): value is number => typeof value === 'number')
    ));
    expect(numbers.every((value) => Number.isFinite(value))).toBe(true);
  });
});
