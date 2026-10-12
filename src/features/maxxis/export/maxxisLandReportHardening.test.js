import { describe, expect, it } from 'vitest';
import { resolveParcelDimensions, resolveLotDimensions, calculateLandUnitMetrics } from '../../../../supabase/functions/_shared/maxxis/landMetrics.ts';
import { mergeVerifiedPropertyEvidenceIntoFacts } from '../../../../supabase/functions/_shared/maxxis/propertyEvidenceProjection.ts';
import { calculateLandDevelopmentScenario, formatLandDevelopmentAnswer } from '../../../../supabase/functions/_shared/maxxis/landDevelopmentScenario.ts';
import { buildMarketReferenceAnswer } from '../../../../supabase/functions/_shared/maxxis/marketReferenceAnswer.ts';
import { buildDealDecisionContext } from '../../../../supabase/functions/_shared/maxxis/dealDecisionContext.ts';
import { buildMaxxisReportSchema } from '../../../domain/maxxis/maxxisReportSchema';
import { resolveLocalLandDevelopment } from '../intelligence/maxxisLandDevelopment';
import { buildMaxxisProactiveTriggers, resolveMaxxisProactiveContext, isCurrentLandDevelopmentAction } from '../proactive/maxxisProactiveTriggerEngine';
import { buildLandReportView } from './maxxisLandReportView';

const base = { id: 'gable', type: 'Land', price: 19000, lot: '1.14 acres', lotSizeAcres: 1.14, lotSizeSqft: 49658.4,
  state: 'AL', notes: 'subdivide 2 lots and build new construction' };
const context = { fields: { lotSizeSqft: { value: 23854, status: 'VERIFIED_RECORD', source: 'RENTCAST_PROPERTY_RECORD' },
  propertyType: { value: 'Single Family', status: 'VERIFIED_RECORD' } } };
const property = mergeVerifiedPropertyEvidenceIntoFacts(base, context);
const assumptions = { zoning: 'R2', zoningSource: 'USER_PROVIDED', developmentIntent: 'NEW_CONSTRUCTION', proposedUnitCount: 1, proposedPropertyType: 'SFR' };
const result = calculateLandDevelopmentScenario({ ...property, ...assumptions, purchasePrice: property.price });
const scenario = { strategy: 'LAND', provenance: 'USER_PROVIDED', propertyId: 'gable', assumptions, calculatedOutputs: result };
const schema = () => buildMaxxisReportSchema({ reportType: 'DEAL_INTELLIGENCE', property, dealIntelligence: { activeScenario: scenario } });
const view = (language = 'pt') => buildLandReportView(schema(), language);
const snapshot = { propertyFacts: property, dealAssumptions: { ...assumptions, activeScenario: scenario } };

