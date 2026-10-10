import {
  calculateSellerFinancingScenario, compareSellerFinancingScenarios,
  parseSellerFinancingAssumptions, type SellerFinancingScenarioInput,
} from './sellerFinancingScenario.ts';
import { calculateLandDevelopmentScenario, formatLandDevelopmentAnswer, parseLandDevelopmentAssumptions,
  LAND_DEVELOPMENT_COST_FIELDS, type LandDevelopmentEvidence } from './landDevelopmentScenario.ts';

export type ScenarioStrategy = 'SELLER_FINANCING' | 'BUY_AND_HOLD' | 'FLIP' | 'SUB_TO' | 'WHOLESALE' | 'LAND';
export type ScenarioStatus = 'DRAFT' | 'COMPLETE' | 'PARTIAL';
type Values = Record<string, unknown>;

export type DealScenario = Readonly<{
  id: string; propertyId: string | null; userId: string | null; strategy: ScenarioStrategy; label: string; createdAt: string;
  assumptions: Readonly<Values>; calculatedOutputs: Readonly<Values>; evidenceReferences: readonly string[];
  unresolvedInputs: readonly string[]; source: Readonly<Record<string, 'USER_PROVIDED' | 'CANONICAL_PROPERTY_FACT' | 'CALCULATED'>>;
  status: ScenarioStatus;
}>;

const finite = (value: unknown) => value === null || value === undefined || value === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null;
const round = (value: number, digits = 2) => Math.round((value + Number.EPSILON) * (10 ** digits)) / (10 ** digits);
const nonNegative = (value: unknown, name: string, fallback = 0) => {
  const parsed = finite(value); if (parsed === null) return fallback;
  if (parsed < 0) throw new Error(`SCENARIO_${name.toUpperCase()}_INVALID`); return parsed;
};
const required = (value: unknown, name: string) => { const parsed = finite(value);
  if (parsed === null || parsed <= 0) throw new Error(`SCENARIO_${name.toUpperCase()}_REQUIRED`); return parsed; };
const pct = (value: number, base: number) => base > 0 ? round((value / base) * 100, 4) : null;

export function calculateBuyAndHoldScenario(input: Values) {
  const purchasePrice = required(input.purchasePrice, 'purchase_price'); const rent = required(input.rent, 'rent');
  const vacancyRate = nonNegative(input.vacancyRate, 'vacancy_rate');
  const grossScheduledRent = round(rent * 12); const effectiveGrossIncome = round(grossScheduledRent * (1 - vacancyRate / 100));
  const management = round(effectiveGrossIncome * nonNegative(input.managementPercent, 'management_percent') / 100);
  const maintenance = finite(input.maintenanceAmount) !== null ? nonNegative(input.maintenanceAmount, 'maintenance_amount')
    : round(effectiveGrossIncome * nonNegative(input.maintenancePercent, 'maintenance_percent') / 100);
  const operatingExpenses = round(nonNegative(input.propertyTax, 'property_tax') + nonNegative(input.insurance, 'insurance')
    + nonNegative(input.HOA, 'hoa') * 12 + management + maintenance + nonNegative(input.otherOperatingExpenses, 'other_operating_expenses'));
  const NOI = round(effectiveGrossIncome - operatingExpenses); const annualDebtService = round(nonNegative(input.monthlyPI, 'monthly_pi') * 12);
  const annualCashFlow = round(NOI - annualDebtService); const cashInvested = finite(input.cashInvested);
  return Object.freeze({ grossScheduledRent, effectiveGrossIncome, operatingExpenses, NOI, capRate: pct(NOI, purchasePrice),
    monthlyOperatingCashFlow: round(NOI / 12), annualCashFlow, debtService: annualDebtService || null,
    cashFlowAfterDebt: annualDebtService ? annualCashFlow : null, cashOnCashReturn: annualDebtService && cashInvested && cashInvested > 0 ? pct(annualCashFlow, cashInvested) : null,
    DSCR: annualDebtService > 0 ? round(NOI / annualDebtService, 4) : null });
}

export function calculateFlipScenario(input: Values) {
  const purchasePrice = required(input.purchasePrice ?? input.offerPrice, 'purchase_price'); const exitValue = required(input.exitValue, 'exit_value');
  const rehabCost = nonNegative(input.rehab, 'rehab'); const acquisitionCosts = nonNegative(input.acquisitionCosts ?? input.closingCosts, 'acquisition_costs');
  const holdingCost = nonNegative(input.holdingCosts, 'holding_costs'); const financingCost = nonNegative(input.financingCosts, 'financing_costs');
  const sellingCost = finite(input.sellingCosts) !== null ? nonNegative(input.sellingCosts, 'selling_costs')
    : round(exitValue * nonNegative(input.sellingCostPercent, 'selling_cost_percent') / 100);
  const acquisitionBasis = round(purchasePrice + acquisitionCosts); const totalBasisBeforeSale = round(acquisitionBasis + rehabCost + holdingCost + financingCost);
  const allInCost = round(totalBasisBeforeSale + sellingCost); const projectedProfit = round(exitValue - allInCost);
  return Object.freeze({ acquisitionBasis, rehabCost, totalBasisBeforeSale, holdingCost, financingCost, sellingCost, allInCost,
    grossSpread: round(exitValue - purchasePrice), projectedProfit, ROI: pct(projectedProfit, allInCost), profitMargin: pct(projectedProfit, exitValue) });
}

export function calculateSubToScenario(input: Values) {
  const debtAssumed = required(input.existingLoanBalance, 'existing_loan_balance'); const monthlyDebtService = required(input.monthlyPI, 'monthly_pi');
  const reinstatement = finite(input.reinstatement) !== null ? nonNegative(input.reinstatement, 'reinstatement') : nonNegative(input.arrears, 'arrears');
  const knownCashToEntry = round(reinstatement + nonNegative(input.cashToSeller, 'cash_to_seller') + nonNegative(input.closingCosts, 'closing_costs'));
  const knownMonthlyCarry = round(monthlyDebtService + nonNegative(input.propertyTax, 'property_tax') / 12
    + nonNegative(input.insurance, 'insurance') / 12 + nonNegative(input.HOA, 'hoa'));
  const rent = finite(input.expectedRent); const estimatedMonthlyCashFlow = rent === null ? null : round(rent - knownMonthlyCarry);
  return Object.freeze({ knownCashToEntry, debtAssumed, monthlyDebtService, knownMonthlyCarry, estimatedMonthlyCashFlow,
    DSCR: rent !== null && monthlyDebtService > 0 ? round(rent / monthlyDebtService, 4) : null });
}

