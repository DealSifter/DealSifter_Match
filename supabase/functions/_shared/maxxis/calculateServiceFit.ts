import type {
  MaxxisPropertyDetails,
  MaxxisServiceResult,
  ServiceFitClassification,
  ServiceFitReason,
  ServiceFitResult,
  PropertyServiceNeed,
} from './types.ts';

const CRITERIA = {
  service_type: 60,
  location: 40,
} as const;

const STATE_NAMES: Record<string, string> = {
  alabama: 'al', alaska: 'ak', arizona: 'az', arkansas: 'ar', california: 'ca', colorado: 'co', connecticut: 'ct', delaware: 'de', florida: 'fl', georgia: 'ga', hawaii: 'hi', idaho: 'id', illinois: 'il', indiana: 'in', iowa: 'ia', kansas: 'ks', kentucky: 'ky', louisiana: 'la', maine: 'me', maryland: 'md', massachusetts: 'ma', michigan: 'mi', minnesota: 'mn', mississippi: 'ms', missouri: 'mo', montana: 'mt', nebraska: 'ne', nevada: 'nv', 'new hampshire': 'nh', 'new jersey': 'nj', 'new mexico': 'nm', 'new york': 'ny', 'north carolina': 'nc', 'north dakota': 'nd', ohio: 'oh', oklahoma: 'ok', oregon: 'or', pennsylvania: 'pa', 'rhode island': 'ri', 'south carolina': 'sc', 'south dakota': 'sd', tennessee: 'tn', texas: 'tx', utah: 'ut', vermont: 'vt', virginia: 'va', washington: 'wa', 'west virginia': 'wv', wisconsin: 'wi', wyoming: 'wy', 'district of columbia': 'dc',
};
const STATE_CODES = new Set(Object.values(STATE_NAMES));

export type CalculateServiceFitInput = {
  serviceNeed: Pick<PropertyServiceNeed, 'serviceType'>;
  propertyContext: Pick<MaxxisPropertyDetails, 'city' | 'state'>;
  service: MaxxisServiceResult;
};

const normalizeText = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

function canonicalState(value: unknown) {
  const normalized = normalizeText(value);
  if (STATE_NAMES[normalized]) return STATE_NAMES[normalized];
  return normalized.length === 2 && STATE_CODES.has(normalized) ? normalized : '';
}

function declaredStateCodes(market: string) {
  const codes = new Set<string>();
  const tokens = market.split(' ').filter(Boolean);
  tokens.forEach((token) => {
    if (STATE_CODES.has(token)) codes.add(token);
  });
  Object.entries(STATE_NAMES).forEach(([name, code]) => {
    if (market === name || market.startsWith(`${name} `) || market.endsWith(` ${name}`)) codes.add(code);
  });
  return codes;
}

function reason(
  key: ServiceFitReason['key'],
  label: string,
  maxPoints: number,
  matched: boolean | null,
  points: number,
  detail: ServiceFitReason['detail'],
): ServiceFitReason {
  return {
    key,
    label,
    status: matched === null ? 'not_evaluated' : matched ? 'matched' : 'not_matched',
    matched,
    points,
    maxPoints,
    detail,
  };
}

function evaluateServiceType(input: CalculateServiceFitInput) {
  const needed = normalizeText(input.serviceNeed.serviceType);
  const offered = normalizeText(input.service.serviceType);
  if (!needed || !offered) {
    return reason('service_type', 'Service type', CRITERIA.service_type, null, 0, 'missing_data');
  }
  const matched = needed === offered;
  return reason(
    'service_type',
    'Service type',
    CRITERIA.service_type,
    matched,
    matched ? CRITERIA.service_type : 0,
    matched ? 'exact_service_type' : 'different_service_type',
  );
}

function evaluateLocation(input: CalculateServiceFitInput) {
  const city = normalizeText(input.propertyContext.city);
  const state = canonicalState(input.propertyContext.state);
  const markets = (Array.isArray(input.service.markets) ? input.service.markets : [])
    .map(normalizeText)
    .filter(Boolean);
  if ((!city && !state) || !markets.length) {
    return reason('location', 'Location coverage', CRITERIA.location, null, 0, 'missing_data');
  }

  const cityMatched = Boolean(city) && markets.some((market) => {
    const cityDeclared = market === city || market.startsWith(`${city} `) || market.endsWith(` ${city}`);
    if (!cityDeclared) return false;
    const declaredStates = declaredStateCodes(market);
    return !state || !declaredStates.size || declaredStates.has(state);
  });
  if (cityMatched) {
    return reason('location', 'Location coverage', CRITERIA.location, true, CRITERIA.location, 'city_coverage');
  }

  const stateMatched = Boolean(state) && markets.some((market) => declaredStateCodes(market).has(state));
  if (stateMatched) {
    return reason('location', 'Location coverage', CRITERIA.location, true, 25, 'state_coverage');
  }

  return reason('location', 'Location coverage', CRITERIA.location, false, 0, 'outside_coverage');
}

function classificationFor(score: number | null): ServiceFitClassification {
  if (score === null) return 'unavailable';
  if (score < 40) return 'low_fit';
  if (score < 60) return 'moderate_fit';
  if (score < 80) return 'good_fit';
  return 'strong_fit';
}

export function calculateServiceFit(input: CalculateServiceFitInput): ServiceFitResult {
  const reasons = [evaluateServiceType(input), evaluateLocation(input)];
  const evaluated = reasons.filter((item) => item.status !== 'not_evaluated');
  const evaluatedWeight = evaluated.reduce((total, item) => total + item.maxPoints, 0);
  const earnedPoints = evaluated.reduce((total, item) => total + item.points, 0);
  const rawScore = evaluatedWeight ? (earnedPoints / evaluatedWeight) * 100 : null;
  const score = rawScore === null ? null : Math.max(0, Math.min(100, Math.round(rawScore)));
  return {
    score,
    classification: classificationFor(score),
    calculable: score !== null,
    reasons,
    evaluatedCriteria: evaluated.length,
    possibleCriteria: reasons.length,
    earnedPoints,
    evaluatedWeight,
  };
}

export function rankServicesByFit<T extends { fit: ServiceFitResult }>(services: T[]): T[] {
  return services
    .map((service, index) => ({ service, index }))
    .sort((left, right) => {
      const calculableDifference = Number(right.service.fit.calculable) - Number(left.service.fit.calculable);
      if (calculableDifference) return calculableDifference;
      const scoreDifference = (right.service.fit.score ?? -1) - (left.service.fit.score ?? -1);
      return scoreDifference || left.index - right.index;
    })
    .map(({ service }) => service);
}

export const SERVICE_FIT_WEIGHTS = Object.freeze({ ...CRITERIA });
