import { describe, expect, it } from 'vitest';
import process from 'node:process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { canonicalFactValue, toKnownFiniteNumber } from '../../../../supabase/functions/_shared/maxxis/canonicalFactSemantics.ts';
import { mergeVerifiedPropertyEvidenceIntoFacts } from '../../../../supabase/functions/_shared/maxxis/propertyEvidenceProjection.ts';
import { buildDealDecisionContext } from '../../../../supabase/functions/_shared/maxxis/dealDecisionContext.ts';
import { buildEvidenceCompletenessGate } from '../../../../supabase/functions/_shared/maxxis/analysisGapResolver.ts';
import { sanitizePublicPropertyNarrative } from '../../../../supabase/functions/_shared/maxxis/propertyDetails.ts';
import { calculateScenario, resolveDealScenario } from '../../../../supabase/functions/_shared/maxxis/scenarioEngine.ts';
import { calculateDealMetrics } from '../../../../supabase/functions/_shared/maxxis/dealMetrics.ts';
import { buildMaxxisReportSchema } from '../../../domain/maxxis/maxxisReportSchema';
import { mergePropertyReleaseEvidence } from '../../../domain/maxxis/propertyReleaseEvidence';
import { buildCanonicalInvestmentAnalysis } from '../intelligence/canonicalInvestmentAnalysis';
import { buildMaxxisProactiveTriggers } from '../proactive/maxxisProactiveTriggerEngine';
import { reportNarrativeProjection } from '../presentation/reportNarrativePresentation';
import { classifyReportContent, rankReportContent, reduceReportContent, selectReportBullets } from '../export/reportContentPriority';

const baseline = 'd9ea801ffd1c57a85e418acddb0c198be744a02c';
const verified = value => ({ value, status: 'VERIFIED_RECORD', source: 'DETERMINISTIC_CONTROL_FIXTURE', confidence: null });
const levels = ['PROPERTY_RELEASE', 'MAXXIS_ANALYSIS', 'DEAL_INTELLIGENCE'];
const controls = [
  { id: 'GABLE', address: '741 Gable Dr', type: 'Land', objective: 'Sell', price: 19000, lot: 49658.4, conflict: true },
  { id: 'DROAD', address: '5939 Droad St', type: 'SFR', objective: 'Seller Financing', price: 113900, lot: 7253 },
  { id: 'BENT CREEK', address: '5714 Bent Creek Dr', type: 'Land', objective: 'Sell', price: 15000, lot: 10000 },
  { id: 'DALEGROVE', address: '9537 Dalegrove Dr', type: 'SFR', objective: 'SUB-TO', price: 2195000, lot: 8316 },
  { id: 'HONOLULU', address: 'Honolulu control fixture', city: 'Honolulu', type: 'SFR', objective: 'Sell', price: 1842500, lot: 10995 },
];
const material = ['county', 'lotSizeSqft', 'yearBuilt', 'assessorId', 'zoning', 'subdivision', 'ownerOccupied',
  'assessedValue', 'annualPropertyTax', 'latestSalePrice', 'latestSaleDate', 'saleHistory', 'hoaFee', 'propertyFeatures',
  'propertyUserNotes', 'localizedPropertyUserNotes', 'propertyTypeConflictCode'];