export function calculateWholesaleScenario(input: Values) {
  const contractPrice = required(input.contractPrice, 'contract_price'); const estimatedBuyerPrice = required(input.estimatedBuyerPrice, 'buyer_price');
  const assignmentFee = nonNegative(input.assignmentFee, 'assignment_fee'); const closingCosts = nonNegative(input.closingCosts, 'closing_costs');
  return Object.freeze({ grossAssignmentSpread: round(estimatedBuyerPrice - contractPrice), estimatedNetAssignmentSpread: round(assignmentFee - closingCosts),
    buyerBasis: round(contractPrice + assignmentFee), assignmentFee, guaranteedIncome: false });
}

export function calculateLandScenario(input: Values) {
  if (input.developmentIntent && input.developmentIntent !== 'NONE') return calculateLandDevelopmentScenario(input);
  const purchasePrice = required(input.purchasePrice, 'purchase_price'); let acres = finite(input.lotSizeAcres); let sqft = finite(input.lotSizeSqft);
  if ((!acres || acres <= 0) && sqft && sqft > 0) acres = sqft / 43_560; if ((!sqft || sqft <= 0) && acres && acres > 0) sqft = acres * 43_560;
  if (!acres || !sqft) throw new Error('SCENARIO_LAND_SIZE_REQUIRED');
  const knownBasis = round(purchasePrice + nonNegative(input.closingCosts, 'closing_costs') + nonNegative(input.dueDiligenceCosts, 'due_diligence_costs')
    + nonNegative(input.surveyTitleCosts, 'survey_title_costs') + nonNegative(input.utilityCosts, 'utility_costs')
    + nonNegative(input.siteImprovementCosts, 'site_improvement_costs') + nonNegative(input.taxes, 'taxes'));
  const targetExitValue = finite(input.targetExitPrice) ?? (finite(input.targetExitPricePerAcre) !== null ? Number(input.targetExitPricePerAcre) * acres
    : finite(input.targetExitPricePerLotSqft) !== null ? Number(input.targetExitPricePerLotSqft) * sqft : null);
  const estimatedProfit = targetExitValue === null ? null : round(targetExitValue - knownBasis);
  return Object.freeze({ purchasePricePerAcre: round(purchasePrice / acres), purchasePricePerLotSqft: round(purchasePrice / sqft, 4), knownBasis,
    knownBasisPerAcre: round(knownBasis / acres), targetExitValue: targetExitValue === null ? null : round(targetExitValue),
    grossSpread: targetExitValue === null ? null : round(targetExitValue - purchasePrice), estimatedProfit, ROI: estimatedProfit === null ? null : pct(estimatedProfit, knownBasis) });
}

export function solveScenarioTarget(strategy: ScenarioStrategy, assumptions: Values, target: Values) {
  const targetROI = finite(target.targetROI);
  if (strategy === 'SELLER_FINANCING' && finite(target.targetMonthlyPI) !== null) {
    const purchasePrice = required(assumptions.purchasePrice, 'purchase_price'); const annualRate = required(assumptions.annualInterestRate, 'interest_rate') / 100 / 12;
    const months = finite(assumptions.amortizationMonths) ?? required(assumptions.amortizationYears, 'amortization') * 12;
    const factor = annualRate === 0 ? 1 / months : annualRate * ((1 + annualRate) ** months) / (((1 + annualRate) ** months) - 1);
    const financedPrincipalRequired = Number(target.targetMonthlyPI) / factor;
    return Object.freeze({ downPaymentRequired: round(Math.max(0, purchasePrice - financedPrincipalRequired)), label: 'DOWN_PAYMENT_REQUIRED_FOR_STATED_TARGET' });
  }
  if (strategy === 'BUY_AND_HOLD' && finite(target.targetDSCR) !== null) {
    const debt = required(assumptions.monthlyPI, 'monthly_pi') * 12; const vacancy = nonNegative(assumptions.vacancyRate, 'vacancy_rate') / 100;
    const variableExpenseRate = (nonNegative(assumptions.managementPercent, 'management_percent') + nonNegative(assumptions.maintenancePercent, 'maintenance_percent')) / 100;
    const fixed = nonNegative(assumptions.propertyTax, 'property_tax') + nonNegative(assumptions.insurance, 'insurance')
      + nonNegative(assumptions.HOA, 'hoa') * 12 + nonNegative(assumptions.otherOperatingExpenses, 'other_operating_expenses');
    const annualRentRequired = (Number(target.targetDSCR) * debt + fixed) / ((1 - vacancy) * (1 - variableExpenseRate));
    return Object.freeze({ monthlyRentRequired: round(annualRentRequired / 12), label: 'RENT_REQUIRED_FOR_STATED_TARGET' });
  }
  const targetProfitMargin = finite(target.targetProfitMargin);
  if (strategy === 'FLIP' && (targetROI !== null || targetProfitMargin !== null)) {
    const exit = required(assumptions.exitValue, 'exit_value'); const selling = finite(assumptions.sellingCosts) ?? exit * nonNegative(assumptions.sellingCostPercent, 'selling_cost_percent') / 100;
    const other = nonNegative(assumptions.rehab, 'rehab') + nonNegative(assumptions.acquisitionCosts ?? assumptions.closingCosts, 'acquisition_costs')
      + nonNegative(assumptions.holdingCosts, 'holding_costs') + nonNegative(assumptions.financingCosts, 'financing_costs') + selling;
    if (targetProfitMargin !== null) {
      if (targetProfitMargin < 0 || targetProfitMargin >= 100) throw new Error('SCENARIO_PROFIT_MARGIN_INVALID');
      return Object.freeze({ purchasePriceRequired: round(exit * (1 - targetProfitMargin / 100) - other), label: 'PRICE_REQUIRED_FOR_STATED_MARGIN' });
    }
    return Object.freeze({ purchasePriceRequired: round((exit - other * (1 + Number(targetROI) / 100)) / (1 + Number(targetROI) / 100)), label: 'PRICE_REQUIRED_FOR_STATED_TARGET' });
  }
  if (strategy === 'LAND' && targetROI !== null) {
    const basisWithoutPurchase = nonNegative(assumptions.closingCosts, 'closing_costs') + nonNegative(assumptions.dueDiligenceCosts, 'due_diligence_costs')
      + nonNegative(assumptions.surveyTitleCosts, 'survey_title_costs') + nonNegative(assumptions.utilityCosts, 'utility_costs') + nonNegative(assumptions.siteImprovementCosts, 'site_improvement_costs');
    const exit = required(assumptions.targetExitPrice, 'target_exit_price');
    return Object.freeze({ purchasePriceRequired: round(exit / (1 + targetROI / 100) - basisWithoutPurchase), label: 'PRICE_REQUIRED_FOR_STATED_TARGET' });
  }
  if (strategy === 'WHOLESALE' && finite(target.targetBuyerBasis) !== null) return Object.freeze({
    assignmentFeeRequired: round(Number(target.targetBuyerBasis) - required(assumptions.contractPrice, 'contract_price')), label: 'FEE_REQUIRED_FOR_STATED_TARGET' });
  throw new Error('SCENARIO_TARGET_NOT_SOLVABLE');
}

