import { describe, expect, it } from 'vitest';
import { crossValidateSoldComparables } from './soldCompEngine.ts';
import { extractRecordedSales, mapRentCastSoldRecordPool } from './soldMapper.ts';
import { mapRentCastValueEstimate } from './valuationMapper.ts';
import { DEFAULT_VALUATION_REQUEST_POLICY } from './valuationProvider.ts';

const NOW = '2026-09-12T12:00:00.000Z';
const lookup = { street: '100 Subject St', city: 'Austin', state: 'TX', zipCode: '78701' };
function valuation(count = 5, distance = 0.5) {
  return mapRentCastValueEstimate({ lookup, requestPolicy: { ...DEFAULT_VALUATION_REQUEST_POLICY }, retrievedAt: NOW,
    raw: { price: 500000, subjectProperty: { id: 'subject', addressLine1: lookup.street, city: lookup.city,
      state: lookup.state, zipCode: lookup.zipCode, propertyType: 'Single Family', squareFootage: 2000 },
    comparables: Array.from({ length: count }, (_, index) => ({ id: `comp-${index}`, addressLine1: `${110 + index} Sold St`,
      city: 'Austin', state: 'TX', zipCode: '78701', latitude: 30 + index / 1000, longitude: -97,
      propertyType: 'Single Family', bedrooms: 3, bathrooms: 2, squareFootage: 1900 + index * 10,
      yearBuilt: 2000, price: 999999, distance, daysOld: 10, correlation: 0.9 })) } });
}
function records(count = 5) {
  return mapRentCastSoldRecordPool({ policy: { radiusMiles: 5, saleDateRangeDays: 270, propertyType: 'Single Family', limit: 100 },
    queryFingerprint: 'a'.repeat(64), retrievedAt: NOW,
    records: Array.from({ length: count }, (_, index) => ({ id: `comp-${index}`, addressLine1: `${110 + index} Sold St`,
      city: 'Austin', state: 'TX', zipCode: '78701', latitude: 30 + index / 1000, longitude: -97,
      propertyType: 'Single Family', bedrooms: 3, bathrooms: 2, squareFootage: 1900 + index * 10,
      lotSize: index ? 6000 : undefined, yearBuilt: 2000, lastSaleDate: '2026-06-01', lastSalePrice: 400000 + index * 10000 })) }).records;
}

describe('recorded sale normalization and cross-validation', () => {
  it('selects the latest valid recorded sale and rejects malformed/future/non-sale entries', () => {
    const result = extractRecordedSales({ history: {
      bad: { event: 'Sale', date: 'bad', price: 100 }, future: { event: 'Sale', date: '2027-01-01', price: 100 },
      zero: { event: 'Sale', date: '2026-07-01', price: 0 }, listing: { event: 'Listing', date: '2026-08-01', price: 900000 },
      valid1: { event: 'Sale', date: '2026-05-01', price: 300000 }, valid2: { event: 'Sale', date: '2026-07-01', price: 350000 },
    } }, { retrievedAt: NOW, saleDateRangeDays: 270 });
    expect(result.transactions).toHaveLength(2);
    expect(result.latest).toMatchObject({ saleDate: '2026-07-01T00:00:00.000Z', salePrice: 350000 });
  });

  it('creates five strong qualified sold comps from exact recorded matches without promoting listing price', () => {
    const result = crossValidateSoldComparables(valuation(), records());
    expect(result).toMatchObject({ exactMatches: 5, strongMatches: 0, ambiguousMatches: 0,
      unmatchedCandidates: 0, sufficiency: 'SUFFICIENT' });
    expect(result.strongSoldComps).toHaveLength(5);
    expect(result.qualifiedSoldComps[0]).toMatchObject({ evidenceStatus: 'VERIFIED_RECORD', matchStrength: 'EXACT' });
    expect(result.qualifiedSoldComps[0].recordedSalePrice).not.toBe(result.qualifiedSoldComps[0].candidate.price);
    expect(result.qualifiedSoldComps[0].recordedSalePricePerSqft).toMatchObject({ status: 'CALCULATED' });
    const missingLot = result.qualifiedSoldComps.find((item) => item.soldRecord.providerPropertyId === 'comp-0');
    expect(missingLot?.limitations).toEqual(expect.arrayContaining([
      'TRANSACTION_QUALITY_UNKNOWN', 'RENOVATION_CONDITION_UNKNOWN', 'LOT_DATA_UNAVAILABLE',
    ]));
    expect(JSON.stringify(result)).not.toMatch(/dealSifterArv|recommendedArv|finalArv/i);
  });

  it('distinguishes strong geographic, ambiguous and no-match identities', () => {
    const value = valuation(3);
    value.comparables[0].providerPropertyId = 'different';
    value.comparables[0].addressLine1 = 'different';
    value.comparables[1].providerPropertyId = 'ambiguous';
    value.comparables[2].providerPropertyId = 'none';
    value.comparables[1].latitude = 30.01;
    value.comparables[2].latitude = 30.02;
    const sold = records(1);
    sold.push({ ...sold[0], providerPropertyId: 'other-1', addressLine1: value.comparables[1].addressLine1, latitude: 30.01 });
    sold.push({ ...sold[0], providerPropertyId: 'other-2', addressLine1: value.comparables[1].addressLine1, latitude: 30.01 });
    const result = crossValidateSoldComparables(value, sold);
    expect(result.matches.map((item) => item.matchStrength)).toEqual(['STRONG', 'AMBIGUOUS', 'NO_MATCH']);
  });

  it('does not consider five weak qualified records sufficient and reports all sufficiency states', () => {
    const conditional = crossValidateSoldComparables(valuation(5, 4), records(5));
    expect(conditional.strongSoldComps).toHaveLength(0);
    expect(conditional.conditionalSoldComps).toHaveLength(5);
    expect(conditional.sufficiency).toBe('CONDITIONAL');
    expect(crossValidateSoldComparables(valuation(5), []).sufficiency).toBe('INSUFFICIENT');
    expect(crossValidateSoldComparables(valuation(5), records(5)).sufficiency).toBe('SUFFICIENT');
  });

  it('does not confirm an exact provider id when unit identifiers conflict', () => {
    const value = valuation(1);
    value.comparables[0].providerPropertyId = '520-Lunalilo-Home-Rd,-Unit-ER126,-Honolulu,-HI-96825';
    value.comparables[0].formattedAddress = '520 Lunalilo Home Rd, Unit ER126, Honolulu, HI 96825';
    const sold = records(1);
    sold[0].providerPropertyId = '520-Lunalilo-Home-Rd,-Unit-6202,-Honolulu,-HI-96825';
    sold[0].formattedAddress = '520 Lunalilo Home Rd, Unit 6202, Honolulu, HI 96825';
    const result = crossValidateSoldComparables(value, sold);
    expect(result.matches[0]).toMatchObject({ matchStrength: 'AMBIGUOUS',
      reasons: expect.arrayContaining(['IDENTITY_ADDRESS_CONFLICT']) });
    expect(result.qualifiedSoldComps).toHaveLength(0);
  });
});
