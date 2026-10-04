import { describe, expect, it } from 'vitest';
import { calculateSellerFinancingScenario, compareSellerFinancingScenarios, parseSellerFinancingAssumptions,
  resolveSellerFinancingScenarioFromConversation } from './sellerFinancingScenario.ts';

describe('deterministic Seller Financing Scenario Engine', () => {
  const scenario = () => calculateSellerFinancingScenario({ purchasePrice: 113900, downPaymentAmount: 20000,
    annualInterestRate: 6, amortizationYears: 30, balloonYears: 5 });

  it('calculates the Droad scenario deterministically', () => {
    expect(scenario()).toMatchObject({ purchasePrice: 113900, downPaymentAmount: 20000, financedPrincipal: 93900,
      monthlyPI: 562.98, balloonBalance: 87378.04, principalPaidToBalloon: 6521.96,
      interestPaidToBalloon: 27256.72, cashToEntry: 20000 });
  });
  it('converts a down-payment percentage', () => {
    expect(calculateSellerFinancingScenario({ purchasePrice: 200000, downPaymentPercent: 10, annualInterestRate: 5,
      amortizationMonths: 360, balloonMonth: 60 }).downPaymentAmount).toBe(20000);
  });
  it('supports zero-percent amortization', () => {
    expect(calculateSellerFinancingScenario({ purchasePrice: 120000, downPaymentAmount: 0, annualInterestRate: 0,
      amortizationMonths: 120, balloonMonth: 60 })).toMatchObject({ monthlyPI: 1000, balloonBalance: 60000, interestPaidToBalloon: 0 });
  });
  it('treats balloon at maturity as no early balloon', () => {
    expect(calculateSellerFinancingScenario({ purchasePrice: 120000, downPaymentAmount: 20000, annualInterestRate: 5,
      amortizationMonths: 120, balloonMonth: 120 })).toMatchObject({ balloonBalance: 0, hasEarlyBalloon: false });
  });
  it('rejects a balloon after amortization', () => {
    expect(() => calculateSellerFinancingScenario({ purchasePrice: 120000, downPaymentAmount: 20000, annualInterestRate: 5,
      amortizationMonths: 120, balloonMonth: 121 })).toThrow('SELLER_FINANCING_BALLOON_AFTER_AMORTIZATION');
  });
  it('excludes unknown costs from cash to entry', () => expect(scenario().includedCashComponents).toEqual(['downPayment']));
  it('includes only explicitly supplied costs', () => expect(calculateSellerFinancingScenario({ purchasePrice: 113900,
    downPaymentAmount: 20000, annualInterestRate: 6, amortizationYears: 30, balloonYears: 5,
    closingCosts: 2500, otherCashToSeller: 1000 }).cashToEntry).toBe(23500));
  it('compares two scenarios without provider or model arithmetic', () => {
    const six = scenario();
    const four = calculateSellerFinancingScenario({ purchasePrice: 113900, downPaymentAmount: 20000,
      annualInterestRate: 4, amortizationYears: 30, balloonYears: 5 });
    expect(compareSellerFinancingScenarios(six, four)).toMatchObject({ financedPrincipal: 0, cashToEntry: 0 });
    expect(four.monthlyPI).toBeLessThan(six.monthlyPI);
    expect(four.interestPaidToBalloon).toBeLessThan(six.interestPaidToBalloon);
  });
  it('parses the Portuguese control question', () => expect(parseSellerFinancingAssumptions(
    'E se eu der $20k de entrada, 6% ao ano, 30 anos de amortização com balloon em 5 anos?',
  )).toEqual({ downPaymentAmount: 20000, annualInterestRate: 6, amortizationYears: 30, balloonYears: 5 }));
  it('parses the exact short-form Droad wording', () => expect(parseSellerFinancingAssumptions(
    'E se eu der $20k de entrada, 6% ao ano, 30 anos com balloon em 5 anos?',
  )).toMatchObject({ downPaymentAmount: 20000, annualInterestRate: 6, amortizationYears: 30, balloonYears: 5 }));
  it('refuses to infer missing negotiated terms', () => {
    const incomplete = resolveSellerFinancingScenarioFromConversation({ message: '$20k de entrada', askingPrice: 113900 });
    expect(incomplete).toMatchObject({ state: 'INCOMPLETE', result: null });
    expect(incomplete.missing).toEqual(expect.arrayContaining(['annualInterestRate', 'amortization', 'balloon']));
  });
  it('does not invent a previous scenario from the current asking price', () => {
    const resolution = resolveSellerFinancingScenarioFromConversation({
      message: 'E se eu der $20k de entrada, 6% ao ano, 30 anos com balloon em 5 anos?',
      askingPrice: 113900,
      history: [],
    });
    expect(resolution).toMatchObject({ state: 'CALCULATED', previousResult: null, comparison: null });
  });
  it('recomputes a 4% follow-up from conversation history and compares it', () => {
    const resolution = resolveSellerFinancingScenarioFromConversation({
      message: 'e com 4%?', askingPrice: 113900,
      history: [{ role: 'user', content: 'E se eu der $20k de entrada, 6% ao ano, 30 anos com balloon em 5 anos?' }],
    });
    expect(resolution).toMatchObject({ state: 'CALCULATED', result: { annualInterestRate: 4, financedPrincipal: 93900 } });
    expect(resolution.comparison.monthlyPI).toBeLessThan(0);
    expect(resolution.comparison.interestPaidToBalloon).toBeLessThan(0);
  });
  it('keeps cent precision stable across repeated calculations', () => {
    expect(scenario()).toEqual(scenario());
    for (const value of Object.values(scenario())) if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
  });
});
