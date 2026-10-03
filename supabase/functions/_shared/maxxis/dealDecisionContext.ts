import {
  getStrategyPlaybook,
  resolveDealStrategy,
  type DecisionCriticality,
  type DealStrategy,
  type StrategyRequirement,
} from './strategyPlaybooks.ts';
import { calculateLandUnitMetrics, parseCanonicalLotArea } from './landMetrics.ts';

type AnyRecord = Record<string, any>;
type Provenance = 'PROVIDER_VERIFIED' | 'USER_PROVIDED' | 'USER_ASSUMPTION' | 'CALCULATED' | 'MARKET_REFERENCE';

export type DecisionDatum = Readonly<{
  key: string;
  value: unknown;
  provenance: Provenance;
  source: string;
}>;

export type DecisionGap = Readonly<{
  code: string;
  field: string;
  criticality: DecisionCriticality;
  why: string;
  unlocks: string;
  actionCode: string;
  inputField: string | null;
  source: StrategyRequirement['source'];
}>;

export type DealDecisionContext = Readonly<{
  type: 'deal_decision_context';
  version: 'DEAL_DECISION_CONTEXT_V1';
  strategy: DealStrategy;
  verifiedEvidence: readonly DecisionDatum[];
  userAssumptions: readonly DecisionDatum[];
  calculatedMetrics: readonly DecisionDatum[];
  marketReferences: readonly DecisionDatum[];
  relationships: Readonly<Record<string, number | string | null>>;
  evidenceCoverage: Readonly<Record<string, { status: string; reason: string | null }>>;
  decisionGaps: readonly DecisionGap[];
  scenariosPossible: readonly Readonly<{ code: string; basis: string[] }>[];
  scenariosBlocked: readonly Readonly<{ code: string; reason: string; gapCodes: string[] }>[];
}>;

const record = (value: unknown): AnyRecord => value && typeof value === 'object' && !Array.isArray(value)
  ? value as AnyRecord : {};
const list = (value: unknown): any[] => Array.isArray(value) ? value : [];
const finite = (value: unknown) => value !== null && value !== undefined && value !== ''
  && Number.isFinite(Number(value)) ? Number(value) : null;
const text = (value: unknown) => String(value ?? '').trim();
const present = (value: unknown) => value !== null && value !== undefined && value !== '';

function field(context: AnyRecord, key: string) {
  return record(record(context.propertyContext).fields)[key] || {};
}

function fact(snapshot: AnyRecord, context: AnyRecord, keys: string[]) {
  const property = record(snapshot.propertyFacts);
  for (const key of keys) {
    if (present(property[key])) return property[key];
    const contextField = field(context, key);
    if (present(contextField.value)) return contextField.value;
  }
  return null;
}

function metricValue(metrics: AnyRecord, key: string) {
  const metric = record(metrics[key]);
  return metric.calculable === false ? null : finite(metric.value);
}

function datum(key: string, value: unknown, provenance: Provenance, source: string): DecisionDatum {
  return Object.freeze({ key, value, provenance, source });
}

function evidenceData(context: AnyRecord) {
  return Object.entries(record(record(context.propertyContext).fields))
    .filter(([, value]) => record(value).status === 'VERIFIED_RECORD' && present(record(value).value))
    .map(([key, value]) => datum(key, record(value).value, 'PROVIDER_VERIFIED',
      text(record(value).source) || 'PROPERTY_EVIDENCE'));
}

function evidenceCoverage(snapshot: AnyRecord) {
  const completeness = record(snapshot.evidenceCompleteness);
  const cache = record(snapshot.cacheStatus);
  const family = (key: string, cacheKey: string) => {
    const value = record(completeness[key]);
    return Object.freeze({
      status: text(value.status) || text(cache[cacheKey]) || 'NOT_REQUESTED',
      reason: text(value.reason) || null,
    });
  };
  return Object.freeze({
    property: family('property', 'property'),
    valuation: family('valuation', 'valuation'),
    sold: family('sold', 'sold'),
  });
}

function hasAssumption(assumptions: AnyRecord, keys: string[]) {
  return keys.some((key) => present(assumptions[key]) && assumptions[key] !== false);
}