const STRATEGY_ALIASES: Record<string, ScenarioStrategy> = { SELLERFINANCING: 'SELLER_FINANCING', SELLER_FINANCING: 'SELLER_FINANCING',
  BUYANDHOLD: 'BUY_AND_HOLD', BUY_AND_HOLD: 'BUY_AND_HOLD', FLIP: 'FLIP', SUBTO: 'SUB_TO', SUB_TO: 'SUB_TO', WHOLESALE: 'WHOLESALE', LAND: 'LAND' };
const normalizeStrategy = (value: unknown) => STRATEGY_ALIASES[String(value || '').toUpperCase().replace(/[^A-Z_]/g, '')] || null;
function compactScenarioInputs(input: Values) {
  const aliases: Record<string, string[]> = {
    purchasePrice: ['purchasePrice', 'price', 'askingPrice'], rent: ['rent', 'expectedRent', 'providerRentEstimate'], vacancyRate: ['vacancyRate'],
    propertyTax: ['propertyTax', 'annualPropertyTax'], insurance: ['insurance'], HOA: ['HOA', 'hoa', 'hoaFee'], managementPercent: ['managementPercent', 'management'],
    maintenancePercent: ['maintenancePercent', 'maintenance'], otherOperatingExpenses: ['otherOperatingExpenses', 'operatingExpenses'], monthlyPI: ['monthlyPI', 'monthlyPiPayment', 'monthlyPayment'],
    cashInvested: ['cashInvested'], rehab: ['rehab', 'rehabBudget'], acquisitionCosts: ['acquisitionCosts', 'closingCosts'], holdingCosts: ['holdingCosts'],
    financingCosts: ['financingCosts'], sellingCosts: ['sellingCosts'], sellingCostPercent: ['sellingCostPercent'], exitValue: ['exitValue', 'arv'],
    existingLoanBalance: ['existingLoanBalance'], arrears: ['arrears'], reinstatement: ['reinstatement'], cashToSeller: ['cashToSeller'], expectedRent: ['expectedRent'],
    contractPrice: ['contractPrice'], estimatedBuyerPrice: ['estimatedBuyerPrice'], assignmentFee: ['assignmentFee'], closingCosts: ['closingCosts'],
    lotSizeAcres: ['lotSizeAcres'], lotSizeSqft: ['lotSizeSqft', 'lot'], dueDiligenceCosts: ['dueDiligenceCosts'], surveyTitleCosts: ['surveyTitleCosts'],
    utilityCosts: ['utilityCosts'], siteImprovementCosts: ['siteImprovementCosts'], taxes: ['taxes'], targetExitPrice: ['targetExitPrice'],
    targetExitPricePerAcre: ['targetExitPricePerAcre'], targetExitPricePerLotSqft: ['targetExitPricePerLotSqft'], downPaymentAmount: ['downPaymentAmount', 'downPayment'],
    downPaymentPercent: ['downPaymentPercent'], annualInterestRate: ['annualInterestRate', 'interestRate'], amortizationMonths: ['amortizationMonths'],
    amortizationYears: ['amortizationYears'], balloonMonth: ['balloonMonth', 'balloonMonths'], balloonYears: ['balloonYears'],
  };
  const compact: Values = {};
  Object.entries(aliases).forEach(([target, keys]) => { const key = keys.find((candidate) => finite(input[candidate]) !== null);
    if (key) compact[target] = finite(input[key]); });
  for (const key of ['proposedLotCount', 'proposedUnitCount', 'proposedBuildingSqftPerUnit', 'proposedBedsPerUnit', 'proposedBathsPerUnit',
    'constructionCostPerSqft', 'contractorBid', 'constructionHardCost', ...LAND_DEVELOPMENT_COST_FIELDS]) {
    if (finite(input[key]) !== null) compact[key] = finite(input[key]);
  }
  for (const key of ['state', 'developmentIntent', 'proposedPropertyType', 'constructionBenchmarkClass']) {
    if (typeof input[key] === 'string' && input[key]) compact[key] = input[key];
  }
  for (const key of ['unitsEquivalent', 'zoningSubdivisionVerified']) if (typeof input[key] === 'boolean') compact[key] = input[key];
  return compact;
}
export function detectScenarioStrategy(message: unknown, fallback?: unknown): ScenarioStrategy | null {
  const text = String(message || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/subdiv|desmembr|constru.*(?:casa|lote)|build.*(?:home|house|lot)|land development/.test(text)) return 'LAND';
  if (/seller financ|financiamento do vendedor|balloon|amortiza/.test(text)) return 'SELLER_FINANCING';
  if (/buy.?and.?hold|aluguel|rent|vacancy|vacancia|cap rate|dscr/.test(text)) return 'BUY_AND_HOLD';
  if (/\bflip\b|rehab|reforma|arv/.test(text)) return 'FLIP';
  if (/sub.?to|subject.?to|reinstatement|reintegracao|arrears/.test(text)) return 'SUB_TO';
  if (/wholesale|\bassign\w*\b|assignment fee|taxa de cessao|contrato.*comprador/.test(text)) return 'WHOLESALE';
  if (/\bland\b|terreno|acre|utilities|utilidades|lote/.test(text)) return 'LAND';
  return normalizeStrategy(fallback);
}

