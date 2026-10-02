import { describe, expect, it, vi } from 'vitest';
import {
  MAXXIS_CONTEXT_BUDGET,
  assertMaxxisContextBudget,
  compactMaxxisConversationHistory,
  measureMaxxisContext,
} from './maxxisContextBudget.ts';
import {
  buildMaxxisLLMContext,
  buildToolInterpretationRequest,
} from './toolResultForGemini.ts';

const supportingComp = (index: number) => ({
  compIdentifier: `comp-${index}`,
  address: `${100 + index} Supporting Ave, Beverly Hills, CA`,
  valuationEligibility: 'SUPPORTING_ONLY',
  valuationRole: 'SUPPORTING',
  recordedSalePrice: 1_700_000 + (index * 10_000),
  recordedSaleDate: '2026-05-15',
  distanceMiles: 1 + (index / 10),
  structuralComparabilityScore: 88 - index,
  dataCompletenessScore: 82 - index,
  conditionCompatibility: 'UNKNOWN',
  exclusionReason: 'Condition review pending',
  rawProviderPayload: `RAW_CANDIDATE_${index}_${'x'.repeat(500)}`,
});

function canonicalFixture() {
  const comparableEvidence = Array.from({ length: 5 }, (_, index) => supportingComp(index));
  const rawSoldCandidates = Array.from({ length: 100 }, (_, index) => ({
    id: `raw-${index}`, rawProviderPayload: `RAW_CANDIDATE_${index}_${'x'.repeat(500)}`,
  }));
  return {
    type: 'deal_insight',
    propertyId: '9537-dalegrove',
    state: 'available',
    property: {
      id: '9537-dalegrove', title: 'SFR', city: 'Beverly Hills', state: 'CA', zip: '90210',
      price: 2_195_000, beds: 3, baths: 2, sqft: 1838, objective: 'Fix & Flip', rehab: 330_840,
    },
    investmentProfile: {
      exists: true, complete: true,
      profile: { status: 'complete', targetMarkets: ['Beverly Hills, CA'], propertyTypes: ['SFR'],
        strategies: ['Fix & Flip'], priceRange: '$1.5M-$2.5M', acceptableConditions: ['FULL_RENOVATION'] },
    },
    match: { score: 74, classification: 'GOOD_FIT', calculable: true,
      reasons: [{ key: 'strategy', label: 'Strategy', status: 'matched', matched: true, points: 25, maxPoints: 25,
        detail: 'Fix & Flip matches the configured profile.' }] },
    metrics: { metrics: {
      pricePerSqft: { value: 1194.23, calculable: true, source: 'calculated', missingInputs: [] },
      acquisitionPlusRehab: { value: 2_525_840, calculable: true, source: 'calculated', missingInputs: [] },
      capRate: { value: 6, calculable: true, source: 'stored', missingInputs: [] },
    }, missingInputs: [] },
    evidence: { duplicateEvidenceMarker: 'DUPLICATE_PROPERTY_EVIDENCE_SHOULD_NOT_ENTER' },
    dealIntelligence: {
      evidenceSummary: { strength: 'MEDIUM', verifiedFieldCount: 17, userProvidedFieldCount: 2,
        unknownFieldCount: 5, conflictCount: 0, conflicts: [] },
      comparableEvidence,
      valuationContext: { status: 'ARV_LIMITED', range: null, centralReference: null, confidence: 'LOW',
        compsUsed: 0, warnings: ['No condition-compatible sale passed every ARV gate.'], provenance: 'CALCULATED' },
      risks: [{ category: 'VALUATION', severity: 'HIGH', explanation: 'ARV remains limited by condition evidence.' }],
    },
    runtimeTrace: { reportType: 'DEAL_INTELLIGENCE', candidateCount: 100, structuralCandidateCount: 5, arvEligibleCount: 0 },
    evidenceCompletenessGate: {
      missingUserInputs: [], question: '', benchmarkOptions: Array.from({ length: 50 }, (_, index) => ({
        state: `ALL_STATE_${index}`, scope: 'FULL_RENOVATION', marker: `FULL_DATASET_${index}`,
      })),
      assumptions: { targetCondition: 'FULL_RENOVATION', rehabBudget: 330_840,
        renovationScope: 'Complete interior renovation', rehabSource: 'USER_PROVIDED',
        declinedInputs: [], provenance: 'USER_PROVIDED' },
    },
    intelligenceSnapshot: {
      reportViewModel: { marker: 'REPORT_VIEW_MODEL_SHOULD_NOT_ENTER' },
      propertyEvidence: { marker: 'DUPLICATE_SNAPSHOT_EVIDENCE_SHOULD_NOT_ENTER' },
      rawSoldCandidates,
      soldEvidence: comparableEvidence,
      rehabAnalysis: {
        value: 330_840, source: 'USER_PROVIDED', provenance: 'USER_PROVIDED', confidence: 'LOW', providerCalls: 0,
        benchmark: { state: 'California', scope: 'FULL_RENOVATION', livingAreaSqft: 1838,
          rate: { average: 180, low: 144, high: 216 }, low: 264_672, mid: 330_840, high: 397_008,
          provenance: 'ESTIMATED', source: 'USER_CURATED_REHAB_BENCHMARK_2026', confidence: 'LOW' },
      },
      dealAssumptions: { holdingPeriodMonths: 8, sellingCostPercent: 8 },
    },
    structuredAnalysis: {
      type: 'maxxis_structured_analysis',
      executiveSummary: 'Canonical Dalegrove evidence-linked analysis remains intact.',
      comparablesAnalysis: { interpretation: 'Five structurally relevant sales remain supporting evidence only.',
        limitations: ['Condition is not verified for ARV use.'] },
      valuationAnalysis: { arvInterpretation: 'A defensible ARV is not available from the selected evidence.' },
      missingEvidence: ['Comparable condition verification'],
      recommendedVerificationSteps: ['Verify target and comparable condition.'],
      userFacingDisclaimers: ['Decision support only.'],
    },
  };
}

