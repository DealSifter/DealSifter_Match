import { calculateScenario, detectScenarioStrategy, type ScenarioStrategy } from './scenarioEngine.ts';
import { normalizeTargetCondition, classifyAnalysisApplicability } from './analysisApplicability.ts';
import { FINANCIAL_INPUT_FIELDS, normalizeFinancialInputs } from './financialInputContract.ts';
import { toKnownFiniteNumber } from './canonicalFactSemantics.ts';
import { ASSISTED_PARAMETERS, costResolutionPlan } from './unknownInputResolution.ts';

type Values = Record<string, any>;
export const COMPLETION_VERSION = 'R3_COMPLETION_V1';
export const COMPLETION_FIELDS: Record<string, { label: string; pt: string; es: string; cadence: string; unit: string }> = {
  rent: { label: 'Monthly rent assumption', pt: 'Aluguel mensal do cenário', es: 'Alquiler mensual del escenario', cadence: 'MONTHLY', unit: 'USD' },
  propertyTax: { label: 'Annual property tax', pt: 'Imposto anual', es: 'Impuesto anual', cadence: 'ANNUAL', unit: 'USD' },
  insurance: { label: 'Annual insurance', pt: 'Seguro anual', es: 'Seguro anual', cadence: 'ANNUAL', unit: 'USD' },
  vacancyRate: { label: 'Vacancy (%)', pt: 'Vacância (%)', es: 'Vacancia (%)', cadence: 'ANNUAL', unit: 'PERCENT' },
  HOA: { label: 'Monthly HOA (0 if not applicable)', pt: 'HOA mensal (0 se não aplicável)', es: 'HOA mensual (0 si no aplica)', cadence: 'MONTHLY', unit: 'USD' },
  managementPercent: { label: 'Management (%) of effective income', pt: 'Administração (%) da receita efetiva', es: 'Administración (%) del ingreso efectivo', cadence: 'ANNUAL', unit: 'PERCENT' },
  maintenanceAmount: { label: 'Annual maintenance', pt: 'Manutenção anual', es: 'Mantenimiento anual', cadence: 'ANNUAL', unit: 'USD' },
  utilities: { label: 'Annual owner-paid utilities', pt: 'Serviços anuais pagos pelo proprietário', es: 'Servicios anuales pagados por el propietario', cadence: 'ANNUAL', unit: 'USD' },
  otherOperatingExpenses: { label: 'Other annual operating expenses', pt: 'Outras despesas operacionais anuais', es: 'Otros gastos operativos anuales', cadence: 'ANNUAL', unit: 'USD' },
  opexPercent: { label: 'Total OPEX (%) of effective income, including known expenses', pt: 'OPEX total (%) da receita efetiva, incluindo despesas conhecidas', es: 'OPEX total (%) del ingreso efectivo, incluidos gastos conocidos', cadence: 'ANNUAL', unit: 'PERCENT' },
  monthlyPI: { label: 'Monthly debt payment (0 only if explicitly unfinanced)', pt: 'Pagamento mensal da dívida (0 somente sem financiamento confirmado)', es: 'Pago mensual de deuda (0 solo sin financiación confirmada)', cadence: 'MONTHLY', unit: 'USD' },
  cashInvested: { label: 'Cash invested', pt: 'Capital investido', es: 'Capital invertido', cadence: 'ONE_TIME', unit: 'USD' },
  purchasePrice: { label: 'Purchase price', pt: 'Preço de aquisição', es: 'Precio de adquisición', cadence: 'ONE_TIME', unit: 'USD' },
  rehab: { label: 'Rehab budget', pt: 'Orçamento de reforma', es: 'Presupuesto de reforma', cadence: 'ONE_TIME', unit: 'USD' },
  exitValue: { label: 'Private exit-price assumption', pt: 'Premissa privada de preço de saída', es: 'Supuesto privado de precio de salida', cadence: 'ONE_TIME', unit: 'USD' },
  acquisitionCosts: { label: 'Acquisition costs', pt: 'Custos de aquisição', es: 'Costos de adquisición', cadence: 'ONE_TIME', unit: 'USD' },
  holdingCosts: { label: 'Total holding expenses until sale (US$)', pt: 'Manutenção: custo total até a venda (US$)', es: 'Gastos totales hasta la venta (US$)', cadence: 'ONE_TIME', unit: 'USD' },
  financingCosts: { label: 'Total financing charges: one-time charges and period interest (US$)', pt: 'Financiamento: encargos únicos e juros do período (US$)', es: 'Financiación: cargos únicos e intereses del período (US$)', cadence: 'ONE_TIME', unit: 'USD' },
  sellingCosts: { label: 'Total sale transaction expenses (US$)', pt: 'Venda: despesas totais da transação (US$)', es: 'Gastos totales de la transacción de venta (US$)', cadence: 'ONE_TIME', unit: 'USD' },
  existingLoanBalance: { label: 'Existing loan balance', pt: 'Saldo do financiamento existente', es: 'Saldo del préstamo existente', cadence: 'ONE_TIME', unit: 'USD' },
  reinstatement: { label: 'Reinstatement / arrears', pt: 'Regularização e atrasados', es: 'Restablecimiento / atrasos', cadence: 'ONE_TIME', unit: 'USD' },
  cashToSeller: { label: 'Cash to seller', pt: 'Pagamento ao vendedor', es: 'Efectivo al vendedor', cadence: 'ONE_TIME', unit: 'USD' },
  closingCosts: { label: 'Closing costs', pt: 'Custos de fechamento', es: 'Costos de cierre', cadence: 'ONE_TIME', unit: 'USD' },
  contractPrice: { label: 'Contract price', pt: 'Preço do contrato', es: 'Precio del contrato', cadence: 'ONE_TIME', unit: 'USD' },
  estimatedBuyerPrice: { label: 'Private buyer-price assumption', pt: 'Premissa privada do preço ao comprador', es: 'Supuesto privado del precio al comprador', cadence: 'ONE_TIME', unit: 'USD' },
  assignmentFee: { label: 'Assignment fee', pt: 'Taxa de cessão', es: 'Tarifa de cesión', cadence: 'ONE_TIME', unit: 'USD' },
  downPaymentAmount: { label: 'Down payment', pt: 'Entrada', es: 'Pago inicial', cadence: 'ONE_TIME', unit: 'USD' },
  annualInterestRate: { label: 'Annual interest (%)', pt: 'Juros anuais (%)', es: 'Interés anual (%)', cadence: 'ANNUAL', unit: 'PERCENT' },
  amortizationMonths: { label: 'Amortization (months)', pt: 'Amortização (meses)', es: 'Amortización (meses)', cadence: 'ONE_TIME', unit: 'MONTHS' },
  otherCashToSeller: { label: 'Other cash to seller', pt: 'Outros valores ao vendedor', es: 'Otro efectivo al vendedor', cadence: 'ONE_TIME', unit: 'USD' },
  ...ASSISTED_PARAMETERS,
};
const finite = toKnownFiniteNumber;
const object = (v: any): Values => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
export const completionLabel = (key: string, lang = 'en') => COMPLETION_FIELDS[key]?.[lang === 'pt' ? 'pt' : lang === 'es' ? 'es' : 'label'] || ({target_condition: lang === 'pt' ? 'Condição-alvo' : 'Target condition', opexMethod: lang === 'pt' ? 'Método de despesas operacionais' : 'Operating expense method', scenarioStrategy: lang === 'pt' ? 'Estratégia do cenário' : 'Scenario strategy'} as Values)[key] || key;

