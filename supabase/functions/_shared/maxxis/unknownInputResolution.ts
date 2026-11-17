/** Offline cost composition. No market defaults, acquisition, ARV or return formulas. */
type Values = Record<string, any>;
export const ASSISTED_COST_FIELDS = ['holdingCosts', 'financingCosts', 'sellingCosts'];
export const ASSISTED_PARAMETERS: Record<string, { label: string; pt: string; es: string; unit: string; cadence: string; options?: string[] }> = {
  holdingPeriodMonths: { label: 'Confirmed holding period (months)', pt: 'Prazo confirmado até a venda (meses)', es: 'Plazo confirmado hasta la venta (meses)', unit: 'MONTHS', cadence: 'ONE_TIME' },
  sellingCostPercent: { label: 'Confirmed transaction costs (%) of private exit price', pt: 'Custos da transação confirmados (% do preço privado de saída)', es: 'Costos confirmados de transacción (% del precio privado de salida)', unit: 'PERCENT', cadence: 'ONE_TIME' },
  financingMode: { label: 'Acquisition funding', pt: 'Modalidade de aquisição', es: 'Modalidad de adquisición', unit: 'ENUM', cadence: 'ONE_TIME', options: ['CASH', 'FINANCED'] },
  financingScope: { label: 'Any financing charges, including closing charges?', pt: 'Há encargos financeiros, inclusive no fechamento?', es: '¿Hay cargos financieros, incluso de cierre?', unit: 'ENUM', cadence: 'ONE_TIME', options: ['NO_FINANCING_CHARGES', 'CHARGES_APPLY'] },
  holdingExpenseScope: { label: 'Holding expense scope', pt: 'Escopo das despesas até a venda', es: 'Alcance de gastos hasta la venta', unit: 'ENUM', cadence: 'ONE_TIME', options: ['ITEMIZED_EXCLUDES_REHAB_AND_FINANCING'] },
  loanAmount: { label: 'Confirmed loan principal', pt: 'Principal confirmado do empréstimo', es: 'Principal confirmado del préstamo', unit: 'USD', cadence: 'ONE_TIME' },
  financingInterestMethod: { label: 'Confirmed interest method', pt: 'Método de juros confirmado', es: 'Método de interés confirmado', unit: 'ENUM', cadence: 'ONE_TIME', options: ['INTEREST_ONLY'] },
  financingCostScope: { label: 'Financing charge scope', pt: 'Escopo dos encargos financeiros', es: 'Alcance de cargos financieros', unit: 'ENUM', cadence: 'ONE_TIME', options: ['EXCLUDES_ACQUISITION_AND_HOLDING_CHARGES'] },
  originationFee: { label: 'Origination charge', pt: 'Taxa de originação', es: 'Cargo de originación', unit: 'USD', cadence: 'ONE_TIME' },
  loanPoints: { label: 'Loan points (%)', pt: 'Pontos do empréstimo (%)', es: 'Puntos del préstamo (%)', unit: 'PERCENT', cadence: 'ONE_TIME' },
  financeClosingCosts: { label: 'Financial closing charges', pt: 'Encargos financeiros de fechamento', es: 'Cargos financieros de cierre', unit: 'USD', cadence: 'ONE_TIME' },
  otherFinancingCosts: { label: 'Other financing charges', pt: 'Outros encargos financeiros', es: 'Otros cargos financieros', unit: 'USD', cadence: 'ONE_TIME' },
};
const object = (v: any): Values => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
const known = (v: any) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const round = (v: number) => Math.round(v * 100) / 100;

