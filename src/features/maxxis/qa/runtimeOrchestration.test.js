import { describe, expect, it, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { classifyMaxxisConversationIntent, pendingGapForContext, shouldPresentAnalysisGap } from '../routing/maxxisConversationIntent';
import { resolveMaxxisPropertyContext } from '../context/maxxisPropertyContext';
import { resolveLocalLandDevelopment } from '../intelligence/maxxisLandDevelopment';
import { maxxisActionExecution } from '../actions/maxxisSmartActions';
import { buildMarketReferenceAnswer } from '../../../../supabase/functions/_shared/maxxis/marketReferenceAnswer.ts';
import { buildDealDecisionContext } from '../../../../supabase/functions/_shared/maxxis/dealDecisionContext.ts';
import { parseLandDevelopmentAssumptions } from '../../../../supabase/functions/_shared/maxxis/landDevelopmentScenario.ts';
import { projectMaxxisDealIntelligenceResponse } from '../intelligence/maxxisDealIntelligenceReport';
import { resolveMaxxisProactiveContext } from '../proactive/maxxisProactiveTriggerEngine';
import { gable, droad, landSnapshot, reportResult } from './runtimeOrchestrationFixtures';
import { normalizeMaxxisResponsePayload } from '../../../domain/maxxis/responseTypes';

const gap = { type: 'analysis_gap_resolution', data: { propertyId: droad.id, analysisStrategy: 'SELLER_FINANCING', gapType: 'interestRate', stateVersion: 'v1', missingUserInputs: ['interestRate'] } };
const source = readFileSync(new URL('../../../components/maxxis/MaxxisAssistant.jsx', import.meta.url), 'utf8');
const backend = readFileSync(new URL('../../../../supabase/functions/maxxis-chat/index.ts', import.meta.url), 'utf8');
const receipts = {};

describe('LAND runtime and multi-topic action orchestration — cache only', () => {
  it('preserves structured market-reference data through the response contract', () => {
    const answer = buildMarketReferenceAnswer(landSnapshot(), 'LAND_MARKET_REFERENCE', 'pt');
    expect(normalizeMaxxisResponsePayload(answer.type, answer.data)).toMatchObject({ type: 'market_reference', data: { propertyId: gable.id, stateVersion: answer.data.stateVersion } });
  });
  it.each(['Como você chegou à estimativa de mercado?', 'How did you get the market estimate?', '¿Cómo llegaste a la estimación de mercado?'])('new explicit topic wins over pending financing: %s', message => {
    expect(classifyMaxxisConversationIntent(message, { property: droad, pendingGap: gap }).code).toBe('EXPLAIN_MARKET_ESTIMATE');
  });
  it('rejects cross-property, strategy, scenario and version continuation', () => {
    expect(pendingGapForContext([gap], { propertyId: gable.id, analysisStrategy: 'LAND', stateVersion: 'v1' })).toBeNull();
    expect(pendingGapForContext([gap], { propertyId: droad.id, analysisStrategy: 'LAND', stateVersion: 'v1' })).toBeNull();
    expect(pendingGapForContext([gap], { propertyId: droad.id, analysisStrategy: 'SELLER_FINANCING', stateVersion: 'v2' })).toBeNull();
    expect(pendingGapForContext([{ ...gap, data: { ...gap.data, scenarioId: 'A' } }], { propertyId: droad.id, analysisStrategy: 'SELLER_FINANCING', stateVersion: 'v1', scenarioId: 'B' })).toBeNull();
    expect(pendingGapForContext([gap], { propertyId: droad.id, analysisStrategy: 'SELLER_FINANCING', stateVersion: 'v1' })).toBe(gap);
  });
  it('visible property replaces chat/historical property immediately', () => {
    const context = resolveMaxxisPropertyContext({ screenProperty: gable.id, chatSelectedProperty: droad.id, activeConversationProperty: droad.id, propertyCandidates: [droad, gable] });
    expect(context.property).toEqual(gable); receipts['context-switch'] = context;
  });
  it.each(['quanto vc acha que vale esse terreno?', 'o preço pedido está bom?', 'qual seria o valor do lote?', 'está caro?', 'compare com terrenos vendidos', 'How much is this land worth?', '¿Cuánto vale este terreno?'])('routes land value deterministically: %s', message => {
    expect(classifyMaxxisConversationIntent(message, { property: gable, pendingGap: gap }).code).toBe('LAND_MARKET_REFERENCE');
  });
  it('recognizes R2 plus 1 SFH separately from the LAND subject', () => {
    const values = parseLandDevelopmentAssumptions('Zoneamento R2. Pretendo construir 1 SFH.');
    expect(values).toMatchObject({ zoning: 'R2', zoningSource: 'USER_PROVIDED', developmentIntent: 'NEW_CONSTRUCTION', proposedUnitCount: 1, proposedPropertyType: 'SFR' });
    receipts['land-intent'] = values;
  });
  it('retains zoning-only state, then SFH intent, then consumes it on the next turn', () => {
    const zoning = resolveLocalLandDevelopment({ property: gable, message: 'zoneamento é R2', language: 'pt' });
    const first = resolveLocalLandDevelopment({ property: gable, storedAssumptions: zoning.data.inputsToPersist, message: 'Pretendo construir 1 SFH.', language: 'pt' });
    const next = resolveLocalLandDevelopment({ property: gable, storedAssumptions: first.data.scenario.assumptions, message: 'qual seria o custo de construção?', language: 'pt' });
    expect(next.data.scenario.assumptions).toMatchObject({ zoning: 'R2', proposedUnitCount: 1, proposedPropertyType: 'SFR' });
    expect(next.data.scenario.calculatedOutputs.benchmark.state).toBe('Alabama');
    expect(next.data.scenario.calculatedOutputs.nextInput).toBe('proposedBuildingSqftPerUnit');
    expect(next.data.scenario.strategy).toBe('LAND'); expect(gable.type).toBe('Land');
    receipts['land-state-persistence'] = next.data;
  });
  it('retains verified zoning and exposes a conflicting user assumption', () => {
    const reply = resolveLocalLandDevelopment({ property: { ...gable, zoning: 'R1' }, message: 'Zoneamento R2. Construir 1 SFH.' });
    expect(reply.data.zoningConflict).toMatchObject({ canonicalValue: 'R1', userValue: 'R2' });
    expect(reply.data.intelligenceSnapshot.propertyFacts.zoning).toBe('R1');
  });
  it('removes resolved zoning and development gaps from DecisionContext/proactive context', () => {
    const first = resolveLocalLandDevelopment({ property: gable, message: 'Zoneamento R2. Construir 1 SFH.' });
    const context = buildDealDecisionContext(first.data.intelligenceSnapshot);
    expect(context.decisionGaps.some(item => /zoning|development_assumptions/i.test(item.code))).toBe(false);
    const proactive = resolveMaxxisProactiveContext({ property: gable, messages: [first] });
    expect(proactive.decisionContext.decisionGaps.some(item => /zoning|development_assumptions/i.test(item.code))).toBe(false);
  });
  it.each(['pt', 'en', 'es'])('uses strict eligible cached sold land evidence in %s', language => {
    const answer = buildMarketReferenceAnswer(landSnapshot(), 'LAND_MARKET_REFERENCE', language);
    expect(answer.data.reference.status).toBe('AVAILABLE');
    expect(answer.data.reference.valuationCompCount).toBeGreaterThanOrEqual(2);
    expect(answer.data.reference.unitMetric).toBe('PRICE_PER_ACRE');
    expect(answer.data.landMetrics.pricePerAcre).toBe(16666.67);
    expect(answer.answer).not.toMatch(/não calculo|do not calculate|no calculo/i);
    receipts['valuation-routing'] = answer;
  });
  it('does not invent a range or refuse when no qualifying sales exist', () => {
    const answer = buildMarketReferenceAnswer(landSnapshot(false), 'LAND_MARKET_REFERENCE', 'pt');
    expect(answer.answer).toContain('Não há vendas registradas de terrenos qualificadas');
    expect(answer.answer).toContain('pedido por acre'); expect(answer.data.reference).toBeNull();
  });
  it('expired cached evidence is never used as a current range', () => {
    const snapshot = landSnapshot(); snapshot.developmentEvidence.freshness.landAcquisition.state = 'EXPIRED';
    expect(buildMarketReferenceAnswer(snapshot, 'LAND_MARKET_REFERENCE').data.reference).toBeNull();
  });
  it('comparables expand analysis evidence, never the Matches network', () => {
    const answer = buildMarketReferenceAnswer(landSnapshot(), 'LAND_MARKET_REFERENCE', 'pt');
    const plan = maxxisActionExecution(answer.actions[0], { propertyId: gable.id, stateVersion: answer.data.stateVersion });
    expect(plan.behavior).toBe('EXPAND_EVIDENCE'); expect(answer.actions[0].label).toBe('Ver comparáveis');
    receipts['action-contract'] = answer.actions;
  });
  it('explicit social Matches still navigates to Matches', () => {
    expect(maxxisActionExecution({ type: 'OPEN_DEALSIFTER_MATCHES' }).behavior).toBe('NAVIGATE_MATCHES');
  });
  it('invalidates stale property and state-version actions', () => {
    const action = buildMarketReferenceAnswer(landSnapshot(), 'LAND_MARKET_REFERENCE').actions[0];
    expect(maxxisActionExecution(action, { propertyId: droad.id })).toBeNull();
    expect(maxxisActionExecution(action, { propertyId: gable.id, stateVersion: 'changed' })).toBeNull();
  });
  it('L3 is a report action and never gated by analytical incompleteness', () => {
    const action = { type: 'GENERATE_DEAL_INTELLIGENCE', propertyId: gable.id, label: 'Gerar Deal Intelligence', payload: { prompt: 'Build the full Deal Intelligence view' } };
    expect(maxxisActionExecution(action, { propertyId: gable.id })).toMatchObject({ behavior: 'OPEN_REPORT', reportType: 'DEAL_INTELLIGENCE' });
    expect(shouldPresentAnalysisGap({ code: 'REPORT_REQUEST' }, 'DEAL_INTELLIGENCE')).toBe(false);
    const first = resolveLocalLandDevelopment({ property: gable, message: 'Zoneamento R2. Construir 1 SFH.' });
    const snapshot = { ...first.data.intelligenceSnapshot, dealAssumptions: { ...first.data.scenario.assumptions,
      activeScenario: { ...first.data.scenario, provenance: 'USER_PROVIDED' } } };
    const projected = projectMaxxisDealIntelligenceResponse(reportResult(snapshot));
    expect(projected.data.maxxisReport.pages).toHaveLength(6);
    expect(projected.data.maxxisReport.presentation.landDevelopment.proposedUnitCount).toBe(1);
    expect(projected.data.maxxisReport.presentation.landDevelopment.hardCost).toBeNull();
    receipts['report-action-routing'] = { action, reportType: projected.data.maxxisReport.reportType, basePages: 6, analyticalGapsBlock: false };
  });
  it('separates execution payloads from visible action labels at every handoff', () => {
    expect(source).toContain('visibleUserMessage: followUp?.label');
    expect(source).toContain("controlledIntent: 'generate_report'");
    expect(source).toContain('if (!requestedReportType && result?.type');
    expect(backend).toContain('!propertyAnalysisContext && propertyContextId ? detectPropertyFactLookup');
    expect(backend).toContain('!marketReferenceIntent && !propertyAnalysisContext');
    receipts['internal-prompt-leak'] = { internalPrompt: 'Build the full Deal Intelligence view', visibleLabel: 'Gerar Deal Intelligence', payloadDisplaySeparation: true };
  });
});

afterAll(() => {
  mkdirSync('qa/runtime-orchestration-hardening', { recursive: true });
  for (const [name, data] of Object.entries(receipts)) writeFileSync(`qa/runtime-orchestration-hardening/${name}.json`, JSON.stringify({ evidenceMode: 'DETERMINISTIC_FIXTURES_NOT_LIVE_PRODUCTION', automatedRentCastCalls: 0, data }, null, 2) + '\n');
});