export function confirmedScenarioMetric(message: string) {
  const text = String(message).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/\b(what if|e se|y si|assuma|assume|change|alterar|simule|simulate|report|relatorio|pdf)\b/.test(text)) return null;
  return /\bnoi\b/.test(text) ? 'NOI' : /\bcap rate\b/.test(text) ? 'capRate' : /\broi\b/.test(text) ? 'ROI'
    : /\bdscr\b/.test(text) ? 'DSCR' : /cash.on.cash/.test(text) ? 'cashOnCashReturn' : /cash flow|fluxo de caixa|flujo de caja/.test(text) ? 'annualCashFlow' : null;
}

/** Presentation only: chat reads the same versioned engine output consumed by PDF. */
export function confirmedScenarioMetricAnswer(snapshot: Values, metric: string | null, language = 'en') {
  const scenario = snapshot?.dealAssumptions?.activeScenario;
  if (!metric || !snapshot?.dealAssumptions?.r3Completion || !scenario?.confirmed
    || scenario.propertyId !== snapshot.propertyId || scenario.version !== snapshot.analysisRevision
    || scenario.source?.[metric] !== 'CALCULATED' || finite(scenario.calculatedOutputs?.[metric]) === null) return null;
  const amount = Number(scenario.calculatedOutputs[metric]), percent = ['capRate', 'ROI', 'cashOnCashReturn'].includes(metric);
  const value = new Intl.NumberFormat(language === 'pt' ? 'pt-BR' : language === 'es' ? 'es-US' : 'en-US',
    metric === 'DSCR' || percent ? { maximumFractionDigits: 4 } : { style: 'currency', currency: 'USD' }).format(amount) + (percent ? '%' : '');
  return language === 'pt' ? `${metric} projetado: ${value}. Cenário privado, versão ${scenario.version}, calculado pelo ScenarioEngine a partir das entradas confirmadas. Não comprova desempenho atual.`
    : language === 'es' ? `${metric} proyectado: ${value}. Escenario privado, versión ${scenario.version}, calculado por ScenarioEngine con entradas confirmadas. No acredita desempeño actual.`
      : `Projected ${metric}: ${value}. Private scenario version ${scenario.version}, calculated by ScenarioEngine from confirmed inputs. This does not establish current performance.`;
}

