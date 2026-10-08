import { buildDealDecisionContext } from '../../../../supabase/functions/_shared/maxxis/dealDecisionContext.ts';
import { calculateScenario, compareScenarioOutputs, solveScenarioTarget } from '../../../../supabase/functions/_shared/maxxis/scenarioEngine.ts';
import { estimateRehabBenchmark2026, sanityCheckRehabAgainstBenchmark2026 } from '../../../../supabase/functions/_shared/maxxis/rehabCostBenchmarks2026.ts';
import { providerEstimateDivergence, RECENT_SALES_POLICY_V1 } from '../../../../supabase/functions/_shared/property-data/recentSalesMarketEstimate.ts';
import { DEALSIFTER_ARV_ENGINE_POLICY_V1 } from '../../../../supabase/functions/_shared/property-data/arvEngine.ts';

const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const list = (value) => Array.isArray(value) ? value : [];
const number = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
const positive = (value) => number(value) > 0;
const present = (value) => value !== null && value !== undefined && value !== '';
const locale = (language) => String(language || 'en').toLowerCase().split(/[-_]/)[0];
const hash = (value) => {
  let result = 2166136261;
  for (const char of JSON.stringify(value)) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  return (result >>> 0).toString(36);
};
const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().filter((key) => !['generatedAt', 'createdAt', 'updatedAt', 'requestId'].includes(key)).map((key) => [key, stable(value[key])])) : value;

const TERMS = {
  down_payment: ['entrada', 'down payment', 'entrada'], interest_rate: ['taxa de juros', 'interest rate', 'tasa de interés'],
  term_months: ['prazo', 'term', 'plazo'], amortization_months: ['amortização', 'amortization', 'amortización'],
  balloon_months: ['prazo do balloon', 'balloon term', 'plazo del balloon'], operating_expenses: ['despesas operacionais', 'operating expenses', 'gastos operativos'],
  arrears: ['valor em atraso/regularização', 'arrears/reinstatement amount', 'importe de atrasos/regularización'],
  reinstatement: ['valor de regularização', 'reinstatement amount', 'importe de regularización'], cash_to_seller: ['valor ao vendedor', 'cash to seller', 'pago al vendedor'],
  existing_loan_balance: ['saldo do financiamento', 'loan balance', 'saldo del préstamo'], monthly_pi_payment: ['parcela mensal', 'monthly payment', 'cuota mensual'],
  zoning: ['zoneamento', 'zoning', 'zonificación'], allowed_use: ['uso permitido', 'allowed use', 'uso permitido'],
  lot_size: ['área do terreno', 'parcel area', 'superficie del terreno'], road_access: ['acesso viário', 'road access', 'acceso vial'],
  utilities: ['infraestrutura de serviços', 'utilities', 'servicios'], land_sale_evidence: ['vendas recentes de terrenos', 'recent land sales', 'ventas recientes de terrenos'],
};

// Read only the currently selected property and already-loaded evidence. No acquisition occurs here.
export function resolveMaxxisProactiveContext({ property = {}, propertyId = property.id, messages = [], snapshot = null } = {}) {
  let loaded = object(snapshot);
  let latestScenario = null;
  let previousScenario = null;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const raw = object(messages[index]?.data);
    const data = object(raw.sourceData || raw);
    const candidate = object(data.intelligenceSnapshot || data.proactiveContext || data.snapshot);
    const id = data.propertyId || data.property?.id || candidate.propertyId || candidate.propertyFacts?.id || data.scenario?.propertyId;
    if (!id || String(id) !== String(propertyId)) continue;
    if (!Object.keys(loaded).length && Object.keys(candidate).length) loaded = candidate;
    if (data.scenario) {
      if (!latestScenario) latestScenario = data.scenario;
      else if (!previousScenario) previousScenario = data.scenario;
    }
  }
  const facts = { ...object(loaded.propertyFacts), ...property, id: propertyId };
  // Cached canonical facts remain authoritative within their snapshot; a changed card invalidates that snapshot.
  const stale = loaded.propertyFacts && ['price', 'sqft', 'type', 'objective', 'rehab'].some((key) =>
    present(property[key]) && present(loaded.propertyFacts[key]) && String(property[key]) !== String(loaded.propertyFacts[key]));
  const base = stale ? {} : loaded;
  if (stale) { latestScenario = null; previousScenario = null; }
  const assumptions = { ...object(base.dealAssumptions), ...object(property.dealAssumptions), ...object(latestScenario?.assumptions) };
  const benchmark = estimateRehabBenchmark2026({ state: facts.state, livingAreaSqft: facts.sqft, condition: assumptions.targetCondition || facts.targetCondition });
  const resolved = { ...base, propertyId, propertyFacts: facts, dealAssumptions: assumptions,
    rehabAnalysis: base.rehabAnalysis || { value: facts.rehab ?? facts.estimatedRehab, benchmark,
      sanityCheck: sanityCheckRehabAgainstBenchmark2026(facts.rehab ?? facts.estimatedRehab, benchmark) } };
  return { property: facts, snapshot: resolved, decisionContext: stale ? buildDealDecisionContext(resolved)
    : base.dealDecisionContext || buildDealDecisionContext(resolved), scenario: latestScenario || base.dealAssumptions?.activeScenario,
  previousScenario };
}

