export const CANONICAL_INVESTMENT_ANALYSIS_VERSION = 'CANONICAL_INVESTMENT_ANALYSIS_V1';

const list = (value) => Array.isArray(value) ? value : [];
const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const clamp = (value) => Math.max(0, Math.min(100, Math.round(value)));
const present = (value) => value !== null && value !== undefined && value !== '';
const normalize = (value) => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');

const LABELS = Object.freeze({
  en: {
    SELLER_FINANCING: ['Purchase basis', 'Down payment', 'Interest & payment', 'Term structure', 'Property security', 'Exit feasibility'],
    FLIP: ['Acquisition basis', 'Property condition', 'Rehab scope / cost', 'Recent-sales / ARV evidence', 'Holding / financing', 'Resale liquidity'],
    BUY_AND_HOLD: ['Purchase basis', 'Rent evidence', 'Operating expenses', 'Financing', 'Cash flow / cap rate', 'Market / vacancy context'],
    SUB_TO: ['Loan balance', 'Interest / payment', 'Arrears / reinstatement', 'Cash to entry', 'Operating carry', 'Exit strategy'],
    WHOLESALE: ['Acquisition discount', 'Market value evidence', 'Assignment spread', 'Buyer liquidity', 'Title / execution', 'Exit speed'],
    LAND: ['Allowed use / zoning', 'Parcel / lot evidence', 'Access', 'Utilities', 'Recent land-sale evidence', 'Title / survey feasibility'],
    GENERIC_SELL: ['Current market value evidence', 'Recent closed sales', 'Active competition', 'Market liquidity / DOM', 'Property / title readiness', 'Exit pricing'],
  },
  pt: {
    SELLER_FINANCING: ['Base de compra', 'Entrada', 'Juros e pagamento', 'Prazo e amortização', 'Garantia do imóvel', 'Viabilidade da saída'],
    FLIP: ['Base de aquisição', 'Condição do imóvel', 'Escopo / custo da reforma', 'Vendas recentes / evidência de ARV', 'Carregamento / financiamento', 'Liquidez de revenda'],
    BUY_AND_HOLD: ['Base de compra', 'Evidência de aluguel', 'Despesas operacionais', 'Financiamento', 'Fluxo de caixa / cap rate', 'Mercado / vacância'],
    SUB_TO: ['Saldo do financiamento', 'Juros / pagamento', 'Atrasos / regularização', 'Caixa de entrada', 'Custo de carregamento', 'Estratégia de saída'],
    WHOLESALE: ['Desconto de aquisição', 'Evidência de valor de mercado', 'Margem de cessão', 'Liquidez de compradores', 'Título / execução', 'Velocidade de saída'],
    LAND: ['Uso permitido / zoneamento', 'Evidência do lote / parcela', 'Acesso', 'Serviços públicos', 'Vendas recentes de terrenos', 'Título / levantamento / viabilidade'],
    GENERIC_SELL: ['Evidência de valor atual', 'Vendas recentes fechadas', 'Concorrência ativa', 'Liquidez / dias no mercado', 'Imóvel / título pronto', 'Preço de saída'],
  },
  es: {
    SELLER_FINANCING: ['Base de compra', 'Entrada', 'Interés y pago', 'Plazo y amortización', 'Garantía del inmueble', 'Viabilidad de salida'],
    FLIP: ['Base de adquisición', 'Condición del inmueble', 'Alcance / costo de reforma', 'Ventas recientes / ARV', 'Mantenimiento / financiación', 'Liquidez de reventa'],
    BUY_AND_HOLD: ['Base de compra', 'Evidencia de renta', 'Gastos operativos', 'Financiación', 'Flujo de caja / cap rate', 'Mercado / vacancia'],
    SUB_TO: ['Saldo del préstamo', 'Interés / pago', 'Atrasos / regularización', 'Efectivo de entrada', 'Costo operativo', 'Estrategia de salida'],
    WHOLESALE: ['Descuento de adquisición', 'Valor de mercado', 'Margen de asignación', 'Liquidez de compradores', 'Título / ejecución', 'Velocidad de salida'],
    LAND: ['Uso permitido / zonificación', 'Evidencia de lote / parcela', 'Acceso', 'Servicios públicos', 'Ventas recientes de terrenos', 'Título / levantamiento / viabilidad'],
    GENERIC_SELL: ['Valor de mercado actual', 'Ventas recientes cerradas', 'Competencia activa', 'Liquidez / días en mercado', 'Inmueble / título listo', 'Precio de salida'],
  },
});