/** The endpoint, not the client, stamps confirmation, provenance, identity and results. */
export function mergeConfirmedCompletion({ existing = {}, patch = {}, propertyId, userId, now, revision, interactionId = '' }: {
  existing?: Values; patch?: Values; propertyId: string; userId: string; now: string; revision: number; interactionId?: string;
}) {
  const previous = object(existing.r3Completion);
  const inputs = { ...object(previous.inputs) };
  const normalized = normalizeFinancialInputs(patch);
  for (const [key, value] of Object.entries(patch)) {
    if (ASSISTED_PARAMETERS[key]?.options) {
      if (!ASSISTED_PARAMETERS[key].options!.includes(String(value))) throw Error('INVALID_COMPLETION_OPTION');
    } else if (['opexMethod', 'scenarioStrategy'].includes(key)) {
      if (key === 'opexMethod' && !['ITEMIZED', 'AGGREGATE_EGI'].includes(String(value))) throw Error('INVALID_OPEX_METHOD');
      if (key === 'scenarioStrategy' && !detectScenarioStrategy('', value)) throw Error('INVALID_SCENARIO_STRATEGY');
    } else {
      const disposition = normalized.dispositions[key];
      if (!COMPLETION_FIELDS[key] && !Object.hasOwn(FINANCIAL_INPUT_FIELDS, key)) throw Error('INVALID_COMPLETION_FIELD');
      if (disposition?.reason && disposition.reason !== 'NOT_AN_OPERATING_FINANCIAL_INPUT') throw Error(disposition.reason);
      if (finite(value) === null || typeof value !== 'number' || value < 0 || value > (COMPLETION_FIELDS[key]?.unit === 'PERCENT' ? 100 : 1e9)) throw Error('INVALID_COMPLETION_VALUE');
      if (['rent', 'purchasePrice', 'exitValue', 'existingLoanBalance', 'contractPrice', 'estimatedBuyerPrice', 'amortizationMonths'].includes(key) && value === 0) throw Error('INVALID_POSITIVE_COMPLETION_VALUE');
    }
    const canonical = normalized.dispositions[key]?.key || key;
    const spec = COMPLETION_FIELDS[canonical] || (FINANCIAL_INPUT_FIELDS as Values)[key] || {};
    if (inputs[canonical]?.value === value && inputs[canonical]?.confirmed === true && !inputs[canonical]?.estimate) continue;
    inputs[canonical] = { value, confirmed: true, origin: canonical === 'rent' || canonical === 'opexPercent' || canonical === 'vacancyRate' ? 'ASSUMPTION' : 'USER_DECLARED',
      source: 'USER_PROVIDED', confirmedAt: now, currency: spec.unit === 'USD' ? 'USD' : null, unit: spec.unit || 'ENUM', cadence: spec.cadence || 'NOT_APPLICABLE', interactionId, version: revision };
  }
  // Selecting an alternative replaces its private counterpart, never a public fact.
  for (const [a, b] of [['maintenanceAmount', 'maintenancePercent'], ['managementAmount', 'managementPercent']]) {
    if (Object.hasOwn(patch, a)) delete inputs[b]; else if (Object.hasOwn(patch, b)) delete inputs[a];
  }
  // Currency is already expressed by unit=USD. Keep the interaction once per write,
  // rather than duplicating a long message ID for every parameter in the bounded context.
  for (const [key, entry] of Object.entries(inputs) as [string, Values][]) {
    const compact = { ...entry }; delete compact.currency; delete compact.interactionId; inputs[key] = compact;
  }
  return { ...existing, r3Completion: { ...previous, version: COMPLETION_VERSION, propertyId, userId, revision, inputs,
    lastInteractionId: interactionId || previous.lastInteractionId || '', updatedAt: now } };
}