export function costResolutionPlan(existing: Values, propertyId: string, revision: number) {
  const stored = object(existing.r3Completion), active = object(existing.activeScenario), inputs = object(stored.inputs);
  const values: Values = {}, provenance: Values = {};
  // Do not reuse old calculated estimates as fresh independent input parameters.
  for (const [key, entry] of Object.entries(inputs) as [string, Values][]) if (entry.confirmed === true && entry.status !== 'STALE' && !entry.estimate) {
    values[key] = entry.value; provenance[key] = { source: entry.source, confirmedAt: entry.confirmedAt };
  }
  if (active.confirmed === true) for (const [key, value] of Object.entries(object(active.assumptions))) {
    if (!Object.hasOwn(inputs, key) && active.source?.[key] === 'USER_PROVIDED') {
      values[key] = value; provenance[key] = { source: 'USER_PROVIDED', confirmedAt: active.confirmedAt || null };
    }
  }
  const candidates: Values = {}, unavailable: Values = {};
  const add = (field: string, value: number, formula: string, keys: string[], limitations: string, applicability = 'APPLICABLE') => {
    if (!known(value) || value > 1e9) return;
    candidates[field] = { field, value: round(value), origin: 'SYSTEM_ASSUMPTION', confirmed: false,
      formula, basis: Object.fromEntries(keys.map(k => [k, { value: values[k], ...provenance[k] }])),
      cadence: 'ONE_TIME', unit: 'USD', limitations, applicability,
      scenarioId: active.id || `r3:${propertyId}`, scenarioVersion: revision };
  };
  const missing = (keys: string[]) => keys.filter(k => !known(values[k]));
  const holding = ['propertyTax', 'insurance', 'HOA', 'maintenanceAmount', 'utilities', 'otherOperatingExpenses', 'holdingPeriodMonths'];
  const holdingMissing = missing(holding);
  if (values.holdingExpenseScope !== 'ITEMIZED_EXCLUDES_REHAB_AND_FINANCING') holdingMissing.push('holdingExpenseScope');
  if (!holdingMissing.length && values.holdingPeriodMonths > 0) add('holdingCosts',
    ((values.propertyTax + values.insurance + values.maintenanceAmount + values.utilities + values.otherOperatingExpenses) / 12 + values.HOA) * values.holdingPeriodMonths,
    '(annual property tax + insurance + maintenance + utilities + other operating expenses) / 12 × months + monthly HOA × months', holding.concat('holdingExpenseScope'),
    'Private holding-period illustration; only the listed expenses are included. Rehab, acquisition charges and financing are separate; no rental-management charge is assumed. Confirm the expense scope and current condition.');
  else unavailable.holdingCosts = { missing: holdingMissing.length ? holdingMissing : ['holdingPeriodMonths'], explanation: 'Confirm the holding period and itemized recurring expenses separately from rehab and financing.' };
  if (values.financingMode === 'CASH' && values.financingScope === 'NO_FINANCING_CHARGES') add('financingCosts', 0,
    'Confirmed cash acquisition with no financing charges in this scope', ['financingMode', 'financingScope'],
    'Not applicable only to the explicitly confirmed cash scenario; does not exclude ordinary acquisition or sale closing costs.', 'NOT_APPLICABLE');
  else {
    const keys = ['loanAmount', 'annualInterestRate', 'holdingPeriodMonths', 'originationFee', 'loanPoints', 'financeClosingCosts', 'otherFinancingCosts'];
    const absent = missing(keys);
    if (values.financingMode !== 'FINANCED') absent.push('financingMode');
    if (values.financingInterestMethod !== 'INTEREST_ONLY') absent.push('financingInterestMethod');
    if (values.financingCostScope !== 'EXCLUDES_ACQUISITION_AND_HOLDING_CHARGES') absent.push('financingCostScope');
    if (!absent.length && values.loanAmount > 0 && values.holdingPeriodMonths > 0) add('financingCosts',
      values.originationFee + values.loanAmount * values.loanPoints / 100 + values.financeClosingCosts + values.otherFinancingCosts
      + values.loanAmount * values.annualInterestRate / 100 * values.holdingPeriodMonths / 12,
      'origination + principal × points / 100 + financial closing + other charges + principal × annual interest / 100 × months / 12', keys.concat('financingMode', 'financingInterestMethod', 'financingCostScope'),
      'Conditional interest-only scenario on constant principal; excludes principal repayment. Not an amortizing-loan quote. All charge categories require explicit amounts, including any zero.');
    else unavailable.financingCosts = { missing: [...new Set(absent.length ? absent : ['loanAmount', 'holdingPeriodMonths'])], explanation: 'Confirm cash with no financial charges, or supply the loan method, principal, duration, interest and each charge. Unknown financing is never zero.' };
  }
  const saleMissing = missing(['exitValue', 'sellingCostPercent']);
  if (!saleMissing.length && values.exitValue > 0 && values.sellingCostPercent <= 100) add('sellingCosts', values.exitValue * values.sellingCostPercent / 100,
    'confirmed private exit price × confirmed total transaction percentage / 100', ['exitValue', 'sellingCostPercent'],
    'Conditional transaction-cost scenario, not a verified sale price or ARV. The percentage must cover the intended commissions and transaction charges; no jurisdictional tariff is presumed.');
  else unavailable.sellingCosts = { missing: saleMissing.length ? saleMissing : ['exitValue'], explanation: 'A confirmed private exit-price scenario and sourced or explicitly approved total transaction percentage are required; asking price and AVM are not substituted.' };
  return { candidates, unavailable };
}