const parsedAmount = (raw: string, suffix = '') => { const number = Number(String(raw).replace(/[.,]/g, ''));
  return Number.isFinite(number) ? round(number * (/k/i.test(suffix) ? 1_000 : /m/i.test(suffix) ? 1_000_000 : 1)) : undefined; };
const numeric = (text: string, names: string[]) => { const name = names.join('|');
  const after = text.match(new RegExp(`(?:${name})\\s*(?:de|of|is|=|a|at|for)?\\s*(?:us\\$|\\$)?\\s*([0-9][0-9.,]*)\\s*([km])?`, 'i'));
  const before = text.match(new RegExp(`(?:us\\$|\\$)?\\s*([0-9][0-9.,]*)\\s*([km])?\\s*(?:de|of|in)?\\s*(?:${name})`, 'i'));
  const match = after || before; return match ? parsedAmount(match[1], match[2]) : undefined; };
export function parseScenarioAssumptions(message: unknown, strategy: ScenarioStrategy): Values {
  const text = String(message || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); const values: Values = {};
  const put = (key: string, value: unknown) => { if (value !== undefined && value !== null) values[key] = value as number; };
  put('purchasePrice', numeric(text, ['offer(?: price)?', 'oferta', 'purchase price', 'preco de compra', 'seller accepts?', 'vendedor aceita']));
  if (strategy === 'BUY_AND_HOLD') { put('rent', numeric(text, ['rent', 'aluguel'])); put('vacancyRate', numeric(text, ['vacancy', 'vacancia']));
    put('managementPercent', numeric(text, ['management', 'administracao'])); put('maintenancePercent', numeric(text, ['maintenance', 'manutencao'])); }
  if (strategy === 'FLIP') { put('rehab', numeric(text, ['rehab', 'reforma'])); put('exitValue', numeric(text, ['arv', 'exit value', 'valor de saida'])); }
  if (strategy === 'SUB_TO') { put('reinstatement', numeric(text, ['reinstatement', 'reintegracao'])); put('cashToSeller', numeric(text, ['cash to seller', 'caixa ao vendedor'])); put('expectedRent', numeric(text, ['rent', 'aluguel']));
    const sellerCash = text.match(/seller\s+wants?\s*(?:us\$|\$)?\s*([0-9][0-9.,]*)\s*([km])?\s*cash/i); if (sellerCash) put('cashToSeller', parsedAmount(sellerCash[1], sellerCash[2])); }
  if (strategy === 'WHOLESALE') { put('contractPrice', numeric(text, ['contract(?: price)?', 'contrato'])); put('estimatedBuyerPrice', numeric(text, ['buyer(?: price)?', 'comprador paga'])); put('assignmentFee', numeric(text, ['assignment fee', 'taxa de cessao']));
    const contractAt = text.match(/contract\s+(?:it\s+)?(?:at|for)\s*(?:us\$|\$)?\s*([0-9][0-9.,]*)\s*([km])?/i); if (contractAt) put('contractPrice', parsedAmount(contractAt[1], contractAt[2]));
    const buyerPays = text.match(/buyer\s+(?:only\s+)?pays?\s*(?:us\$|\$)?\s*([0-9][0-9.,]*)\s*([km])?/i); if (buyerPays) put('estimatedBuyerPrice', parsedAmount(buyerPays[1], buyerPays[2]));
    const assignFor = text.match(/assign(?:\s+this)?\s+contract\s+(?:at|for)\s*(?:us\$|\$)?\s*([0-9][0-9.,]*)\s*([km])?/i);
    if (assignFor) { put('assignmentFee', parsedAmount(assignFor[1], assignFor[2])); delete values.contractPrice; } }
  if (strategy === 'LAND') { put('utilityCosts', numeric(text, ['utilities(?: cost)?', 'utilidades'])); put('targetExitPricePerAcre', numeric(text, ['per acre', 'por acre'])); put('targetExitPrice', numeric(text, ['sale price', 'preco de venda'])); Object.assign(values, parseLandDevelopmentAssumptions(message)); }
  if (strategy === 'SELLER_FINANCING') Object.assign(values, parseSellerFinancingAssumptions(text));
  const perAcre = text.match(/(?:us\$|\$)?\s*([0-9][0-9.,]*)\s*([km])?\s*(?:per|por)\s+acre/i);
  if (strategy === 'LAND' && perAcre) put('targetExitPricePerAcre', parsedAmount(perAcre[1], perAcre[2]));
  const roi = text.match(/(?:roi\s*(?:de|of|=)?\s*([0-9]+(?:[.,][0-9]+)?)|([0-9]+(?:[.,][0-9]+)?)\s*%\s*(?:de\s+)?roi)/i);
  if (roi) put('targetROI', Number((roi[1] || roi[2]).replace(',', '.')));
  const dscr = text.match(/(?:dscr\s*(?:de|of|=)?\s*([0-9]+(?:[.,][0-9]+)?)|([0-9]+(?:[.,][0-9]+)?)\s*dscr)/i);
  if (dscr) put('targetDSCR', Number((dscr[1] || dscr[2]).replace(',', '.')));
  const paymentTarget = text.match(/(?:pi|p&i|parcela|payment)[^0-9]{0,20}(?:under|abaixo de|menor que)?\s*(?:us\$|\$)?\s*([0-9][0-9.,]*)/i);
  if (paymentTarget) put('targetMonthlyPI', parsedAmount(paymentTarget[1]));
  const buyerBasisTarget = text.match(/(?:buyer|comprador)[^0-9]{0,20}(?:basis|base)[^0-9]{0,10}(?:us\$|\$)?\s*([0-9][0-9.,]*)\s*([km])?/i)
    || text.match(/(?:buyer|comprador)[^0-9]{0,20}(?:us\$|\$)?\s*([0-9][0-9.,]*)\s*([km])?\s*(?:basis|base)/i);
  if (buyerBasisTarget) put('targetBuyerBasis', parsedAmount(buyerBasisTarget[1], buyerBasisTarget[2]));
  const relativeRehab = text.match(/(?:us\$|\$)?\s*([0-9][0-9.,]*)\s*([km])?\s*(more|mais|less|lower|menos)\s*(?:in\s+|de\s+)?(?:rehab|reforma)/i);
  if (strategy === 'FLIP' && relativeRehab) { const amount = parsedAmount(relativeRehab[1], relativeRehab[2]) || 0;
    values.__relativeRehab = (/less|lower|menos/i.test(relativeRehab[3]) ? -1 : 1) * amount; }
  if (!Object.keys(values).length) {
    const relative = text.match(/(?:us\$|\$)?\s*([0-9][0-9.,]*)\s*([km])?\s*(less|lower|menos|more|mais)/i);
    if (relative) { const amount = parsedAmount(relative[1], relative[2]) || 0; const direction = /less|lower|menos/i.test(relative[3]) ? -1 : 1;
      values.__relativePurchasePrice = direction * amount; }
  }
  return Object.freeze(values);
}

