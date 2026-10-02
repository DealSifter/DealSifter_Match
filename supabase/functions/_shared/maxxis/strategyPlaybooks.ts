export type DealStrategy = 'FLIP' | 'BUY_AND_HOLD' | 'WHOLESALE' | 'SELLER_FINANCING'
  | 'SUB_TO' | 'LAND' | 'GENERIC_SELL';

export type DecisionCriticality = 'CRITICAL' | 'IMPORTANT' | 'SUPPORTING' | 'OPTIONAL';

export type StrategyRequirement = Readonly<{
  key: string;
  criticality: DecisionCriticality;
  source: 'PROVIDER' | 'USER' | 'CALCULATED';
  unlocks: string;
}>;

export type StrategyPlaybook = Readonly<{
  strategy: DealStrategy;
  requirements: readonly StrategyRequirement[];
  residentialArvApplicable: boolean;
}>;

const requirement = (key: string, criticality: DecisionCriticality,
  source: StrategyRequirement['source'], unlocks: string): StrategyRequirement =>
  Object.freeze({ key, criticality, source, unlocks });

const PLAYBOOKS: Readonly<Record<DealStrategy, StrategyPlaybook>> = Object.freeze({
  FLIP: Object.freeze({ strategy: 'FLIP', residentialArvApplicable: true, requirements: Object.freeze([
    requirement('acquisition_price', 'CRITICAL', 'USER', 'BASE_COST'),
    requirement('exit_value_evidence', 'CRITICAL', 'PROVIDER', 'EXIT_SPREAD'),
    requirement('rehab_budget', 'CRITICAL', 'USER', 'BASE_COST'),
    requirement('target_condition', 'IMPORTANT', 'USER', 'ARV_ELIGIBILITY'),
    requirement('renovation_scope', 'IMPORTANT', 'USER', 'REHAB_BENCHMARK_VALIDATION'),
    requirement('selling_costs', 'IMPORTANT', 'USER', 'NET_EXIT_SCENARIO'),
    requirement('holding_costs', 'IMPORTANT', 'USER', 'NET_EXIT_SCENARIO'),
    requirement('financing_terms', 'SUPPORTING', 'USER', 'NET_RETURN_SCENARIO'),
  ]) }),
  BUY_AND_HOLD: Object.freeze({ strategy: 'BUY_AND_HOLD', residentialArvApplicable: false, requirements: Object.freeze([
    requirement('acquisition_price', 'CRITICAL', 'USER', 'COST_BASIS'),
    requirement('rent_evidence', 'CRITICAL', 'PROVIDER', 'NOI'),
    requirement('operating_expenses', 'CRITICAL', 'USER', 'NOI'),
    requirement('vacancy', 'IMPORTANT', 'USER', 'EFFECTIVE_GROSS_INCOME'),
    requirement('property_tax', 'IMPORTANT', 'PROVIDER', 'NOI'),
    requirement('insurance', 'IMPORTANT', 'USER', 'NOI'),
    requirement('management', 'SUPPORTING', 'USER', 'NOI'),
    requirement('maintenance', 'SUPPORTING', 'USER', 'NOI'),
    requirement('hoa', 'OPTIONAL', 'USER', 'NOI'),
    requirement('financing_terms', 'IMPORTANT', 'USER', 'CASH_FLOW'),
  ]) }),
  WHOLESALE: Object.freeze({ strategy: 'WHOLESALE', residentialArvApplicable: false, requirements: Object.freeze([
    requirement('acquisition_price', 'CRITICAL', 'USER', 'ASSIGNMENT_SPREAD'),
    requirement('disposition_price', 'CRITICAL', 'USER', 'ASSIGNMENT_SPREAD'),
    requirement('buyer_demand_evidence', 'CRITICAL', 'PROVIDER', 'DISPOSITION_CONFIDENCE'),
    requirement('assignability', 'IMPORTANT', 'USER', 'EXECUTION_FEASIBILITY'),
    requirement('assignment_fee', 'IMPORTANT', 'USER', 'ASSIGNMENT_SPREAD'),
    requirement('closing_costs', 'SUPPORTING', 'USER', 'NET_ASSIGNMENT_SCENARIO'),
  ]) }),
  SELLER_FINANCING: Object.freeze({ strategy: 'SELLER_FINANCING', residentialArvApplicable: false, requirements: Object.freeze([
    requirement('sale_price', 'CRITICAL', 'USER', 'FINANCED_PRINCIPAL'),
    requirement('down_payment', 'CRITICAL', 'USER', 'FINANCED_PRINCIPAL'),
    requirement('interest_rate', 'CRITICAL', 'USER', 'PAYMENT_SCHEDULE'),
    requirement('term_months', 'CRITICAL', 'USER', 'PAYMENT_SCHEDULE'),
    requirement('amortization_months', 'IMPORTANT', 'USER', 'PAYMENT_SCHEDULE'),
    requirement('balloon_months', 'IMPORTANT', 'USER', 'BALLOON_EXPOSURE'),
  ]) }),
  SUB_TO: Object.freeze({ strategy: 'SUB_TO', residentialArvApplicable: false, requirements: Object.freeze([
    requirement('existing_loan_balance', 'CRITICAL', 'USER', 'DEBT_ASSUMED'),
    requirement('monthly_pi_payment', 'CRITICAL', 'USER', 'MONTHLY_DEBT_OBLIGATION'),
    requirement('arrears', 'CRITICAL', 'USER', 'CASH_TO_ENTRY'),
    requirement('cash_to_seller', 'CRITICAL', 'USER', 'CASH_TO_ENTRY'),
    requirement('interest_rate', 'IMPORTANT', 'USER', 'DEBT_PROFILE'),
    requirement('property_tax', 'IMPORTANT', 'PROVIDER', 'OPERATING_CARRY'),
    requirement('insurance', 'IMPORTANT', 'USER', 'OPERATING_CARRY'),
    requirement('reinstatement', 'IMPORTANT', 'USER', 'CASH_TO_ENTRY'),
    requirement('closing_costs', 'SUPPORTING', 'USER', 'CASH_TO_ENTRY'),
  ]) }),
  LAND: Object.freeze({ strategy: 'LAND', residentialArvApplicable: false, requirements: Object.freeze([
    requirement('lot_size', 'CRITICAL', 'PROVIDER', 'LAND_UNIT_PRICE'),
    requirement('zoning', 'CRITICAL', 'PROVIDER', 'ALLOWED_USE'),
    requirement('allowed_use', 'CRITICAL', 'PROVIDER', 'DEVELOPMENT_FEASIBILITY'),
    requirement('road_access', 'IMPORTANT', 'PROVIDER', 'DEVELOPMENT_FEASIBILITY'),
    requirement('utilities', 'IMPORTANT', 'PROVIDER', 'DEVELOPMENT_FEASIBILITY'),
    requirement('survey', 'IMPORTANT', 'USER', 'BOUNDARY_CONFIDENCE'),
    requirement('topography', 'SUPPORTING', 'PROVIDER', 'SITE_FEASIBILITY'),
    requirement('ownership', 'IMPORTANT', 'PROVIDER', 'TITLE_REVIEW'),
    requirement('land_sale_evidence', 'CRITICAL', 'PROVIDER', 'MARKET_CONTEXT'),
    requirement('development_assumptions', 'SUPPORTING', 'USER', 'DEVELOPMENT_SCENARIO'),
  ]) }),
  GENERIC_SELL: Object.freeze({ strategy: 'GENERIC_SELL', residentialArvApplicable: false, requirements: Object.freeze([
    requirement('sale_price', 'CRITICAL', 'USER', 'DISPOSITION_SCENARIO'),
    requirement('market_evidence', 'CRITICAL', 'PROVIDER', 'PRICE_POSITIONING'),
    requirement('selling_costs', 'IMPORTANT', 'USER', 'NET_PROCEEDS'),
    requirement('property_condition', 'IMPORTANT', 'USER', 'MARKETABILITY_REVIEW'),
  ]) }),
});