export function buildReportPreflight({ reportType, property = {}, dealAssumptions = {}, targetCondition, revision = 0,
  userId = '', propertyId = '', evidence = {}, language = 'en', partialAccepted = false, now = new Date().toISOString() }: {
  reportType: string; property?: Values; dealAssumptions?: Values; targetCondition?: unknown; revision?: number;
  userId?: string; propertyId?: string; evidence?: Values; language?: string; partialAccepted?: boolean; now?: string;
}) {
  const stored = object(dealAssumptions.r3Completion), active = object(dealAssumptions.activeScenario);
  if (stored.propertyId && stored.propertyId !== propertyId || stored.userId && stored.userId !== userId
    || active.propertyId && active.propertyId !== propertyId || active.userId && active.userId !== userId) throw Error('SCENARIO_IDENTITY_MISMATCH');
  const inputs: Values = { ...object(stored.inputs) };
  // Existing explicitly confirmed scenarios remain usable. No text-history inference.
  if (active.confirmed === true) for (const [key, value] of Object.entries(object(active.assumptions))) {
    const canonical = normalizeFinancialInputs({ [key]: value }).dispositions[key]?.key || key;
    if (!inputs[canonical] && finite(value) !== null && active.source?.[key] === 'USER_PROVIDED') inputs[canonical] = { value, confirmed: true,
      origin: canonical === 'rent' ? 'ASSUMPTION' : 'USER_DECLARED', source: 'USER_PROVIDED', confirmedAt: active.confirmedAt || active.createdAt || null };
  }
  const resolution = costResolutionPlan(dealAssumptions, propertyId, revision);
  for (const [key, entry] of Object.entries(inputs)) if (entry.estimate) {
    const current = resolution.candidates[key];
    if (!current || current.value !== entry.value || Object.keys(current.basis).length !== Object.keys(entry.estimate.basis || {}).length
      || Object.entries(current.basis).some(([parameter, raw]) => {
        const before = entry.estimate.basis?.[parameter], currentBasis = raw as Values;
        return before?.value !== currentBasis.value || before?.confirmedAt !== currentBasis.confirmedAt;
      })) inputs[key] = { ...entry, status: 'STALE' };
  }
  const values: Values = Object.fromEntries(Object.entries(inputs).filter(([, v]) => v.confirmed === true && v.status !== 'STALE').map(([k, v]) => [k, v.value]));
  const sources: Values = Object.fromEntries(Object.keys(values).map(k => [k, 'USER_PROVIDED']));
  const fieldStates: Values = {};
  for (const [key, v] of Object.entries(inputs)) fieldStates[key] = { ...v, status: v.status === 'STALE' ? 'STALE' : v.confirmed ? ['ASSUMPTION', 'SYSTEM_ASSUMPTION'].includes(v.origin) ? 'AVAILABLE_ASSUMPTION' : 'AVAILABLE_USER_CONFIRMED' : 'MISSING' };
  for (const [key, entry] of Object.entries(object(stored.unknown))) if (!fieldStates[key]) fieldStates[key] = { ...object(entry), status: 'UNKNOWN' };
  if (values.opexMethod === 'ITEMIZED' && values.opexPercent !== undefined) {
    delete values.opexPercent; delete sources.opexPercent;
    fieldStates.opexPercent.status = 'NOT_APPLICABLE';
  }
  if (finite(values.purchasePrice) === null && finite(property.price) !== null && Number(property.price) > 0) {
    values.purchasePrice = Number(property.price); sources.purchasePrice = 'CANONICAL_PROPERTY_FACT';
  }
  // Consume usable evidence, keeping its original source, date and estimate semantics.
  for (const [key, domain] of [['propertyTax', 'propertyTax'], ['insurance', 'insurance'], ['HOA', 'hoa']]) {
    const item = evidence.financialEvidence?.inputs?.[domain];
    if (values[key] !== undefined || !item || item.value === null || ['CONFLICTED', 'UNAVAILABLE', 'NOT_APPLICABLE'].includes(item.analyticalUsability) || item.source?.freshness === 'STALE') continue;
    const amount = key === 'HOA' ? item.cadence === 'MONTHLY' ? item.value : finite(item.annualizedValue) === null ? null : item.annualizedValue / 12 : item.annualizedValue;
    if (finite(amount) !== null) { values[key] = amount; sources[key] = 'CANONICAL_PROPERTY_FACT'; fieldStates[key] = { value: amount,
      status: item.sourceClass === 'PUBLIC_RECORD' ? 'AVAILABLE_VERIFIED' : item.sourceClass === 'USER_PROVIDED_ACTUAL' ? 'AVAILABLE_USER_CONFIRMED' : 'AVAILABLE_ASSUMPTION',
      origin: item.sourceClass, source: item.source, date: item.source?.retrievedAt || null }; }
  }
  const strategy = detectScenarioStrategy('', values.scenarioStrategy || active.strategy || property.objective || property.strategy);
  const gaps: Values[] = [];
  const gap = (id: string, required: boolean, status = 'MISSING') => gaps.push({ id, label: completionLabel(id, language), status,
    sourceExpected: id === 'target_condition' ? 'USER_PROVIDED' : 'PRIVATE_SCENARIO', provenance: fieldStates[id]?.origin || null,
    required, dependencies: id === 'target_condition' ? ['ARV_ELIGIBILITY'] : ['SCENARIO_FINANCIALS'], resolvable: true,
    permittedMethods: id === 'opexMethod' ? ['ITEMIZED', 'AGGREGATE_EGI'] : [], lastConfirmation: inputs[id]?.confirmedAt || null });
  const requireFinancials = reportType === 'DEAL_INTELLIGENCE' && ['BUY_AND_HOLD', 'FLIP', 'SUB_TO', 'WHOLESALE', 'SELLER_FINANCING'].includes(strategy || '');
  if (reportType !== 'PROPERTY_RELEASE' && requireFinancials) {
    const required = strategy === 'FLIP' ? ['purchasePrice', 'exitValue', 'rehab', 'acquisitionCosts', 'holdingCosts', 'financingCosts', 'sellingCosts']
      : strategy === 'SUB_TO' ? ['existingLoanBalance', 'monthlyPI', 'reinstatement', 'cashToSeller', 'closingCosts', 'propertyTax', 'insurance', 'HOA', 'rent']
      : strategy === 'WHOLESALE' ? ['contractPrice', 'estimatedBuyerPrice', 'assignmentFee', 'closingCosts']
      : strategy === 'SELLER_FINANCING' ? ['purchasePrice', 'downPaymentAmount', 'annualInterestRate', 'amortizationMonths', 'closingCosts', 'otherCashToSeller']
      : ['purchasePrice', 'rent', 'vacancyRate', 'opexMethod', ...(values.opexMethod === 'ITEMIZED' ? ['propertyTax', 'insurance', 'HOA',
        values.managementAmount !== undefined ? 'managementAmount' : 'managementPercent', values.maintenancePercent !== undefined ? 'maintenancePercent' : 'maintenanceAmount', 'utilities', 'otherOperatingExpenses'] : values.opexMethod === 'AGGREGATE_EGI' ? ['opexPercent'] : [])];
    for (const key of required) if (values[key] === undefined) gap(key, true, fieldStates[key]?.status || 'MISSING');
  }
  const residential = classifyAnalysisApplicability(property, { targetCondition }).residentialArv === 'APPLICABLE';
  if (reportType === 'DEAL_INTELLIGENCE' && residential && !strategy) gap('scenarioStrategy', true);
  if (reportType === 'DEAL_INTELLIGENCE' && residential && !normalizeTargetCondition(targetCondition)) gap('target_condition', true);
  const limitations: string[] = [];
  const valuation = evidence.dealIntelligence?.valuationContext || evidence.valuationEvidence || {};
  const eligibleCount = Number.isSafeInteger(valuation.compsUsed) && valuation.compsUsed >= 0 ? valuation.compsUsed : 0;
  const supportedArv = normalizeTargetCondition(targetCondition) && eligibleCount >= 2 && valuation.range
    && ['ARV_AVAILABLE', 'ARV_LIMITED'].includes(valuation.status);
  if (reportType === 'DEAL_INTELLIGENCE' && residential && !supportedArv) limitations.push('ARV_REQUIRES_ELIGIBLE_RECORDED_SALES');
  let outputs: Values = {}, unresolved: string[] = [];
  if (strategy === 'SUB_TO' && values.rent !== undefined) { values.expectedRent = values.rent; sources.expectedRent = sources.rent; }
  if (reportType !== 'PROPERTY_RELEASE' && (requireFinancials || Object.keys(inputs).length) && strategy && strategy !== 'LAND'
    && (!['BUY_AND_HOLD', 'FLIP', 'SELLER_FINANCING'].includes(strategy) || finite(values.purchasePrice) !== null)
    ) {
    // A quoted transaction percentage is a candidate basis, not acceptance of the composed estimate.
    const engineInputs = { ...values };
    if (strategy === 'FLIP' && engineInputs.sellingCosts === undefined) delete engineInputs.sellingCostPercent;
    try { outputs = calculateScenario(strategy, engineInputs) as Values; unresolved = outputs.unresolvedInputs || []; }
    catch { unresolved = ['SCENARIO_INPUTS_INCOMPLETE']; }
  }
  if (outputs.operatingReadiness === 'BLOCKED_CONFLICT') gap('opexPercent', true, 'CONFLICT');
  if (requireFinancials && unresolved.includes('SCENARIO_INPUTS_INCOMPLETE') && !gaps.length) gap('scenarioStrategy', true, 'CONFLICT');
  if (requireFinancials && strategy === 'BUY_AND_HOLD' && values.monthlyPI === undefined) { gap('monthlyPI', false); limitations.push('DEBT_DEPENDENT_METRICS_UNAVAILABLE'); }
  if (requireFinancials && strategy === 'BUY_AND_HOLD' && values.cashInvested === undefined) { gap('cashInvested', false); limitations.push('CASH_ON_CASH_REQUIRES_CASH_INVESTED'); }
  const scenario = strategy === 'LAND' && active.confirmed === true ? { ...active, propertyId, userId, version: revision }
    : { ...active, id: active.id || `r3:${propertyId}`, propertyId, userId, strategy,
    confirmed: Object.values(inputs).some(v => v.confirmed), version: revision, confirmedAt: stored.updatedAt || active.confirmedAt || null,
    assumptions: values, calculatedOutputs: outputs, source: { ...sources, ...Object.fromEntries(Object.keys(outputs).map(k => [k, 'CALCULATED'])) },
    inputMetadata: inputs, unresolvedInputs: [...new Set([...unresolved, ...gaps.filter(g => g.required).map(g => g.id)])],
    missingInputLabels: gaps.filter(g => g.required).map(g => completionLabel(g.id, language)),
    partialDelivery: partialAccepted && gaps.length > 0,
    status: outputs.calculationStatus === 'COMPLETE' && !gaps.some(g => g.required) ? 'COMPLETE' : 'PARTIAL' };
  const requiredGaps = gaps.filter(g => g.required);
  const marketRent = evidence.marketRent?.evidence || evidence.providerMarketContext?.rentEstimate;
  const rentGap = gaps.find(g => g.id === 'rent');
  if (rentGap && marketRent?.status === 'AVAILABLE' && finite(marketRent.rent) !== null) {
    rentGap.candidate = { value: Number(marketRent.rent), origin: 'ESTIMATED', source: marketRent.provider,
      date: marketRent.retrievedAt || null, status: 'AVAILABLE_PROVIDER_ESTIMATE' };
    rentGap.status = 'AVAILABLE_PROVIDER_ESTIMATE';
  }
  const partial = limitations.length > 0 || gaps.length > 0;
  const conflict = gaps.some(g => g.status === 'CONFLICT');
  const status = reportType === 'PROPERTY_RELEASE' ? 'READY' : conflict ? 'NEEDS_CONFIRMATION' : requiredGaps.length && !partialAccepted ? 'NEEDS_INPUT'
    : partial && !partialAccepted ? 'PARTIAL_ALLOWED' : 'READY';
  return { version: COMPLETION_VERSION, reportType, propertyId, userId, revision, status, gaps,
    questions: (requiredGaps.length ? requiredGaps : gaps).slice(0, 3), missingUserInputs: requiredGaps.slice(0, 3).map(g => g.id),
    fields: fieldStates, scenario, limitations, eligibleSales: eligibleCount,
    partialAvailable: reportType !== 'PROPERTY_RELEASE' && !conflict,
    unknownResolution: { ...resolution, unknown: stored.unknown || {} },
    blockedEvidence: limitations.includes('ARV_REQUIRES_ELIGIBLE_RECORDED_SALES') ? [{ id: 'arv', status: 'BLOCKED_EXTERNAL_EVIDENCE',
      required: false, resolvable: false, reason: evidence.evidenceReasons?.recordedSales || 'NO_COVERAGE',
      sourceExpected: 'RECORDED_SOLD', dependencies: ['TARGET_CONDITION', 'ELIGIBLE_RECORDED_SALES'], attempts: ['CACHE'] }] : [],
    acquisition: { mode: 'CACHE_ONLY', attempted: ['DB', 'PRIVATE_CONFIRMED_CONTEXT', 'CACHE'], providerCalls: 0,
      blockedReason: 'NOT_REQUESTED', explanation: 'External acquisition requires separate consent, entitlement and Usage Guard authorization.' },
    generatedAt: now, partialAccepted, canGenerate: status === 'READY' };
}
