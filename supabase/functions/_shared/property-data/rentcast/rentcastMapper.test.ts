import { describe, expect, it } from 'vitest';
import { mapRentCastProperty } from './rentcastMapper.ts';

const RETRIEVED_AT = '2026-09-09T12:00:00.000Z';

describe('RentCast mapper', () => {
  it('maps only confirmed property-record fields and chooses latest dated records deterministically', () => {
    const result = mapRentCastProperty({
      id: 'rentcast-property-id',
      formattedAddress: '5500 Grand Lake Dr, San Antonio, TX 78244',
      addressLine1: '5500 Grand Lake Dr',
      city: 'San Antonio',
      state: 'TX',
      zipCode: '78244',
      county: 'Bexar',
      latitude: 29.475962,
      longitude: -98.351442,
      propertyType: 'Single Family',
      bedrooms: 3,
      bathrooms: 2.5,
      squareFootage: 1878,
      lotSize: 8850,
      yearBuilt: 1973,
      owner: { names: ['Fixture Owner', '', null] },
      ownerOccupied: true,
      taxAssessments: {
        2023: { year: 2023, value: 200000 },
        2024: { year: 2024, value: 216513 },
      },
      propertyTaxes: {
        invalid: { year: 'bad', total: 9999 },
        2024: { year: 2024, total: 4065 },
      },
      lastSaleDate: '2022-01-01T00:00:00.000Z',
      lastSalePrice: 200000,
      history: {
        old: { event: 'Sale', date: '2020-01-01T00:00:00.000Z', price: 180000 },
        invalid: { event: 'Sale', date: 'not-a-date', price: 999999 },
        newest: { event: 'Sale', date: '2024-11-18T00:00:00.000Z', price: 270000 },
      },
    }, RETRIEVED_AT);

    expect(result).toMatchObject({
      provider: 'rentcast',
      sourceMetadata: { source: 'rentcast', retrievedAt: RETRIEVED_AT, providerPropertyId: 'rentcast-property-id', confidence: null },
      identity: { providerPropertyId: { value: 'rentcast-property-id', status: 'VERIFIED_RECORD' } },
      address: {
        formattedAddress: { value: '5500 Grand Lake Dr, San Antonio, TX 78244' },
        addressLine1: { value: '5500 Grand Lake Dr' }, city: { value: 'San Antonio' }, state: { value: 'TX' },
        zipCode: { value: '78244' }, county: { value: 'Bexar' }, latitude: { value: 29.475962 }, longitude: { value: -98.351442 },
      },
      characteristics: {
        propertyType: { value: 'Single Family' }, bedrooms: { value: 3 }, bathrooms: { value: 2.5 },
        livingAreaSqft: { value: 1878 }, lotSizeSqft: { value: 8850 }, yearBuilt: { value: 1973 },
      },
      ownership: { ownerNames: { value: ['Fixture Owner'] }, ownerOccupied: { value: true } },
      tax: {
        assessedValue: { value: 216513 }, assessmentYear: { value: 2024 },
        annualPropertyTax: { value: 4065 }, propertyTaxYear: { value: 2024 },
      },
      lastSale: { price: { value: 270000 }, date: { value: '2024-11-18T00:00:00.000Z' } },
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('999999');
    expect(serialized).not.toContain('confidence":0');
  });

  it('preserves every missing or wrongly typed field as null/UNAVAILABLE without fabricating false, zero or confidence', () => {
    const result = mapRentCastProperty({
      id: 'minimal-record',
      formattedAddress: '',
      bedrooms: '3',
      ownerOccupied: 'false',
      owner: { names: [] },
      history: { invalid: { event: 'Sale', date: 'invalid', price: 1 } },
    }, RETRIEVED_AT);

    const evidences = [
      ...Object.values(result.address),
      ...Object.values(result.characteristics),
      ...Object.values(result.ownership),
      ...Object.values(result.tax),
      ...Object.values(result.lastSale),
    ];
    evidences.forEach((item) => {
      expect(item.value).toBeNull();
      expect(item.status).toBe('UNAVAILABLE');
      expect(item.confidence).toBeNull();
    });
    expect(JSON.stringify(result)).not.toContain('AI_INFERRED');
  });

  it('requires a confirmed provider property id', () => {
    expect(() => mapRentCastProperty({ formattedAddress: 'Unknown' })).toThrow('INVALID_PROVIDER_RESPONSE');
  });
});
