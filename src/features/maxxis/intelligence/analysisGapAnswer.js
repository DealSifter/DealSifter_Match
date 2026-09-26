const CONDITION_PATTERNS = [
  ['NEW_CONSTRUCTION', /\b(new construction|nova constru[cç][aã]o|construcci[oó]n nueva)\b/i],
  ['FULL_RENOVATION', /\b(full renovation|full rehab|reforma completa|renovaci[oó]n completa)\b/i],
  ['STANDARD_RENOVATION', /\b(standard renovation|standard rehab|reforma (?:padr[aã]o|media|m[eé]dia)|renovaci[oó]n est[aá]ndar)\b/i],
  ['LIGHT_REHAB', /\b(light rehab|light renovation|reforma leve|renovaci[oó]n ligera)\b/i],
  ['HIGH_END', /\b(high[ -]?end|alto padr[aã]o|alta gama)\b/i],
  ['TURN_KEY', /\b(turn[ -]?key|pronto para morar|llave en mano)\b/i],
  ['AS_IS', /\b(as[ -]?is|estado atual|tal como est[aá]|como est[aá])\b/i],
];

function numericBudget(value) {
  const match = String(value || '').match(/(?:US\$|USD|\$)?\s*(\d[\d.,]*)/i);
  if (!match) return null;
  const raw = match[1];
  const separators = (raw.match(/[.,]/g) || []).length;
  let normalized = raw;
  if (separators > 1 || /[.,]\d{3}$/.test(raw)) normalized = raw.replace(/[.,]/g, '');
  else normalized = raw.replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function parseAnalysisGapAnswer(message, answer) {
  const missing = Array.isArray(message?.data?.missingUserInputs) ? message.data.missingUserInputs : [];
  const clean = String(answer || '').trim();
  if (!missing.length || !clean) return null;
  if (/\b(continue anyway|continue with limitations|skip|pular|continuar com limita[cç][oõ]es|seguir sem|omitir|continuar con limitaciones)\b/i.test(clean)) {
    return { action: 'decline', fields: missing };
  }
  if (missing.includes('target_condition')) {
    const condition = CONDITION_PATTERNS.find(([, pattern]) => pattern.test(clean))?.[0];
    return condition ? { action: 'resolve', values: { targetCondition: condition } } : null;
  }
  if (missing.includes('rehab_budget')) {
    if (/\b(benchmark|refer[eê]ncia|reference|referencia)\b/i.test(clean)) {
      const target = String(message?.data?.assumptions?.targetCondition || '');
      const benchmark = (message?.data?.benchmarkOptions || []).find((item) => item?.scope === target);
      return benchmark ? { action: 'resolve', values: {
        rehabBudget: benchmark.mid,
        rehabSource: 'USER_CURATED_REHAB_BENCHMARK_2026',
      } } : null;
    }
    const amount = numericBudget(clean);
    return amount === null ? null : { action: 'resolve', values: {
      rehabBudget: amount,
      rehabSource: 'USER_PROVIDED',
    } };
  }
  return null;
}
