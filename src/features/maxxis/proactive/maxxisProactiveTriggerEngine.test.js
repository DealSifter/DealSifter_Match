import { describe, expect, it, vi } from 'vitest';
import { buildMaxxisProactiveTriggers, resolveMaxxisProactiveContext, selectMaxxisProactiveTrigger, calculateMaxxisProactiveScenario } from './maxxisProactiveTriggerEngine';
import { createMaxxisProactiveSessionMemory, evaluateMaxxisProactiveAttention, markMaxxisProactiveSignalDismissed, markMaxxisProactiveSignalSurfaced, selectMaxxisProactiveCandidate } from './maxxisProactiveIntelligence';
import { normalizeMaxxisPreferences } from '../preferences/maxxisPreferences';
import { orchestrateMaxxisExperience } from '../orchestration/maxxisExperienceOrchestrator';

const property = { id: 'property-a', type: 'SFR', price: 114000, sqft: 1200, state: 'FL', objective: 'Seller Financing' };
const recent = { status: 'AVAILABLE', centralEstimate: 150000, range: { low: 140000, high: 160000 }, weightedUnitValue: 125,
  valuationCompCount: 5, confidence: 'MODERATE', providerAvmCompatibility: 'COMPATIBLE' };
const input = (patch = {}) => ({ property, snapshot: { propertyFacts: property }, language: 'pt', ...patch });
const scenario = (strategy, assumptions) => ({ propertyId: property.id, strategy, assumptions, status: 'COMPLETE',
  calculatedOutputs: calculateMaxxisProactiveScenario(strategy, assumptions) });
const options = (memory = createMaxxisProactiveSessionMemory()) => ({ config: { enabled: true, attentionSafetyManaged: true },
  contextSnapshot: { property: { id: property.id } }, sessionMemory: memory });

