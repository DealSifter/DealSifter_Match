import { describe, expect, it } from 'vitest';
import { buildRecentSalesMarketEstimate, providerEstimateDivergence } from './recentSalesMarketEstimate.ts';
import type { RecordedSoldComparableCandidate } from './soldTypes.ts';

const evidence = (value: number | null) => ({ value, status: value === null ? 'UNAVAILABLE' : 'CALCULATED', source: 'calculation',
  retrievedAt: '2026-10-03T00:00:00.000Z', effectiveDate: null, providerPropertyId: null, confidence: null });
function candidate(index: number, options: Record<string, unknown> = {}): RecordedSoldComparableCandidate {
  const land = options.type === 'Land';
  const sqft = Number(options.sqft ?? 2000);
  const lot = Number(options.lot ?? 43_560);
  const price = Number(options.price ?? (400_000 + index * 20_000));
  const age = Number(options.age ?? (20 + index * 10));
  const distance = Number(options.distance ?? (0.5 + index * 0.1));
  const quality = Number(options.structural ?? 85);
  return {
    soldRecord: { provider: 'rentcast', providerPropertyId: `comp-${index}`, assessorId: null,
      retrievedAt: '2026-10-03T00:00:00.000Z', formattedAddress: `${index} Sold St`, addressLine1: `${index} Sold St`,
      city: 'Austin', state: 'TX', zipCode: '78701', latitude: 30, longitude: -97,
      propertyType: String(options.type ?? 'Single Family'), bedrooms: land ? null : 3, bathrooms: land ? null : 2,
      livingAreaSqft: land ? null : sqft, lotSizeSqft: lot, yearBuilt: land ? null : 2000,
      saleTransactions: [], latestValidSale: { saleDate: '2026-08-01', salePrice: price,
        evidenceStatus: 'VERIFIED_RECORD', source: 'rentcast_property_record' },
      saleTransactionAmbiguous: Boolean(options.ambiguous), transactionQuality: 'UNKNOWN' },
    recordedSalePrice: price, recordedSaleDate: '2026-08-01',
    recordedSalePricePerSqft: evidence(land ? null : price / sqft), distanceFromSubjectMiles: evidence(distance),
    daysSinceSale: evidence(age), sqftDifference: evidence(0), sqftDifferencePercent: evidence(Number(options.sizeDelta ?? 0)),
    bedroomDifference: evidence(0), bathroomDifference: evidence(0), lotSizeDifference: evidence(0),
    lotSizeDifferencePercent: evidence(Number(options.sizeDelta ?? 0)), yearBuiltDifference: evidence(0),
    evidenceStatus: (options.evidenceStatus ?? 'VERIFIED_RECORD') as 'VERIFIED_RECORD', baselineCompQuality: 'STRONG', compQuality: 'STRONG',
    qualityScore: quality, qualityChecks: { recordedSale: 'PASS', recency: 'PASS', proximity: 'PASS', propertyType: 'PASS',
      structuralCompatibility: 'PASS', livingArea: 'PASS', bedrooms: 'PASS', bathrooms: 'PASS', lotSize: 'PASS',
      yearBuilt: 'PASS', specialCharacteristics: 'PASS', missingDataBurden: 'PASS' }, primaryQualityBlocker: null,
    weightedAssessment: { structuralComparabilityScore: quality, dataCompletenessScore: Number(options.completeness ?? 90),
      hardGates: { pass: true, reasons: [] }, structuralClass: 'EXCELLENT_STRUCTURAL_CANDIDATE',
      primaryArvCompCandidate: true, primaryEligibilityBlockers: [], valuationWeight: 1 } as any,
    qualityReasons: [], penaltyReasons: [], hardInvalidReasons: [], limitations: [], recordMatchStrength: 'EXACT',
    avmOverlap: true, providerCorrelation: Number(options.correlation ?? 0.9),
  };
}

const residential = { propertyType: 'SFR', livingAreaSqft: 2000, lotSizeSqft: 6000 };