function fixture(control) {
  const fields = Object.fromEntries(Object.entries({ propertyType: 'Single Family', county: 'Control County', lotSizeSqft: control.lot,
    bedrooms: 3, bathrooms: 2, livingAreaSqft: 1063, yearBuilt: 1962, assessorId: 'APN-12.345.678', zoning: 'RMD-B',
    subdivision: 'CONTROL SUBDIVISION', ownerOccupied: false, assessedValue: 108188, annualPropertyTax: 1843,
    latestSalePrice: 80500, latestSaleDate: '2021-08-03', saleHistory: [{ price: 80500, date: '2021-08-03' }],
    hoaFee: 0, propertyFeatures: { garage: true, roofType: 'Composition Shingle' } }).map(([key, value]) => [key, verified(value)]));
  if (!control.conflict && control.type === 'Land') fields.propertyType = verified('Land');
  const property = { ...control, notes: 'Original owner notes. HOA $0. APN-12.345.678. Material risk: flood review required.',
    localizedPropertyUserNotes: 'Notas originais. HOA $0. APN-12.345.678. Risco material: revisar inundação.',
    images: Array.from({ length: 10 }, (_, index) => `fixture-image-${index}.jpg`),
    owner: { name: 'Authorized owner', notes: 'Authorized owner note.', allowedContacts: [], privateEmail: 'private@example.test' } };
  return { property, context: { fields, conflicts: [] }, projected: mergeVerifiedPropertyEvidenceIntoFacts(property, { fields, conflicts: [] }) };
}
function artifact(name, data) {
  const directory = resolve(process.cwd(), 'qa/p0-canonical-truth'); mkdirSync(directory, { recursive: true });
  writeFileSync(resolve(directory, name + '.json'), JSON.stringify({ baseline, evidenceMode: 'DETERMINISTIC_FIXTURES_NOT_LIVE_PROPERTY_OBSERVATIONS', ...data }, null, 2) + '\n');
}

