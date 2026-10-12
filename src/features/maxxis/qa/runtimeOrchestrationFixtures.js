import { mapRentCastValueEstimate } from '../../../../supabase/functions/_shared/property-data/valuationMapper.ts';
import { mapRentCastSoldRecordPool } from '../../../../supabase/functions/_shared/property-data/soldMapper.ts';
import { DEFAULT_SOLD_SEARCH_POLICY } from '../../../../supabase/functions/_shared/property-data/soldProvider.ts';

export const gable = { id: '11111111-1111-4111-8111-111111111111', address: '741 Gable Dr', city: 'Center Point', state: 'AL', zip: '35215', type: 'Land', price: 19000, lot: '1.14 acres' };
export const droad = { id: '22222222-2222-4222-8222-222222222222', address: '5939 Droad St', city: 'Jacksonville', state: 'FL', type: 'SFR', objective: 'Seller Financing', price: 114000 };
export const fixtureTime = '2026-10-11T12:00:00Z';
const valuation = mapRentCastValueEstimate({ lookup: { street: gable.address, city: gable.city, state: 'AL', zipCode: gable.zip }, retrievedAt: fixtureTime,
  requestPolicy: { maxRadius: 5, daysOld: 365, compCount: 0, lookupSubjectAttributes: false }, raw: { subjectProperty: { id: 'subject', addressLine1: gable.address,
    city: gable.city, state: 'AL', zipCode: gable.zip, propertyType: 'Land', latitude: 33.65, longitude: -86.68, lotSize: 49658.4 }, comparables: [] } });
const records = [0, 1, 2].map(index => ({ id: `land-sale-${index}`, formattedAddress: `${index + 100} Example Rd`, propertyType: 'Land',
  latitude: 33.651 + index / 10000, longitude: -86.681, lotSize: 49658.4, lastSaleDate: '2026-09-15', lastSalePrice: 18000 + index * 1000, zoning: 'R2' }));
export function landSnapshot(withEvidence = true) {
  return { propertyId: gable.id, propertyFacts: { ...gable }, generatedAt: fixtureTime, dealAssumptions: {},
    developmentEvidence: withEvidence ? { valuation, records: mapRentCastSoldRecordPool({ records, policy: { ...DEFAULT_SOLD_SEARCH_POLICY, saleDateRangeDays: 365 },
      queryFingerprint: 'a'.repeat(64), retrievedAt: fixtureTime }).records, freshness: { landAcquisition: { state: 'FRESH', retrievedAt: fixtureTime } } } : null };
}
export function reportResult(snapshot = landSnapshot(false)) {
  return { type: 'deal_insight', answer: 'Análise disponível com limitações.', data: { propertyId: gable.id, property: gable, state: 'available', intelligenceSnapshot: snapshot,
    evidenceCompletenessGate: { status: 'USER_INPUT_REQUIRED', missingUserInputs: ['proposedBuildingSqftPerUnit'] },
    dealIntelligence: { type: 'deal_intelligence_context', propertySummary: { ...gable, propertyType: 'Land' },
      propertyContext: { fields: {}, verifiedFields: [], userProvidedFields: [], unknownFields: [] }, valuationContext: { status: 'NOT_APPLICABLE' },
      evidenceSummary: { strength: 'LOW', conflicts: [] }, providerMarketContext: {}, limitations: ['Building area is unknown.'], opportunities: [], risks: [], recommendedActions: [] } } };
}