export function calculateScenario(strategy: ScenarioStrategy, assumptions: Values, developmentEvidence?: LandDevelopmentEvidence | null, asOf?: string) {
  if (strategy === 'LAND' && assumptions.developmentIntent && assumptions.developmentIntent !== 'NONE') return calculateLandDevelopmentScenario(assumptions, developmentEvidence, asOf);
  if (strategy === 'SELLER_FINANCING') return calculateSellerFinancingScenario(assumptions as SellerFinancingScenarioInput);
  if (strategy === 'BUY_AND_HOLD') return calculateBuyAndHoldScenario(assumptions);
  if (strategy === 'FLIP') return calculateFlipScenario(assumptions);
  if (strategy === 'SUB_TO') return calculateSubToScenario(assumptions);
  if (strategy === 'WHOLESALE') return calculateWholesaleScenario(assumptions);
  return calculateLandScenario(assumptions);
}

export function compareScenarioOutputs(before: Values | null, after: Values) {
  if (!before) return Object.freeze({}); const delta: Record<string, Readonly<{ before: number; after: number; absolute: number; percent: number | null }>> = {};
  Object.entries(after).forEach(([key, value]) => { const left = finite(before[key]); const right = finite(value); if (left === null || right === null || left === right) return;
    delta[key] = Object.freeze({ before: left, after: right, absolute: round(right - left), percent: left === 0 ? null : round(((right - left) / Math.abs(left)) * 100, 4) }); });
  if (before.model === 'LAND_DEVELOPMENT_V2' && after.model === 'LAND_DEVELOPMENT_V2') {
    for (const field of ['hardCost', 'knownDevelopmentBasis', 'projectedExitPerUnit', 'aggregateProjectedExit', 'preliminaryGrossSpread']) {
      for (const bound of ['low', 'central', 'high']) {
        const left = finite((before[field] as Values | null)?.[bound]); const right = finite((after[field] as Values | null)?.[bound]);
        if (left === null || right === null || left === right) continue;
        delta[`${field}.${bound}`] = Object.freeze({ before: left, after: right, absolute: round(right - left), percent: left === 0 ? null : round(((right - left) / Math.abs(left)) * 100, 4) });
      }
    }
  }
  return Object.freeze(delta);
}

export function detectsDealScenario(message: unknown, history: Array<{ role?: unknown; content?: unknown }> = []) {
  const text = String(message || '').toLowerCase(); if (/\b(save|salvar|guardar|compare|comparar|cenario|scenario|what if|e se|y si)\b/.test(text)) return true;
  if (detectScenarioStrategy(text)) return Object.keys(parseScenarioAssumptions(text, detectScenarioStrategy(text)!)).length > 0;
  return /^(?:and|e|y|now|agora).*(?:\$|%|rent|aluguel|rehab|reforma)/i.test(text) && history.length > 0;
}

