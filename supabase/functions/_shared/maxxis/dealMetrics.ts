export type DealMetricSource = 'stored' | 'calculated';
export type DealMetricInputKey = 'price' | 'sqft' | 'rehab' | 'capRate';
export type DealMetricUnavailableReason = 'missing_inputs' | 'invalid_input' | 'division_by_zero' | 'unsafe_result';

export type DealMetric = {
  value: number | null;
  calculable: boolean;
  source: DealMetricSource | null;
  missingInputs: DealMetricInputKey[];
  reason: DealMetricUnavailableReason | null;
};

export type DealMetricsInput = {
  price?: number | string | null;
  sqft?: number | string | null;
  rehab?: number | string | null;
  capRate?: number | string | null;
};

export type DealMetricsResult = {
  metrics: {
    pricePerSqft: DealMetric;
    acquisitionPlusRehab: DealMetric;
    capRate: DealMetric;
  };
  missingInputs: DealMetricInputKey[];
};

type NumericKind = 'money' | 'sqft' | 'rate';
type ParsedNumeric = {
  value: number | null;
  status: 'valid' | 'missing' | 'invalid';
};

const PLAIN_MONEY_PATTERN = /^\d+(?:\.\d{1,2})?$/;
const GROUPED_MONEY_PATTERN = /^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/;
const PLAIN_INTEGER_PATTERN = /^\d+$/;
const GROUPED_INTEGER_PATTERN = /^\d{1,3}(?:,\d{3})+$/;
const RATE_PATTERN = /^\d+(?:\.\d{1,2})?$/;

function parseNumeric(value: number | string | null | undefined, kind: NumericKind): ParsedNumeric {
  if (value === null || value === undefined || value === '') return { value: null, status: 'missing' };

  if (typeof value === 'number') {
    const validInteger = kind !== 'sqft' || Number.isInteger(value);
    const safePrecision = kind !== 'money' || value * 100 <= Number.MAX_SAFE_INTEGER;
    if (!Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER || !validInteger || !safePrecision) {
      return { value: null, status: 'invalid' };
    }
    return { value, status: 'valid' };
  }

  let text = value.trim();
  if (!text) return { value: null, status: 'missing' };
  if (kind === 'money') {
    text = text.replace(/^\$\s*/, '');
    if (!text) return { value: null, status: 'invalid' };
  } else if (text.startsWith('$')) {
    return { value: null, status: 'invalid' };
  }

  const validFormat = kind === 'money'
    ? PLAIN_MONEY_PATTERN.test(text) || GROUPED_MONEY_PATTERN.test(text)
    : kind === 'sqft'
      ? PLAIN_INTEGER_PATTERN.test(text) || GROUPED_INTEGER_PATTERN.test(text)
      : RATE_PATTERN.test(text);
  if (!validFormat) return { value: null, status: 'invalid' };

  const parsed = Number(text.replace(/,/g, ''));
  const safePrecision = kind !== 'money' || parsed * 100 <= Number.MAX_SAFE_INTEGER;
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > Number.MAX_SAFE_INTEGER || !safePrecision) {
    return { value: null, status: 'invalid' };
  }
  return { value: parsed, status: 'valid' };
}

export function parseDealMetricNumber(
  value: number | string | null | undefined,
  kind: NumericKind,
): number | null {
  const parsed = parseNumeric(value, kind);
  return parsed.status === 'valid' ? parsed.value : null;
}

function roundCurrency(value: number) {
  if (!Number.isFinite(value) || Math.abs(value) * 100 > Number.MAX_SAFE_INTEGER) return null;
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return Number.isFinite(rounded) ? rounded : null;
}

function unavailableMetric(
  missingInputs: DealMetricInputKey[],
  reason: DealMetricUnavailableReason,
): DealMetric {
  return { value: null, calculable: false, source: null, missingInputs, reason };
}

function availableMetric(value: number, source: DealMetricSource): DealMetric {
  return { value, calculable: true, source, missingInputs: [], reason: null };
}

function unavailableReason(inputs: ParsedNumeric[], divisor?: ParsedNumeric): DealMetricUnavailableReason {
  if (inputs.some((input) => input.status === 'invalid')) return 'invalid_input';
  if (divisor?.status === 'valid' && divisor.value === 0) return 'division_by_zero';
  return 'missing_inputs';
}

export function calculateDealMetrics(input: DealMetricsInput): DealMetricsResult {
  const price = parseNumeric(input.price, 'money');
  const sqft = parseNumeric(input.sqft, 'sqft');
  const rehab = parseNumeric(input.rehab, 'money');
  const capRate = parseNumeric(input.capRate, 'rate');

  const priceAvailable = price.status === 'valid' && price.value !== null && price.value > 0;
  const sqftAvailable = sqft.status === 'valid' && sqft.value !== null && sqft.value > 0;
  const rehabAvailable = rehab.status === 'valid' && rehab.value !== null && rehab.value > 0;
  const capRateAvailable = capRate.status === 'valid' && capRate.value !== null && capRate.value > 0 && capRate.value < 100;

  const pricePerSqftMissing = [
    ...(!priceAvailable ? ['price' as const] : []),
    ...(!sqftAvailable ? ['sqft' as const] : []),
  ];
  let pricePerSqft = unavailableMetric(
    pricePerSqftMissing,
    unavailableReason([price, sqft], sqft),
  );
  if (priceAvailable && sqftAvailable) {
    const calculated = roundCurrency(price.value! / sqft.value!);
    pricePerSqft = calculated === null
      ? unavailableMetric([], 'unsafe_result')
      : availableMetric(calculated, 'calculated');
  }

  const acquisitionPlusRehabMissing = [
    ...(!priceAvailable ? ['price' as const] : []),
    ...(!rehabAvailable ? ['rehab' as const] : []),
  ];
  let acquisitionPlusRehab = unavailableMetric(
    acquisitionPlusRehabMissing,
    unavailableReason([price, rehab]),
  );
  if (priceAvailable && rehabAvailable) {
    const calculated = roundCurrency(price.value! + rehab.value!);
    acquisitionPlusRehab = calculated === null
      ? unavailableMetric([], 'unsafe_result')
      : availableMetric(calculated, 'calculated');
  }

  const storedCapRate = capRateAvailable
    ? availableMetric(capRate.value!, 'stored')
    : unavailableMetric(
      ['capRate'],
      capRate.status === 'invalid' || (capRate.value !== null && capRate.value >= 100)
        ? 'invalid_input'
        : 'missing_inputs',
    );

  const metrics = { pricePerSqft, acquisitionPlusRehab, capRate: storedCapRate };
  const missingInputs = Array.from(new Set(
    Object.values(metrics).flatMap((metric) => metric.missingInputs),
  ));

  return { metrics, missingInputs };
}