function requirementAvailable(requirement: StrategyRequirement, values: AnyRecord) {
  const assumption = values.assumptions;
  const property = values.property;
  const context = values.context;
  const valuation = values.valuation;
  const comps = values.comps;
  const metrics = values.metrics;
  const map: Record<string, boolean> = {
    acquisition_price: values.price !== null,
    sale_price: values.price !== null || hasAssumption(assumption, ['salePrice']),
    exit_value_evidence: valuation.status === 'ARV_AVAILABLE' || valuation.status === 'ARV_LIMITED',
    rehab_budget: values.rehab !== null,
    target_condition: hasAssumption(assumption, ['targetCondition']),
    renovation_scope: hasAssumption(assumption, ['renovationScope']),
    selling_costs: hasAssumption(assumption, ['sellingCosts', 'sellingCostPercent']),
    holding_costs: hasAssumption(assumption, ['holdingCosts', 'holdingPeriodMonths']),
    loan_amount: hasAssumption(assumption, ['loanAmount']),
    rent_evidence: present(property.monthlyRent) || present(property.rent) || present(context.rentEvidence),
    operating_expenses: hasAssumption(assumption, ['operatingExpenses', 'noi']),
    vacancy: hasAssumption(assumption, ['vacancyRate']),
    property_tax: present(field(context, 'annualPropertyTax').value),
    insurance: hasAssumption(assumption, ['insurance']),
    management: hasAssumption(assumption, ['management']),
    maintenance: hasAssumption(assumption, ['maintenance']),
    hoa: present(property.hoa) || hasAssumption(assumption, ['hoa']),
    disposition_price: hasAssumption(assumption, ['dispositionPrice']),
    buyer_demand_evidence: present(context.buyerDemandEvidence),
    assignability: hasAssumption(assumption, ['assignability']),
    assignment_fee: hasAssumption(assumption, ['assignmentFee']),
    closing_costs: hasAssumption(assumption, ['closingCosts']),
    down_payment: hasAssumption(assumption, ['downPayment']),
    interest_rate: hasAssumption(assumption, ['interestRate']),
    term_months: hasAssumption(assumption, ['termMonths']),
    amortization_months: hasAssumption(assumption, ['amortizationMonths']),
    balloon_months: hasAssumption(assumption, ['balloonMonths']),
    existing_loan_balance: hasAssumption(assumption, ['existingLoanBalance']),
    monthly_pi_payment: hasAssumption(assumption, ['monthlyPiPayment']),
    arrears: hasAssumption(assumption, ['arrears']),
    cash_to_seller: hasAssumption(assumption, ['cashToSeller']),
    reinstatement: hasAssumption(assumption, ['reinstatement']),
    lot_size: parseCanonicalLotArea(fact(values.snapshot, context, ['lotSizeSqft', 'lot'])).lotSizeSqft !== null,
    zoning: present(property.zoning) || present(field(context, 'zoning').value),
    allowed_use: present(property.allowedUse) || hasAssumption(assumption, ['allowedUse']),
    road_access: present(property.roadAccess) || hasAssumption(assumption, ['roadAccess']),
    utilities: present(property.utilities) || hasAssumption(assumption, ['utilities']),
    survey: hasAssumption(assumption, ['survey']),
    topography: present(property.topography) || hasAssumption(assumption, ['topography']),
    ownership: present(field(context, 'ownershipRecordPresent').value),
    land_sale_evidence: comps.length > 0,
    development_assumptions: hasAssumption(assumption, ['developmentAssumptions']),
    market_evidence: comps.length > 0 || finite(record(valuation.providerEstimate).value) !== null,
    property_condition: hasAssumption(assumption, ['targetCondition']),
  };
  return map[requirement.key] === true;
}

const criticalityRank: Record<DecisionCriticality, number> = {
  CRITICAL: 0, IMPORTANT: 1, SUPPORTING: 2, OPTIONAL: 3,
};

function inputField(key: string) {
  if (key === 'target_condition' || key === 'property_condition') return 'target_condition';
  if (key === 'rehab_budget') return 'rehab_budget';
  if (key === 'renovation_scope') return 'renovationScope';
  return key.replace(/_([a-z])/g, (_, character) => character.toUpperCase());
}