export function assistedParameterValue(value: any, language = 'en') {
  const index = language === 'pt' ? 0 : language === 'es' ? 2 : 1;
  const copy: Record<string, string[]> = {
    CASH: ['Compra à vista', 'Cash purchase', 'Compra al contado'], FINANCED: ['Com financiamento', 'Financed purchase', 'Con financiación'],
    NO_FINANCING_CHARGES: ['Sem encargos financeiros neste cenário', 'No financing charges in this scenario', 'Sin cargos financieros en este escenario'],
    CHARGES_APPLY: ['Há encargos financeiros', 'Financing charges apply', 'Hay cargos financieros'],
    ITEMIZED_EXCLUDES_REHAB_AND_FINANCING: ['Despesas recorrentes adequadas à condição atual, sem reforma, financiamento ou duplicação', 'Recurring expenses appropriate to current condition, excluding rehab, financing and duplicates', 'Gastos recurrentes adecuados, sin reforma, financiación ni duplicación'],
    EXCLUDES_ACQUISITION_AND_HOLDING_CHARGES: ['Encargos financeiros separados da aquisição e manutenção, sem duplicação', 'Financing charges separate from acquisition and holding expenses, without duplication', 'Cargos financieros separados de adquisición y tenencia, sin duplicación'],
    INTEREST_ONLY: ['Somente juros sobre principal constante', 'Interest only on constant principal', 'Solo intereses sobre principal constante'],
  };
  return copy[String(value)]?.[index] || (typeof value === 'number' ? String(value) : '—');
}

