import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { calculateDealMetrics } from './dealMetrics.ts';
import { calculatePropertyMatch } from './calculatePropertyMatch.ts';
import { orchestrateDealInsightContext } from './dealInsightContext.ts';
import { sanitizeToolResultForGemini } from './toolResultForGemini.ts';

const PROPERTY_ID = 'e86dd292-429d-4b51-9b02-bc60a3e9068f';
const property = {
  id: PROPERTY_ID, type: 'SFR', city: 'Honolulu', state: 'HI', zip: '96825', price: 2_100_000,
  beds: 5, baths: 3, sqft: '2333', improvement: '', lot: '', dealTag: '', objective: 'Buy & Hold',
  rehab: null, capRate: 5, description: '', markets: [], images: [], published: true, dealClosed: false,
};
const metrics = calculateDealMetrics({ price: property.price, sqft: property.sqft, rehab: property.rehab, capRate: property.capRate });
const details = {
  found: true, property, missingFields: ['rehab', 'description', 'images'], metrics,
  analysis: { positiveSignals: ['property_published'], attentionPoints: ['rehab_missing_or_invalid'], missingInformation: ['rehab'], limitations: ['arv_not_structured', 'roi_not_calculated'] },
  serviceNeeds: [], serviceMatches: null, nextBestAction: null, workflow: null, serviceMatchingSummary: null,
};
const investmentProfile = {
  exists: true, complete: true,
  profile: { status: 'complete' as const, targetMarkets: ['HI'], priceRange: '800k_plus', propertyTypes: ['Single Family'], strategies: ['Buy & Hold'] },
};
const evidence = {
  type: 'property_evidence' as const, propertyId: PROPERTY_ID, state: 'available' as const,
  entitlementState: 'authorized' as const, cacheState: 'hit' as const,
  evidence: {
    propertyId: PROPERTY_ID,
    fields: { livingAreaSqft: { value: 2333, status: 'VERIFIED_RECORD', source: 'rentcast', retrievedAt: '2026-09-11T15:02:46.829Z', effectiveDate: null } },
    internalFields: { livingAreaSqft: { value: 2333, status: 'USER_PROVIDED', source: 'dealSifter', retrievedAt: null, effectiveDate: null } },
    conflicts: [], missingFields: [], source: { label: 'Public property records via RentCast', updatedAt: '2026-09-11T15:02:46.829Z' }, cacheHit: true,
  },
};
const arvEvaluation = {
  status: 'ARV_LIMITED', arvRangeLow: 2_020_196, arvRangeHigh: 3_063_156,
  centralReference: 2_541_676, confidence: 'LOW', eligibleCompCount: 2,
  warnings: ['VALUATION_DISPERSION_WARNING'], limitations: ['TRANSACTION_QUALITY_UNKNOWN'],
  methodologyVersion: 'DEALSIFTER_ARV_ENGINE_V1', evidenceSummary: { arv: 'CALCULATED',
    conditionReview: 'USER_PROVIDED' }, valuationSet: [],
};

function setup(evidenceResult = evidence) {
  return orchestrateDealInsightContext({
    propertyId: PROPERTY_ID,
    loadPropertyDetails: vi.fn(async () => details),
    loadInvestmentProfile: vi.fn(async () => investmentProfile),
    calculateMatch: calculatePropertyMatch,
    loadPropertyEvidence: vi.fn(async () => evidenceResult),
    loadArvEvaluation: vi.fn(async () => arvEvaluation as never),
  });
}