function buildGaps(playbook: ReturnType<typeof getStrategyPlaybook>, values: AnyRecord) {
  return playbook.requirements
    .filter((requirement) => !requirementAvailable(requirement, values))
    .map((requirement) => Object.freeze({
      code: `${playbook.strategy}_${requirement.key}`,
      field: requirement.key,
      criticality: requirement.criticality,
      why: `${requirement.key}_required_for_${requirement.unlocks.toLowerCase()}`,
      unlocks: requirement.unlocks,
      actionCode: `RESOLVE_${requirement.key.toUpperCase()}`,
      inputField: inputField(requirement.key),
      source: requirement.source,
    }))
    .sort((left, right) => criticalityRank[left.criticality] - criticalityRank[right.criticality]
      || left.code.localeCompare(right.code));
}

function rehabBenchmarkResemblance(rehabPerSqft: number | null, options: any[]) {
  if (rehabPerSqft === null || !options.length) return null;
  const ranked = options.map((option) => {
    const rate = record(option?.rate);
    const low = finite(rate.low);
    const high = finite(rate.high);
    const average = finite(rate.average);
    const distance = low !== null && high !== null && rehabPerSqft >= low && rehabPerSqft <= high
      ? 0 : average === null ? Number.POSITIVE_INFINITY : Math.abs(rehabPerSqft - average);
    return { option, distance };
  }).sort((left, right) => left.distance - right.distance);
  const closest = ranked[0]?.option;
  if (!closest || !Number.isFinite(ranked[0]?.distance)) return null;
  return Object.freeze({
    scope: text(closest.scope),
    state: text(closest.state),
    lowPerSqft: finite(record(closest.rate).low),
    averagePerSqft: finite(record(closest.rate).average),
    highPerSqft: finite(record(closest.rate).high),
    classification: ranked[0].distance === 0 ? 'RESEMBLES_REFERENCE_RANGE' : 'CLOSEST_REFERENCE_CATEGORY',
    classificationOnly: true,
  });
}

