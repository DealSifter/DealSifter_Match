import { describe, expect, it } from 'vitest';
import { evaluateArv, type ArvEngineCandidate } from '../property-data/arvEngine.ts';
import { calculateDealMetrics } from './dealMetrics.ts';
import { buildDealIntelligenceContext } from './dealIntelligenceContext.ts';
import { calculatePropertyMatch } from './calculatePropertyMatch.ts';
import { sanitizeToolResultForGemini } from './toolResultForGemini.ts';

const PROPERTY_ID = 'e86dd292-429d-4b51-9b02-bc60a3e9068f';
const property = {
  id: PROPERTY_ID, type: 'SFR', city: 'Honolulu', state: 'HI', zip: '96825', price: 2_100_000,
  beds: 5, baths: 3, sqft: '2333', improvement: '', lot: '', dealTag: '', objective: 'Buy & Hold',
  rehab: null, capRate: 5, description: '', markets: [], images: [], published: true, dealClosed: false,
};
const profile = { exists: true, complete: true, profile: { status: 'complete' as const,
  targetMarkets: ['TX'], priceRange: '200_400k', propertyTypes: ['Single Family'], strategies: ['Fix & Flip'] } };

function candidate(id: string, price: number, sqft: number, score = 90): ArvEngineCandidate {
  return { source: 'ARV_COMP_CANDIDATE', compIdentifier: id, address: `${id} Honolulu HI`,
    recordedSalePrice: price, recordedSaleDate: '2026-04-08', recordedSaleEvidenceStatus: 'VERIFIED_RECORD',
    livingAreaSqft: sqft, structuralComparabilityScore: score, dataCompletenessScore: 90,
    hardGatesPass: true, recordAmbiguousOrCorrupt: false, distanceMiles: .5, daysSinceSale: 120,
    transactionQuality: 'ARMS_LENGTH_VERIFIED', conditionCompatibility: 'MATCHES_TARGET',
    conditionEvidenceStatus: 'USER_PROVIDED' };
}

function arv(prices: number[]) {
  return evaluateArv({ propertyId: PROPERTY_ID, subjectPropertyId: PROPERTY_ID,
    subjectLivingAreaSqft: 2333, targetCondition: 'FULL_RENOVATION',
    candidates: prices.map((price, index) => candidate(`comp-${index}`, price, 2000 + index * 10, 94 - index)),
    calculatedAt: '2026-09-13T12:00:00.000Z' } as Parameters<typeof evaluateArv>[0]);
}

function evidence(strong = false) {
  const field = (value: unknown) => ({ value, status: 'VERIFIED_RECORD', source: 'rentcast',
    retrievedAt: '2026-09-12', effectiveDate: null });
  return { type: 'property_evidence' as const, propertyId: PROPERTY_ID, state: 'available' as const,
    entitlementState: 'authorized' as const, cacheState: 'hit' as const,
    evidence: { fields: strong ? { propertyType: field('Single Family'), bedrooms: field(5), bathrooms: field(3),
      livingAreaSqft: field(2333), lotSizeSqft: field(8000), yearBuilt: field(1970) } : { livingAreaSqft: field(2333) },
    internalFields: {}, conflicts: [], missingFields: [], source: { label: 'Public records', updatedAt: '2026-09-12' }, cacheHit: true } };
}

function build(overrides: Record<string, unknown> = {}) {
  const match = calculatePropertyMatch(profile.profile, property);
  return buildDealIntelligenceContext({ property, investmentProfile: profile, match,
    propertyEvidence: evidence(), dealMetrics: calculateDealMetrics(property),
    analysis: { positiveSignals: [], attentionPoints: ['rehab_missing_or_invalid'],
      missingInformation: ['rehab'], limitations: ['roi_not_calculated'] },
    arvEvaluation: arv([1_550_000, 2_450_000]), ...overrides });
}

