import { describe, expect, it } from 'vitest';
import {
  analyzeCompQualitySensitivity,
  auditSubjectBaselines,
  DEALSIFTER_RECORDED_COMP_POLICY_V1,
  referenceSetClass,
  runCompQualityScenario,
} from './compQualityCalibration.ts';
import { selectRecordedSoldComparables } from './soldCompEngine.ts';
import { mapRentCastSoldRecordPool } from './soldMapper.ts';
import { mapRentCastValueEstimate } from './valuationMapper.ts';
import { DEFAULT_VALUATION_REQUEST_POLICY } from './valuationProvider.ts';

const NOW = '2026-09-12T12:00:00.000Z';
const lookup = { street: '100 Subject St', city: 'Austin', state: 'TX', zipCode: '78701' };

function evidenceSet(options: { count?: number; distances?: number[]; type?: string; lot?: number | undefined } = {}) {
  const count = options.count ?? 5;
  const type = options.type || 'Single Family';
  const valuation = mapRentCastValueEstimate({
    lookup, requestPolicy: { ...DEFAULT_VALUATION_REQUEST_POLICY }, retrievedAt: NOW,
    raw: { price: 500000, subjectProperty: { id: 'subject', addressLine1: lookup.street, city: lookup.city,
      state: lookup.state, zipCode: lookup.zipCode, latitude: 30, longitude: -97, propertyType: type,
      bedrooms: 3, bathrooms: 2, squareFootage: 2000, lotSize: options.lot, yearBuilt: 2000 }, comparables: [] },
  });
  const records = mapRentCastSoldRecordPool({
    policy: { radiusMiles: 5, saleDateRangeDays: 270, propertyType: type, limit: 100 },
    queryFingerprint: 'b'.repeat(64), retrievedAt: NOW,
    records: Array.from({ length: count }, (_, index) => {
      const miles = options.distances?.[index] ?? 0.2 + index * 0.1;
      return { id: `record-${index}`, addressLine1: `${index} Sold St`, city: 'Austin', state: 'TX', zipCode: '78701',
        latitude: 30 + miles / 69, longitude: -97, propertyType: type, bedrooms: 3, bathrooms: 2,
        squareFootage: 1950, lotSize: options.lot, yearBuilt: 2002,
        lastSaleDate: '2026-07-01', lastSalePrice: 300000 + index * 100000 };
    }),
  }).records;
  return selectRecordedSoldComparables(valuation, records);
}

describe('DealSifter comp quality calibration', () => {
  it('implements explicit proximity bands and prevents records over one mile from becoming strong', () => {
    const selection = evidenceSet({ count: 3, distances: [0.4, 0.8, 1.2], lot: 6000 });
    const byId = new Map(selection.directSoldCompCandidates.map((item) => [item.soldRecord.providerPropertyId, item]));
    expect(DEALSIFTER_RECORDED_COMP_POLICY_V1.proximityMiles).toEqual({
      preferred: 0.5, strongEligible: 1, secondaryMaximum: 3,
    });
    expect(byId.get('record-0')?.compQuality).toBe('STRONG');
    expect(byId.get('record-1')?.compQuality).toBe('STRONG');
    expect(byId.get('record-2')?.compQuality).not.toBe('STRONG');
    expect(byId.get('record-2')?.primaryQualityBlocker).toBe('SECONDARY_PROXIMITY');
  });

  it('maps two through five strong references without letting weak quantity override quality', () => {
    expect([0, 1, 2, 3, 4, 5].map(referenceSetClass)).toEqual([
      'INSUFFICIENT', 'INSUFFICIENT', 'MINIMUM', 'ACCEPTABLE', 'ROBUST', 'PREFERRED',
    ]);
    const weak = evidenceSet({ count: 5, distances: [4, 4.1, 4.2, 4.3, 4.4], lot: 6000 });
    expect(weak.strong).toHaveLength(0);
    expect(weak.referenceSetClass).toBe('INSUFFICIENT');
  });

  it('does not use sale price to select or rank comparables', () => {
    const selection = evidenceSet({ count: 5, lot: 6000 });
    const before = runCompQualityScenario(selection.directSoldCompCandidates, 'MULTI_CHECK_BALANCED')
      .ranked.map((item) => item.candidate.soldRecord.providerPropertyId);
    const repriced = selection.directSoldCompCandidates.map((candidate, index) => ({
      ...candidate, recordedSalePrice: index % 2 ? 1 : 999999999,
      recordedSalePricePerSqft: { ...candidate.recordedSalePricePerSqft, value: index % 2 ? 0.01 : 999999 },
    }));
    const after = runCompQualityScenario(repriced, 'MULTI_CHECK_BALANCED')
      .ranked.map((item) => item.candidate.soldRecord.providerPropertyId);
    expect(after).toEqual(before);
  });

  it('keeps lot optional for a condo and surfaces subject conflicts without choosing a winner', () => {
    const condo = evidenceSet({ count: 1, type: 'Condo', lot: undefined });
    expect(condo.directSoldCompCandidates[0]).toMatchObject({
      compQuality: 'STRONG', qualityChecks: { lotSize: 'UNAVAILABLE' },
    });
    const audit = auditSubjectBaselines([
      { source: 'INTERNAL_LISTING', evidenceStatus: 'USER_PROVIDED', propertyType: 'SFR', bedrooms: 3,
        bathrooms: 2, livingAreaSqft: 2000, lotSizeSqft: null, yearBuilt: null },
      { source: 'PROPERTY_RECORD', evidenceStatus: 'VERIFIED_RECORD', propertyType: 'Single Family', bedrooms: 3,
        bathrooms: 2, livingAreaSqft: 2100, lotSizeSqft: 6000, yearBuilt: 2000 },
    ]);
    expect(audit.conflicts.map((item) => item.field)).toEqual(['livingAreaSqft']);
  });

  it('runs four rational scenarios with stable, explainable output and no ARV field', () => {
    const analysis = analyzeCompQualitySensitivity(evidenceSet({ count: 8, lot: 6000 }).directSoldCompCandidates);
    expect(analysis.scenarios.map((item) => item.scenario)).toEqual([
      'CURRENT', 'MULTI_CHECK_BALANCED', 'LOCALITY_PRIORITY', 'STRUCTURAL_PRIORITY',
    ]);
    expect(analysis.consensus.length).toBeGreaterThan(0);
    expect(['HIGH', 'MEDIUM', 'LOW']).toContain(analysis.rankingStability);
    expect(JSON.stringify(analysis)).not.toMatch(/dealSifterArv|recommendedArv|finalArv/i);
  });
});
