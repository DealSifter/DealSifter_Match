export type SellerFinancingScenarioInput = {
  purchasePrice: number;
  downPaymentAmount?: number | null;
  downPaymentPercent?: number | null;
  annualInterestRate: number;
  amortizationMonths?: number | null;
  amortizationYears?: number | null;
  balloonMonth?: number | null;
  balloonYears?: number | null;
  explicitTermMonths?: number | null;
  closingCosts?: number | null;
  otherCashToSeller?: number | null;
};

export type SellerFinancingScenarioResult = Readonly<{
  purchasePrice: number;
  downPaymentAmount: number;
  downPaymentPercent: number;
  financedPrincipal: number;
  financedPercent: number;
  annualInterestRate: number;
  amortizationMonths: number;
  balloonMonth: number;
  hasEarlyBalloon: boolean;
  monthlyPI: number;
  balloonBalance: number;
  principalPaidToBalloon: number;
  interestPaidToBalloon: number;
  totalScheduledPIToBalloon: number;
  cashToEntry: number;
  includedCashComponents: readonly string[];
}>;

export type ParsedSellerFinancingAssumptions = Readonly<{
  purchasePrice?: number;
  downPaymentAmount?: number;
  downPaymentPercent?: number;
  annualInterestRate?: number;
  amortizationYears?: number;
  balloonYears?: number;
  closingCosts?: number;
  otherCashToSeller?: number;
}>;

const cents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const percent = (value: number) => Math.round((value + Number.EPSILON) * 10000) / 10000;
const finite = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : null;

export function calculateSellerFinancingScenario(input: SellerFinancingScenarioInput): SellerFinancingScenarioResult {
  const purchasePrice = finite(input.purchasePrice);
  const annualInterestRate = finite(input.annualInterestRate);
  const amortizationMonths = finite(input.amortizationMonths)
    ?? (finite(input.amortizationYears) === null ? null : Math.round(Number(input.amortizationYears) * 12));
  const balloonMonth = finite(input.balloonMonth)
    ?? (finite(input.balloonYears) === null ? amortizationMonths : Math.round(Number(input.balloonYears) * 12));
  if (purchasePrice === null || purchasePrice <= 0) throw new Error('SELLER_FINANCING_PURCHASE_PRICE_REQUIRED');
  if (annualInterestRate === null || annualInterestRate < 0) throw new Error('SELLER_FINANCING_INTEREST_REQUIRED');
  if (amortizationMonths === null || amortizationMonths <= 0 || !Number.isInteger(amortizationMonths)) throw new Error('SELLER_FINANCING_AMORTIZATION_INVALID');
  if (balloonMonth === null || balloonMonth <= 0 || !Number.isInteger(balloonMonth)) throw new Error('SELLER_FINANCING_BALLOON_INVALID');
  if (balloonMonth > amortizationMonths) throw new Error('SELLER_FINANCING_BALLOON_AFTER_AMORTIZATION');

  const explicitDownAmount = finite(input.downPaymentAmount);
  const explicitDownPercent = finite(input.downPaymentPercent);
  if (explicitDownAmount === null && explicitDownPercent === null) throw new Error('SELLER_FINANCING_DOWN_PAYMENT_REQUIRED');
  if (explicitDownPercent !== null && (explicitDownPercent < 0 || explicitDownPercent >= 100)) throw new Error('SELLER_FINANCING_DOWN_PAYMENT_INVALID');
  const downPaymentAmount = cents(explicitDownAmount ?? (purchasePrice * Number(explicitDownPercent) / 100));
  if (downPaymentAmount < 0 || downPaymentAmount >= purchasePrice) throw new Error('SELLER_FINANCING_DOWN_PAYMENT_INVALID');
  const financedPrincipal = cents(purchasePrice - downPaymentAmount);
  const monthlyRate = annualInterestRate / 100 / 12;
  const monthlyPI = cents(monthlyRate === 0
    ? financedPrincipal / amortizationMonths
    : financedPrincipal * monthlyRate * ((1 + monthlyRate) ** amortizationMonths)
      / (((1 + monthlyRate) ** amortizationMonths) - 1));
  const exactPayment = monthlyRate === 0
    ? financedPrincipal / amortizationMonths
    : financedPrincipal * monthlyRate * ((1 + monthlyRate) ** amortizationMonths)
      / (((1 + monthlyRate) ** amortizationMonths) - 1);
  const exactBalance = balloonMonth === amortizationMonths ? 0 : monthlyRate === 0
    ? financedPrincipal - (exactPayment * balloonMonth)
    : financedPrincipal * ((1 + monthlyRate) ** balloonMonth)
      - exactPayment * ((((1 + monthlyRate) ** balloonMonth) - 1) / monthlyRate);
  const balloonBalance = cents(Math.max(0, exactBalance));
  const principalPaidToBalloon = cents(financedPrincipal - balloonBalance);
  const totalScheduledPIToBalloon = cents(exactPayment * balloonMonth);
  const interestPaidToBalloon = cents(Math.max(0, totalScheduledPIToBalloon - principalPaidToBalloon));
  const closingCosts = finite(input.closingCosts);
  const otherCashToSeller = finite(input.otherCashToSeller);
  if ((closingCosts !== null && closingCosts < 0) || (otherCashToSeller !== null && otherCashToSeller < 0)) throw new Error('SELLER_FINANCING_CASH_COMPONENT_INVALID');
  const includedCashComponents = ['downPayment'];
  if (closingCosts !== null) includedCashComponents.push('closingCosts');
  if (otherCashToSeller !== null) includedCashComponents.push('otherCashToSeller');
  return Object.freeze({
    purchasePrice: cents(purchasePrice), downPaymentAmount,
    downPaymentPercent: percent((downPaymentAmount / purchasePrice) * 100),
    financedPrincipal, financedPercent: percent((financedPrincipal / purchasePrice) * 100),
    annualInterestRate: percent(annualInterestRate), amortizationMonths, balloonMonth,
    hasEarlyBalloon: balloonMonth < amortizationMonths, monthlyPI, balloonBalance,
    principalPaidToBalloon, interestPaidToBalloon, totalScheduledPIToBalloon,
    cashToEntry: cents(downPaymentAmount + (closingCosts ?? 0) + (otherCashToSeller ?? 0)),
    includedCashComponents: Object.freeze(includedCashComponents),
  });
}