describe('Maxxis Deal Intelligence Context v1', () => {
  it('composes property evidence, limited ARV and profile mismatch without a deal-quality verdict', () => {
    const context = build();
    expect(context).toMatchObject({ type: 'deal_intelligence_context',
      version: 'MAXXIS_DEAL_INTELLIGENCE_CONTEXT_V1',
      matchContext: { semantics: 'PROFILE_FIT_ONLY' },
      valuationContext: { status: 'ARV_LIMITED', confidence: 'LOW', compsUsed: 2 },
      evidenceSummary: { strength: 'LOW' } });
    expect(context.risks.map((risk) => risk.code)).toEqual(expect.arrayContaining([
      'TARGET_MARKET_MISMATCH', 'TARGET_PRICE_RANGE_MISMATCH', 'MISSING_REHAB_INFORMATION', 'ARV_EVIDENCE_LIMITED',
    ]));
    expect(JSON.stringify(context)).not.toMatch(/good deal|buy this|guaranteed return/i);
  });

  it('preserves an available ARV and strong evidence exactly', () => {
    const evaluation = arv([500_000, 505_000, 510_000, 515_000, 520_000]);
    const context = build({ propertyEvidence: evidence(true), arvEvaluation: evaluation });
    expect(evaluation.status).toBe('ARV_AVAILABLE');
    expect(context.evidenceSummary.strength).toBe('HIGH');
    expect(context.valuationContext).toMatchObject({ status: evaluation.status,
      range: { low: evaluation.arvRangeLow, high: evaluation.arvRangeHigh },
      centralReference: evaluation.centralReference, confidence: evaluation.confidence });
    expect(context.comparableEvidence[0]).toMatchObject({ valuationRole: 'PRIMARY', distanceMiles: .5,
      transactionQuality: 'ARMS_LENGTH_VERIFIED' });
  });

  it('keeps unavailable ARV monetary fields absent instead of inventing a value', () => {
    const evaluation = arv([]);
    const context = build({ arvEvaluation: evaluation });
    expect(context.valuationContext).toMatchObject({ status: 'ARV_UNAVAILABLE', range: null,
      centralReference: null, confidence: 'LOW', provenance: 'UNAVAILABLE' });
    expect(JSON.stringify(context.valuationContext)).not.toContain('"centralReference":0');
  });

  it('passes exact engine values through the Gemini sanitizer without model-side calculation', () => {
    const context = build();
    const safe = sanitizeToolResultForGemini({ type: 'deal_insight', propertyId: PROPERTY_ID,
      state: 'available', dealIntelligence: context, capabilities: { hasArvEvaluation: true } });
    const safeContext = safe.dealIntelligence as Record<string, any>;
    expect(safeContext.valuationContext).toMatchObject(context.valuationContext);
    expect(safeContext.matchContext.semantics).toBe('PROFILE_FIT_ONLY');
    expect(JSON.stringify(safe)).not.toMatch(/recommend_buy|deal_quality_score|guaranteed_return/i);
  });

  it('preserves unknown property and profile data as UNKNOWN/null', () => {
    const emptyProperty = { ...property, type: '', city: '', state: '', zip: '', price: null,
      beds: null, baths: null, sqft: '', lot: '' };
    const context = buildDealIntelligenceContext({ property: emptyProperty,
      investmentProfile: { exists: false, complete: false, profile: null }, match: null,
      propertyEvidence: { type: 'property_evidence', propertyId: PROPERTY_ID, state: 'not_loaded',
        entitlementState: 'authorized', cacheState: 'miss' }, dealMetrics: null, analysis: null, arvEvaluation: null });
    expect(context.propertyContext.fields.propertyType).toEqual({ value: null, status: 'UNKNOWN', source: null });
    expect(context.investorContext).toMatchObject({ provenance: 'UNKNOWN', targetMarkets: null, priceRange: null });
    expect(context.evidenceSummary.strength).toBe('LOW');
  });
});
