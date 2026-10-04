import { describe, expect, it } from 'vitest';
import {
  calculateBuyAndHoldScenario, calculateFlipScenario, calculateLandScenario, calculateScenario,
  calculateSubToScenario, calculateWholesaleScenario, compareScenarioOutputs, detectScenarioStrategy,
  detectsDealScenario, formatDealScenarioAnswer, resolveDealScenario, solveScenarioTarget,
} from './scenarioEngine.ts';

describe('deterministic Maxxis ScenarioEngine', () => {
  it('reuses the Seller Financing arithmetic and mutates interest only on follow-up', () => {
    const history = [{ role: 'user', content: '$20k de entrada, 6% ao ano, amortização 30 anos e balloon em 5 anos' }];
    const result = resolveDealScenario({ message: 'e com 4%?', history, canonicalStrategy: 'SELLER_FINANCING', canonicalFacts: { purchasePrice: 113900 }, now: '2026-10-04T00:00:00Z' });
    expect(result.scenario?.assumptions).toMatchObject({ purchasePrice: 113900, downPaymentAmount: 20000, annualInterestRate: 4, amortizationYears: 30, balloonYears: 5 });
    expect(result.scenario?.calculatedOutputs).toMatchObject({ financedPrincipal: 93900, monthlyPI: 448.29, balloonBalance: 84930.21 });
    expect(result.comparison).toMatchObject({ monthlyPI: { before: 562.98, after: 448.29, absolute: -114.69 } });
    expect(result.providerCalls).toBe(0);
  });

  it('calculates Buy & Hold NOI, cap rate, debt cash flow, CoC and DSCR', () => {
    const result = calculateBuyAndHoldScenario({ purchasePrice: 200000, rent: 2000, vacancyRate: 5, propertyTax: 2400, insurance: 1200,
      HOA: 0, managementPercent: 8, maintenancePercent: 5, otherOperatingExpenses: 600, monthlyPI: 900, cashInvested: 50000 });
    expect(result).toMatchObject({ grossScheduledRent: 24000, effectiveGrossIncome: 22800, operatingExpenses: 7164, NOI: 15636,
      capRate: 7.818, annualCashFlow: 4836, cashOnCashReturn: 9.672, DSCR: 1.4478 });
  });

  it('calculates Flip basis, profit, ROI and rehab delta', () => {
    const before = calculateFlipScenario({ purchasePrice: 100000, rehab: 30000, acquisitionCosts: 5000, holdingCosts: 6000, sellingCosts: 12000, exitValue: 200000 });
    const after = calculateFlipScenario({ purchasePrice: 100000, rehab: 50000, acquisitionCosts: 5000, holdingCosts: 6000, sellingCosts: 12000, exitValue: 200000 });
    expect(before).toMatchObject({ allInCost: 153000, projectedProfit: 47000, ROI: 30.719, profitMargin: 23.5 });
    expect(compareScenarioOutputs(before, after).projectedProfit.absolute).toBe(-20000);
  });

  it('calculates SUB-TO cash entry, carry and cash flow without inventing loan terms', () => {
    expect(calculateSubToScenario({ existingLoanBalance: 180000, monthlyPI: 1100, reinstatement: 12000, cashToSeller: 5000,
      closingCosts: 3000, propertyTax: 2400, insurance: 1200, HOA: 50, expectedRent: 2100 })).toMatchObject({
      knownCashToEntry: 20000, debtAssumed: 180000, knownMonthlyCarry: 1450, estimatedMonthlyCashFlow: 650,
    });
  });

  it('calculates Wholesale spreads and does not guarantee income', () => {
    expect(calculateWholesaleScenario({ contractPrice: 90000, estimatedBuyerPrice: 110000, assignmentFee: 12000, closingCosts: 1000 })).toEqual({
      grossAssignmentSpread: 20000, estimatedNetAssignmentSpread: 11000, buyerBasis: 102000, assignmentFee: 12000, guaranteedIncome: false,
    });
  });

  it('calculates LAND per-acre basis and target economics without residential fields', () => {
    const result = calculateLandScenario({ purchasePrice: 20000, lotSizeAcres: 2, closingCosts: 1000, dueDiligenceCosts: 1500,
      surveyTitleCosts: 500, utilityCosts: 5000, targetExitPricePerAcre: 30000 });
    expect(result).toMatchObject({ purchasePricePerAcre: 10000, knownBasis: 28000, knownBasisPerAcre: 14000,
      targetExitValue: 60000, estimatedProfit: 32000, ROI: 114.2857 });
    expect(result).not.toHaveProperty('rehab');
  });

  it('solves stated targets as calculations, not recommendations', () => {
    expect(solveScenarioTarget('FLIP', { rehab: 30000, acquisitionCosts: 5000, holdingCosts: 5000, sellingCosts: 10000, exitValue: 200000 }, { targetROI: 20 }))
      .toEqual({ purchasePriceRequired: 116666.67, label: 'PRICE_REQUIRED_FOR_STATED_TARGET' });
    expect(solveScenarioTarget('WHOLESALE', { contractPrice: 90000 }, { targetBuyerBasis: 110000 }))
      .toEqual({ assignmentFeeRequired: 20000, label: 'FEE_REQUIRED_FOR_STATED_TARGET' });
    expect(solveScenarioTarget('SELLER_FINANCING', { purchasePrice: 113900, annualInterestRate: 6, amortizationYears: 30 }, { targetMonthlyPI: 600 }))
      .toMatchObject({ downPaymentRequired: expect.any(Number), label: 'DOWN_PAYMENT_REQUIRED_FOR_STATED_TARGET' });
    expect(solveScenarioTarget('BUY_AND_HOLD', { monthlyPI: 900, vacancyRate: 5, managementPercent: 8, maintenancePercent: 5,
      propertyTax: 2400, insurance: 1200 }, { targetDSCR: 1.25 })).toMatchObject({ monthlyRentRequired: expect.any(Number), label: 'RENT_REQUIRED_FOR_STATED_TARGET' });
  });

  it('isolates strategies, detects natural intents, and localizes compact responses', () => {
    expect(detectScenarioStrategy('what if rehab is $50k?')).toBe('FLIP');
    expect(detectScenarioStrategy('e se aluguel for $1.800?')).toBe('BUY_AND_HOLD');
    expect(detectsDealScenario('what if rehab is $50k?')).toBe(true);
    expect(() => calculateScenario('LAND', { purchasePrice: 10000, lotSizeAcres: 1, targetExitPrice: 30000 })).not.toThrow();
    const resolution = resolveDealScenario({ message: 'what if rehab is $50k?', canonicalStrategy: 'FLIP', canonicalFacts: { purchasePrice: 100000, exitValue: 200000 } });
    expect(formatDealScenarioAnswer(resolution, 'pt')).toContain('Cenário simulado');
    expect(formatDealScenarioAnswer(resolution, 'en')).toContain('Scenario simulated');
    expect(formatDealScenarioAnswer(resolution, 'es')).toContain('Escenario simulado');
  });

  it('parses formatted money, per-acre exits and relative follow-ups without provider calls', () => {
    const hold = resolveDealScenario({ message: 'now use $1,800 rent', canonicalStrategy: 'BUY_AND_HOLD', canonicalFacts: { purchasePrice: 200000 } });
    expect(hold.scenario?.assumptions.rent).toBe(1800);
    const land = resolveDealScenario({ message: 'What if I can sell this land for $30k per acre?', canonicalStrategy: 'LAND',
      canonicalFacts: { purchasePrice: 20000, lotSizeAcres: 2 } });
    expect(land.scenario?.calculatedOutputs).toMatchObject({ targetExitValue: 60000 });
    const lower = resolveDealScenario({ message: 'and $10k less?', history: [{ role: 'user', content: 'what if I offer $105k?' }],
      canonicalStrategy: 'FLIP', canonicalFacts: { exitValue: 180000, rehab: 30000 } });
    expect(lower.scenario?.assumptions.purchasePrice).toBe(95000);
    expect(lower.providerCalls).toBe(0);
  });

  it('compares labeled Scenario A and B within the bounded property session history', () => {
    const result = resolveDealScenario({ message: 'now compare A and B', canonicalStrategy: 'FLIP', canonicalFacts: { exitValue: 200000,
      acquisitionCosts: 5000, holdingCosts: 5000, sellingCosts: 10000 }, history: [
      { role: 'user', content: 'Scenario A: offer $100k and rehab $30k for this flip' },
      { role: 'user', content: 'Scenario B: offer $90k and rehab $50k for this flip' },
    ] });
    expect(result.scenario?.assumptions).toMatchObject({ purchasePrice: 90000, rehab: 50000 });
    expect(result.comparison.projectedProfit).toMatchObject({ before: 50000, after: 40000, absolute: -10000 });
  });

  it('understands strategy-specific natural changes without converting them into price changes', () => {
    const rehab = resolveDealScenario({ message: 'and $10k more rehab?', canonicalStrategy: 'FLIP', canonicalFacts: { purchasePrice: 100000, exitValue: 200000 },
      history: [{ role: 'user', content: 'rehab is $30k for this flip' }] });
    expect(rehab.scenario?.assumptions).toMatchObject({ purchasePrice: 100000, rehab: 40000 });
    expect(rehab.comparison.projectedProfit.absolute).toBe(-10000);

    const assignment = resolveDealScenario({ message: 'What if I assign this contract for $12k?', canonicalStrategy: 'WHOLESALE',
      canonicalFacts: { contractPrice: 90000, estimatedBuyerPrice: 110000 } });
    expect(assignment.scenario?.calculatedOutputs).toMatchObject({ assignmentFee: 12000, buyerBasis: 102000, guaranteedIncome: false });

    const target = resolveDealScenario({ message: 'What assignment fee leaves the buyer at $110k basis?', canonicalStrategy: 'WHOLESALE',
      canonicalFacts: { contractPrice: 90000, estimatedBuyerPrice: 115000 } });
    expect(target.scenario?.calculatedOutputs).toMatchObject({ assignmentFeeRequired: 20000 });
  });
});