const DIMENSION_FIELDS = Object.freeze({
  SELLER_FINANCING: [['askingPrice', 'assessedValue'], [], [], [], ['county', 'assessorId', 'assessedValue', 'ownerOccupied'], ['latestSalePrice', 'propertyType', 'askingPrice']],
  FLIP: [['askingPrice', 'assessedValue'], ['propertyFeatures'], ['rehab'], ['latestSalePrice'], ['askingPrice'], ['latestSalePrice', 'county']],
  BUY_AND_HOLD: [['askingPrice', 'assessedValue'], ['rentEstimate'], ['propertyFeatures'], [], ['capRate', 'rentEstimate'], ['county']],
  SUB_TO: [[], [], [], ['askingPrice'], ['annualPropertyTax'], ['latestSalePrice', 'county']],
  WHOLESALE: [['askingPrice', 'assessedValue'], ['latestSalePrice'], ['askingPrice', 'latestSalePrice'], ['county'], ['assessorId', 'ownerOccupied'], ['latestSaleDate']],
  LAND: [['zoning'], ['lotSizeSqft', 'assessorId', 'county', 'stateFips'], ['propertyFeatures'], ['propertyFeatures'], ['latestSalePrice', 'latestSaleDate'], ['assessorId', 'legalDescription', 'subdivision', 'assessedValue', 'annualPropertyTax']],
  GENERIC_SELL: [['assessedValue'], ['latestSalePrice', 'latestSaleDate'], [], ['county'], ['assessorId', 'ownerOccupied'], ['askingPrice', 'assessedValue']],
});
const DIMENSION_REQUIREMENTS = Object.freeze({
  SELLER_FINANCING: [['acquisition_price'], ['down_payment'], ['interest_rate'], ['term_months', 'amortization_months', 'balloon_months'], ['ownership', 'property_tax'], ['market_evidence']],
  FLIP: [['acquisition_price'], ['property_condition'], ['rehab_budget', 'renovation_scope'], ['exit_value_evidence'], ['holding_costs', 'loan_amount'], ['market_evidence']],
  BUY_AND_HOLD: [['acquisition_price'], ['rent_evidence'], ['operating_expenses', 'property_tax', 'insurance', 'management', 'maintenance'], ['loan_amount', 'interest_rate'], ['rent_evidence', 'operating_expenses'], ['vacancy', 'market_evidence']],
  SUB_TO: [['existing_loan_balance'], ['interest_rate', 'monthly_pi_payment'], ['arrears', 'reinstatement'], ['cash_to_seller'], ['property_tax', 'insurance', 'maintenance'], ['market_evidence']],
  WHOLESALE: [['acquisition_price'], ['market_evidence'], ['assignment_fee', 'closing_costs'], ['buyer_demand_evidence'], ['ownership', 'assignability'], ['market_evidence']],
  LAND: [['zoning', 'allowed_use'], ['lot_size'], ['road_access'], ['utilities'], ['land_sale_evidence'], ['ownership', 'survey', 'topography']],
  GENERIC_SELL: [['market_evidence'], ['land_sale_evidence'], ['market_evidence'], ['market_evidence'], ['ownership'], ['sale_price']],
});
const CRITERION_LABELS = Object.freeze({
  en: ['Target market', 'Price range', 'Property type', 'Strategy / objective'],
  pt: ['Mercado-alvo', 'Faixa de preço', 'Tipo de imóvel', 'Estratégia / objetivo'],
  es: ['Mercado objetivo', 'Rango de precio', 'Tipo de propiedad', 'Estrategia / objetivo'],
});

function resolvedStrategy(context) {
  const property = object(context?.propertyFacts);
  const explicit = normalize(context?.dealDecisionContext?.strategy || property.resolvedAnalysisStrategy || property.objective);
  const type = normalize(property.resolvedAnalysisPropertyType || property.type);
  if (type === 'LAND' || type === 'VACANT_LAND' || explicit === 'LAND') return 'LAND';
  return Object.hasOwn(DIMENSION_FIELDS, explicit) ? explicit : 'GENERIC_SELL';
}

function criterion(match, key, label) {
  const item = list(match?.reasons).find((candidate) => candidate?.key === key) || {};
  const status = ['matched', 'not_matched', 'not_evaluated'].includes(item.status) ? item.status : 'not_evaluated';
  const max = finite(item.maxPoints); const points = finite(item.points);
  return Object.freeze({ key, label, status, explanation: item.detail || null,
    points, maxPoints: max, score: status !== 'not_evaluated' && max > 0 ? clamp(((points || 0) / max) * 100) : null,
    source: 'CALCULATED' });
}

function fieldState(context, name) {
  const field = object(context?.propertyContext?.fields)?.[name];
  if (field && present(field.value)) return { name, status: field.status || 'UNKNOWN', value: field.value };
  const property = object(context?.propertyFacts);
  if (present(property[name])) return { name, status: 'USER_PROVIDED', value: property[name] };
  if (name === 'rehab' && present(property.rehab)) return { name, status: 'USER_PROVIDED', value: property.rehab };
  if (name === 'capRate' && present(property.capRate) && Number(property.capRate) !== 0) return { name, status: 'USER_PROVIDED', value: property.capRate };
  const provider = object(context?.providerMarketContext);
  if (name === 'rentEstimate' && present(object(provider.rentEstimate).value)) return { name, status: 'ESTIMATED', value: object(provider.rentEstimate).value };
  return { name, status: 'UNKNOWN', value: null };
}