describe('Contextual proactivity over existing deterministic intelligence', () => {
  it('passes a concrete trigger through experience orchestration to a real bubble', () => {
    const trigger = selectMaxxisProactiveTrigger(input());
    const result = orchestrateMaxxisExperience({ maxxisEnabled: true, maxxisOpen: false, proactiveSignal: trigger,
      attentionResult: { shouldSurface: true, allowBubble: true, priority: 100 }, preferences: { proactiveEnabled: true } });
    expect(result.attentionMode).toBe('BUBBLE');
    expect(result.primaryContent.type).toBe('CONTEXT');
    expect(Number.isFinite(result.primaryContent.priority)).toBe(true);
  });
  it('DROAD collects the single highest-value missing financing input', () => {
    const result = selectMaxxisProactiveTrigger(input());
    expect(result.type).toBe('SELLER_FINANCING_INPUT');
    expect(result.actions[0].target.inputField).toBe('downPayment');
    expect(result.message).toContain('entrada');
    expect(result.actions).toHaveLength(2);
    const next = selectMaxxisProactiveTrigger(input({ snapshot: { propertyFacts: property, dealAssumptions: { downPayment: 20000 } } }));
    expect(next.actions[0].target.inputField).toBe('interestRate');
    expect(next.dedupeKey).not.toBe(result.dedupeKey);
  });
  it('financing completed terms compare through the existing scenario engine without persistence', () => {
    const current = scenario('SELLER_FINANCING', { purchasePrice: 114000, downPaymentAmount: 20100, annualInterestRate: 4, amortizationYears: 30, balloonYears: 5 });
    const original = structuredClone(current);
    const trigger = selectMaxxisProactiveTrigger(input({ scenario: current, intensity: 'HIGH' }));
    expect(trigger.type).toBe('SELLER_FINANCING_COMPARISON');
    expect(trigger.actions[0].target.localResponse).toContain('P&I mensal');
    expect(trigger.actions[0].target.localResponse).toContain('Juros até o balloon');
    expect(current).toEqual(original);
  });
  it('BUY & HOLD with price, rent and tax offers operating expenses', () => {
    const hold = { ...property, objective: 'Buy and Hold', annualPropertyTax: 2400 };
    const trigger = selectMaxxisProactiveTrigger({ property: hold, snapshot: { propertyFacts: hold, rentalEvidence: { rentEstimate: { rent: 1800 } } }, language: 'pt' });
    expect(trigger.type).toBe('BUY_AND_HOLD_INPUT');
    expect(trigger.actions[0].target.inputField).toBe('operatingExpenses');
    expect(trigger.message).toContain('despesas operacionais');
  });
  it('does not claim NOI is close to calculable without price, rent and tax', () => {
    const hold = { ...property, objective: 'Buy and Hold' };
    expect(selectMaxxisProactiveTrigger({ property: hold, snapshot: { propertyFacts: hold } })).toBeNull();
  });
  it('rent divergence compares existing scenarios without changing the user rent', () => {
    const hold = { ...property, objective: 'Buy and Hold', annualPropertyTax: 2400 };
    const current = scenario('BUY_AND_HOLD', { purchasePrice: 114000, rent: 2500, propertyTax: 2400, otherOperatingExpenses: 3000 });
    const trigger = selectMaxxisProactiveTrigger({ property: hold, snapshot: { propertyFacts: hold, rentalEvidence: { rentEstimate: { rent: 1800 } } }, scenario: current, language: 'pt' });
    expect(trigger.type).toBe('RENT_DIVERGENCE');
    expect(trigger.actions[0].target.localResponse).toContain('NOI');
    expect(current.assumptions.rent).toBe(2500);
  });
  it('FLIP rehab increase surfaces a material profit delta', () => {
    const flip = { ...property, objective: 'Flip' };
    const before = scenario('FLIP', { purchasePrice: 100000, rehab: 20000, exitValue: 180000, sellingCosts: 10000, holdingCosts: 5000 });
    const after = scenario('FLIP', { ...before.assumptions, rehab: 45000 });
    const trigger = selectMaxxisProactiveTrigger({ property: flip, snapshot: { propertyFacts: flip }, scenario: after, previousScenario: before, language: 'pt' });
    expect(trigger.type).toBe('SCENARIO_DELTA');
    expect(trigger.message).toContain('lucro projetado');
    expect(trigger.message).toContain('45.000');
    expect(trigger.message).toContain('20.000');
  });
  it('FLIP offers a price target that actually produces the stated margin', () => {
    const flip = { ...property, objective: 'Flip' };
    const current = scenario('FLIP', { purchasePrice: 150000, rehab: 20000, exitValue: 180000, sellingCosts: 5000 });
    const trigger = selectMaxxisProactiveTrigger({ property: flip, snapshot: { propertyFacts: flip }, scenario: current, language: 'pt' });
    expect(trigger.type).toBe('FLIP_MARGIN');
    expect(trigger.actions[0].target.localResponse).toContain('128.000');
    expect(calculateMaxxisProactiveScenario('FLIP', { ...current.assumptions, purchasePrice: 128000 }).profitMargin).toBe(15);
  });
  it('uses the actual rehab benchmark and flags its low confidence', () => {
    const flip = { ...property, objective: 'Flip', rehab: 500000, targetCondition: 'FULL_RENOVATION' };
    const resolved = resolveMaxxisProactiveContext({ property: flip });
    const trigger = selectMaxxisProactiveTrigger({ ...resolved, language: 'pt' });
    expect(trigger.type).toBe('REHAB_BENCHMARK');
    expect(trigger.message).toContain('confiança baixa');
    expect(trigger.evidence.benchmark.state).toBe('Florida');
    expect(selectMaxxisProactiveTrigger({ ...resolved, intensity: 'LOW' })).toBeNull();
  });
  it('SUB-TO identifies arrears when loan and payment are known', () => {
    const subto = { ...property, objective: 'Sub-to' };
    const trigger = selectMaxxisProactiveTrigger({ property: subto, snapshot: { propertyFacts: subto, dealAssumptions: { existingLoanBalance: 90000, monthlyPiPayment: 650 } }, language: 'pt' });
    expect(trigger.type).toBe('SUB_TO_INPUT');
    expect(trigger.message).toContain('regularização');
  });
  it('WHOLESALE needs contract and meaningful market evidence and HIGH intensity', () => {
    const wholesale = { ...property, objective: 'Wholesale' };
    const value = { property: wholesale, snapshot: { propertyFacts: wholesale, recentSalesMarketEstimate: recent, dealAssumptions: { contractPrice: 140000 } }, intensity: 'HIGH' };
    expect(buildMaxxisProactiveTriggers(value).some((trigger) => trigger.type === 'WHOLESALE_ASSIGNMENT')).toBe(true);
    expect(buildMaxxisProactiveTriggers({ ...value, intensity: 'BALANCED' }).some((trigger) => trigger.type === 'WHOLESALE_ASSIGNMENT')).toBe(false);
  });
  it('LAND prioritizes zoning/use and never contaminates suggestions with residential metrics', () => {
    const land = { ...property, type: 'LAND', objective: 'Sell', lot: '2 acres', rehab: 10000 };
    const trigger = selectMaxxisProactiveTrigger({ property: land, snapshot: { propertyFacts: land }, language: 'pt' });
    expect(trigger.type).toBe('LAND_INPUT');
    expect(trigger.message).toMatch(/zoneamento|uso permitido/);
    expect(JSON.stringify(trigger)).not.toMatch(/rehab|ARV|bedrooms/i);
  });
  it('P0 conflict blocks other methodologies and bypasses analytical cooldown', () => {
    const trigger = selectMaxxisProactiveTrigger(input({ snapshot: { propertyFacts: property, recentSalesMarketEstimate: recent,
      providerEvidence: { conflicts: [{ field: 'propertyType', classification: 'CRITICAL_IDENTITY', resolution: 'UNRESOLVED', storedValue: 'LAND', providerValue: 'SFR' }] } } }));
    expect(trigger.type).toBe('PROPERTY_CONFLICT');
    expect(trigger.priority).toBe('P0');
    const memory = createMaxxisProactiveSessionMemory(); memory.lastBubbleAt = Date.now(); memory.surfacedCount = 2;
    expect(evaluateMaxxisProactiveAttention(trigger, options(memory)).shouldSurface).toBe(true);
  });
  it.each(['pt-BR', 'en-US', 'es'])('valuation divergence exposes both sources in %s without asserting either is correct', (language) => {
    const trigger = selectMaxxisProactiveTrigger(input({ language, snapshot: { propertyFacts: property, recentSalesMarketEstimate: recent, providerMarketContext: { providerEstimate: 200000 } },
      decisionContext: { strategy: 'GENERIC_SELL', relationships: {}, decisionGaps: [] } }));
    expect(trigger.type).toBe('VALUATION_DIVERGENCE');
    expect(trigger.message).toContain(language === 'pt-BR' ? '33,3%' : '33.3%');
    expect(trigger.actions[0].target.localResponse).toContain('180');
    expect(trigger.actions[0].target.localResponse).toMatch(/automaticamente|automatically|automáticamente/);
  });
  it('asking price versus market has sufficient, non-quarantined recent sales', () => {
    const trigger = selectMaxxisProactiveTrigger(input({ snapshot: { propertyFacts: property, recentSalesMarketEstimate: recent }, decisionContext: { strategy: 'GENERIC_SELL', relationships: {}, decisionGaps: [] } }));
    expect(trigger.type).toBe('ASKING_VS_MARKET');
    expect(trigger.evidence.range).toEqual(recent.range);
    expect(trigger.actions[0].label).toBe('Testar oferta');
  });
  it.each(['LOW', 'INSUFFICIENT_RECENT_SALES_EVIDENCE'])('does not emphasize weak/unavailable sales evidence (%s)', (state) => {
    const sales = state === 'LOW' ? { ...recent, confidence: state } : { ...recent, status: state };
    expect(selectMaxxisProactiveTrigger(input({ snapshot: { propertyFacts: property, recentSalesMarketEstimate: sales }, decisionContext: { strategy: 'GENERIC_SELL', relationships: {}, decisionGaps: [] } }))).toBeNull();
  });
  it('separates profile compatibility from economics', () => {
    const trigger = selectMaxxisProactiveTrigger(input({ snapshot: { propertyFacts: property, recentSalesMarketEstimate: recent, matchScore: { score: 29 } },
      decisionContext: { strategy: 'GENERIC_SELL', relationships: {}, decisionGaps: [] } }));
    expect(trigger.type).toBe('PROFILE_MISMATCH');
    expect(trigger.message).toContain('não mede a qualidade');
  });
  it('suppresses the whole displayed state and permits a materially changed state', () => {
    const trigger = selectMaxxisProactiveTrigger(input()); const memory = createMaxxisProactiveSessionMemory();
    markMaxxisProactiveSignalSurfaced(memory, trigger, Date.now() - 100000);
    markMaxxisProactiveSignalDismissed(memory, trigger);
    expect(selectMaxxisProactiveCandidate(buildMaxxisProactiveTriggers(input()), options(memory))).toBeNull();
    const changed = buildMaxxisProactiveTriggers(input({ snapshot: { propertyFacts: property, dealAssumptions: { downPayment: 20000 } } }));
    expect(selectMaxxisProactiveCandidate(changed, options(memory))?.signal.type).toBe('SELLER_FINANCING_INPUT');
  });
  it('ignores generated timestamps, object key order and language changes for dedupe', () => {
    const first = selectMaxxisProactiveTrigger(input());
    const next = selectMaxxisProactiveTrigger(input({ snapshot: { generatedAt: 'later', propertyFacts: { ...property } }, language: 'es' }));
    expect(next.dedupeKey).toBe(first.dedupeKey);
  });
  it('routes only the active property and invalidates evidence when the card materially changes', () => {
    const messages = [{ data: { propertyId: 'other', intelligenceSnapshot: { propertyId: 'other', recentSalesMarketEstimate: recent } } },
      { data: { propertyId: property.id, intelligenceSnapshot: { propertyId: property.id, propertyFacts: property, recentSalesMarketEstimate: recent } } }];
    expect(resolveMaxxisProactiveContext({ property, messages }).snapshot.recentSalesMarketEstimate).toEqual(recent);
    expect(resolveMaxxisProactiveContext({ property: { ...property, price: 300000 }, messages }).snapshot.recentSalesMarketEstimate).toBeUndefined();
    expect(resolveMaxxisProactiveContext({ property: { ...property, id: 'third' }, messages }).snapshot.recentSalesMarketEstimate).toBeUndefined();
  });
  it('opening FREE/PRO/ENTERPRISE context uses zero network calls and changes no state', () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    try {
      for (const plan of ['FREE', 'PRO', 'ENTERPRISE']) {
        const value = { propertyFacts: property, plan }; const saved = structuredClone(value);
        buildMaxxisProactiveTriggers(input({ snapshot: value }));
        expect(value).toEqual(saved);
      }
      expect(fetch).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });
  it('stays silent for no concrete opportunity, closed properties and generic signals', () => {
    expect(selectMaxxisProactiveTrigger({ property: { id: 'empty' } })).toBeNull();
    expect(selectMaxxisProactiveTrigger(input({ property: { ...property, status: 'closed' } }))).toBeNull();
    expect(evaluateMaxxisProactiveAttention({ code: 'DEAL_CONTEXT_UPDATED', dedupeKey: 'generic' }, options()).reasonCode).toBe('GENERIC_OR_INFORMATIONAL');
  });
  it('normalizes independent intensity preferences safely', () => {
    expect(normalizeMaxxisPreferences({ proactiveIntensity: 'noisy' }).proactiveIntensity).toBe('BALANCED');
    for (const intensity of ['LOW', 'BALANCED', 'HIGH']) expect(normalizeMaxxisPreferences({ proactiveIntensity: intensity }).proactiveIntensity).toBe(intensity);
  });
});