export function assistedEstimateCopy(estimate: Values, language = 'en') {
  const index = language === 'pt' ? 0 : language === 'es' ? 2 : 1;
  const formulas: Record<string, string[]> = {
    holdingCosts: ['(imposto + seguro + manutenção + serviços + outras despesas anuais) / 12 × meses + HOA mensal × meses', estimate.formula, '(impuesto + seguro + mantenimiento + servicios + otros gastos anuales) / 12 × meses + HOA mensual × meses'],
    financingCosts: estimate.applicability === 'NOT_APPLICABLE'
      ? ['Compra à vista e ausência de encargos financeiros confirmadas', estimate.formula, 'Compra al contado y ausencia de cargos financieros confirmadas']
      : ['originação + principal × pontos / 100 + fechamento financeiro + outros encargos + principal × juros anuais / 100 × meses / 12', estimate.formula, 'originación + principal × puntos / 100 + cierre financiero + otros cargos + principal × interés anual / 100 × meses / 12'],
    sellingCosts: ['preço privado de saída confirmado × percentual total de transação confirmado / 100', estimate.formula, 'precio privado de salida confirmado × porcentaje total de transacción confirmado / 100'],
  };
  const notes: Record<string, string[]> = {
    holdingCosts: ['Cenário privado para o período informado, somente com as despesas listadas. Reforma, aquisição e financiamento são separados. Não inclui administração de aluguel presumida. Confirme condição atual e escopo.', estimate.limitations, 'Escenario privado del período indicado, solo con gastos listados. Reforma, adquisición y financiación separados; sin administración de alquiler presumida. Confirma condición y alcance.'],
    financingCosts: estimate.applicability === 'NOT_APPLICABLE'
      ? ['Não aplicável somente à compra à vista confirmada, sem encargos financeiros. Não exclui custos normais de aquisição ou venda.', estimate.limitations, 'No aplicable solo a compra al contado confirmada sin cargos financieros. No excluye costos normales de adquisición o venta.']
      : ['Cenário condicional de juros sobre principal constante, sem amortização. Não é cotação de empréstimo. Cada encargo exige valor explícito; despesas de aquisição e manutenção não podem ser duplicadas.', estimate.limitations, 'Escenario condicional de intereses sobre principal constante, sin amortización. No es cotización. Cada cargo requiere un importe explícito; sin duplicar adquisición ni tenencia.'],
    sellingCosts: ['Cenário condicional de despesas da transação; não confirma venda nem ARV. O percentual deve cobrir as comissões e despesas pretendidas. Nenhuma tarifa local foi presumida.', estimate.limitations, 'Escenario condicional de gastos; no confirma venta ni ARV. El porcentaje debe cubrir comisiones y gastos previstos. No presume tarifas locales.'],
  };
  const englishNotes: Record<string, string> = {
    holdingCosts: 'Private period illustration using only listed recurring expenses; rehab, acquisition and financing are separate. Confirm current condition and avoid duplicate charges.',
    financingCosts: estimate.applicability === 'NOT_APPLICABLE' ? 'Not applicable only to confirmed cash acquisition without financing charges; ordinary acquisition and sale charges remain separate.' : 'Conditional interest-only scenario on constant principal, excluding repayment. Every charge requires an explicit amount; acquisition and holding charges must not be duplicated.',
    sellingCosts: 'Conditional transaction-cost scenario, not verified sale price or ARV. Confirm commission and transaction scope; no local tariff is presumed.',
  };
  return { formula: formulas[estimate.field]?.[index] || '', limitations: index === 1 ? englishNotes[estimate.field] || '' : notes[estimate.field]?.[index] || '' };
}

/** Keep the existing 8 KiB private-context bound: reference input provenance instead of duplicating it. */
export function confirmedCostEstimate(candidate: Values, confirmedAt: string, revision: number) {
  return { field: candidate.field, formula: candidate.formula,
    basis: Object.fromEntries(Object.entries(candidate.basis).map(([key, raw]) => [key, { value: (raw as Values).value,
      confirmedAt: (raw as Values).confirmedAt }])), parameterSource: 'USER_PROVIDED',
    methodologyVersion: 'R31_COST_COMPOSITION_V1', applicability: candidate.applicability,
    confirmed: true, confirmedAt, scenarioId: candidate.scenarioId, scenarioVersion: revision,
    baseScenarioVersion: candidate.scenarioVersion };
}

export function applyUnknownChoice(existing: Values, fields: string[], now: string, revision: number) {
  if (!fields.length || fields.length > 30 || fields.some(f => !/^[a-zA-Z][a-zA-Z0-9_]{0,60}$/.test(f))) throw Error('INVALID_UNKNOWN_FIELDS');
  const previous = object(existing.r3Completion), unknown = { ...object(previous.unknown) };
  for (const field of fields) if (!previous.inputs?.[field]?.confirmed) unknown[field] = { status: 'UNKNOWN', recordedAt: now, version: revision };
  return { ...existing, r3Completion: { ...previous, unknown } };
}