const WEIGHT = Object.freeze({ VERIFIED_RECORD: 1, CALCULATED: .95, USER_PROVIDED: .8, ESTIMATED: .6, UNKNOWN: 0 });
function buildFocusMap(context, language) {
  const strategy = resolvedStrategy(context); const labels = (LABELS[language] || LABELS.en)[strategy] || LABELS.en.GENERIC_SELL;
  const fieldGroups = DIMENSION_FIELDS[strategy] || DIMENSION_FIELDS.GENERIC_SELL;
  const requirementGroups = DIMENSION_REQUIREMENTS[strategy] || DIMENSION_REQUIREMENTS.GENERIC_SELL;
  const decisionGaps = list(context?.dealDecisionContext?.decisionGaps);
  const scenario = object(context?.sellerFinancingScenario || object(context?.dealAssumptions).sellerFinancingScenario);
  const scenarioSatisfies = (requirement) => ({
    acquisition_price: present(scenario.purchasePrice), down_payment: present(scenario.downPaymentAmount) || present(scenario.downPaymentPercent),
    interest_rate: present(scenario.annualInterestRate), monthly_pi_payment: present(scenario.monthlyPI),
    term_months: present(scenario.balloonMonth), amortization_months: present(scenario.amortizationMonths),
    balloon_months: present(scenario.balloonMonth),
  })[requirement] === true;
  const missingRequirements = new Set(decisionGaps.map((item) => item?.field).filter((field) => field && !scenarioSatisfies(field)));
  const comparableCount = list(context?.comparableEvidence).filter((item) => ['PRIMARY', 'SUPPORTING'].includes(item?.valuationRole)).length;
  const dimensions = labels.map((label, index) => {
    const fields = fieldGroups[index] || [];
    const states = fields.map((name) => fieldState(context, name));
    if (/Recent (?:land-)?sale|Vendas recentes|Ventas recientes|Market value|Valor de mercado/i.test(label) && comparableCount) {
      states.push({ name: 'comparableEvidence', status: 'VERIFIED_RECORD', value: comparableCount });
    }
    const applicable = states.filter((item) => item.status !== 'NOT_APPLICABLE');
    const requirements = requirementGroups[index] || [];
    const supportingRequirements = requirements.filter((item) => scenarioSatisfies(item) || !missingRequirements.has(item));
    const missingRequirementList = requirements.filter((item) => missingRequirements.has(item));
    const evidenceReadiness = applicable.length ? (applicable.reduce((sum, item) => sum + (WEIGHT[item.status] || 0), 0) / applicable.length) * 100 : 0;
    const requirementReadiness = requirements.length ? (supportingRequirements.length / requirements.length) * 100 : evidenceReadiness;
    // Strategy requirements establish the decision gate; field provenance adds a
    // smaller evidence-quality adjustment so equal strategies still reflect the
    // actual record completeness of each property.
    const readiness = clamp(requirements.length ? (requirementReadiness * .8) + (evidenceReadiness * .2) : evidenceReadiness);
    const supportingEvidence = [...new Set([...supportingRequirements,
      ...applicable.filter((item) => present(item.value) && item.status !== 'UNKNOWN').map((item) => item.name)])];
    const missingEvidence = [...new Set([...missingRequirementList,
      ...applicable.filter((item) => !present(item.value) || item.status === 'UNKNOWN').map((item) => item.name)])];
    const reason = supportingEvidence.length
      ? `${supportingEvidence.length} supporting input(s); ${missingEvidence.length} missing input(s).`
      : 'No supporting input is currently available.';
    return Object.freeze({ dimension: label, readiness, supportingEvidence: Object.freeze(supportingEvidence),
      missingEvidence: Object.freeze(missingEvidence), reason });
  });
  return Object.freeze({ strategy, semantics: 'STRATEGY_DECISION_READINESS_ONLY',
    note: language === 'pt' ? 'As barras representam a prontidão da decisão com base nas evidências disponíveis.'
      : language === 'es' ? 'Las barras representan la preparación de la decisión según la evidencia disponible.'
        : 'Bars represent decision readiness based on available evidence.', dimensions: Object.freeze(dimensions) });
}

export function buildCanonicalInvestmentAnalysis(context = {}, language = 'en') {
  const match = object(context?.matchContext);
  const locale = ['pt', 'es'].includes(language) ? language : 'en';
  const labels = CRITERION_LABELS[locale];
  const criteria = Object.freeze([
    criterion(match, 'market', labels[0]), criterion(match, 'price', labels[1]),
    criterion(match, 'property_type', labels[2]), criterion(match, 'strategy', labels[3]),
  ]);
  return Object.freeze({ version: CANONICAL_INVESTMENT_ANALYSIS_VERSION, semantics: 'PROFILE_FIT_AND_DECISION_READINESS',
    profileFit: Object.freeze({ score: finite(match.score), classification: match.classification || 'unavailable',
      calculable: Boolean(match.calculable), semantics: 'PROFILE_FIT_ONLY', criteria,
      targetMarket: criteria[0], priceRange: criteria[1], propertyType: criteria[2], strategy: criteria[3] }),
    focusMap: buildFocusMap(context, locale),
    evidenceSummary: Object.freeze({ ...(object(context?.evidenceSummary)) }),
    risks: Object.freeze(list(context?.risks).map((item) => Object.freeze({ ...item }))),
    decisionGaps: Object.freeze(list(context?.limitations)),
  });
}
