import type { DealDecisionContext, DecisionGap } from './dealDecisionContext.ts';

type Language = 'en' | 'pt' | 'es';

const languageOf = (value: unknown): Language => {
  const language = String(value || '').slice(0, 2).toLowerCase();
  return language === 'pt' || language === 'es' ? language : 'en';
};
const localized = (language: Language, en: string, pt: string, es: string) =>
  language === 'pt' ? pt : language === 'es' ? es : en;
const money = (value: unknown, language: Language) => Number.isFinite(Number(value))
  ? new Intl.NumberFormat(language === 'pt' ? 'pt-BR' : language === 'es' ? 'es-US' : 'en-US', {
      style: 'currency', currency: 'USD', maximumFractionDigits: 0,
    }).format(Number(value))
  : '';
const decimal = (value: unknown, language: Language) => Number.isFinite(Number(value))
  ? new Intl.NumberFormat(language === 'pt' ? 'pt-BR' : language === 'es' ? 'es-US' : 'en-US', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(Number(value))
  : '';

const GAP_LABELS: Record<string, [string, string, string]> = {
  acquisition_price: ['acquisition price', 'preço de aquisição', 'precio de adquisición'],
  sale_price: ['sale price', 'preço de venda', 'precio de venta'],
  exit_value_evidence: ['confirmed exit-value evidence', 'evidências confirmadas de valor de saída', 'evidencia confirmada del valor de salida'],
  rehab_budget: ['rehabilitation budget', 'orçamento de reforma', 'presupuesto de reforma'],
  target_condition: ['target condition', 'condição-alvo', 'condición objetivo'],
  renovation_scope: ['renovation scope', 'escopo da reforma', 'alcance de la reforma'],
  selling_costs: ['selling costs', 'custos de venda', 'costos de venta'],
  holding_costs: ['holding costs', 'custos de carregamento', 'costos de mantenimiento'],
  financing_terms: ['financing terms', 'condições de financiamento', 'condiciones de financiación'],
  rent_evidence: ['rent evidence', 'evidências de aluguel', 'evidencia de alquiler'],
  operating_expenses: ['operating expenses', 'despesas operacionais', 'gastos operativos'],
  vacancy: ['vacancy assumption', 'premissa de vacância', 'supuesto de vacancia'],
  property_tax: ['property tax', 'imposto predial', 'impuesto predial'],
  insurance: ['insurance', 'seguro', 'seguro'],
  management: ['management cost', 'custo de administração', 'costo de administración'],
  maintenance: ['maintenance cost', 'custo de manutenção', 'costo de mantenimiento'],
  hoa: ['HOA cost', 'custo de HOA', 'costo de HOA'],
  disposition_price: ['disposition price', 'preço de saída', 'precio de salida'],
  buyer_demand_evidence: ['buyer-demand evidence', 'evidências de demanda de compradores', 'evidencia de demanda de compradores'],
  assignability: ['contract assignability', 'cessão do contrato', 'cesión del contrato'],
  assignment_fee: ['assignment fee', 'taxa de cessão', 'tarifa de cesión'],
  closing_costs: ['closing costs', 'custos de fechamento', 'costos de cierre'],
  down_payment: ['down payment', 'entrada', 'pago inicial'],
  interest_rate: ['interest rate', 'taxa de juros', 'tasa de interés'],
  term_months: ['financing term', 'prazo do financiamento', 'plazo del financiamiento'],
  amortization_months: ['amortization term', 'prazo de amortização', 'plazo de amortización'],
  balloon_months: ['balloon term', 'prazo do balloon', 'plazo del pago balloon'],
  existing_loan_balance: ['existing loan balance', 'saldo do financiamento existente', 'saldo del préstamo existente'],
  monthly_pi_payment: ['monthly principal and interest payment', 'parcela mensal de principal e juros', 'pago mensual de principal e intereses'],
  arrears: ['arrears', 'parcelas em atraso', 'atrasos'],
  cash_to_seller: ['cash to seller', 'valor em dinheiro ao vendedor', 'efectivo para el vendedor'],
  reinstatement: ['reinstatement amount', 'valor de regularização', 'importe de regularización'],
  lot_size: ['lot size', 'área do lote', 'área del lote'],
  zoning: ['zoning', 'zoneamento', 'zonificación'],
  allowed_use: ['allowed use', 'uso permitido', 'uso permitido'],
  road_access: ['road access', 'acesso viário', 'acceso vial'],
  utilities: ['utilities', 'infraestrutura disponível', 'servicios disponibles'],
  survey: ['survey', 'levantamento topográfico', 'levantamiento topográfico'],
  topography: ['topography', 'topografia', 'topografía'],
  ownership: ['ownership evidence', 'evidências de titularidade', 'evidencia de titularidad'],
  land_sale_evidence: ['recorded land-sale evidence', 'evidências de vendas de terrenos', 'evidencia de ventas de terrenos'],
  development_assumptions: ['development assumptions', 'premissas de desenvolvimento', 'supuestos de desarrollo'],
  market_evidence: ['market evidence', 'evidências de mercado', 'evidencia de mercado'],
  property_condition: ['property condition', 'condição do imóvel', 'condición del inmueble'],
};

function gapLabel(gap: DecisionGap | null, language: Language) {
  if (!gap) return '';
  const labels = GAP_LABELS[gap.field];
  return labels?.[language === 'pt' ? 1 : language === 'es' ? 2 : 0]
    || gap.field.replaceAll('_', ' ');
}

function gapAction(gap: DecisionGap, language: Language) {
  const label = gapLabel(gap, language);
  return localized(language,
    `Resolve ${label} to unlock ${gap.unlocks.toLowerCase().replaceAll('_', ' ')}.`,
    `Resolver ${label} para liberar ${gap.unlocks.toLowerCase().replaceAll('_', ' ')}.`,
    `Resolver ${label} para habilitar ${gap.unlocks.toLowerCase().replaceAll('_', ' ')}.`);
}

export function buildDealThesis(context: DealDecisionContext, languageInput: unknown = 'en') {
  const language = languageOf(languageInput);
  const relationship = context.relationships;
  const highestGap = context.decisionGaps[0] || null;
  const baseCost = money(relationship.baseCost, language);
  const rehab = money(relationship.rehabBudget, language);
  const rehabPerSqft = decimal(relationship.rehabPerSqft, language);
  const selected = Number(relationship.selectedCompCount || 0);
  const supporting = Number(relationship.supportingCompCount || 0);
  const providerEstimate = money(relationship.providerEstimate, language);
  const reportedCapRate = Number.isFinite(Number(relationship.reportedCapRate))
    ? `${Number(relationship.reportedCapRate)}%` : '';
  const benchmarkResemblance = String(relationship.rehabBenchmarkResemblance || '').replaceAll('_', ' ').toLowerCase();
  let summary = '';
  if (context.strategy === 'FLIP') {
    summary = relationship.arvStatus === 'ARV_AVAILABLE' || relationship.arvStatus === 'ARV_LIMITED'
      ? localized(language,
        `The current flip thesis has ${baseCost || 'an incomplete'} pre-financing cost basis and exit evidence is available for a spread review.`,
        `A tese atual de flip possui base de custo pré-financiamento de ${baseCost || 'valor incompleto'} e há evidência de saída disponível para revisar o spread.`,
        `La tesis actual de flip tiene una base de costo previa al financiamiento de ${baseCost || 'valor incompleto'} y existe evidencia de salida para revisar el margen.`)
      : localized(language,
        `The flip cannot yet be validated because exit value remains unresolved${baseCost ? `, while the current pre-financing cost basis is already ${baseCost}` : ''}.`,
        `O flip ainda não pode ser validado porque o valor de saída permanece sem resolução${baseCost ? `, enquanto a base de custo pré-financiamento já é ${baseCost}` : ''}.`,
        `El flip aún no puede validarse porque el valor de salida sigue sin resolverse${baseCost ? `, mientras que la base de costo previa al financiamiento ya es ${baseCost}` : ''}.`);
  } else if (context.strategy === 'BUY_AND_HOLD') {
    summary = localized(language,
      `The hold thesis depends on income evidence and operating expenses; ${reportedCapRate ? `the ${reportedCapRate} cap rate is reported, not calculated from NOI` : 'a calculated cap rate is not yet available'}.`,
      `A tese de renda depende de evidências de aluguel e despesas operacionais; ${reportedCapRate ? `a cap rate de ${reportedCapRate} é informada, não calculada a partir do NOI` : 'a cap rate calculada ainda não está disponível'}.`,
      `La tesis de renta depende de evidencia de alquiler y gastos operativos; ${reportedCapRate ? `la tasa de capitalización de ${reportedCapRate} es informada, no calculada desde el NOI` : 'la tasa de capitalización calculada aún no está disponible'}.`);
  } else if (context.strategy === 'LAND') {
    summary = localized(language,
      'This land decision depends on permitted use, access, utilities and recorded land-sale evidence; residential rehabilitation and ARV are not part of this thesis.',
      'A decisão sobre este terreno depende de uso permitido, acesso, infraestrutura e vendas registradas de terrenos; reforma residencial e ARV não fazem parte desta tese.',
      'La decisión sobre este terreno depende del uso permitido, acceso, servicios y ventas registradas de terrenos; la reforma residencial y el ARV no forman parte de esta tesis.');
  } else if (context.strategy === 'SUB_TO') {
    summary = localized(language,
      'The SUB-TO thesis cannot be evaluated until assumed debt, monthly obligation and cash-to-entry are known.',
      'A tese SUB-TO não pode ser avaliada até que a dívida assumida, a obrigação mensal e o custo de entrada sejam conhecidos.',
      'La tesis SUB-TO no puede evaluarse hasta conocer la deuda asumida, la obligación mensual y el costo de entrada.');
  } else if (context.strategy === 'SELLER_FINANCING') {
    summary = localized(language,
      'The seller-financing thesis depends on price, down payment and complete payment terms; no financing values are inferred.',
      'A tese de seller financing depende do preço, da entrada e das condições completas de pagamento; nenhum valor de financiamento é inferido.',
      'La tesis de financiación del vendedor depende del precio, el pago inicial y los términos completos; no se infieren valores financieros.');
  } else {
    summary = localized(language,
      'The current decision remains conditional on market evidence and the strategy-specific assumptions shown below.',
      'A decisão atual permanece condicionada às evidências de mercado e às premissas específicas da estratégia indicadas abaixo.',
      'La decisión actual sigue condicionada a la evidencia de mercado y a los supuestos específicos de la estrategia indicados abajo.');
  }

  const supportingEvidence = [
    baseCost ? localized(language, `Current base cost: ${baseCost}.`, `Base de custo atual: ${baseCost}.`, `Base de costo actual: ${baseCost}.`) : '',
    rehab && rehabPerSqft ? localized(language,
      `The ${rehab} rehabilitation assumption equals approximately $${rehabPerSqft}/sqft.`,
      `A premissa de reforma de ${rehab} equivale a aproximadamente US$ ${rehabPerSqft}/sqft.`,
      `El supuesto de reforma de ${rehab} equivale aproximadamente a US$ ${rehabPerSqft}/sqft.`) : '',
    benchmarkResemblance ? localized(language,
      `Without assigning a target condition, this intensity most closely resembles the ${benchmarkResemblance} 2026 state reference; the user must confirm the intended scope.`,
      `Sem atribuir uma condição-alvo, essa intensidade se aproxima mais da referência estadual de 2026 para ${benchmarkResemblance}; o usuário ainda deve confirmar o escopo pretendido.`,
      `Sin asignar una condición objetivo, esta intensidad se aproxima más a la referencia estatal de 2026 para ${benchmarkResemblance}; el usuario aún debe confirmar el alcance previsto.`) : '',
    selected ? localized(language, `${selected} comparable sales passed the current ARV gates.`,
      `${selected} vendas comparáveis passaram pelos critérios atuais de ARV.`,
      `${selected} ventas comparables superaron los criterios actuales de ARV.`) : '',
    supporting ? localized(language, `${supporting} structurally relevant sales provide market context but are not ARV comps.`,
      `${supporting} vendas estruturalmente relevantes fornecem contexto de mercado, mas não são comparáveis de ARV.`,
      `${supporting} ventas estructuralmente relevantes aportan contexto de mercado, pero no son comparables de ARV.`) : '',
  ].filter(Boolean);
  const contraryEvidence = [
    relationship.arvStatus === 'ARV_UNAVAILABLE' && context.strategy === 'FLIP'
      ? localized(language, 'No confirmed exit comp set currently supports a defensible ARV.',
        'Nenhum conjunto confirmado de comparáveis de saída sustenta atualmente um ARV defensável.',
        'Ningún conjunto confirmado de comparables de salida respalda actualmente un ARV defendible.') : '',
    providerEstimate ? localized(language,
      `The provider estimate of ${providerEstimate} is a market reference, not a DealSifter ARV.`,
      `A estimativa do provedor de ${providerEstimate} é uma referência de mercado, não um ARV DealSifter.`,
      `La estimación del proveedor de ${providerEstimate} es una referencia de mercado, no un ARV DealSifter.`) : '',
    reportedCapRate ? localized(language,
      `The ${reportedCapRate} cap rate is reported and cannot be treated as calculated without NOI.`,
      `A cap rate de ${reportedCapRate} é informada e não pode ser tratada como calculada sem NOI.`,
      `La tasa de capitalización de ${reportedCapRate} es informada y no puede tratarse como calculada sin NOI.`) : '',
  ].filter(Boolean);
  const whatWouldChange = context.decisionGaps.slice(0, 3).map((gap) => gapAction(gap, language));
  return Object.freeze({
    summary,
    supportingEvidence: Object.freeze(supportingEvidence),
    contraryEvidence: Object.freeze(contraryEvidence),
    whatWouldChange: Object.freeze(whatWouldChange),
    highestValueUnknown: highestGap ? Object.freeze({
      code: highestGap.code,
      criticality: highestGap.criticality,
      label: gapLabel(highestGap, language),
      why: gapAction(highestGap, language),
      unlocks: highestGap.unlocks,
    }) : null,
  });
}

export function localizeDecisionAction(gap: DecisionGap, languageInput: unknown = 'en') {
  const language = languageOf(languageInput);
  const label = gapLabel(gap, language);
  return Object.freeze({
    code: gap.actionCode,
    gapCode: gap.code,
    label: localized(language, `Resolve ${label}`, `Resolver ${label}`, `Resolver ${label}`),
    why: gapAction(gap, language),
    unlocks: gap.unlocks,
    criticality: gap.criticality,
    inputField: gap.inputField,
    source: gap.source,
  });
}