export function resolveDealScenario(options: { message: unknown; history?: Array<{ role?: unknown; content?: unknown }>; propertyId?: unknown; userId?: unknown;
  canonicalStrategy?: unknown; canonicalFacts?: Values; storedAssumptions?: Values | null; now?: string; developmentEvidence?: LandDevelopmentEvidence | null }) {
  const history = Array.isArray(options.history) ? options.history.filter((item) => item?.role !== 'assistant') : [];
  const prior = history.slice(-5).map((item) => ({ strategy: detectScenarioStrategy(item.content, options.canonicalStrategy), content: item.content })).filter((item) => item.strategy);
  const strategy = detectScenarioStrategy(options.message, prior.at(-1)?.strategy || options.canonicalStrategy);
  if (!strategy) return Object.freeze({ state: 'NOT_SCENARIO' as const, scenario: null, previousScenario: null, comparison: null });
  const strategyHistory = prior.filter((item) => item.strategy === strategy);
  const scenarioStates = strategyHistory.reduce<Values[]>((states, item) => {
    const next = { ...(states.at(-1) || {}), ...parseScenarioAssumptions(item.content, strategy) };
    if (Object.keys(next).length) states.push(next);
    return states;
  }, []);
  let previousAssumptions = scenarioStates.at(-1) || {};
  let explicitComparisonLeft: Values | null = null;
  const compareRequest = /\b(?:compare|comparar|compara)\b/i.test(String(options.message || ''));
  if (compareRequest) {
    const labeled = strategyHistory.map((item) => ({
      label: String(item.content || '').match(/(?:scenario|cenario|cenário)\s*([a-e])/i)?.[1]?.toUpperCase() || '',
      assumptions: parseScenarioAssumptions(item.content, strategy),
    })).filter((item) => item.label && Object.keys(item.assumptions).length);
    const requested = [...String(options.message || '').matchAll(/\b([a-e])\b/gi)].map((match) => match[1].toUpperCase());
    const left = labeled.find((item) => item.label === requested[0]) || labeled.at(-2);
    const right = labeled.find((item) => item.label === requested[1]) || labeled.at(-1);
    if (left && right) {
      explicitComparisonLeft = left.assumptions;
      previousAssumptions = right.assumptions;
    } else if (scenarioStates.length >= 2) {
      explicitComparisonLeft = scenarioStates.at(-2) || null;
      previousAssumptions = scenarioStates.at(-1) || {};
    }
  }
  const parsedCurrent = parseScenarioAssumptions(options.message, strategy); const canonical = compactScenarioInputs(options.canonicalFacts || {});
  const storedInputs = compactScenarioInputs(options.storedAssumptions || {});
  const current = { ...parsedCurrent };
  if (finite(current.__relativePurchasePrice) !== null) {
    const priceKey = strategy === 'WHOLESALE' ? 'contractPrice' : 'purchasePrice'; const basePrice = finite(previousAssumptions[priceKey]) ?? finite(storedInputs[priceKey]) ?? finite(canonical[priceKey]);
    if (basePrice !== null) current[priceKey] = round(basePrice + Number(current.__relativePurchasePrice)); delete current.__relativePurchasePrice;
  }
  if (finite(current.__relativeRehab) !== null) {
    const baseRehab = finite(previousAssumptions.rehab) ?? finite(storedInputs.rehab) ?? finite(canonical.rehab);
    if (baseRehab !== null) current.rehab = round(baseRehab + Number(current.__relativeRehab));
    delete current.__relativeRehab;
  }
  const assumptions = Object.freeze({ ...canonical, ...storedInputs, ...previousAssumptions, ...current });
  let calculatedOutputs: Values = {}; const unresolvedInputs: string[] = [];
  const target = { targetROI: current.targetROI, targetDSCR: current.targetDSCR, targetMonthlyPI: current.targetMonthlyPI, targetBuyerBasis: current.targetBuyerBasis };
  const hasTarget = Object.values(target).some((value) => finite(value) !== null);
  try { calculatedOutputs = calculateScenario(strategy, assumptions, options.developmentEvidence, options.now);
    if (calculatedOutputs.model === 'LAND_DEVELOPMENT_V2' && (!calculatedOutputs.totalBuildingSqft || !assumptions.proposedPropertyType)) unresolvedInputs.push(String(calculatedOutputs.nextInput));
  } catch (error) { if (!hasTarget) unresolvedInputs.push(String(error instanceof Error ? error.message : error)); }
  if (hasTarget) try { calculatedOutputs = { ...calculatedOutputs, ...solveScenarioTarget(strategy, assumptions, target) }; }
  catch (error) { unresolvedInputs.push(String(error instanceof Error ? error.message : error)); }
  let previousOutputs: Values | null = null; const previousInput = explicitComparisonLeft || previousAssumptions;
  if (Object.keys(previousInput).length && (!compareRequest || explicitComparisonLeft)) try { previousOutputs = calculateScenario(strategy,
    { ...canonical, ...storedInputs, ...previousInput }, options.developmentEvidence, options.now); } catch { previousOutputs = null; }
  const status: ScenarioStatus = unresolvedInputs.length ? (Object.keys(assumptions).length ? 'PARTIAL' : 'DRAFT') : 'COMPLETE';
  const source = Object.fromEntries(Object.keys(assumptions).map((key) => [key, key in current || key in previousAssumptions ? 'USER_PROVIDED'
    : key in storedInputs ? 'USER_PROVIDED' : 'CANONICAL_PROPERTY_FACT'])) as DealScenario['source'];
  Object.keys(calculatedOutputs).forEach((key) => { (source as Record<string, 'CALCULATED'>)[key] = 'CALCULATED'; });
  const scenario: DealScenario = Object.freeze({ id: `scenario-${String(options.propertyId || 'property')}-${strategy.toLowerCase()}`, propertyId: String(options.propertyId || '') || null,
    userId: String(options.userId || '') || null, strategy, label: `Scenario ${strategy}`, createdAt: options.now || new Date().toISOString(), assumptions,
    calculatedOutputs: Object.freeze(calculatedOutputs), evidenceReferences: Object.freeze(Object.keys(canonical)), unresolvedInputs: Object.freeze(unresolvedInputs), source: Object.freeze(source), status });
  return Object.freeze({ state: status === 'COMPLETE' ? 'CALCULATED' as const : 'INCOMPLETE' as const, scenario, previousScenario: previousOutputs,
    comparison: compareScenarioOutputs(previousOutputs, calculatedOutputs), providerCalls: 0, arithmeticSource: 'DETERMINISTIC_SCENARIO_ENGINE' });
}

