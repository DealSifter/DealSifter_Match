import { describe, expect, it } from 'vitest';
import { selectRecordedSoldComparables } from './soldCompEngine.ts';
import { mapRentCastSoldRecordPool } from './soldMapper.ts';
import { mapRentCastValueEstimate } from './valuationMapper.ts';
import { DEFAULT_VALUATION_REQUEST_POLICY } from './valuationProvider.ts';

const NOW = '2026-09-12T12:00:00.000Z';
const lookup = { street: '100 Subject St', city: 'Austin', state: 'TX', zipCode: '78701' };

function valuation(comparables: Array<Record<string, unknown>> = []) {
  return mapRentCastValueEstimate({
    lookup,
    requestPolicy: { ...DEFAULT_VALUATION_REQUEST_POLICY },
    retrievedAt: NOW,
    raw: {
      price: 500000,
      subjectProperty: {
        id: 'subject', addressLine1: lookup.street, city: lookup.city, state: lookup.state,
        zipCode: lookup.zipCode, latitude: 30, longitude: -97, propertyType: 'Single Family',
        bedrooms: 3, bathrooms: 2, squareFootage: 2000, lotSize: 6000, yearBuilt: 2000,
      },
      comparables,
    },
  });
}

function soldRecords(count = 5, overrides: (index: number) => Record<string, unknown> = () => ({})) {
  return mapRentCastSoldRecordPool({
    policy: { radiusMiles: 5, saleDateRangeDays: 270, propertyType: 'Single Family', limit: 100 },
    queryFingerprint: 'a'.repeat(64),
    retrievedAt: NOW,
    records: Array.from({ length: count }, (_, index) => ({
      id: `sold-${index}`, formattedAddress: `${110 + index} Sold St, Austin, TX 78701`,
      addressLine1: `${110 + index} Sold St`, city: 'Austin', state: 'TX', zipCode: '78701',
      latitude: 30 + (index + 1) / 1000, longitude: -97, propertyType: 'Single Family',
      bedrooms: 3, bathrooms: 2, squareFootage: 1900 + index * 10, lotSize: 6200,
      yearBuilt: 2001, lastSaleDate: '2026-09-01', lastSalePrice: 400000 + index * 10000,
      ...overrides(index),
    })),
  }).records;
}

describe('direct recorded sold comparable selection', () => {
  it('preserves verified sale evidence and calculates direct structural signals without AVM membership', () => {
    const result = selectRecordedSoldComparables(valuation(), soldRecords(1));
    const candidate = result.directSoldCompCandidates[0];
    expect(candidate).toMatchObject({
      recordedSalePrice: 400000,
      recordedSaleDate: '2026-09-01T00:00:00.000Z',
      evidenceStatus: 'VERIFIED_RECORD',
      compQuality: 'STRONG',
      recordMatchStrength: 'NO_MATCH',
      avmOverlap: false,
      providerCorrelation: null,
    });
    expect(candidate.distanceFromSubjectMiles).toMatchObject({ status: 'CALCULATED' });
    expect(candidate.daysSinceSale).toMatchObject({ value: 11, status: 'CALCULATED' });
    expect(candidate.sqftDifferencePercent).toMatchObject({ value: 0.05, status: 'CALCULATED' });
    expect(candidate.recordedSalePricePerSqft.value).toBeCloseTo(210.5263);
    expect(JSON.stringify(result)).not.toMatch(/dealSifterArv|recommendedArv|finalArv/i);
  });

  it('selects and ranks five strong records as sufficient', () => {
    const result = selectRecordedSoldComparables(valuation(), soldRecords(6));
    expect(result.strong).toHaveLength(6);
    expect(result.topFiveStrong).toHaveLength(5);
    expect(result.topFiveStrong[0].soldRecord.providerPropertyId).toBe('sold-0');
    expect(result.sufficiency).toBe('SUFFICIENT');
  });

  it('does not consider five weak records sufficient', () => {
    const result = selectRecordedSoldComparables(valuation(), soldRecords(5, (index) => ({ latitude: 30.06 + index / 1000 })));
    expect(result.weak).toHaveLength(5);
    expect(result.strong).toHaveLength(0);
    expect(result.sufficiency).toBe('INSUFFICIENT');
  });

  it('returns CONDITIONAL for five acceptable records that meet core limits but not strong quality', () => {
    const result = selectRecordedSoldComparables(valuation(), soldRecords(5, (index) => ({
      latitude: 30.025 + index / 10000,
      lastSaleDate: '2026-06-01',
    })));
    expect(result.acceptable).toHaveLength(5);
    expect(result.strong).toHaveLength(0);
    expect(result.sufficiency).toBe('CONDITIONAL');
  });

  it('hard-invalidates objective evidence defects while keeping lot optional', () => {
    const records = soldRecords(4, (index) => index === 0 ? { lastSalePrice: 0 }
      : index === 1 ? { squareFootage: 0 }
        : index === 2 ? { propertyType: 'Condo' }
          : { lotSize: undefined });
    const result = selectRecordedSoldComparables(valuation(), records);
    expect(result.hardInvalid).toHaveLength(3);
    const noLot = result.directSoldCompCandidates.find((item) => item.soldRecord.providerPropertyId === 'sold-3');
    expect(noLot?.compQuality).toBe('STRONG');
    expect(noLot?.limitations).toContain('LOT_DATA_UNAVAILABLE');
  });

  it('keeps AVM overlap and provider correlation as optional diagnostics separate from comp quality', () => {
    const record = soldRecords(1)[0];
    const value = valuation([{
      id: record.providerPropertyId, formattedAddress: record.formattedAddress, addressLine1: record.addressLine1,
      city: record.city, state: record.state, zipCode: record.zipCode, latitude: record.latitude,
      longitude: record.longitude, propertyType: record.propertyType, bedrooms: record.bedrooms,
      bathrooms: record.bathrooms, squareFootage: record.livingAreaSqft, lotSize: record.lotSizeSqft,
      yearBuilt: record.yearBuilt, price: 999999, distance: 0.1, daysOld: 10, correlation: 0.91,
    }]);
    const candidate = selectRecordedSoldComparables(value, [record]).directSoldCompCandidates[0];
    expect(candidate).toMatchObject({ compQuality: 'STRONG', recordMatchStrength: 'EXACT',
      avmOverlap: true, providerCorrelation: 0.91, recordedSalePrice: 400000 });
  });
});