describe('DealSifter Recent-Sales Market Estimate', () => {
  it('enforces the 180-day closed-sale gates without expanding the window', () => {
    const result = buildRecentSalesMarketEstimate(residential, [candidate(1), candidate(2, { age: 181 })]);
    expect(result.status).toBe('INSUFFICIENT_RECENT_SALES_EVIDENCE');
    expect(result.historicalReferences).toEqual([expect.objectContaining({ reason: 'SALE_OLDER_THAN_180_DAYS' })]);
  });

  it.each([
    ['active/non-recorded evidence', { evidenceStatus: 'LISTING' }, 'NOT_RECORDED_CLOSED_SALE'],
    ['wrong property type', { type: 'Condo' }, 'INCOMPATIBLE_PROPERTY_TYPE'],
    ['invalid sale price', { price: 0 }, 'INVALID_RECORDED_SALE_PRICE'],
    ['invalid residential area', { sqft: 0 }, 'INVALID_COMP_LIVING_AREA'],
    ['extreme distance', { distance: 6 }, 'EXTREME_GEOGRAPHICAL_MISMATCH'],
  ])('excludes %s', (_name, options, reason) => {
    const result = buildRecentSalesMarketEstimate(residential, [candidate(1, options), candidate(2)]);
    expect(result.status).toBe('INSUFFICIENT_RECENT_SALES_EVIDENCE');
    expect(result.exclusions.flatMap((item) => item.reasons)).toContain(reason);
  });

  it('requires two comps and caps the valuation set at five', () => {
    expect(buildRecentSalesMarketEstimate(residential, [candidate(1)]).centralEstimate).toBeNull();
    const result = buildRecentSalesMarketEstimate(residential, Array.from({ length: 8 }, (_, index) => candidate(index)));
    expect(result.status).toBe('AVAILABLE');
    expect(result.valuationCompCount).toBe(5);
  });

  it('uses weighted median unit value and produces subject-implied value and robust range', () => {
    const result = buildRecentSalesMarketEstimate({ ...residential, livingAreaSqft: 1000 }, [
      candidate(1, { price: 180_000, sqft: 1000, structural: 95 }),
      candidate(2, { price: 200_000, sqft: 1000, structural: 95 }),
      candidate(3, { price: 220_000, sqft: 1000, structural: 95 }),
    ]);
    expect(result.weightedUnitValue).toBe(200);
    expect(result.centralEstimate).toBe(200_000);
    expect(result.range?.low).toBeLessThanOrEqual(200_000);
    expect(result.range?.high).toBeGreaterThanOrEqual(200_000);
  });

  it('traces unit-price outliers instead of allowing them to dominate', () => {
    const result = buildRecentSalesMarketEstimate(residential, [candidate(1, { price: 400_000 }), candidate(2, { price: 410_000 }),
      candidate(3, { price: 420_000 }), candidate(4, { price: 2_000_000 })]);
    expect(result.marketReferenceOutliers).toHaveLength(1);
    expect(result.marketReferenceOutliers[0].classification).toBe('MARKET_REFERENCE_OUTLIER');
    expect(result.centralEstimate).toBeLessThan(1_000_000);
  });

  it('calculates dispersion and deterministic confidence independent of Match Score', () => {
    const result = buildRecentSalesMarketEstimate(residential, [candidate(1), candidate(2), candidate(3)]);
    expect(result.dispersion.coefficient).toBeGreaterThan(0);
    expect(result.confidence).toBe('MODERATE');
    expect(result.confidenceReasons).toContain('CONDITION_NOT_ADJUSTED');
  });

  it('uses lot acreage and lot sqft for land, never living area or rehab', () => {
    const result = buildRecentSalesMarketEstimate({ propertyType: 'Land', livingAreaSqft: null, lotSizeSqft: 87_120 }, [
      candidate(1, { type: 'Land', lot: 43_560, price: 100_000 }), candidate(2, { type: 'Land', lot: 87_120, price: 210_000 }),
    ]);
    expect(result.status).toBe('AVAILABLE');
    expect(result.unitMetric).toBe('PRICE_PER_ACRE');
    expect(result.weightedUnitValue).toBeGreaterThan(0);
    expect(result.weightedLotPricePerSqft).toBeGreaterThan(0);
    expect(result.centralEstimate).toBeGreaterThan(190_000);
  });

  it('quarantines a residential provider AVM for a canonical land subject and blocks unresolved valuation', () => {
    const result = buildRecentSalesMarketEstimate({ propertyType: 'Land', livingAreaSqft: null, lotSizeSqft: 43_560,
      providerPropertyType: 'Single Family' }, [candidate(1, { type: 'Land' }), candidate(2, { type: 'Land' })]);
    expect(result.status).toBe('BLOCKED_BY_MATERIAL_CONFLICT');
    expect(result.providerAvmCompatibility).toBe('QUARANTINED_FOR_TYPE_CONFLICT');
  });

  it('keeps AVM, recent-sales estimate and ARV semantically separate', () => {
    const result = buildRecentSalesMarketEstimate(residential, [candidate(1), candidate(2), candidate(3)]);
    expect(result.methodology).toBe('RECENT_SALES_MARKET_ESTIMATE');
    expect(providerEstimateDivergence(500_000, result)).not.toBeNull();
    expect(JSON.stringify(result)).not.toMatch(/\bARV_AVAILABLE\b|appraisal|certified.?fmv/i);
  });
});