const locale = (language: string) => language === 'pt' ? 'pt-BR' : language === 'es' ? 'es-US' : 'en-US';
const money = (value: number, language: string) => new Intl.NumberFormat(locale(language), { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
const OUTPUT_LABELS: Record<string, Record<string, string>> = {
  pt: { purchasePrice: 'Preço', downPaymentAmount: 'Entrada', financedPrincipal: 'Valor financiado', annualInterestRate: 'Juros anuais', monthlyPI: 'Parcela mensal P&I',
    balloonBalance: 'Saldo no balloon', cashToEntry: 'Caixa inicial', grossScheduledRent: 'Aluguel bruto anual', effectiveGrossIncome: 'Receita efetiva', operatingExpenses: 'Despesas operacionais',
    NOI: 'NOI', capRate: 'Cap rate', annualCashFlow: 'Fluxo de caixa anual', cashFlowAfterDebt: 'Fluxo após dívida', cashOnCashReturn: 'Retorno sobre caixa', DSCR: 'DSCR',
    acquisitionBasis: 'Base de aquisição', allInCost: 'Custo total', projectedProfit: 'Lucro projetado', ROI: 'ROI', profitMargin: 'Margem', knownCashToEntry: 'Caixa inicial conhecido',
    debtAssumed: 'Dívida assumida', knownMonthlyCarry: 'Custo mensal conhecido', estimatedMonthlyCashFlow: 'Fluxo mensal estimado', grossAssignmentSpread: 'Margem bruta de cessão',
    estimatedNetAssignmentSpread: 'Margem líquida estimada', buyerBasis: 'Base do comprador', purchasePricePerAcre: 'Compra por acre', purchasePricePerLotSqft: 'Compra por sqft do lote',
    knownBasis: 'Base conhecida', knownBasisPerAcre: 'Base por acre', targetExitValue: 'Valor de saída-alvo', estimatedProfit: 'Lucro estimado', purchasePriceRequired: 'Preço necessário',
    downPaymentRequired: 'Entrada necessária', monthlyRentRequired: 'Aluguel mensal necessário', assignmentFeeRequired: 'Taxa de cessão necessária', rent: 'Aluguel', rehab: 'Reforma',
    exitValue: 'Valor de saída', contractPrice: 'Preço de contrato', estimatedBuyerPrice: 'Preço do comprador', assignmentFee: 'Taxa de cessão', targetExitPricePerAcre: 'Saída por acre' },
  es: { purchasePrice: 'Precio', downPaymentAmount: 'Pago inicial', financedPrincipal: 'Valor financiado', annualInterestRate: 'Interés anual', monthlyPI: 'Pago mensual P&I',
    balloonBalance: 'Saldo balloon', cashToEntry: 'Efectivo inicial', grossScheduledRent: 'Alquiler bruto anual', effectiveGrossIncome: 'Ingreso efectivo', operatingExpenses: 'Gastos operativos',
    NOI: 'NOI', capRate: 'Cap rate', annualCashFlow: 'Flujo anual', cashFlowAfterDebt: 'Flujo después de deuda', cashOnCashReturn: 'Retorno sobre efectivo', DSCR: 'DSCR',
    acquisitionBasis: 'Base de adquisición', allInCost: 'Costo total', projectedProfit: 'Beneficio proyectado', ROI: 'ROI', profitMargin: 'Margen', knownCashToEntry: 'Efectivo inicial conocido',
    debtAssumed: 'Deuda asumida', knownMonthlyCarry: 'Costo mensual conocido', estimatedMonthlyCashFlow: 'Flujo mensual estimado', grossAssignmentSpread: 'Margen bruto de cesión',
    estimatedNetAssignmentSpread: 'Margen neto estimado', buyerBasis: 'Base del comprador', purchasePricePerAcre: 'Compra por acre', purchasePricePerLotSqft: 'Compra por sqft del lote',
    knownBasis: 'Base conocida', knownBasisPerAcre: 'Base por acre', targetExitValue: 'Valor de salida objetivo', estimatedProfit: 'Beneficio estimado', purchasePriceRequired: 'Precio requerido',
    downPaymentRequired: 'Pago inicial requerido', monthlyRentRequired: 'Alquiler mensual requerido', assignmentFeeRequired: 'Tarifa de cesión requerida', rent: 'Alquiler', rehab: 'Rehabilitación',
    exitValue: 'Valor de salida', contractPrice: 'Precio de contrato', estimatedBuyerPrice: 'Precio del comprador', assignmentFee: 'Tarifa de cesión', targetExitPricePerAcre: 'Salida por acre' },
  en: { purchasePrice: 'Price', downPaymentAmount: 'Down payment', financedPrincipal: 'Financed principal', annualInterestRate: 'Annual interest', monthlyPI: 'Monthly P&I',
    balloonBalance: 'Balloon balance', cashToEntry: 'Cash to entry', grossScheduledRent: 'Gross scheduled rent', effectiveGrossIncome: 'Effective gross income', operatingExpenses: 'Operating expenses',
    NOI: 'NOI', capRate: 'Cap rate', annualCashFlow: 'Annual cash flow', cashFlowAfterDebt: 'Cash flow after debt', cashOnCashReturn: 'Cash-on-cash return', DSCR: 'DSCR',
    acquisitionBasis: 'Acquisition basis', allInCost: 'All-in cost', projectedProfit: 'Projected profit', ROI: 'ROI', profitMargin: 'Profit margin', knownCashToEntry: 'Known cash to entry',
    debtAssumed: 'Debt assumed', knownMonthlyCarry: 'Known monthly carry', estimatedMonthlyCashFlow: 'Estimated monthly cash flow', grossAssignmentSpread: 'Gross assignment spread',
    estimatedNetAssignmentSpread: 'Estimated net assignment spread', buyerBasis: 'Buyer basis', purchasePricePerAcre: 'Purchase per acre', purchasePricePerLotSqft: 'Purchase per lot sqft',
    knownBasis: 'Known basis', knownBasisPerAcre: 'Known basis per acre', targetExitValue: 'Target exit value', estimatedProfit: 'Estimated profit', purchasePriceRequired: 'Price required',
    downPaymentRequired: 'Down payment required', monthlyRentRequired: 'Monthly rent required', assignmentFeeRequired: 'Assignment fee required', rent: 'Rent', rehab: 'Rehab',
    exitValue: 'Exit value', contractPrice: 'Contract price', estimatedBuyerPrice: 'Buyer price', assignmentFee: 'Assignment fee', targetExitPricePerAcre: 'Exit per acre' },
};
const formattedScenarioValue = (key: string, value: number, language: string) => /rate|percent|roi|margin|caprate|return/i.test(key)
  ? `${value.toLocaleString(locale(language))}%` : key === 'DSCR' ? value.toLocaleString(locale(language)) : money(value, language);
const STRATEGY_LABELS: Record<string, Record<ScenarioStrategy, string>> = {
  pt: { SELLER_FINANCING: 'Financiamento pelo vendedor', BUY_AND_HOLD: 'Comprar e manter', FLIP: 'Reforma e revenda', SUB_TO: 'SUB-TO', WHOLESALE: 'Atacado', LAND: 'Terreno' },
  es: { SELLER_FINANCING: 'Financiación del vendedor', BUY_AND_HOLD: 'Comprar y mantener', FLIP: 'Rehabilitación y reventa', SUB_TO: 'SUB-TO', WHOLESALE: 'Mayoreo', LAND: 'Terreno' },
  en: { SELLER_FINANCING: 'Seller Financing', BUY_AND_HOLD: 'Buy & Hold', FLIP: 'Flip', SUB_TO: 'SUB-TO', WHOLESALE: 'Wholesale', LAND: 'Land' },
};
export function formatDealScenarioAnswer(resolution: ReturnType<typeof resolveDealScenario>, languageInput: unknown) {
  const language = ['pt', 'es'].includes(String(languageInput)) ? String(languageInput) : 'en'; const scenario = resolution.scenario;
  if (!scenario) return language === 'pt' ? 'Não identifiquei um cenário financeiro.' : language === 'es' ? 'No identifiqué un escenario financiero.' : 'I could not identify a financial scenario.';
  if (scenario.calculatedOutputs.model === 'LAND_DEVELOPMENT_V2') return formatLandDevelopmentAnswer(scenario.calculatedOutputs as ReturnType<typeof calculateLandDevelopmentScenario>, language);
  if (resolution.state !== 'CALCULATED') {
    const missingLabels: Record<string, Record<string, string>> = {
      pt: { PURCHASE_PRICE: 'preço de compra', RENT: 'aluguel', EXIT_VALUE: 'valor de saída', EXISTING_LOAN_BALANCE: 'saldo do financiamento', MONTHLY_PI: 'parcela mensal P&I', BUYER_PRICE: 'preço do comprador', CONTRACT_PRICE: 'preço de contrato', LAND_SIZE: 'área do terreno' },
      es: { PURCHASE_PRICE: 'precio de compra', RENT: 'alquiler', EXIT_VALUE: 'valor de salida', EXISTING_LOAN_BALANCE: 'saldo del préstamo', MONTHLY_PI: 'pago mensual P&I', BUYER_PRICE: 'precio del comprador', CONTRACT_PRICE: 'precio de contrato', LAND_SIZE: 'superficie del terreno' },
      en: { PURCHASE_PRICE: 'purchase price', RENT: 'rent', EXIT_VALUE: 'exit value', EXISTING_LOAN_BALANCE: 'existing loan balance', MONTHLY_PI: 'monthly P&I', BUYER_PRICE: 'buyer price', CONTRACT_PRICE: 'contract price', LAND_SIZE: 'land size' },
    };
    const missing = scenario.unresolvedInputs.map((code) => {
      const key = Object.keys(missingLabels[language]).find((candidate) => code.includes(candidate)); return key ? missingLabels[language][key] : (language === 'pt' ? 'premissas financeiras restantes' : language === 'es' ? 'supuestos financieros restantes' : 'remaining financial assumptions');
    }).filter((entry, index, entries) => entries.indexOf(entry) === index).join(', ');
    return language === 'pt' ? `Cenário parcial. Para calcular sem inventar premissas, ainda preciso de: ${missing}.`
      : language === 'es' ? `Escenario parcial. Para calcular sin inventar supuestos, todavía necesito: ${missing}.`
        : `Partial scenario. To calculate without inventing assumptions, I still need: ${missing}.`; }
  const labels = OUTPUT_LABELS[language];
  const assumptions = Object.entries(scenario.assumptions).filter(([key, value]) => labels[key] && typeof value === 'number').slice(0, 5)
    .map(([key, value]) => `- ${labels[key]}: ${formattedScenarioValue(key, Number(value), language)}`).join('\n');
  const outputs = Object.entries(scenario.calculatedOutputs).filter(([key, value]) => labels[key] && typeof value === 'number').slice(0, 6)
    .map(([key, value]) => `- ${labels[key]}: ${formattedScenarioValue(key, Number(value), language)}`).join('\n');
  const delta = Object.entries((resolution.comparison || {}) as Record<string, { absolute: number }>).filter(([key]) => labels[key]).slice(0, 3)
    .map(([key, value]) => `- ${labels[key]}: ${value.absolute > 0 ? '+' : ''}${formattedScenarioValue(key, value.absolute, language)}`).join('\n');
  const unchanged = resolution.previousScenario ? Object.entries(scenario.calculatedOutputs)
    .filter(([key, value]) => labels[key] && finite(value) !== null && finite(resolution.previousScenario?.[key]) === finite(value))
    .slice(0, 2).map(([key]) => labels[key]).join(', ') : '';
  const unresolved = (scenario.unresolvedInputs?.length || 0) > 0;
  const strategyLabel = STRATEGY_LABELS[language][scenario.strategy];
  if (language === 'pt') return `Cenário simulado — ${strategyLabel}\n\nPremissas\n${assumptions}\n\nResultados\n${outputs}${delta ? `\n\nImpacto versus o cenário anterior\n${delta}${unchanged ? `\n- Sem mudança: ${unchanged}` : ''}\nAs variações são direcionais; sem um objetivo informado, não são classificadas como melhores ou piores.` : ''}${unresolved ? '\n\nPermanece desconhecido: faltam premissas necessárias para concluir o cálculo.' : ''}\n\nPróximo teste útil: altere uma premissa para comparar o impacto.`;
  if (language === 'es') return `Escenario simulado — ${strategyLabel}\n\nSupuestos\n${assumptions}\n\nResultados\n${outputs}${delta ? `\n\nImpacto frente al escenario anterior\n${delta}${unchanged ? `\n- Sin cambios: ${unchanged}` : ''}\nLas variaciones son direccionales; sin un objetivo indicado, no se clasifican como mejores o peores.` : ''}${unresolved ? '\n\nAún se desconoce: faltan supuestos necesarios para completar el cálculo.' : ''}\n\nPróxima prueba útil: cambia un supuesto para comparar el impacto.`;
  return `Scenario simulated — ${strategyLabel}\n\nAssumptions\n${assumptions}\n\nResults\n${outputs}${delta ? `\n\nImpact versus the prior scenario\n${delta}${unchanged ? `\n- Unchanged: ${unchanged}` : ''}\nChanges are directional; without a stated objective, they are not classified as better or worse.` : ''}${unresolved ? '\n\nStill unknown: required assumptions are missing to complete the calculation.' : ''}\n\nNext useful test: change one assumption to compare the impact.`;
}

export function compareSellerScenarioCompatibility(before: Values, after: Values) {
  return compareSellerFinancingScenarios(calculateSellerFinancingScenario(before as SellerFinancingScenarioInput), calculateSellerFinancingScenario(after as SellerFinancingScenarioInput));
}