const serializedProjection = () => JSON.stringify(buildMaxxisLLMContext(canonicalFixture()));
const followUpRequest = (question: string) => buildToolInterpretationRequest({
  contents: [{ role: 'user', parts: [{ text: question }] }],
  modelParts: [], toolName: 'getDealInsightContext', toolResult: canonicalFixture(), language: 'pt',
  generationConfig: { maxOutputTokens: 420 }, safetySettings: [], plainToolResult: true,
});

describe('Maxxis critical context compaction', () => {
  it('1. never sends the raw pool of 100 sold candidates to Gemini', () => {
    const projection = buildMaxxisLLMContext(canonicalFixture()) as any;
    expect(projection.compsSummary.candidatesConsidered).toBe(100);
    expect(projection.compsSummary.supporting).toHaveLength(5);
    expect(JSON.stringify(projection)).not.toContain('RAW_CANDIDATE_99');
  });

  it('2. sends only the compact comparable summary', () => {
    const projection = buildMaxxisLLMContext(canonicalFixture()) as any;
    expect(projection.compsSummary).toMatchObject({ structuralCandidates: 5, selectedCount: 0,
      supportingCount: 5, excludedCount: 0, arvEligibleCount: 0 });
    expect(projection).not.toHaveProperty('comparableEvidence');
  });

  it('3. never sends the full 50-state rehab dataset', () => {
    expect(serializedProjection()).not.toMatch(/FULL_DATASET_|ALL_STATE_/);
  });

  it('4. sends only the relevant state and scope benchmark', () => {
    expect((buildMaxxisLLMContext(canonicalFixture()) as any).rehabSummary.benchmark).toMatchObject({
      state: 'California', scope: 'FULL_RENOVATION', averagePerSqft: 180,
      rangeLowPerSqft: 144, rangeHighPerSqft: 216,
    });
  });

  it('5. removes duplicate property evidence', () => {
    expect(serializedProjection()).not.toMatch(/DUPLICATE_PROPERTY_EVIDENCE|DUPLICATE_SNAPSHOT_EVIDENCE/);
  });

  it('6. excludes report view models from chat requests', () => {
    expect(JSON.stringify(followUpRequest('resuma'))).not.toContain('REPORT_VIEW_MODEL_SHOULD_NOT_ENTER');
  });

  it('7. enforces the recent-history window', () => {
    const history = Array.from({ length: 20 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', content: `turn ${index}` }));
    const compacted = compactMaxxisConversationHistory(history);
    expect(compacted.contents.filter((item) => !item.parts[0].text.startsWith('Preserved user decisions'))).toHaveLength(6);
    expect(compacted.compactedChars).toBeLessThanOrEqual(MAXXIS_CONTEXT_BUDGET.recentHistoryChars + MAXXIS_CONTEXT_BUDGET.conversationSummaryChars);
  });

  it('8. preserves explicit user decisions in the conversation summary', () => {
    const history = [{ role: 'user', content: 'Minha strategy é Fix & Flip e essa premissa deve permanecer.' },
      ...Array.from({ length: 8 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', content: `recent ${index}` }))];
    expect(compactMaxxisConversationHistory(history).summary).toContain('Fix & Flip');
  });

  it('9. preserves USER_PROVIDED condition through compaction', () => {
    expect((buildMaxxisLLMContext(canonicalFixture()) as any).recentUserInputs).toMatchObject({
      targetCondition: 'FULL_RENOVATION', provenance: 'USER_PROVIDED',
    });
  });

  it('10. preserves the user rehab choice through compaction', () => {
    expect((buildMaxxisLLMContext(canonicalFixture()) as any).recentUserInputs).toMatchObject({
      rehabBudget: 330_840, renovationScope: 'Complete interior renovation', rehabSource: 'USER_PROVIDED',
    });
  });

  it('11. uses compact context for follow-up "como assim?"', () => {
    const payload = JSON.stringify(followUpRequest('como assim?'));
    expect(payload).toContain('MAXXIS_LLM_CONTEXT_V1');
    expect(payload.length).toBeLessThan(MAXXIS_CONTEXT_BUDGET.maxSecondPassChars);
  });

  it('12. uses compact context for follow-up "Why?"', () => {
    expect(JSON.stringify(followUpRequest('Why?')).length).toBeLessThan(MAXXIS_CONTEXT_BUDGET.maxSecondPassChars);
  });

  it('13. uses compact context for follow-up "What\'s missing?"', () => {
    expect(JSON.stringify(followUpRequest("What's missing?")).length).toBeLessThan(MAXXIS_CONTEXT_BUDGET.maxSecondPassChars);
  });

  it('14. uses compact context for metric explanations', () => {
    const payload = JSON.stringify(followUpRequest('Explain metrics'));
    expect(payload).toContain('pricePerSqft');
    expect(payload.length).toBeLessThan(MAXXIS_CONTEXT_BUDGET.maxSecondPassChars);
  });

  it('15. uses compact context for deal snapshot questions', () => {
    const payload = JSON.stringify(followUpRequest('Deal snapshot'));
    expect(payload).not.toContain('intelligenceSnapshot');
    expect(payload.length).toBeLessThan(MAXXIS_CONTEXT_BUDGET.maxSecondPassChars);
  });

  it('16. estimates context size and prevents over-budget requests', () => {
    const request = followUpRequest('quais comps você encontrou?');
    expect(assertMaxxisContextBudget({ request }, MAXXIS_CONTEXT_BUDGET.maxSecondPassChars).withinBudget).toBe(true);
    expect(() => assertMaxxisContextBudget({ oversized: 'x'.repeat(24_001) }, 24_000))
      .toThrow('MAXXIS_CONTEXT_COMPACTION_FAILED');
    expect(measureMaxxisContext({ request }).approximateTokens).toBeGreaterThan(0);
  });

  it('17. does not mutate or degrade the canonical MaxxisStructuredAnalysis', () => {
    const fixture = canonicalFixture();
    const before = JSON.stringify(fixture.structuredAnalysis);
    const projection = buildMaxxisLLMContext(fixture) as any;
    expect(JSON.stringify(fixture.structuredAnalysis)).toBe(before);
    expect(projection.analysisSummary.executiveSummary).toBe(fixture.structuredAnalysis.executiveSummary);
  });

  it('18. performs no new provider calls', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const projection = buildMaxxisLLMContext(canonicalFixture()) as any;
    expect(projection.rehabSummary.selectedValue).toBe(330_840);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('19. keeps only compact strategy assumptions inside the existing tool budget', () => {
    const projection = buildMaxxisLLMContext(canonicalFixture()) as any;
    expect(projection.recentUserInputs.dealAssumptions).toEqual({ holdingPeriodMonths: 8, sellingCostPercent: 8 });
    expect(JSON.stringify(projection).length).toBeLessThan(MAXXIS_CONTEXT_BUDGET.maxToolProjectionChars);
  });
});
