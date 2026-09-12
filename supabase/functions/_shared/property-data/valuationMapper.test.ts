import { describe, expect, it } from 'vitest';
import { analyzeSaleComparables } from './compEngine.ts';
import { isNormalizedValuationEvidence } from './valuationSchema.ts';
import { mapRentCastValueEstimate } from './valuationMapper.ts';
import { DEFAULT_VALUATION_REQUEST_POLICY } from './valuationProvider.ts';

const lookup = { street: '100 Fixture St', city: 'Austin', state: 'TX', zipCode: '78701' };
const subject = {
  id: 'subject-1', formattedAddress: '100 Fixture St, Austin, TX 78701', addressLine1: '100 Fixture St',
  city: 'Austin', state: 'TX', zipCode: '78701', propertyType: 'Single Family', bedrooms: 3,
  bathrooms: 2, squareFootage: 1500, lotSize: 6000, yearBuilt: 1990,
};

describe('RentCast valuation normalization and deterministic comp diagnostics', () => {
  it('preserves provider estimate/range/correlation and derives auditable metrics without producing ARV', () => {
    const valuation = mapRentCastValueEstimate({
      lookup, requestPolicy: { ...DEFAULT_VALUATION_REQUEST_POLICY }, retrievedAt: '2026-09-12T12:00:00.000Z',
      raw: {
        price: 310000, priceRangeLow: 285000, priceRangeHigh: 335000, subjectProperty: subject,
        comparables: [{
          id: 'comp-strong', formattedAddress: '110 Fixture St, Austin, TX 78701', addressLine1: '110 Fixture St',
          city: 'Austin', state: 'TX', zipCode: '78701', propertyType: 'Single Family', bedrooms: 3,
          bathrooms: 2, squareFootage: 1450, lotSize: 5900, yearBuilt: 1992, price: 300000,
          status: 'Inactive', listingType: 'Standard', lastSeenDate: '2026-08-20T00:00:00.000Z',
          distance: 0.4, daysOld: 23, correlation: 0.98,
        }],
      },
    });
    expect(valuation.providerEstimate.value).toMatchObject({ value: 310000, status: 'ESTIMATED', source: 'rentcast' });
    expect(valuation.providerEstimate.rangeLow.value).toBe(285000);
    expect(valuation.providerEstimate.rangeHigh.value).toBe(335000);
    expect(valuation.providerEstimate.providerConfidenceSemantic).toBe('PROVIDER_85_PERCENT_RANGE');
    expect(valuation.comparables[0]).toMatchObject({
      priceSemantic: 'PROVIDER_LISTING_PRICE', providerCorrelation: 0.98,
      derived: { pricePerSqft: { status: 'CALCULATED' } },
    });
    expect(valuation.comparables[0].derived.pricePerSqft.value).toBeCloseTo(206.8965, 3);
    const analysis = analyzeSaleComparables(valuation);
    expect(analysis.diagnostics[0]).toMatchObject({ classification: 'strong' });
    expect(analysis.diagnostics[0].positiveReasons).toEqual(expect.arrayContaining([
      'SAME_PROPERTY_TYPE', 'CLOSE_DISTANCE', 'RECENT_MARKET_EVIDENCE', 'SIMILAR_LIVING_AREA',
    ]));
    expect(analysis.diagnostics[0].limitations).toEqual(expect.arrayContaining([
      'RENOVATION_CONDITION_UNAVAILABLE', 'ARMS_LENGTH_DISTRESS_UNAVAILABLE', 'SALE_PRICE_UNCONFIRMED',
    ]));
    expect(JSON.stringify({ valuation, analysis })).not.toMatch(/dealSifterArv|recommendedArv|finalArv|authoritativeArv/i);
    expect(isNormalizedValuationEvidence(valuation)).toBe(true);
  });

  it('does not invent missing values and separates hard invalid from soft quality', () => {
    const valuation = mapRentCastValueEstimate({
      lookup, requestPolicy: { ...DEFAULT_VALUATION_REQUEST_POLICY }, retrievedAt: '2026-09-12T12:00:00.000Z',
      raw: {
        subjectProperty: subject,
        comparables: [
          { id: 'missing', addressLine1: '120 Fixture St', state: 'TX', zipCode: '78701', propertyType: 'Single Family' },
          { id: 'soft', addressLine1: '130 Fixture St', state: 'TX', zipCode: '78701', propertyType: 'Single Family', bedrooms: 6, bathrooms: 5, squareFootage: 1500, price: 290000, distance: 4, daysOld: 220 },
        ],
      },
    });
    expect(valuation.providerEstimate.value).toMatchObject({ value: null, status: 'UNAVAILABLE' });
    expect(valuation.comparables[0].price).toBeNull();
    expect(valuation.comparables[0].derived.pricePerSqft).toMatchObject({ value: null, status: 'UNAVAILABLE' });
    const analysis = analyzeSaleComparables(valuation);
    const missing = analysis.diagnostics.find((item) => item.providerPropertyId === 'missing');
    const soft = analysis.diagnostics.find((item) => item.providerPropertyId === 'soft');
    expect(missing).toMatchObject({ classification: 'hard_rejected' });
    expect(missing?.hardInvalidReasons).toEqual(expect.arrayContaining(['MISSING_PRICE', 'MISSING_SQFT']));
    expect(soft).toMatchObject({ classification: 'down_ranked', hardInvalidReasons: [] });
    expect(soft?.penaltyReasons).toEqual(expect.arrayContaining(['DISTANT_COMPARABLE', 'STALE_COMPARABLE', 'BEDROOM_MISMATCH', 'BATHROOM_MISMATCH']));
  });

  it('rejects cache payloads with typed subject or request-policy corruption', () => {
    const valuation = mapRentCastValueEstimate({
      lookup, requestPolicy: { ...DEFAULT_VALUATION_REQUEST_POLICY }, retrievedAt: '2026-09-12T12:00:00.000Z',
      raw: { price: 310000, subjectProperty: subject, comparables: [] },
    });
    const corruptedSubject = structuredClone(valuation) as unknown as Record<string, Record<string, Record<string, unknown>>>;
    corruptedSubject.subjectProperty.addressLine1.value = 123;
    expect(isNormalizedValuationEvidence(corruptedSubject)).toBe(false);

    const corruptedPolicy = structuredClone(valuation) as unknown as { requestPolicy: { compCount: number } };
    corruptedPolicy.requestPolicy.compCount = 100;
    expect(isNormalizedValuationEvidence(corruptedPolicy)).toBe(false);
  });
});