describe('LAND report hardening, deterministic cached evidence only', () => {
  it('detects the independent acres/sqft conflict', () => expect(property.resolvedLotDimensions.conflict.code).toBe('LOT_DIMENSION_CONFLICT'));
  it('converts trusted sqft without rounding drift', () => expect(property.lotSizeAcres).toBe(23854 / 43560));
  it('resolves an acres-only app field and marks sqft as calculated', () => {
    const resolved = mergeVerifiedPropertyEvidenceIntoFacts({ type: 'Land', lot: '1.14 acres' }, null);
    expect(resolved.lotSizeSqft).toBe(49658.4);
    expect(resolved.canonicalPropertyFacts.physical.lotSizeSqft.status).toBe('CALCULATED');
  });
  it('can select higher-confidence acres instead of hardcoding sqft', () => expect(resolveParcelDimensions({ value: 1.14, status: 'VERIFIED_RECORD' }, { value: 23854, status: 'USER_PROVIDED' }).resolvedSqft).toBe(49658.4));
  it('makes the canonical pair internally consistent', () => expect(property.canonicalPropertyFacts.physical.lotSizeAcres.value).toBe(property.lotSizeSqft / 43560));
  it('calculates asking per acre from that pair', () => expect(calculateLandUnitMetrics(19000, property).pricePerAcre).toBe(Math.round(19000 * 43560 / 23854 * 100) / 100));
  it('keeps chat/report/scenario lot parity', () => {
    const chat = buildMarketReferenceAnswer(snapshot, 'LAND_MARKET_VALUE', 'pt');
    expect(chat.data.landMetrics.lotSizeAcres).toBe(view().metrics.lotSizeAcres);
    expect(result.landMetrics.lotSizeSqft).toBe(view().metrics.lotSizeSqft);
  });
  it('persists current one-unit premises instead of old two-unit history', () => {
    const response = resolveLocalLandDevelopment({ property, storedAssumptions: assumptions, message: '1500 sqft', messages: [{ data: { propertyId: 'gable', scenario: { ...scenario, assumptions: { ...assumptions, proposedUnitCount: 2 } } } }] });
    expect(response.data.scenario.assumptions.proposedUnitCount).toBe(1);
  });
  it('notes cannot offer two houses after explicit one-unit input', () => {
    expect(buildMaxxisProactiveTriggers({ property, snapshot }).some(trigger => trigger.type === 'LAND_DEVELOPMENT')).toBe(false);
  });
  it('invalidates stale two-unit actions', () => {
    const resolved = resolveMaxxisProactiveContext({ property, snapshot });
    expect(isCurrentLandDevelopmentAction({ target: { prompt: 'construir duas casas' } }, resolved)).toBe(false);
    expect(isCurrentLandDevelopmentAction({ target: { prompt: 'construir uma casa' } }, resolved)).toBe(true);
  });
  it('keeps rehab not applicable', () => expect(property.canonicalPropertyFacts.financial.rehab.status).toBe('NOT_APPLICABLE'));
  it('keeps cap rate not applicable', () => expect(property.canonicalPropertyFacts.financial.capRate.status).toBe('NOT_APPLICABLE'));
  it('does not introduce false-zero land metrics', () => {
    expect(view().knownBasis).toBe(19000); expect(view().result.hardCost).toBeNull();
    expect(schema().presentation.existingMetrics.capRate.sourceType).toBe('NOT_APPLICABLE');
    expect(view().coverage.flatMap(group => group.lines).join(' ')).not.toMatch(/\$\s*0[,.]00/);
  });
  it('resolved LAND does not create a missing propertyType gap', () => expect(buildDealDecisionContext(snapshot).decisionGaps.some(gap => /MISSING_PROPERTY_TYPE/.test(gap.code))).toBe(false));
  it('known LAND does not require type-conflict resolution to unlock land sales', () => expect(buildDealDecisionContext(snapshot).decisionGaps.some(gap => gap.field === 'propertyType')).toBe(false));
  it('retains provider SFR conflict without changing subject to SFR', () => { expect(property.propertyTypeConflict).toBe(true); expect(property.type).toBe('Land'); });
  it('composes intentional zero-land-sales evidence', () => expect(view().acquisition.lines.join(' ')).toContain('0 vendas qualificadas'));
  it('documents why exit selection is pending', () => expect(view().exit.lines.join(' ')).toContain('falta área construída'));
  it('projects available comps without losing their addresses', () => {
    const available = schema(); const ref = { status: 'AVAILABLE', valuationCompCount: 2, weightedUnitValue: 30000, weightedLotPricePerSqft: 0.69, range: { low: 16000, high: 18000 }, valuationComps: [{ address: 'Sold parcel A', salePrice: 17000, saleDate: '2026-09-01', lotSizeSqft: 24000, unitValue: 30855, distanceMiles: 0.2 }, { address: 'Sold parcel B', salePrice: 18000, saleDate: '2026-09-02', lotSizeSqft: 25000, unitValue: 31363, distanceMiles: 0.3 }] };
    const populated = { ...available, presentation: { ...available.presentation, landDevelopment: { ...result, landAcquisitionReference: ref } } };
    expect(buildLandReportView(populated, 'en').acquisition.lines.join(' ')).toContain('Sold parcel B');
  });
  it('does not calculate hard cost without building area', () => expect(view().result.hardCost).toBeNull());
  it('calculates known area using the existing benchmark engine', () => {
    const s = schema(); const populated = { ...s, presentation: { ...s.presentation, activeScenario: { ...scenario, assumptions: { ...assumptions, proposedBuildingSqftPerUnit: 1500 } } } };
    expect(buildLandReportView(populated).result.hardCost).toEqual({ low: 178500, central: 218250, high: 258000 });
  });
  it('uses Alabama 2026 construction reference, not a fake bid', () => expect(result.benchmark.rate).toEqual({ low: 119, average: 145.5, high: 172 }));
  it('covers all cost fields and leaves unknowns null', () => {
    expect(result.costCoverage.filter(row => row.status === 'UNKNOWN').every(row => row.value === null)).toBe(true);
    expect(view().coverage.flatMap(group => group.lines)).toHaveLength(result.costCoverage.length);
  });
  it('reports have static next-input copy, not conversational questions', () => {
    expect(formatLandDevelopmentAnswer(result, 'pt', { conversational: false })).not.toContain('?');
    expect(JSON.stringify(view())).not.toContain('cada casa');
  });
  it.each(['pt', 'en', 'es'])('localizes all new report components: %s', language => {
    const text = JSON.stringify(view(language));
    expect(text).not.toMatch(/Resolver propertyType|recent sales market estimate|development feasibility|market context/);
    expect(view(language).premises.lines.some(line => line.includes('R2'))).toBe(true);
  });
  it('retains single-unit singular chat wording', () => expect(formatLandDevelopmentAnswer(result, 'pt')).toContain('para a casa?'));
  it('does not reserve maps for zero qualified comp coordinates', () => expect(view().mapsEligible).toEqual([]));
  it('always uses LAND template without active development intent', () => {
    const raw = buildMaxxisReportSchema({ reportType: 'DEAL_INTELLIGENCE', property });
    expect(buildLandReportView(raw).result.hardCost).toBeNull();
  });
  it('retains the same resolved pair on all report levels', () => {
    for (const reportType of ['PROPERTY_RELEASE', 'MAXXIS_ANALYSIS', 'DEAL_INTELLIGENCE']) {
      const report = buildMaxxisReportSchema({ reportType, property });
      expect(resolveLotDimensions(report.sections.propertySummary.data).resolvedAcres).toBe(property.lotSizeAcres);
    }
  });
});