describe('P0 canonical truth acceptance', () => {
  it('uses identical material facts in chat and all report levels for five controls', () => {
    const parity = [];
    for (const control of controls) {
      const { property, context, projected } = fixture(control);
      const decision = buildDealDecisionContext({ propertyFacts: projected, propertyEvidence: { evidence: context } });
      const investment = buildCanonicalInvestmentAnalysis({ propertyFacts: projected, propertyContext: context, dealDecisionContext: decision });
      expect(investment.focusMap.strategy).toBe(control.type === 'Land' ? 'LAND' : decision.strategy);
      const release = mergePropertyReleaseEvidence(property, { state: 'unlocked', intelligence: context });
      expect(release.canonicalPropertyFacts).toEqual(projected.canonicalPropertyFacts);
      const reports = levels.map(reportType => buildMaxxisReportSchema({ reportType, property: projected }));
      for (const field of material) for (const report of reports) {
        const canonical = report.sections.propertySummary.data;
        expect(canonical[field]).toEqual(reports[0].sections.propertySummary.data[field]);
        expect(canonical[field]).toEqual(projected[field]);
      }
      for (const report of reports) {
        expect(report.sections.propertySummary.data.images).toHaveLength(10);
        expect(report.sections.propertySummary.data.owner.notes).toBe(property.owner.notes);
        expect(report.sections.propertySummary.data.owner.privateEmail).toBeUndefined();
        const narrative = reportNarrativeProjection(report, 'pt');
        expect(narrative.userNotes.original).toBe(property.notes);
        expect(narrative.userNotes.localized).toBe(property.localizedPropertyUserNotes);
      }
      if (control.type === 'Land') {
        expect(decision.strategy).toBe('LAND');
        expect(decision.relationships.rehabBudget).toBeNull();
        const gate = buildEvidenceCompletenessGate({ reportType: 'DEAL_INTELLIGENCE', property: projected });
        expect(gate.inputs.rehabBudget).toBe('NOT_APPLICABLE');
        expect(gate.inputs.targetCondition).toBe('NOT_APPLICABLE');
        const scenario = resolveDealScenario({ message: 'what if rehab is $50k?', canonicalStrategy: 'FLIP', canonicalFacts: projected });
        expect(scenario.scenario.strategy).toBe('LAND');
        expect(canonicalFactValue(projected.canonicalPropertyFacts.physical.livingAreaSqft)).toBeNull();
      }
      if (control.conflict) {
        expect(projected.canonicalPropertyFacts.physical.propertyType.value).toBe('Land');
        expect(projected.canonicalPropertyFacts.physical.propertyType.semanticState).toBe('CONFLICT');
        expect(projected.canonicalPropertyFacts.physical.propertyType.providerEvidence.value).toBe('Single Family');
        // The provider conflict remains evidence, but a known LAND subject does
        // not require a type change to select land sales or simulate development.
        expect(decision.decisionGaps.some(gap => gap.code === 'EVIDENCE_CONFLICT_PROPERTYTYPE')).toBe(false);
      }
      parity.push({ control: control.id, type: projected.type, providerType: projected.providerPropertyType, strategy: decision.strategy,
        conflict: projected.propertyTypeConflictCode, canonical: projected.canonicalPropertyFacts, fields: material, consumers: ['CHAT', 'L1', 'L2', 'L3'], status: 'PASS' });
    }
    artifact('fact-parity', { controls: parity });
    artifact('report-completeness', { status: 'PASS', fields: material, photosRetained: 10, ownerNotesPreserved: true,
      originalNotesPreserved: true, localizedNotesPreserved: true, silentFieldLoss: [], unauthorizedOwnerFieldsExcluded: ['privateEmail'] });
  });

  it('preserves absent states without reviving zero and preserves genuine zero', () => {
    const invalid = [null, undefined, '', ' ', 'unknown', NaN, Infinity, -Infinity, true, false];
    for (const value of invalid) expect(toKnownFiniteNumber(value)).toBeNull();
    const statuses = ['UNKNOWN', 'UNAVAILABLE', 'NOT_APPLICABLE', 'NOT_EVALUATED'];
    for (const status of statuses) expect(toKnownFiniteNumber({ value: 0, status })).toBeNull();
    for (const value of [0, '0', { value: 0, status: 'USER_PROVIDED' }]) expect(toKnownFiniteNumber(value)).toBe(0);
    expect(calculateDealMetrics({ price: 100000, rehab: 0, capRate: 0 }).metrics).toMatchObject({
      acquisitionPlusRehab: { value: 100000, calculable: true }, capRate: { value: 0, calculable: true },
    });
    const gate = buildEvidenceCompletenessGate({ reportType: 'DEAL_INTELLIGENCE', property: { type: 'SFR', rehab: 0 }, assumptions: { targetCondition: 'AS_IS' } });
    expect(gate.inputs.rehabBudget).toBe('AVAILABLE');
    const unknownGate = buildEvidenceCompletenessGate({ reportType: 'DEAL_INTELLIGENCE', property: { type: 'SFR', rehab: 0,
      canonicalPropertyFacts: { financial: { rehab: { value: 0, status: 'UNKNOWN' } } } } });
    expect(unknownGate.inputs.rehabBudget).toBe('USER_RESOLVABLE');
    const property = { id: 'absent', type: 'SFR', objective: 'Flip', price: 100000, rehab: null };
    expect(buildMaxxisProactiveTriggers({ property, snapshot: { propertyFacts: property } }).some(trigger => trigger.type === 'REHAB_BENCHMARK')).toBe(false);
    artifact('zero-semantics', { status: 'PASS', absentStates: statuses, unknownToZero: 0, unavailableToZero: 0,
      notApplicableToZero: 0, notEvaluatedToZero: 0, genuineZeroPreserved: true, gapResolver: 'PASS', proactiveFalseZeroTriggers: 0 });
  });

  it('makes incomplete financial scenarios partial instead of reporting fabricated final metrics', () => {
    const cases = [
      ['BUY_AND_HOLD', { purchasePrice: 200000, rent: 2000 }, ['NOI', 'capRate', 'annualCashFlow']],
      ['FLIP', { purchasePrice: 100000, exitValue: 200000, rehab: 0 }, ['projectedProfit', 'ROI', 'allInCost']],
      ['SUB_TO', { existingLoanBalance: 100000, monthlyPI: 700 }, ['knownCashToEntry', 'knownMonthlyCarry', 'estimatedMonthlyCashFlow']],
      ['WHOLESALE', { contractPrice: 90000, estimatedBuyerPrice: 110000 }, ['estimatedNetAssignmentSpread', 'buyerBasis']],
      ['LAND', { purchasePrice: 19000, lotSizeAcres: 1, targetExitPrice: 50000 }, ['estimatedProfit', 'ROI', 'completeBasis']],
      ['SELLER_FINANCING', { purchasePrice: 120000, downPaymentAmount: 0, annualInterestRate: 0, amortizationYears: 10, balloonYears: 5 }, ['cashToEntry']],
    ];
    const outcomes = cases.map(([strategy, inputs, nullOutputs]) => {
      const result = calculateScenario(strategy, inputs);
      for (const output of nullOutputs) expect(result[output]).toBeNull();
      const resolved = resolveDealScenario({ message: 'simulate this scenario', canonicalStrategy: strategy, canonicalFacts: inputs });
      expect(resolved.scenario.status).toBe('PARTIAL');
      expect(resolved.scenario.unresolvedInputs.length).toBeGreaterThan(0);
      return { strategy, result, nullOutputs, status: resolved.scenario.status };
    });
    const zeroFinancing = calculateScenario('SELLER_FINANCING', { ...cases[5][1], closingCosts: 0, otherCashToSeller: 0 });
    expect(zeroFinancing).toMatchObject({ monthlyPI: 1000, interestPaidToBalloon: 0, cashToEntry: 0, cashToEntryStatus: 'KNOWN' });
    const unknownRehab = resolveDealScenario({ message: 'simulate this flip', canonicalStrategy: 'FLIP', canonicalFacts: {
      purchasePrice: 100000, exitValue: 200000, rehab: 0, canonicalPropertyFacts: { financial: { rehab: { value: 0, status: 'UNKNOWN' } } } } });
    expect(unknownRehab.scenario.assumptions.rehab).toBeUndefined();
    artifact('scenario-completeness', { status: 'PASS', outcomes, explicitZeroFinancing: zeroFinancing, providerCalls: 0 });
  });

  it('ranks critical tails ahead of context without changing numeric facts or original notes', () => {
    const items = ['Generic introduction.', 'Generic context.', 'More context.', 'Another introduction.',
      'APN 12.345.678; LAND, zoning RMD-B.', 'Projected profit $25,000; ROI 12.5%.', 'MATERIAL_TYPE_CONFLICT: LAND / SFR.',
      'Material flood risk: verify before proceeding.'];
    const selected = selectReportBullets(items, 3);
    for (const critical of items.slice(4)) expect(selected).toContain(critical);
    const reduced = reduceReportContent(items.join('\n'), { hardCharacterBudget: 60 });
    for (const critical of items.slice(4)) expect(reduced).toContain(critical);
    expect(reduced).toContain('12.345.678'); expect(reduced).toContain('12.5%');
    const source = 'Narrative sentence. '.repeat(200) + 'Final material fact: APN 12.345.678, tax $1,843; risk flood.';
    expect(sanitizePublicPropertyNarrative(source)).toBe(source);
    expect(sanitizePublicPropertyNarrative('<script>unsafe()</script><b>APN-12.345.678</b>')).toBe('APN-12.345.678');
    expect(sanitizePublicPropertyNarrative('Email private@example.test; phone: 12053780355')).not.toContain('private@example.test');
    const semanticsSource = readFileSync(resolve('supabase/functions/_shared/maxxis/canonicalFactSemantics.ts'), 'utf8');
    expect(semanticsSource).not.toMatch(/fetch\s*\(|createClient\s*\(|invoke\s*\(/);
    artifact('reducer-priority', { status: 'PASS', items: rankReportContent(items), selected, reduced,
      criticalFactRemoved: 0, criticalFinancialRemoved: 0, criticalRiskRemoved: 0,
      longNotesLength: source.length, originalSanitizedLength: sanitizePublicPropertyNarrative(source).length,
      priorities: items.map(classifyReportContent) });
  });
});