function amount(raw: string, suffix = '') {
  const normalized = raw.replace(/,/g, '').trim();
  const value = Number(normalized);
  if (!Number.isFinite(value)) return undefined;
  const multiplier = /k/i.test(suffix) ? 1_000 : /m/i.test(suffix) ? 1_000_000 : 1;
  return cents(value * multiplier);
}

export function parseSellerFinancingAssumptions(message: unknown): ParsedSellerFinancingAssumptions {
  const raw = String(message || '');
  const text = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const result: Record<string, number> = {};
  const downAmount = text.match(/(?:\$|us\$)?\s*([0-9]+(?:[.,][0-9]+)?)\s*([km])?\s*(?:de\s+)?(?:entrada|down(?:\s+payment)?|pago\s+inicial)/i)
    || text.match(/(?:entrada|down(?:\s+payment)?|pago\s+inicial)\s*(?:de|of)?\s*(?:\$|us\$)?\s*([0-9]+(?:[.,][0-9]+)?)\s*([km])?/i);
  const downPercent = text.match(/([0-9]+(?:[.,][0-9]+)?)\s*%\s*(?:de\s+)?(?:entrada|down(?:\s+payment)?|pago\s+inicial)/i);
  const interest = text.match(/([0-9]+(?:[.,][0-9]+)?)\s*%\s*(?:ao\s+ano|a\.a\.?|annual|per\s+year|anual|de\s+juros|interest|interes)\b/i)
    || (/^\s*(?:e\s+)?(?:com|at|a)?\s*[0-9]+(?:[.,][0-9]+)?\s*%\s*\??\s*$/i.test(text)
      ? text.match(/([0-9]+(?:[.,][0-9]+)?)\s*%/) : null);
  const amortization = text.match(/(?:amortiza(?:cao|tion|cion)|amortized?)\s*(?:em|over|a|de)?\s*([0-9]+)\s*(?:anos?|years?|meses?|months?)/i)
    || text.match(/([0-9]+)\s*(?:anos?|years?)\s*(?:de\s+)?amortiza(?:cao|tion|cion)/i)
    || text.match(/([0-9]+)\s*[- ]?(?:year|ano)s?\s+amortization/i)
    || text.match(/([0-9]+)\s*(?:anos?|years?)\s*(?:com|with)\s+balloon/i);
  const balloon = text.match(/balloon\s*(?:em|in|a|de|after)?\s*([0-9]+)\s*(?:anos?|years?|meses?|months?)/i);
  const price = text.match(/(?:preco|price|purchase price|valor de compra|oferta)\s*(?:de|of)?\s*(?:\$|us\$)?\s*([0-9]+(?:[.,][0-9]+)?)\s*([km])?/i);
  const closing = text.match(/(?:closing costs?|custos? de fechamento)\s*(?:de|of)?\s*(?:\$|us\$)?\s*([0-9]+(?:[.,][0-9]+)?)\s*([km])?/i);
  const cashSeller = text.match(/(?:cash to seller|caixa adicional ao vendedor)\s*(?:de|of)?\s*(?:\$|us\$)?\s*([0-9]+(?:[.,][0-9]+)?)\s*([km])?/i);
  const parsedDownAmount = downAmount ? amount(downAmount[1].replace(',', '.'), downAmount[2]) : undefined;
  const parsedPrice = price ? amount(price[1].replace(',', '.'), price[2]) : undefined;
  const parsedClosingCosts = closing ? amount(closing[1].replace(',', '.'), closing[2]) : undefined;
  const parsedCashToSeller = cashSeller ? amount(cashSeller[1].replace(',', '.'), cashSeller[2]) : undefined;
  if (parsedDownAmount !== undefined) result.downPaymentAmount = parsedDownAmount;
  if (downPercent) result.downPaymentPercent = Number(downPercent[1].replace(',', '.'));
  if (interest) result.annualInterestRate = Number(interest[1].replace(',', '.'));
  if (amortization) result.amortizationYears = Number(amortization[1]);
  if (balloon) result.balloonYears = Number(balloon[1]);
  if (parsedPrice !== undefined) result.purchasePrice = parsedPrice;
  if (parsedClosingCosts !== undefined) result.closingCosts = parsedClosingCosts;
  if (parsedCashToSeller !== undefined) result.otherCashToSeller = parsedCashToSeller;
  return Object.freeze(result);
}

