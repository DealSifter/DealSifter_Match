import type { ReportLocale, ReportRow, ReportSection, ReportValue } from './reportIntegrityTypes';

type RecordValue = Record<string, unknown>;
type Labels = readonly [string, string, string];
type Field = { label: Labels; unit: 'money' | 'percent' | 'number' | 'months' | 'years' | 'ratio'; signed?: boolean };
export interface SavedScenarioReportProjection {
  sections: ReportSection[];
  values: Record<string, ReportValue>;
  evidencePacket: { id: string; text: string; numericValues: number[] }[];
  diagnostics: string[];
}
const object = (value: unknown): RecordValue => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const finite = (value: unknown): number | null => (typeof value === 'number' || typeof value === 'string' && value.trim() !== '')
  && Number.isFinite(Number(value)) && Math.abs(Number(value)) <= Number.MAX_SAFE_INTEGER ? Number(value) : null;
const select = (locale: ReportLocale, labels: Labels): string => labels[locale === 'pt' ? 0 : locale === 'es' ? 2 : 1];
const field = (label: Labels, unit: Field['unit'] = 'money', signed = false): Field => ({ label, unit, signed });
const INPUT: Record<string, Field> = {
  purchasePrice: field(['Preço de aquisição', 'Acquisition price', 'Precio de adquisición']),
  offerPrice: field(['Oferta de aquisição', 'Acquisition offer', 'Oferta de adquisición']),
  downPaymentAmount: field(['Entrada', 'Down payment', 'Pago inicial']), downPaymentPercent: field(['Entrada percentual', 'Down payment percentage', 'Porcentaje inicial'], 'percent'),
  annualInterestRate: field(['Taxa anual de juros', 'Annual interest rate', 'Tasa de interés anual'], 'percent'),
  amortizationMonths: field(['Amortização em meses', 'Amortization in months', 'Amortización en meses'], 'months'),
  amortizationYears: field(['Amortização em anos', 'Amortization in years', 'Amortización en años'], 'years'),
  balloonMonth: field(['Prazo do balloon em meses', 'Balloon term in months', 'Plazo balloon en meses'], 'months'),
  balloonYears: field(['Prazo do balloon em anos', 'Balloon term in years', 'Plazo balloon en años'], 'years'),
  closingCosts: field(['Custos de fechamento', 'Closing costs', 'Costos de cierre']), otherCashToSeller: field(['Caixa adicional ao vendedor', 'Additional cash to seller', 'Efectivo adicional al vendedor']),
  rent: field(['Premissa de aluguel mensal', 'Monthly rent assumption', 'Supuesto de alquiler mensual']),
  expectedRent: field(['Premissa de aluguel mensal esperado', 'Expected monthly rent assumption', 'Supuesto de alquiler mensual esperado']),
  vacancyRate: field(['Premissa de vacância', 'Vacancy assumption', 'Supuesto de vacancia'], 'percent'),
  propertyTax: field(['Premissa de imposto predial anual', 'Annual property-tax assumption', 'Supuesto de impuesto anual']),
  insurance: field(['Premissa de seguro anual', 'Annual insurance assumption', 'Supuesto de seguro anual']), HOA: field(['Premissa de associação mensal', 'Monthly HOA assumption', 'Supuesto de asociación mensual']),
  managementPercent: field(['Premissa de administração', 'Management assumption', 'Supuesto de administración'], 'percent'),
  maintenancePercent: field(['Premissa de manutenção', 'Maintenance assumption', 'Supuesto de mantenimiento'], 'percent'),
  maintenanceAmount: field(['Premissa de manutenção anual', 'Annual maintenance assumption', 'Supuesto de mantenimiento anual']),
  otherOperatingExpenses: field(['Outras despesas anuais assumidas', 'Other assumed annual expenses', 'Otros gastos anuales supuestos']),
  monthlyPI: field(['Premissa de principal e juros mensais', 'Monthly principal and interest assumption', 'Supuesto mensual de principal e interés']),
  cashInvested: field(['Caixa investido no cenário', 'Cash invested in the scenario', 'Efectivo invertido en el escenario']),
  exitValue: field(['Premissa de valor de saída', 'Exit-value assumption', 'Supuesto de valor de salida']), rehab: field(['Premissa de reforma', 'Rehabilitation assumption', 'Supuesto de reforma']),
  acquisitionCosts: field(['Custos de aquisição assumidos', 'Assumed acquisition costs', 'Costos de adquisición supuestos']),
  holdingCosts: field(['Custos de carregamento assumidos', 'Assumed holding costs', 'Costos de tenencia supuestos']),
  financingCosts: field(['Custos de financiamento assumidos', 'Assumed financing costs', 'Costos de financiación supuestos']),
  sellingCosts: field(['Custos de venda assumidos', 'Assumed selling costs', 'Costos de venta supuestos']),
  sellingCostPercent: field(['Premissa percentual de venda', 'Selling-cost percentage assumption', 'Supuesto porcentual de venta'], 'percent'),
  existingLoanBalance: field(['Saldo de financiamento assumido', 'Assumed loan balance', 'Saldo de préstamo supuesto']),
  reinstatement: field(['Regularização do financiamento', 'Loan reinstatement', 'Regularización del préstamo']), arrears: field(['Parcelas em atraso assumidas', 'Assumed arrears', 'Atrasos supuestos']),
  cashToSeller: field(['Caixa ao vendedor', 'Cash to seller', 'Efectivo al vendedor']), contractPrice: field(['Preço do contrato', 'Contract price', 'Precio del contrato']),
  estimatedBuyerPrice: field(['Premissa de preço ao comprador', 'Buyer-price assumption', 'Supuesto de precio al comprador']), assignmentFee: field(['Taxa de cessão assumida', 'Assumed assignment fee', 'Tarifa de cesión supuesta']),
};
const OUTPUT: Record<string, Field> = {
  monthlyPI: field(['Parcela mensal de principal e juros', 'Monthly principal and interest', 'Pago mensual de principal e interés']),
  balloonBalance: field(['Saldo no balloon', 'Balloon balance', 'Saldo balloon']), financedPrincipal: field(['Principal financiado', 'Financed principal', 'Principal financiado']),
  cashToEntry: field(['Caixa inicial completo do cenário', 'Complete scenario cash to entry', 'Efectivo inicial completo del escenario']),
  knownCashToEntry: field(['Caixa inicial conhecido', 'Known cash to entry', 'Efectivo inicial conocido']),
  principalPaidToBalloon: field(['Principal amortizado até o balloon', 'Principal paid to balloon', 'Principal amortizado hasta balloon']),
  interestPaidToBalloon: field(['Juros pagos até o balloon', 'Interest paid to balloon', 'Interés pagado hasta balloon']),
  totalScheduledPIToBalloon: field(['Pagamentos previstos até o balloon', 'Scheduled payments to balloon', 'Pagos previstos hasta balloon']),
  grossScheduledRent: field(['Aluguel bruto anual do cenário', 'Scenario annual gross rent', 'Alquiler bruto anual del escenario']),
  effectiveGrossIncome: field(['Receita efetiva do cenário', 'Scenario effective income', 'Ingreso efectivo del escenario']),
  operatingExpenses: field(['Despesas operacionais do cenário', 'Scenario operating expenses', 'Gastos operativos del escenario']),
  NOI: field(['NOI do cenário privado', 'Private-scenario NOI', 'NOI del escenario privado'], 'money', true),
  capRate: field(['Cap Rate do cenário privado', 'Private-scenario cap rate', 'Tasa de capitalización del escenario privado'], 'percent', true),
  annualCashFlow: field(['Fluxo anual do cenário privado', 'Private-scenario annual cash flow', 'Flujo anual del escenario privado'], 'money', true),
  monthlyOperatingCashFlow: field(['Fluxo operacional mensal do cenário', 'Scenario monthly operating cash flow', 'Flujo operativo mensual del escenario'], 'money', true),
  cashOnCashReturn: field(['Retorno sobre caixa do cenário', 'Scenario cash-on-cash return', 'Retorno sobre efectivo del escenario'], 'percent', true),
  DSCR: field(['Cobertura da dívida no cenário', 'Scenario debt-service coverage', 'Cobertura de deuda del escenario'], 'ratio', true),
  acquisitionBasis: field(['Base de aquisição do cenário', 'Scenario acquisition basis', 'Base de adquisición del escenario']),
  allInCost: field(['Base completa de custos do cenário', 'Complete scenario cost basis', 'Base completa de costos del escenario']),
  projectedProfit: field(['Resultado projetado do cenário', 'Scenario projected result', 'Resultado proyectado del escenario'], 'money', true),
  ROI: field(['ROI do cenário privado', 'Private-scenario ROI', 'ROI del escenario privado'], 'percent', true),
  profitMargin: field(['Margem do cenário privado', 'Private-scenario margin', 'Margen del escenario privado'], 'percent', true),
  grossSpread: field(['Diferença bruta do cenário', 'Scenario gross spread', 'Diferencia bruta del escenario'], 'money', true),
  debtAssumed: field(['Dívida assumida no cenário', 'Debt assumed in the scenario', 'Deuda asumida en el escenario']),
  monthlyDebtService: field(['Pagamento mensal da dívida', 'Monthly debt payment', 'Pago mensual de deuda']),
  knownMonthlyCarry: field(['Custo mensal conhecido do cenário', 'Scenario known monthly carry', 'Costo mensual conocido del escenario']),
  estimatedMonthlyCashFlow: field(['Fluxo mensal estimado do cenário', 'Scenario estimated monthly cash flow', 'Flujo mensual estimado del escenario'], 'money', true),
  grossAssignmentSpread: field(['Diferença bruta de cessão', 'Gross assignment spread', 'Diferencia bruta de cesión'], 'money', true),
  estimatedNetAssignmentSpread: field(['Diferença líquida estimada de cessão', 'Estimated net assignment spread', 'Diferencia neta estimada de cesión'], 'money', true),
  buyerBasis: field(['Base do comprador no cenário', 'Scenario buyer basis', 'Base del comprador en el escenario']),
};
const FIELDS: Record<string, { inputs: string[]; outputs: string[]; label: Labels }> = {
  SELLER_FINANCING: { label: ['Financiamento pelo vendedor', 'Seller financing', 'Financiación del vendedor'], inputs: ['purchasePrice', 'downPaymentAmount', 'downPaymentPercent', 'annualInterestRate', 'amortizationMonths', 'amortizationYears', 'balloonMonth', 'balloonYears', 'closingCosts', 'otherCashToSeller'], outputs: ['monthlyPI', 'balloonBalance', 'financedPrincipal', 'cashToEntry', 'knownCashToEntry', 'principalPaidToBalloon', 'interestPaidToBalloon', 'totalScheduledPIToBalloon'] },
  BUY_AND_HOLD: { label: ['Comprar e alugar', 'Buy and hold', 'Comprar y alquilar'], inputs: ['purchasePrice', 'rent', 'vacancyRate', 'propertyTax', 'insurance', 'HOA', 'managementPercent', 'maintenanceAmount', 'maintenancePercent', 'otherOperatingExpenses', 'monthlyPI', 'cashInvested'], outputs: ['grossScheduledRent', 'effectiveGrossIncome', 'operatingExpenses', 'NOI', 'capRate', 'annualCashFlow', 'monthlyOperatingCashFlow', 'cashOnCashReturn', 'DSCR'] },
  FLIP: { label: ['Reformar e vender', 'Fix and flip', 'Reformar y vender'], inputs: ['purchasePrice', 'offerPrice', 'exitValue', 'rehab', 'acquisitionCosts', 'closingCosts', 'holdingCosts', 'financingCosts', 'sellingCosts', 'sellingCostPercent'], outputs: ['acquisitionBasis', 'allInCost', 'projectedProfit', 'ROI', 'profitMargin', 'grossSpread'] },
  SUB_TO: { label: ['Aquisição sujeita ao financiamento', 'Subject-to acquisition', 'Compra sujeta a financiación'], inputs: ['existingLoanBalance', 'monthlyPI', 'reinstatement', 'arrears', 'cashToSeller', 'closingCosts', 'propertyTax', 'insurance', 'HOA', 'expectedRent'], outputs: ['knownCashToEntry', 'debtAssumed', 'monthlyDebtService', 'knownMonthlyCarry', 'estimatedMonthlyCashFlow', 'DSCR'] },
  WHOLESALE: { label: ['Cessão de contrato', 'Wholesale', 'Cesión de contrato'], inputs: ['contractPrice', 'estimatedBuyerPrice', 'assignmentFee', 'closingCosts'], outputs: ['grossAssignmentSpread', 'estimatedNetAssignmentSpread', 'buyerBasis'] },
};