export function buildMaxxisProactiveTriggers({ property = {}, snapshot = {}, decisionContext, scenario, previousScenario,
  language = 'en', now = Date.now(), accountKey = '', intensity = 'BALANCED', threshold = DEALSIFTER_ARV_ENGINE_POLICY_V1.divergenceWarningRatio } = {}) {
  const propertyId = String(property.id || snapshot.propertyId || '');
  if (!propertyId || ['closed', 'sold', 'archived', 'inactive', 'deleted'].includes(String(property.status).toLowerCase())) return [];
  const lang = locale(language);
  const t = (pt, en, es) => lang === 'pt' ? pt : lang === 'es' ? es : en;
  const money = (value) => new Intl.NumberFormat(lang === 'pt' ? 'pt-BR' : lang === 'es' ? 'es-US' : 'en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  const percent = (ratio) => new Intl.NumberFormat(lang === 'pt' ? 'pt-BR' : lang === 'es' ? 'es-US' : 'en-US', { maximumFractionDigits: 1 }).format(Math.abs(ratio) * 100);
  const decision = decisionContext || buildDealDecisionContext(snapshot);
  const strategy = decision.strategy;
  const relationships = object(decision.relationships);
  const market = object(snapshot.providerMarketContext);
  const recent = object(snapshot.recentSalesMarketEstimate || market.recentSalesMarketEstimate);
  const assumptions = { ...object(snapshot.dealAssumptions), ...object(scenario?.assumptions) };
  const compare = (patches, basis = scenario) => {
    if (basis?.status !== 'COMPLETE') return {};
    try {
      const labels = { monthlyPI: t('P&I mensal', 'Monthly P&I', 'P&I mensual'), balloonBalance: t('Saldo do balloon', 'Balloon balance', 'Saldo del balloon'),
        interestPaidToBalloon: t('Juros até o balloon', 'Interest to balloon', 'Intereses hasta balloon'),
        projectedProfit: t('Lucro projetado', 'Projected profit', 'Beneficio proyectado'), profitMargin: t('Margem (%)', 'Margin (%)', 'Margen (%)'),
        NOI: 'NOI', capRate: 'Cap rate (%)', annualCashFlow: t('Fluxo de caixa anual', 'Annual cash flow', 'Flujo de caja anual') };
      const rows = patches.map((patch) => {
        const outputs = calculateScenario(basis.strategy, { ...basis.assumptions, ...patch });
        return Object.entries(labels).filter(([key]) => number(outputs[key]) !== null).map(([key, label]) =>
          `${label}: ${/Rate|Margin/.test(key) ? outputs[key] : money(outputs[key])} (${t('anterior', 'previous', 'anterior')}: ${/Rate|Margin/.test(key) ? basis.calculatedOutputs[key] : money(basis.calculatedOutputs[key])})`).join('\n');
      });
      return { localResponse: rows.join('\n\n') };
    } catch { return {}; }
  };
  const stateVersion = hash(stable({ propertyId, strategy, relationships, gaps: decision.decisionGaps, assumptions,
    recent, conflicts: snapshot.providerEvidence?.conflicts || snapshot.propertyEvidence?.evidence?.conflicts, scenario: scenario?.calculatedOutputs }));
  const triggers = [];
  const add = (type, priority, evidence, message, label, prompt, target = {}, strong = true) => {
    const version = hash(stable(evidence));
    const id = `${accountKey}:${propertyId}:${type}:${version}`;
    triggers.push({ id, code: 'CONTEXTUAL_INSIGHT', type, propertyId, entityId: propertyId, entityType: 'PROPERTY',
      source: 'canonical_context', priority, severity: priority === 'P0' ? 'IMPORTANT' : 'RELEVANT', reason: message, evidence: { ...evidence, propertyId, actionAvailable: true },
      message, generatedFromStateVersion: version, contextStateVersion: stateVersion, status: 'AVAILABLE', occurredAt: now, freshnessMs: 15 * 60_000, dedupeKey: id, strong,
      actions: [{ id: `${id}:accept`, code: target.inputField ? `DECISION_PROACTIVE_${type}` : `PROACTIVE_${type}`,
        type: target.inputField ? 'INPUT_REQUIRED' : type === 'PROPERTY_CONFLICT' ? 'CONFLICT_RESOLUTION' : 'COMPARISON', capability: 'contextual_intelligence', propertyId,
        generatedFromStateVersion: version, state: 'available', enabled: true, consumesOnExecution: true, confirmationRequired: false,
        label, reason: message, target: { propertyId, prompt, ...target } },
      { id: `${id}:dismiss`, code: 'DISMISS', type: 'INFORMATION', label: t('Agora não', 'Not now', 'Ahora no') }] });
  };
  const gaps = list(decision.decisionGaps);
  const conflict = gaps.find((gap) => String(gap.code).startsWith('EVIDENCE_CONFLICT_'));
  if (conflict) {
    const values = present(conflict.storedValue) && present(conflict.providerValue) ? `${conflict.storedValue} / ${conflict.providerValue}` : '';
    const field = /type/i.test(conflict.field) ? t('tipo do imóvel', 'property type', 'tipo de inmueble') : t('dados cadastrais', 'property records', 'datos del inmueble');
    const message = t(`Há uma divergência em ${field}${values ? ` (${values})` : ''} que pode alterar a análise. Quer revisar o conflito?`,
      `There is a conflict in ${field}${values ? ` (${values})` : ''} that may change the analysis. Review the conflict?`,
      `Hay una discrepancia en ${field}${values ? ` (${values})` : ''} que puede cambiar el análisis. ¿Revisamos el conflicto?`);
    add('PROPERTY_CONFLICT', 'P0', conflict, message, t('Revisar conflito', 'Review conflict', 'Revisar conflicto'), message);
    return triggers; // No valuation/scenario suggestion until the methodology conflict is resolved.
  }
  const sufficientSales = recent.status === 'AVAILABLE' && positive(recent.centralEstimate)
    && recent.providerAvmCompatibility !== 'QUARANTINED_FOR_TYPE_CONFLICT'
    && Number(recent.valuationCompCount) >= RECENT_SALES_POLICY_V1.minimumComparables
    && ['HIGH', 'MODERATE'].includes(recent.confidence);
  const avm = number(market.providerEstimate ?? relationships.providerEstimate);
  if (sufficientSales && positive(avm) && recent.providerAvmCompatibility !== 'QUARANTINED_FOR_TYPE_CONFLICT') {
    const divergence = providerEstimateDivergence(avm, recent);
    if (Math.abs(divergence) >= threshold) {
      const message = t(`Há uma divergência de ${percent(divergence)}% entre o AVM do provedor e a estimativa por vendas recentes. Quer comparar as evidências?`,
        `The provider AVM and recent-sales estimate differ by ${percent(divergence)}%. Compare the evidence?`,
        `El AVM del proveedor y la estimación por ventas recientes difieren un ${percent(divergence)}%. ¿Comparamos las evidencias?`);
      add('VALUATION_DIVERGENCE', 'P1', { avm, recent: recent.centralEstimate, count: recent.valuationCompCount, divergence }, message,
        t('Comparar evidências', 'Compare evidence', 'Comparar evidencias'), message, { localResponse: t(
          `AVM do provedor: ${money(avm)}. Estimativa por vendas recentes: ${money(recent.centralEstimate)}, baseada em ${recent.valuationCompCount} vendas dos últimos ${RECENT_SALES_POLICY_V1.maximumAgeDays} dias. Divergência: ${percent(divergence)}%. São referências com metodologias distintas; nenhuma é automaticamente correta, e nenhuma equivale ao ARV.`,
          `Provider AVM: ${money(avm)}. Recent-sales estimate: ${money(recent.centralEstimate)}, based on ${recent.valuationCompCount} sales within ${RECENT_SALES_POLICY_V1.maximumAgeDays} days. Divergence: ${percent(divergence)}%. These use different methodologies; neither is automatically correct and neither is ARV.`,
          `AVM del proveedor: ${money(avm)}. Estimación por ventas recientes: ${money(recent.centralEstimate)}, basada en ${recent.valuationCompCount} ventas de los últimos ${RECENT_SALES_POLICY_V1.maximumAgeDays} días. Divergencia: ${percent(divergence)}%. Las metodologías difieren; ninguna es automáticamente correcta ni equivale al ARV.`) });
    }
  }
  const asking = number(property.price ?? relationships.askingPrice);
  if (sufficientSales && positive(asking)) {
    const delta = (asking - recent.centralEstimate) / recent.centralEstimate;
    if (Math.abs(delta) >= threshold) {
      const direction = delta < 0 ? t('abaixo', 'below', 'por debajo') : t('acima', 'above', 'por encima');
      const message = t(`O preço pedido está ${percent(delta)}% ${direction} da estimativa por vendas recentes. Quer testar uma oferta?`,
        `The asking price is ${percent(delta)}% ${direction} the recent-sales estimate. Test an offer scenario?`,
        `El precio pedido está un ${percent(delta)}% ${direction} de la estimación por ventas recientes. ¿Probamos una oferta?`);
      add('ASKING_VS_MARKET', 'P1', { asking, central: recent.centralEstimate, range: recent.range, unitValue: recent.weightedUnitValue }, message,
        t('Testar oferta', 'Test offer', 'Probar oferta'), t('Quero testar um cenário de oferta com as vendas recentes disponíveis. Solicite meu preço de oferta e mantenha as premissas existentes.',
          'Test an offer scenario using available recent sales. Ask for my offer price and keep existing assumptions.', 'Probar una oferta con las ventas recientes disponibles. Pide mi precio de oferta y conserva los supuestos actuales.'));
    }
  }
  const rentReference = number(snapshot.rentalEvidence?.rentEstimate?.rent ?? market.rentEstimate?.rent ?? relationships.rentEstimate);
  const rentAssumption = number(assumptions.rent ?? assumptions.expectedRent ?? property.monthlyRent);
  if (strategy === 'BUY_AND_HOLD' && positive(rentReference) && positive(rentAssumption)) {
    const delta = (rentAssumption - rentReference) / rentReference;
    if (Math.abs(delta) >= threshold) add('RENT_DIVERGENCE', 'P1', { rentAssumption, rentReference },
      t(`Seu aluguel assumido difere ${percent(delta)}% da referência disponível. Quer comparar os cenários?`,
        `Your rent assumption differs ${percent(delta)}% from the available reference. Compare scenarios?`,
        `Tu supuesto de alquiler difiere un ${percent(delta)}% de la referencia disponible. ¿Comparamos escenarios?`),
      t('Comparar aluguéis', 'Compare rents', 'Comparar alquileres'),
      t(`Compare meu cenário atual com aluguel de ${rentReference}, mantendo as demais premissas. Não salve mudanças no imóvel.`,
        `Compare my current scenario with rent ${rentReference}, keeping other assumptions. Do not save property changes.`,
        `Compara mi escenario actual con alquiler ${rentReference}, manteniendo los otros supuestos. No guardes cambios en el inmueble.`), compare([{ rent: rentReference }]));
  }
  const check = snapshot.rehabAnalysis?.sanityCheck;
  if (strategy === 'FLIP' && check && snapshot.rehabAnalysis?.benchmark && check.classification !== 'WITHIN_REFERENCE_RANGE') add('REHAB_BENCHMARK', 'P1',
    { check, benchmark: snapshot.rehabAnalysis.benchmark },
    t(`O rehab equivale a ${money(check.actualRehabPerSqft)}/sqft e está fora da faixa de referência para ${snapshot.rehabAnalysis.benchmark.state}. A referência tem confiança baixa. Quer testar ±10%?`,
      `Rehab is ${money(check.actualRehabPerSqft)}/sqft, outside the reference range for ${snapshot.rehabAnalysis.benchmark.state}. The reference has low confidence. Test ±10%?`,
      `La rehabilitación equivale a ${money(check.actualRehabPerSqft)}/sqft y está fuera de la referencia para ${snapshot.rehabAnalysis.benchmark.state}. La referencia tiene confianza baja. ¿Probamos ±10%?`),
    t('Testar rehab', 'Test rehab', 'Probar rehabilitación'),
    t('Compare o cenário atual com rehab 10% menor e 10% maior, mantendo as demais premissas.',
      'Compare the current scenario with rehab 10% lower and 10% higher, keeping other assumptions.',
      'Compara el escenario actual con rehabilitación un 10% menor y un 10% mayor, manteniendo los otros supuestos.'),
    compare([{ rehab: Number(assumptions.rehab) * 0.9 }, { rehab: Number(assumptions.rehab) * 1.1 }]), false);

  const strategyFields = { SELLER_FINANCING: ['down_payment', 'interest_rate', 'amortization_months', 'balloon_months', 'term_months'],
    BUY_AND_HOLD: ['operating_expenses'], SUB_TO: ['existing_loan_balance', 'monthly_pi_payment', 'arrears', 'reinstatement', 'cash_to_seller'],
    LAND: ['zoning', 'allowed_use', 'lot_size', 'road_access', 'utilities', 'land_sale_evidence'] };
  const aliases = { down_payment: ['downPayment', 'downPaymentAmount', 'downPaymentPercent'], interest_rate: ['interestRate', 'annualInterestRate'],
    amortization_months: ['amortizationMonths', 'amortizationYears'], balloon_months: ['balloonMonths', 'balloonMonth', 'balloonYears'],
    term_months: ['termMonths', 'termYears', 'amortizationMonths', 'amortizationYears'], operating_expenses: ['operatingExpenses', 'noi'],
    arrears: ['arrears', 'reinstatement'], reinstatement: ['arrears', 'reinstatement'] };
  const gap = list(strategyFields[strategy]).map((field) => gaps.find((item) => item.field === field
    && !list(aliases[field]).some((key) => present(assumptions[key])))).find(Boolean);
  const holdReady = positive(asking) && positive(rentReference || rentAssumption) && (present(property.annualPropertyTax)
    || list(decision.verifiedEvidence).some((datum) => datum.key === 'annualPropertyTax'));
  if (gap && (strategy !== 'BUY_AND_HOLD' || holdReady) && !(scenario?.status === 'COMPLETE' && strategy === 'SELLER_FINANCING')) {
    const term = TERMS[gap.field]?.[lang === 'pt' ? 0 : lang === 'es' ? 2 : 1];
    const message = strategy === 'LAND' ? t(`Falta evidência de ${term}. Isso limita a análise de uso e viabilidade do terreno. Quer revisar?`,
      `Evidence of ${term} is missing. This limits land-use and feasibility analysis. Review it?`,
      `Falta evidencia de ${term}. Esto limita el análisis de uso y viabilidad del terreno. ¿La revisamos?`)
      : t(`Falta ${term} para avançar o cálculo desta estrutura. Quer informar agora?`,
        `${term} is missing to advance this calculation. Provide it now?`, `Falta ${term} para avanzar el cálculo de esta estructura. ¿Lo proporcionas ahora?`);
    add(`${strategy}_INPUT`, 'P1', { gap, strategy, assumptions }, message,
      t(`${gap.source === 'USER' ? 'Informar' : 'Revisar'} ${term}`, `${gap.source === 'USER' ? 'Provide' : 'Review'} ${term}`, `${gap.source === 'USER' ? 'Informar' : 'Revisar'} ${term}`),
      message, { inputField: gap.source === 'USER' ? gap.inputField : null, source: gap.source, unlocks: gap.unlocks });
  }
  if (scenario?.status === 'COMPLETE') {
    const outputs = object(scenario.calculatedOutputs);
    if (previousScenario?.status === 'COMPLETE' && previousScenario.strategy === scenario.strategy) {
      const comparison = compareScenarioOutputs(previousScenario.calculatedOutputs, outputs);
      const key = ['monthlyPI', 'projectedProfit', 'annualCashFlow', 'knownCashToEntry', 'estimatedProfit'].find((field) => {
        const before = number(previousScenario.calculatedOutputs?.[field]); const after = number(outputs[field]);
        return before !== null && after !== null && Math.abs(after - before) >= Math.max(100, Math.abs(before) * threshold);
      });
      if (key) {
        const labels = { monthlyPI: t('parcela', 'payment', 'cuota'), projectedProfit: t('lucro projetado', 'projected profit', 'beneficio proyectado'),
          annualCashFlow: t('fluxo de caixa anual', 'annual cash flow', 'flujo de caja anual'), knownCashToEntry: t('capital de entrada', 'cash to entry', 'capital de entrada'), estimatedProfit: t('lucro estimado', 'estimated profit', 'beneficio estimado') };
        const message = t(`A mudança de premissa alterou ${labels[key]} de ${money(previousScenario.calculatedOutputs[key])} para ${money(outputs[key])}. Quer comparar os cenários?`,
          `The assumption change moved ${labels[key]} from ${money(previousScenario.calculatedOutputs[key])} to ${money(outputs[key])}. Compare scenarios?`,
          `El cambio de supuesto modificó ${labels[key]} de ${money(previousScenario.calculatedOutputs[key])} a ${money(outputs[key])}. ¿Comparamos escenarios?`);
        add('SCENARIO_DELTA', 'P1', { key, comparison, before: previousScenario.assumptions, after: scenario.assumptions }, message,
          t('Comparar cenários', 'Compare scenarios', 'Comparar escenarios'), message, compare([scenario.assumptions], previousScenario));
      }
    }
    if (strategy === 'SELLER_FINANCING' && positive(outputs.monthlyPI) && number(outputs.balloonBalance) !== null && number(assumptions.annualInterestRate) >= 1) add('SELLER_FINANCING_COMPARISON', 'P2',
      { assumptions: scenario.assumptions, outputs }, t(`Com estes termos, o P&I é ${money(outputs.monthlyPI)} e o balloon é ${money(outputs.balloonBalance)}. Quer testar juros 1 ponto percentual menores?`,
        `These terms produce P&I of ${money(outputs.monthlyPI)} and a balloon of ${money(outputs.balloonBalance)}. Test interest 1 percentage point lower?`,
        `Estos términos producen P&I de ${money(outputs.monthlyPI)} y balloon de ${money(outputs.balloonBalance)}. ¿Probamos interés 1 punto porcentual menor?`),
      t('Comparar juros', 'Compare interest', 'Comparar interés'), t('Compare o cenário com taxa de juros 1 ponto percentual menor, mantendo as demais condições.',
        'Compare the scenario with interest 1 percentage point lower, keeping other terms.', 'Compara el escenario con interés 1 punto porcentual menor, manteniendo los otros términos.'),
      compare([{ annualInterestRate: assumptions.annualInterestRate - 1 }]), false);
    if (strategy === 'FLIP' && positive(scenario.assumptions?.exitValue) && number(outputs.profitMargin) !== null && outputs.profitMargin < 15) add('FLIP_MARGIN', 'P1', { assumptions: scenario.assumptions, outputs },
      t(`A margem projetada é ${outputs.profitMargin}%. Quer testar o preço máximo de compra para uma meta de 15%?`,
        `Projected margin is ${outputs.profitMargin}%. Test the maximum purchase price for a 15% target?`,
        `El margen proyectado es ${outputs.profitMargin}%. ¿Probamos el precio máximo de compra para una meta del 15%?`),
      t('Testar preço máximo', 'Test maximum price', 'Probar precio máximo'), t('Calcule o preço máximo de compra para margem de lucro de 15%, mantendo as premissas do cenário.',
        'Calculate the maximum purchase price for a 15% profit margin, keeping scenario assumptions.', 'Calcula el precio máximo de compra para un margen de beneficio del 15%, manteniendo los supuestos.'),
      { localResponse: t(`Preço máximo de compra para margem de 15%: ${money(solveScenarioTarget('FLIP', scenario.assumptions, { targetProfitMargin: 15 }).purchasePriceRequired)}. Demais premissas mantidas.`,
        `Maximum purchase price for a 15% margin: ${money(solveScenarioTarget('FLIP', scenario.assumptions, { targetProfitMargin: 15 }).purchasePriceRequired)}. Other assumptions unchanged.`,
        `Precio máximo de compra para margen del 15%: ${money(solveScenarioTarget('FLIP', scenario.assumptions, { targetProfitMargin: 15 }).purchasePriceRequired)}. Otros supuestos conservados.`) });
  }
  if (strategy === 'WHOLESALE' && positive(assumptions.contractPrice) && sufficientSales) add('WHOLESALE_ASSIGNMENT', 'P2', { contract: assumptions.contractPrice, recent: recent.centralEstimate },
    t('O preço de contrato e as vendas recentes permitem testar diferentes taxas de cessão. Quer simular?',
      'The contract price and recent sales support testing assignment fees. Simulate?', 'El precio de contrato y las ventas recientes permiten probar distintas comisiones de cesión. ¿Simulamos?'),
    t('Simular cessão', 'Simulate assignment', 'Simular cesión'), t('Quero simular diferentes assignment fees com o preço de contrato atual. Solicite as taxas para comparar.',
      'Simulate assignment fees using the current contract price. Ask for the fees to compare.', 'Simula comisiones de cesión con el precio de contrato actual. Pide las comisiones a comparar.'), {}, false);
  const fit = number(snapshot.matchScore?.score ?? snapshot.matchScore?.overallScore);
  if (fit !== null && fit < 40 && sufficientSales && positive(asking) && asking < recent.centralEstimate * (1 - threshold)) add('PROFILE_MISMATCH', 'P1',
    { fit, asking, central: recent.centralEstimate }, t('Este imóvel tem baixa aderência ao seu perfil, mas isso não mede a qualidade do negócio. O preço está abaixo da referência por vendas recentes. Quer avaliar os números?',
      'This property has low profile compatibility, which does not measure deal quality. Its price is below the recent-sales reference. Review the economics?',
      'Este inmueble tiene baja compatibilidad con tu perfil, lo que no mide la calidad del negocio. Su precio está por debajo de las ventas recientes. ¿Evaluamos los números?'),
    t('Analisar economia', 'Review economics', 'Evaluar números'), t('Avalie apenas a economia deste imóvel, separando compatibilidade do perfil da qualidade do negócio.',
      'Review only this property’s economics, separating profile compatibility from deal quality.', 'Evalúa solamente los números del inmueble, separando compatibilidad del perfil de calidad del negocio.'));
  const rank = { PROPERTY_CONFLICT: 0, SCENARIO_DELTA: 1, LAND_INPUT: 2, SELLER_FINANCING_INPUT: 3, PROFILE_MISMATCH: 4 };
  return triggers.filter((trigger) => trigger.priority !== 'P3' && (intensity === 'HIGH' || trigger.priority !== 'P2')
    && (intensity !== 'LOW' || trigger.priority === 'P0' || trigger.strong))
    .sort((a, b) => a.priority.localeCompare(b.priority) || (rank[a.type] ?? 10) - (rank[b.type] ?? 10));
}

export function selectMaxxisProactiveTrigger(input = {}, consumed = new Set()) {
  return buildMaxxisProactiveTriggers(input).find((trigger) => !consumed.has(trigger.dedupeKey)) || null;
}

// Reuse scenario arithmetic for explicit comparisons; never persist the proposed assumptions.
export function calculateMaxxisProactiveScenario(strategy, assumptions) {
  return calculateScenario(strategy, assumptions);
}

export function projectMaxxisProactiveSnapshot(snapshot = {}) {
  snapshot = object(snapshot);
  return Object.fromEntries(['propertyId', 'propertyFacts', 'dealDecisionContext', 'dealAssumptions', 'providerMarketContext',
    'recentSalesMarketEstimate', 'rehabAnalysis', 'matchScore', 'rentalEvidence', 'providerEvidence'].filter((key) => snapshot[key] !== undefined)
    .map((key) => [key, key === 'providerEvidence' ? { conflicts: snapshot[key]?.conflicts } : snapshot[key]]));
}