const normalize = (value: unknown) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');

export function resolveDealStrategy(input: {
  propertyType?: unknown;
  objective?: unknown;
  strategies?: unknown;
  rehab?: unknown;
} = {}): DealStrategy {
  const propertyType = normalize(input.propertyType);
  if (/\b(land|lot|vacant)\b/.test(propertyType)) return 'LAND';
  const candidates = [input.objective, ...(Array.isArray(input.strategies) ? input.strategies : [])]
    .map(normalize).filter(Boolean).join(' | ');
  if (/\b(sub to|subject to|subto)\b/.test(candidates)) return 'SUB_TO';
  if (/\b(seller financ\w*|owner financ\w*|owner carry)\b/.test(candidates)) return 'SELLER_FINANCING';
  if (/\b(wholesale|assignment)\b/.test(candidates)) return 'WHOLESALE';
  if (/\b(buy and hold|buy hold|rental|hold)\b/.test(candidates)) return 'BUY_AND_HOLD';
  if (/\b(flip|fix and flip|rehab and sell)\b/.test(candidates)) return 'FLIP';
  if (/\b(sell|disposition)\b/.test(candidates) && Number(input.rehab) > 0) return 'FLIP';
  return 'GENERIC_SELL';
}

export function getStrategyPlaybook(strategy: DealStrategy): StrategyPlaybook {
  return PLAYBOOKS[strategy] || PLAYBOOKS.GENERIC_SELL;
}

export const STRATEGY_PLAYBOOKS = PLAYBOOKS;