/** Projection of existing, confirmed calculations only. No engine or formula runs here. */
export function projectSavedReportScenario({ scenario: input, locale, propertyId, sourcePath }: { scenario: unknown; locale: ReportLocale; propertyId: string; sourcePath?: 'activeScenario' | 'sellerFinancingScenario' }): SavedScenarioReportProjection {
  const result: SavedScenarioReportProjection = { sections: [], values: {}, evidencePacket: [], diagnostics: [] };
  const scenario = object(input);
  const legacyFinancing = !text(scenario.strategy) && !Object.keys(object(scenario.assumptions)).length
    && finite(scenario.purchasePrice) !== null && finite(scenario.annualInterestRate) !== null && finite(scenario.monthlyPI) !== null;
  const strategy = legacyFinancing ? 'SELLER_FINANCING' : text(scenario.strategy);
  const policy = Object.hasOwn(FIELDS, strategy) ? FIELDS[strategy] : null;
  if (scenario.confirmed !== true || !policy || !propertyId) return result;
  if (text(scenario.propertyId) && scenario.propertyId !== propertyId) { result.diagnostics.push('SAVED_SCENARIO_PROPERTY_MISMATCH'); return result; }
  const id = text(scenario.id);
  if (!id) result.diagnostics.push('SAVED_SCENARIO_LEGACY_ID_ABSENT');
  const recordPath = sourcePath || (legacyFinancing ? 'sellerFinancingScenario' : 'activeScenario');
  const rootRef = `property:${encodeURIComponent(propertyId)}:dealAssumptions.${recordPath}${id ? `:scenario:${encodeURIComponent(id)}` : ''}`;
  const assumptions = legacyFinancing ? scenario : object(scenario.assumptions);
  const outputs = legacyFinancing ? scenario : object(scenario.calculatedOutputs), sources = object(scenario.source);
  const t = (pt: string, en: string, es: string): string => select(locale, [pt, en, es]);
  const privateSource = t('Premissa privada confirmada do investidor; não verificada independentemente, não é fato público nem renda contratual atual', 'Confirmed private investor assumption; not independently verified, not a public fact or current contract income', 'Supuesto privado confirmado del inversor; sin verificación independiente, no es dato público ni ingreso contractual actual');
  const calculatedSource = t('Resultado existente do cenário privado, condicionado às premissas; não é renda atual, retorno verificado ou garantia', 'Existing private-scenario result, conditional on assumptions; not current income, verified return or a guarantee', 'Resultado existente del escenario privado, condicionado a supuestos; no es ingreso actual, retorno verificado ni garantía');
  const register = (ref: string, label: string, value: string, numericValues: number[]): void => { result.evidencePacket.push({ id: ref, text: `${label}: ${value}`, numericValues }); };
  const formatted = (n: number, spec: Field): string => {
    const language = locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es-US' : 'en-US';
    if (spec.unit === 'money') return new Intl.NumberFormat(language, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
    const value = new Intl.NumberFormat(language, { maximumFractionDigits: spec.unit === 'ratio' ? 4 : 2 }).format(n);
    return spec.unit === 'percent' ? `${value}%` : value;
  };
  const known = (key: string, positive = false): number | null => {
    const n = finite(assumptions[key]);
    return n === null || n < 0 || positive && n <= 0 || n === 0 && sources[key] !== 'USER_PROVIDED' ? null : n;
  };
  const all = (keys: string[]): boolean => keys.every(key => known(key) !== null);
  const present = (key: string): boolean => assumptions[key] !== null && assumptions[key] !== undefined && assumptions[key] !== '';
  const first = (...keys: string[]): string | null => keys.find(present) || null;
  const knownEither = (...keys: string[]): boolean => { const key = first(...keys); return key !== null && known(key) !== null; };
  const rows: ReportRow[] = [];
  for (const key of policy.inputs) {
    const amount = known(key); if (amount === null) { if (present(key)) result.diagnostics.push(`SAVED_SCENARIO_INPUT_UNUSABLE:${key}`); continue; }
    const spec = INPUT[key], label = select(locale, spec.label), value = formatted(amount, spec), ref = `${rootRef}:input:${key}`;
    register(ref, label, value, [amount]);
    result.values[ref] = { state: amount === 0 ? 'EXPLICIT_ZERO' : 'VALUE', text: value, numericValue: amount, source: privateSource, evidenceRefs: [ref] };
    rows.push({ label, value, source: privateSource, evidenceRefs: [ref], state: amount === 0 ? 'EXPLICIT_ZERO' : 'VALUE' });
  }
  if (rows.length) result.sections.push({ id: 'saved-scenario-assumptions', title: t('Premissas privadas do cenário confirmado', 'Private assumptions of the confirmed scenario', 'Supuestos privados del escenario confirmado'), kind: 'facts', priority: 64, rows, evidenceRefs: rows.flatMap(row => row.evidenceRefs), continuationPolicy: 'SAME_SECTION' });
  const purchaseKnown = known(first('purchasePrice', 'offerPrice') || 'purchasePrice', true) !== null;
  const loanKnown = (() => {
    const price = known('purchasePrice', true), rate = known('annualInterestRate');
    const down = first('downPaymentAmount', 'downPaymentPercent');
    const downValue = down ? known(down) : null;
    const amortization = first('amortizationMonths', 'amortizationYears');
    const amortizationValue = amortization ? known(amortization, true) : null;
    const balloon = first('balloonMonth', 'balloonYears');
    const balloonValue = balloon ? known(balloon, true) : null;
    if (price === null || rate === null || downValue === null || !down || amortizationValue === null
      || amortization === 'amortizationMonths' && !Number.isInteger(amortizationValue)) return false;
    if (down === 'downPaymentAmount' ? downValue >= price : downValue >= 100) return false;
    if (balloon && balloonValue === null) return false;
    // Unit normalization validates loan terms; no payment or financial output is calculated.
    return !balloon || balloonValue! * (balloon === 'balloonYears' ? 12 : 1) <= amortizationValue * (amortization === 'amortizationYears' ? 12 : 1);
  })();
  const complete = scenario.status === 'COMPLETE' && outputs.calculationStatus === 'COMPLETE'
    && Array.isArray(scenario.unresolvedInputs) && scenario.unresolvedInputs.length === 0;
  const holdBasis = purchaseKnown && known('rent', true) !== null && known('vacancyRate') !== null && Number(known('vacancyRate')) <= 100 && all(['vacancyRate', 'propertyTax', 'insurance', 'HOA', 'managementPercent', 'otherOperatingExpenses', 'monthlyPI'])
    && knownEither('maintenanceAmount', 'maintenancePercent');
  const flipBasis = purchaseKnown && known('exitValue', true) !== null && all(['rehab', 'holdingCosts', 'financingCosts']) && knownEither('acquisitionCosts', 'closingCosts') && knownEither('sellingCosts', 'sellingCostPercent');
  const subBasis = known('existingLoanBalance', true) !== null && known('monthlyPI', true) !== null && knownEither('reinstatement', 'arrears') && all(['cashToSeller', 'closingCosts', 'propertyTax', 'insurance', 'HOA', 'expectedRent']);
  const wholesaleBasis = known('contractPrice', true) !== null && known('estimatedBuyerPrice', true) !== null && all(['assignmentFee', 'closingCosts']);
  const fullBasis = complete && (strategy === 'BUY_AND_HOLD' ? holdBasis : strategy === 'FLIP' ? flipBasis : strategy === 'SUB_TO' ? subBasis : strategy === 'WHOLESALE' ? wholesaleBasis : false);
  const outputRows: ReportRow[] = [];
  for (const key of policy.outputs) {
    const amount = finite(outputs[key]), spec = OUTPUT[key];
    if (amount === null || !spec.signed && amount < 0) continue;
    let usable = fullBasis;
    if (strategy === 'SELLER_FINANCING') usable = loanKnown && (key === 'cashToEntry' ? outputs.cashToEntryStatus === 'KNOWN' && all(['closingCosts', 'otherCashToSeller']) : true);
    if (strategy === 'SUB_TO' && ['debtAssumed', 'monthlyDebtService'].includes(key)) usable = known('existingLoanBalance', true) !== null && known('monthlyPI', true) !== null;
    if (key === 'cashOnCashReturn') usable = usable && known('cashInvested', true) !== null;
    if (key === 'DSCR') usable = usable && known('monthlyPI', true) !== null;
    if (sources[key] !== undefined && sources[key] !== 'CALCULATED') usable = false;
    if (!usable || amount === 0 && sources[key] !== 'CALCULATED') { result.diagnostics.push(`SAVED_SCENARIO_OUTPUT_BASIS_INCOMPLETE:${key}`); continue; }
    const label = select(locale, spec.label), value = formatted(amount, spec), ref = `${rootRef}:output:${key}`;
    register(ref, label, value, [amount]);
    result.values[ref] = { state: amount === 0 ? 'EXPLICIT_ZERO' : 'VALUE', text: value, numericValue: amount, source: calculatedSource, evidenceRefs: [ref] };
    outputRows.push({ label, value, source: calculatedSource, evidenceRefs: [ref], state: amount === 0 ? 'EXPLICIT_ZERO' : 'VALUE' });
  }
  const metadata = new Set(['calculationStatus', 'unresolvedInputs', 'guaranteedIncome', 'cashToEntryStatus', 'includedCashComponents', 'hasEarlyBalloon']);
  const mirrored = new Set(policy.inputs);
  for (const key of Object.keys(outputs)) if (!policy.outputs.includes(key) && !metadata.has(key) && !mirrored.has(key)) result.diagnostics.push(`SAVED_SCENARIO_OUTPUT_NOT_DISPLAY_AUTHORIZED:${key}`);
  if (outputRows.length) result.sections.push({ id: 'saved-scenario-results', title: `${t('Cenário confirmado', 'Confirmed scenario', 'Escenario confirmado')} · ${select(locale, policy.label)}`, kind: 'facts', priority: 63, rows: outputRows, evidenceRefs: outputRows.flatMap(row => row.evidenceRefs), continuationPolicy: 'SAME_SECTION' });
  const omitted = policy.outputs.some(key => finite(outputs[key]) !== null && !outputRows.some(row => row.evidenceRefs[0].endsWith(`:output:${key}`)));
  if ((strategy === 'SELLER_FINANCING' ? !loanKnown || outputs.cashToEntryStatus !== 'KNOWN' : !fullBasis) || omitted) {
    const explanation = t('As premissas privadas conhecidas foram preservadas. A base do cenário permanece incompleta; resultados sem todos os insumos necessários foram omitidos, sem presumir custos ausentes como zero.', 'Known private assumptions are preserved. The scenario basis remains incomplete; results without every required input are omitted, without assuming missing costs are zero.', 'Se conservan los supuestos privados conocidos. La base del escenario sigue incompleta; se omiten resultados sin todos los datos requeridos, sin presumir costos ausentes como cero.');
    const ref = `${rootRef}:status:incomplete`; register(ref, t('Base incompleta', 'Incomplete basis', 'Base incompleta'), explanation, []);
    result.sections.push({ id: 'saved-scenario-limitations', title: t('Limites do cenário privado', 'Private-scenario limitations', 'Límites del escenario privado'), kind: 'narrative', priority: 62, text: explanation, evidenceRefs: [ref], continuationPolicy: 'SAME_SECTION' });
  }
  return result;
}