describe('Maxxis Deal Insight context', () => {
  it('composes property, profile-fit Match Score, cached evidence, and existing deterministic metrics', async () => {
    const result = await setup();
    expect(result).toMatchObject({
      type: 'deal_insight', propertyId: PROPERTY_ID, state: 'available',
      investmentProfile: { exists: true, complete: true },
      match: { score: 100, classification: 'excellent', calculable: true, semantics: 'profile_fit_only' },
      evidence: { state: 'available', cacheState: 'hit' },
      metrics: { metrics: { pricePerSqft: { calculable: true, source: 'calculated' }, acquisitionPlusRehab: { calculable: false }, capRate: { value: 5, source: 'stored' } } },
      capabilities: { canDiscussPricePerSqft: true, canDiscussAcquisitionPlusRehab: false, hasReportedCapRate: true },
      dealIntelligence: { type: 'deal_intelligence_context', valuationContext: {
        status: 'ARV_LIMITED', range: { low: 2_020_196, high: 3_063_156 }, centralReference: 2_541_676,
      }, matchContext: { semantics: 'PROFILE_FIT_ONLY' } },
    });
    expect(result.match?.reasons.map((reason) => reason.key)).toEqual(['market', 'price', 'property_type', 'strategy']);
  });

  it('allows partial insight when public evidence is not loaded without provider work', async () => {
    const notLoaded = { type: 'property_evidence' as const, propertyId: PROPERTY_ID, state: 'not_loaded' as const, entitlementState: 'authorized' as const, cacheState: 'miss' as const };
    const result = await setup(notLoaded);
    expect(result).toMatchObject({ state: 'available', property: { id: PROPERTY_ID }, evidence: { state: 'not_loaded', cacheState: 'miss' } });
    expect(result.match?.calculable).toBe(true);
    expect(result.metrics?.metrics.pricePerSqft.calculable).toBe(true);
  });

  it('keeps the report context available when valuation evidence is rejected for ADDRESS_MISMATCH', async () => {
    const result = await orchestrateDealInsightContext({
      propertyId: PROPERTY_ID,
      loadPropertyDetails: vi.fn(async () => details),
      loadInvestmentProfile: vi.fn(async () => investmentProfile),
      calculateMatch: calculatePropertyMatch,
      loadPropertyEvidence: vi.fn(async () => ({
        type: 'property_evidence' as const, propertyId: PROPERTY_ID, state: 'unavailable' as const,
        entitlementState: 'authorized' as const, cacheState: 'invalid' as const,
      })),
      loadArvEvaluation: vi.fn(async () => { throw new Error('ADDRESS_MISMATCH'); }),
    });
    expect(result).toMatchObject({
      state: 'available', property: { id: PROPERTY_ID },
      evidence: { state: 'unavailable', cacheState: 'invalid' },
      capabilities: { hasArvEvaluation: false },
      dealIntelligence: { valuationContext: { status: 'ARV_UNAVAILABLE' } },
    });
  });

  it('hard-codes unavailable financial capabilities and keeps reported cap rate distinct from verified data', async () => {
    const safe = sanitizeToolResultForGemini(await setup());
    expect(safe).toMatchObject({
      match: { semantics: 'profile_fit_only' },
      metrics: { metrics: { capRate: { value: 5, source: 'stored' } } },
      capabilities: { canCalculateARV: false, canCalculateMAO: false, canCalculateROI: false, canCalculateCashFlow: false, hasReportedCapRate: true },
      dealIntelligence: { valuationContext: { status: 'ARV_LIMITED', centralReference: 2_541_676 } },
    });
    expect(JSON.stringify(safe)).not.toMatch(/"(?:arv|mao|roi|cashFlow)"\s*:\s*(?!false|null)/i);
  });

  it('preserves conflicts without resolving them and strips owner/raw payload data', async () => {
    const conflicted = structuredClone(evidence);
    conflicted.evidence.conflicts = [{ field: 'livingAreaSqft', dealSifterValue: 2333, publicRecordValue: 2500, severity: 'WARNING' }];
    Object.assign(conflicted.evidence, { ownerNames: ['Private Owner'], rawProviderPayload: { owner: 'Private Owner' } });
    const safe = sanitizeToolResultForGemini(await setup(conflicted));
    expect(safe).toMatchObject({ evidence: { conflicts: [{ field: 'livingAreaSqft', dealSifterValue: 2333, publicRecordValue: 2500 }] } });
    expect(JSON.stringify(safe)).not.toMatch(/Private Owner|ownerNames|rawProviderPayload|providerPropertyId/);
  });

  it('is read-only and contains no provider, purchase, mutation, or autonomous action path', () => {
    const orchestration = readFileSync(new URL('./dealInsightContext.ts', import.meta.url), 'utf8');
    const wrapper = readFileSync(new URL('./getDealInsightContext.ts', import.meta.url), 'utf8');
    const registry = readFileSync(new URL('./toolRegistry.ts', import.meta.url), 'utf8');
    expect((registry.match(/name: 'getDealInsightContext'/g) || [])).toHaveLength(1);
    expect(`${orchestration}\n${wrapper}`).not.toMatch(/createRentCastClient|RentCastPropertyDataProvider|usageGuard|stripe|nugget|insert\(|update\(|delete\(|upsert\(/i);
    expect(orchestration).toContain('canCalculateARV: false');
    expect(orchestration).toContain("semantics: 'profile_fit_only'");
  });
});
