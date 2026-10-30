import { describe, it, expect } from 'vitest';
import { evaluateArv } from '../../../../supabase/functions/_shared/property-data/arvEngine';
import { arvEvidenceTier } from '../../../../supabase/functions/_shared/property-data/arvEligibilityPolicy';
import { buildMaxxisReportSchema } from '../../../domain/maxxis/maxxisReportSchema';
import { buildStrictReportViewModel } from './reportIntegrityViewModel';

const candidate = index => ({ source: 'ARV_COMP_CANDIDATE', compIdentifier: `c${index}`, address: `Example ${index}`,
  recordedSalePrice: 200000 + index * 1000, recordedSaleDate: '2026-09-01', recordedSaleEvidenceStatus: 'VERIFIED_RECORD',
  livingAreaSqft: 1500, structuralComparabilityScore: 99, dataCompletenessScore: 99, hardGatesPass: true,
  recordAmbiguousOrCorrupt: false, distanceMiles: .1, daysSinceSale: 20, transactionQuality: 'ARMS_LENGTH_VERIFIED',
  conditionCompatibility: 'MATCHES_TARGET', conditionEvidenceStatus: 'USER_PROVIDED' });

describe('G3 shared ARV count policy, engine through report', () => {
  it.each([0, 1, 2, 3, 5])('preserves the policy with %s eligible sales', count => {
    const candidates = Array.from({ length: count }, (_, i) => candidate(i));
    const result = evaluateArv({ subjectPropertyId: 'p', subjectLivingAreaSqft: 1500, targetCondition: 'AS_IS', candidates });
    const tier = arvEvidenceTier(count);
    if (count < 2) expect(result).toMatchObject({ status: 'ARV_UNAVAILABLE', arvRangeLow: null, arvRangeHigh: null });
    else expect(result.presentationTier).toBe(tier);
    if (count === 2) expect(result).toMatchObject({ status: 'ARV_LIMITED', confidence: 'LOW' });
    const schema = buildMaxxisReportSchema({ reportType: 'DEAL_INTELLIGENCE', property: { id: 'p', type: 'SFR', price: 150000, sqft: 1500 },
      dealIntelligence: { valuationIntelligence: { status: result.status, confidence: result.confidence,
        centralReference: result.centralReference, range: { low: result.arvRangeLow, high: result.arvRangeHigh } },
        comparableEvidence: { used: candidates.map(c => ({ ...c, role: 'PRIMARY', salePrice: c.recordedSalePrice, saleDate: c.recordedSaleDate })) } } });
    const vm = buildStrictReportViewModel({ schema, language: 'en' });
    const section = vm.sections.find(section => section.id === 'arv-market');
    if (count < 2) expect(section).toBeUndefined();
    else {
      expect(section).toBeDefined();
      if (count === 2) {
        expect(section.title).toContain('Preliminary');
        expect(section.rows[0].value).toContain('Low');
        expect(section.range).toBeUndefined();
      } else expect(section.title).not.toContain('Preliminary');
    }
  });
});