export function buildDealDecisionContext(snapshotInput: unknown): DealDecisionContext {
  const snapshot = record(snapshotInput);
  const context = record(snapshot.dealIntelligence);
  const property = record(snapshot.propertyFacts);
  const valuation = record(context.valuationContext || snapshot.valuationEvidence);
  const metrics = record(record(context.dealMetrics || snapshot.dealMetrics).metrics);
  const rehabAnalysis = record(snapshot.rehabAnalysis);
  const gate = record(snapshot.evidenceCompletenessGate);
  const assumptions = { ...record(gate.assumptions), ...record(snapshot.dealAssumptions) };
  const benchmarkOptions = list(gate.benchmarkOptions);
  const comps = list(context.comparableEvidence || snapshot.comps);
  const price = finite(fact(snapshot, context, ['price', 'askingPrice']));
  const rehab = finite(rehabAnalysis.value ?? fact(snapshot, context, ['rehab']));
  const sqft = finite(fact(snapshot, context, ['sqft', 'livingAreaSqft']));
  const objective = fact(snapshot, context, ['objective']);
  const propertyType = fact(snapshot, context, ['type', 'propertyType']);
  const strategies = list(record(context.investorContext).strategies);
  const strategy = resolveDealStrategy({ propertyType, objective, strategies, rehab });
  const playbook = getStrategyPlaybook(strategy);
  const lotArea = parseCanonicalLotArea(
    fact(snapshot, context, ['lotSizeSqft', 'lot']) ?? property.lotSizeSqft,
  );
  const explicitAcres = finite(fact(snapshot, context, ['lotSizeAcres']));
  const canonicalLotArea = explicitAcres !== null && lotArea.lotSizeSqft === null
    ? parseCanonicalLotArea(`${explicitAcres} acres`) : lotArea;
  const landUnitMetrics = strategy === 'LAND'
    ? calculateLandUnitMetrics(price, canonicalLotArea) : null;
  const baseCost = price !== null && rehab !== null ? Math.round((price + rehab) * 100) / 100 : null;
  const rehabPerSqft = rehab !== null && sqft !== null && sqft > 0
    ? Math.round((rehab / sqft) * 100) / 100 : null;
  const benchmarkResemblance = !present(assumptions.targetCondition)
    ? rehabBenchmarkResemblance(rehabPerSqft, benchmarkOptions) : null;
  const providerEstimate = finite(record(valuation.providerEstimate).value);
  const assessedValue = finite(field(context, 'assessedValue').value);
  const latestSalePrice = finite(field(context, 'latestSalePrice').value);
  const reportedCapRate = metricValue(metrics, 'capRate') ?? finite(property.capRate);
  const noi = finite(assumptions.noi ?? property.noi);
  const calculatedCapRate = noi !== null && price !== null && price > 0
    ? Math.round((noi / price) * 10000) / 100 : null;
  const selectedComps = comps.filter((item) => item?.valuationRole === 'PRIMARY'
    || item?.valuationEligibility === 'INCLUDED');
  const supportingComps = comps.filter((item) => item?.valuationRole === 'SUPPORTING'
    || item?.valuationEligibility === 'SUPPORTING_ONLY');

  const userAssumptions = [
    price !== null ? datum('askingPrice', price, 'USER_ASSUMPTION', 'PROPERTY_RECORD') : null,
    rehab !== null ? datum('rehabBudget', rehab, 'USER_ASSUMPTION', text(rehabAnalysis.source) || 'PROPERTY_RECORD') : null,
    present(property.notes ?? property.description)
      ? datum('propertyNotes', property.notes ?? property.description, 'USER_PROVIDED', 'PROPERTY_CARD_NOTES') : null,
    ...Object.entries(assumptions).filter(([, value]) => present(value) && !Array.isArray(value))
      .map(([key, value]) => datum(key, value, 'USER_ASSUMPTION', 'DEAL_ASSUMPTIONS')),
  ].filter(Boolean) as DecisionDatum[];
  const calculatedMetrics = [
    baseCost !== null ? datum('baseCost', baseCost, 'CALCULATED', 'ASKING_PRICE_PLUS_REHAB') : null,
    rehabPerSqft !== null ? datum('rehabPerSqft', rehabPerSqft, 'CALCULATED', 'REHAB_DIVIDED_BY_LIVING_AREA') : null,
    metricValue(metrics, 'pricePerSqft') !== null
      ? datum('pricePerSqft', metricValue(metrics, 'pricePerSqft'), 'CALCULATED', 'DEAL_METRICS') : null,
    calculatedCapRate !== null ? datum('calculatedCapRate', calculatedCapRate, 'CALCULATED', 'NOI_DIVIDED_BY_PRICE') : null,
    landUnitMetrics?.pricePerLotSqft != null
      ? datum('pricePerLotSqft', landUnitMetrics?.pricePerLotSqft, 'CALCULATED', 'ASKING_PRICE_DIVIDED_BY_LOT_SQFT') : null,
    landUnitMetrics?.pricePerAcre != null
      ? datum('pricePerAcre', landUnitMetrics?.pricePerAcre, 'CALCULATED', 'ASKING_PRICE_DIVIDED_BY_LOT_ACRES') : null,
  ].filter(Boolean) as DecisionDatum[];
  const marketReferences = [
    providerEstimate !== null ? datum('providerEstimate', providerEstimate, 'MARKET_REFERENCE', 'PROVIDER_AVM_NOT_ARV') : null,
    reportedCapRate !== null ? datum('reportedCapRate', reportedCapRate, 'MARKET_REFERENCE', 'REPORTED_NOT_CALCULATED') : null,
    rehabAnalysis.benchmark ? datum('rehabBenchmark', rehabAnalysis.benchmark, 'MARKET_REFERENCE',
      text(rehabAnalysis.benchmark.source) || 'USER_CURATED_REHAB_BENCHMARK_2026') : null,
    benchmarkResemblance ? datum('rehabBenchmarkResemblance', benchmarkResemblance, 'MARKET_REFERENCE',
      'USER_CURATED_REHAB_BENCHMARK_2026_CLASSIFICATION_ONLY') : null,
    ...supportingComps.slice(0, 5).map((item) => datum(`supportingComp:${text(item.compIdentifier || item.address)}`,
      { address: item.address, salePrice: item.recordedSalePrice }, 'MARKET_REFERENCE', 'COMP_ENGINE_SUPPORTING_ONLY')),
  ].filter(Boolean) as DecisionDatum[];
  const values = { snapshot, property, context, valuation, metrics, assumptions, comps, price, rehab };
  const decisionGaps = buildGaps(playbook, values);
  const highestGap = decisionGaps[0] || null;
  const exitEvidenceAvailable = valuation.status === 'ARV_AVAILABLE' || valuation.status === 'ARV_LIMITED';
  const scenariosPossible = [
    baseCost !== null ? Object.freeze({ code: 'BASE_COST', basis: ['askingPrice', 'rehabBudget'] }) : null,
    rehabPerSqft !== null ? Object.freeze({ code: 'REHAB_INTENSITY', basis: ['rehabBudget', 'livingAreaSqft'] }) : null,
    calculatedCapRate !== null ? Object.freeze({ code: 'CALCULATED_CAP_RATE', basis: ['noi', 'askingPrice'] }) : null,
    strategy === 'LAND' && price !== null && canonicalLotArea.lotSizeSqft !== null
      ? Object.freeze({ code: 'LAND_UNIT_PRICE', basis: ['askingPrice', 'lotSizeSqft'] }) : null,
  ].filter(Boolean) as Array<Readonly<{ code: string; basis: string[] }>>;
  const scenariosBlocked = [
    strategy === 'FLIP' && !exitEvidenceAvailable
      ? Object.freeze({ code: 'EXIT_SPREAD', reason: 'EXIT_VALUE_EVIDENCE_UNAVAILABLE',
        gapCodes: decisionGaps.filter((gap) => gap.field === 'exit_value_evidence').map((gap) => gap.code) }) : null,
    strategy === 'BUY_AND_HOLD' && calculatedCapRate === null
      ? Object.freeze({ code: 'INCOME_PERFORMANCE', reason: 'NOI_NOT_CALCULABLE',
        gapCodes: decisionGaps.filter((gap) => ['rent_evidence', 'operating_expenses'].includes(gap.field)).map((gap) => gap.code) }) : null,
    highestGap ? Object.freeze({ code: `${strategy}_FULL_DECISION`, reason: highestGap.code,
      gapCodes: decisionGaps.slice(0, 3).map((gap) => gap.code) }) : null,
  ].filter(Boolean) as Array<Readonly<{ code: string; reason: string; gapCodes: string[] }>>;

  return Object.freeze({
    type: 'deal_decision_context',
    version: 'DEAL_DECISION_CONTEXT_V1',
    strategy,
    verifiedEvidence: Object.freeze(evidenceData(context)),
    userAssumptions: Object.freeze(userAssumptions),
    calculatedMetrics: Object.freeze(calculatedMetrics),
    marketReferences: Object.freeze(marketReferences),
    relationships: Object.freeze({
      askingPrice: price,
      rehabBudget: rehab,
      livingAreaSqft: sqft,
      baseCost,
      rehabPerSqft,
      rehabBenchmarkResemblance: benchmarkResemblance ? text(benchmarkResemblance.scope) : null,
      providerEstimate,
      assessedValue,
      latestSalePrice,
      reportedCapRate,
      calculatedCapRate,
      lotSizeSqft: strategy === 'LAND' ? canonicalLotArea.lotSizeSqft : null,
      lotSizeAcres: strategy === 'LAND' ? canonicalLotArea.lotSizeAcres : null,
      pricePerLotSqft: landUnitMetrics?.pricePerLotSqft ?? null,
      pricePerAcre: landUnitMetrics?.pricePerAcre ?? null,
      selectedCompCount: selectedComps.length,
      supportingCompCount: supportingComps.length,
      arvStatus: text(valuation.status) || 'ARV_UNAVAILABLE',
    }),
    evidenceCoverage: evidenceCoverage(snapshot),
    decisionGaps: Object.freeze(decisionGaps),
    scenariosPossible: Object.freeze(scenariosPossible),
    scenariosBlocked: Object.freeze(scenariosBlocked),
  });
}