export function detectsSellerFinancingScenario(message: unknown) {
  const text = String(message || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const parsed = parseSellerFinancingAssumptions(text);
  const namesSellerFinancingInput = /seller financing|financiamento (?:pelo|do) vendedor|balloon|amortiza|entrada|down payment/.test(text);
  const isRateOnlyFollowUp = /^\s*(?:e\s+)?(?:com|at|a)?\s*[0-9]+(?:[.,][0-9]+)?\s*%\s*\??\s*$/.test(text);
  return (namesSellerFinancingInput || isRateOnlyFollowUp) && Object.keys(parsed).length > 0;
}

type ConversationItem = { role?: unknown; content?: unknown };

export function resolveSellerFinancingScenarioFromConversation(options: {
  message: unknown;
  history?: ConversationItem[];
  askingPrice?: unknown;
  storedAssumptions?: Partial<SellerFinancingScenarioInput> | null;
}) {
  const current = parseSellerFinancingAssumptions(options.message);
  const priorMessages = (Array.isArray(options.history) ? options.history : [])
    .filter((item) => item?.role !== 'assistant')
    .map((item) => parseSellerFinancingAssumptions(item?.content))
    .filter((item) => Object.keys(item).length > 0);
  const previous = priorMessages.at(-1) || {};
  const stored = options.storedAssumptions || {};
  const base = {
    purchasePrice: current.purchasePrice ?? previous.purchasePrice ?? finite(stored.purchasePrice) ?? finite(options.askingPrice) ?? undefined,
    downPaymentAmount: current.downPaymentAmount ?? previous.downPaymentAmount ?? finite(stored.downPaymentAmount) ?? undefined,
    downPaymentPercent: current.downPaymentPercent ?? previous.downPaymentPercent ?? finite(stored.downPaymentPercent) ?? undefined,
    annualInterestRate: current.annualInterestRate ?? previous.annualInterestRate ?? finite(stored.annualInterestRate) ?? undefined,
    amortizationYears: current.amortizationYears ?? previous.amortizationYears ?? finite(stored.amortizationYears) ?? undefined,
    balloonYears: current.balloonYears ?? previous.balloonYears ?? finite(stored.balloonYears) ?? undefined,
    closingCosts: current.closingCosts ?? previous.closingCosts ?? finite(stored.closingCosts) ?? undefined,
    otherCashToSeller: current.otherCashToSeller ?? previous.otherCashToSeller ?? finite(stored.otherCashToSeller) ?? undefined,
  };
  const missing = [
    !base.purchasePrice && 'purchasePrice',
    base.downPaymentAmount === undefined && base.downPaymentPercent === undefined && 'downPayment',
    base.annualInterestRate === undefined && 'annualInterestRate',
    !base.amortizationYears && 'amortization',
    !base.balloonYears && 'balloon',
  ].filter(Boolean) as string[];
  if (missing.length) return Object.freeze({ state: 'INCOMPLETE' as const, assumptions: Object.freeze(base), missing: Object.freeze(missing), result: null, comparison: null });
  const result = calculateSellerFinancingScenario(base as SellerFinancingScenarioInput);
  let comparison = null;
  let previousResult = null;
  if (Object.keys(previous).length > 0) {
    const priorBase = { ...base, ...previous, purchasePrice: previous.purchasePrice ?? base.purchasePrice };
    const priorMissing = [priorBase.downPaymentAmount === undefined && priorBase.downPaymentPercent === undefined,
      priorBase.annualInterestRate === undefined, !priorBase.amortizationYears, !priorBase.balloonYears].some(Boolean);
    if (!priorMissing && JSON.stringify(previous) !== JSON.stringify(current)) {
      previousResult = calculateSellerFinancingScenario(priorBase as SellerFinancingScenarioInput);
      comparison = compareSellerFinancingScenarios(previousResult, result);
    }
  }
  return Object.freeze({ state: 'CALCULATED' as const, assumptions: Object.freeze(base), missing: Object.freeze([]),
    result, previousResult, comparison, readiness: sellerFinancingScenarioReadiness(result) });
}

const locale = (language: string) => language === 'pt' ? 'pt-BR' : language === 'es' ? 'es-US' : 'en-US';
const money = (value: number, language: string) => new Intl.NumberFormat(locale(language), {
  style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(value);

export function formatSellerFinancingScenarioAnswer(resolution: ReturnType<typeof resolveSellerFinancingScenarioFromConversation>, languageInput: unknown) {
  const language = ['pt', 'es'].includes(String(languageInput)) ? String(languageInput) : 'en';
  if (resolution.state !== 'CALCULATED' || !resolution.result) {
    const labels: Record<string, Record<string, string>> = {
      pt: { purchasePrice: 'preço de compra', downPayment: 'entrada', annualInterestRate: 'taxa anual de juros', amortization: 'amortização', balloon: 'prazo do balloon' },
      es: { purchasePrice: 'precio de compra', downPayment: 'pago inicial', annualInterestRate: 'tasa anual', amortization: 'amortización', balloon: 'plazo del balloon' },
      en: { purchasePrice: 'purchase price', downPayment: 'down payment', annualInterestRate: 'annual interest rate', amortization: 'amortization', balloon: 'balloon term' },
    };
    const missing = resolution.missing.map((item) => labels[language][item] || item).join(', ');
    return language === 'pt' ? `Para calcular este cenário sem inventar premissas, informe: ${missing}.`
      : language === 'es' ? `Para calcular este escenario sin inventar supuestos, indica: ${missing}.`
        : `To calculate this scenario without inventing assumptions, provide: ${missing}.`;
  }
  const r = resolution.result;
  const years = (months: number) => Number.isInteger(months / 12) ? String(months / 12) : String(months);
  const basis = language === 'pt' ? 'Usei o preço pedido atual porque você não informou outro preço de compra.'
    : language === 'es' ? 'Usé el precio pedido actual porque no indicaste otro precio de compra.'
      : 'I used the current asking price because you did not provide another purchase price.';
  const comparison = resolution.comparison && resolution.previousResult
    ? (language === 'pt'
      ? `\n\nComparação com o cenário anterior\n- Parcela mensal: ${money(resolution.comparison.monthlyPI, language)}\n- Saldo no balloon: ${money(resolution.comparison.balloonBalance, language)}\n- Juros até o balloon: ${money(resolution.comparison.interestPaidToBalloon, language)}\n(Valores negativos representam redução.)`
      : language === 'es'
        ? `\n\nComparación con el escenario anterior\n- Pago mensual: ${money(resolution.comparison.monthlyPI, language)}\n- Saldo balloon: ${money(resolution.comparison.balloonBalance, language)}\n- Intereses hasta el balloon: ${money(resolution.comparison.interestPaidToBalloon, language)}\n(Los valores negativos representan una reducción.)`
        : `\n\nComparison with the prior scenario\n- Monthly payment: ${money(resolution.comparison.monthlyPI, language)}\n- Balloon balance: ${money(resolution.comparison.balloonBalance, language)}\n- Interest to balloon: ${money(resolution.comparison.interestPaidToBalloon, language)}\n(Negative values mean a reduction.)`)
    : '';
  if (language === 'pt') return `Cenário usado\n- Preço: ${money(r.purchasePrice, language)}\n- Entrada: ${money(r.downPaymentAmount, language)} (${r.downPaymentPercent.toLocaleString('pt-BR')}%)\n- Valor financiado: ${money(r.financedPrincipal, language)}\n- Juros: ${r.annualInterestRate.toLocaleString('pt-BR')}% ao ano\n- Amortização: ${years(r.amortizationMonths)} anos\n- Balloon: ${years(r.balloonMonth)} anos\n\nResultado\n- Parcela mensal P&I: ${money(r.monthlyPI, language)}\n- Saldo no balloon: ${money(r.balloonBalance, language)}\n- Principal amortizado até o balloon: ${money(r.principalPaidToBalloon, language)}\n- Juros pagos até o balloon: ${money(r.interestPaidToBalloon, language)}\n- Caixa inicial conhecido: ${money(r.cashToEntry, language)}\n\nLeitura Maxxis\n- ${basis}\n- P&I não inclui impostos, seguro ou HOA.\n- O saldo do balloon exigirá quitação, refinanciamento ou nova negociação no prazo indicado.${comparison}`;
  if (language === 'es') return `Escenario usado\n- Precio: ${money(r.purchasePrice, language)}\n- Pago inicial: ${money(r.downPaymentAmount, language)} (${r.downPaymentPercent.toLocaleString('es-US')}%)\n- Valor financiado: ${money(r.financedPrincipal, language)}\n- Interés: ${r.annualInterestRate.toLocaleString('es-US')}% anual\n- Amortización: ${years(r.amortizationMonths)} años\n- Balloon: ${years(r.balloonMonth)} años\n\nResultado\n- Pago mensual P&I: ${money(r.monthlyPI, language)}\n- Saldo balloon: ${money(r.balloonBalance, language)}\n- Principal amortizado: ${money(r.principalPaidToBalloon, language)}\n- Intereses pagados: ${money(r.interestPaidToBalloon, language)}\n- Efectivo inicial conocido: ${money(r.cashToEntry, language)}\n\nLectura Maxxis\n- ${basis}\n- P&I no incluye impuestos, seguro ni HOA.\n- El saldo balloon requerirá pago, refinanciación o renegociación.${comparison}`;
  return `Scenario used\n- Price: ${money(r.purchasePrice, language)}\n- Down payment: ${money(r.downPaymentAmount, language)} (${r.downPaymentPercent}%)\n- Financed principal: ${money(r.financedPrincipal, language)}\n- Interest: ${r.annualInterestRate}% annually\n- Amortization: ${years(r.amortizationMonths)} years\n- Balloon: ${years(r.balloonMonth)} years\n\nResult\n- Monthly P&I: ${money(r.monthlyPI, language)}\n- Balloon balance: ${money(r.balloonBalance, language)}\n- Principal paid to balloon: ${money(r.principalPaidToBalloon, language)}\n- Interest paid to balloon: ${money(r.interestPaidToBalloon, language)}\n- Known cash to entry: ${money(r.cashToEntry, language)}\n\nMaxxis reading\n- ${basis}\n- P&I excludes tax, insurance and HOA.\n- The balloon balance will require payoff, refinancing or renegotiation.${comparison}`;
}

export function compareSellerFinancingScenarios(left: SellerFinancingScenarioResult, right: SellerFinancingScenarioResult) {
  return Object.freeze({
    cashToEntry: cents(right.cashToEntry - left.cashToEntry),
    monthlyPI: cents(right.monthlyPI - left.monthlyPI),
    balloonBalance: cents(right.balloonBalance - left.balloonBalance),
    interestPaidToBalloon: cents(right.interestPaidToBalloon - left.interestPaidToBalloon),
    financedPrincipal: cents(right.financedPrincipal - left.financedPrincipal),
  });
}

export function sellerFinancingScenarioReadiness(result: SellerFinancingScenarioResult) {
  return Object.freeze({
    downPayment: 'INPUT_COMPLETE', interestPayment: 'INPUT_COMPLETE', termAmortization: 'INPUT_COMPLETE',
    semantics: 'INPUT_EVIDENCE_COMPLETENESS_ONLY', scenario: result,
  });
}
