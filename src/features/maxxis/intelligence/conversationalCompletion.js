import { COMPLETION_FIELDS, completionLabel } from '../../../../supabase/functions/_shared/maxxis/reportCompletion.ts';

const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const number = raw => {
  const text = raw.replace(/\s/g, '');
  const last = Math.max(text.lastIndexOf('.'), text.lastIndexOf(',')), decimals = last < 0 ? 0 : text.length - last - 1;
  const both = text.includes('.') && text.includes(',');
  const canonical = last >= 0 && (both || decimals !== 3)
    ? text.slice(0, last).replace(/[.,]/g, '') + '.' + text.slice(last + 1) : text.replace(/[.,]/g, '');
  const value = Number(canonical);
  return Number.isFinite(value) && value >= 0 && value <= 1e9 ? value : null;
};
const patterns = [
  ['insurance', /insurance|seguro/], ['rent', /\brent\b|aluguel|alquiler/],
  ['propertyTax', /property tax|imposto|impuestos/], ['maintenanceAmount', /maintenance|manutencao|mantenimiento/],
  ['HOA', /\bhoa\b|condominio/], ['utilities', /utilities|servicos|servicios/],
  ['vacancyRate', /vacancy|vacancia/], ['managementPercent', /management|administracao|administracion/],
  ['opexPercent', /\bopex\b|total operating expenses|despesas totais|gastos totales/],
  ['monthlyPI', /debt payment|monthly payment|pagamento da divida|parcela da divida/],
  ['cashInvested', /cash invested|capital investido|capital invertido/],
];

/** Conservative deterministic candidates. A parsed statement never authorizes a write. */
export function parseConversationalCompletion(message) {
  const text = normalize(message);
  if (/[?]/.test(text) || /\b(what if|e se|y si|suppose|imagine|maybe|talvez|hipotetic|if i)\b/.test(text)) return null;
  const values = {}, candidates = [];
  for (const rawClause of String(message || '').split(/\s+(?:and|e|y)\s+|[;\n]/i)) {
    const clause = normalize(rawClause);
    const matching = patterns.filter(([, pattern]) => pattern.test(clause));
    if (matching.length !== 1) continue;
    const [key] = matching[0], spec = COMPLETION_FIELDS[key];
    const amounts = [...clause.matchAll(/(?:\$|usd\s*)?\b(\d[\d.,]*)\s*(%)?/g)];
    if (amounts.length !== 1) continue;
    let value = number(amounts[0][1]);
    if (value === null || spec.unit === 'PERCENT' && (!amounts[0][2] || value > 100)) continue;
    const monthly = /month|monthly|mensal|mes|mensual/.test(clause);
    const annual = /year|annual|anual|ano|anual/.test(clause);
    if (spec.unit === 'USD' && spec.cadence !== 'ONE_TIME') {
      if (monthly === annual) continue; // Ambiguous cadence cannot become an annual/monthly value.
      if (spec.cadence === 'ANNUAL' && monthly) value *= 12;
      if (spec.cadence === 'MONTHLY' && annual) value /= 12;
    }
    if (values[key] !== undefined && values[key] !== value) return null;
    values[key] = value;
    candidates.push({ field: key, value, cadence: spec.cadence, unit: spec.unit, confirmed: false,
      origin: key === 'rent' || key === 'vacancyRate' || key === 'opexPercent' ? 'ASSUMPTION' : 'USER_DECLARED' });
    if (key === 'opexPercent') values.opexMethod = 'AGGREGATE_EGI';
  }
  return candidates.length ? { values, candidates, requiresConfirmation: true } : null;
}

export function completionEcho(values, language = 'en') {
  return Object.entries(values).map(([key, value]) => {
    const spec = COMPLETION_FIELDS[key];
    return `${completionLabel(key, language)}: ${value}${spec ? ` ${spec.unit} / ${spec.cadence}` : ''}`;
  }).join('\n');
}
