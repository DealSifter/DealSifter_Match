import type {
  MaxxisInvestmentProfile,
  PropertyMatchClassification,
  PropertyMatchProperty,
  PropertyMatchReason,
  PropertyMatchResult,
} from './types.ts';

const CRITERIA = {
  market: 35,
  price: 25,
  property_type: 25,
  strategy: 15,
} as const;

const STATE_NAMES: Record<string, string> = {
  alabama: 'al', alaska: 'ak', arizona: 'az', arkansas: 'ar', california: 'ca', colorado: 'co', connecticut: 'ct', delaware: 'de', florida: 'fl', georgia: 'ga', hawaii: 'hi', idaho: 'id', illinois: 'il', indiana: 'in', iowa: 'ia', kansas: 'ks', kentucky: 'ky', louisiana: 'la', maine: 'me', maryland: 'md', massachusetts: 'ma', michigan: 'mi', minnesota: 'mn', mississippi: 'ms', missouri: 'mo', montana: 'mt', nebraska: 'ne', nevada: 'nv', 'new hampshire': 'nh', 'new jersey': 'nj', 'new mexico': 'nm', 'new york': 'ny', 'north carolina': 'nc', 'north dakota': 'nd', ohio: 'oh', oklahoma: 'ok', oregon: 'or', pennsylvania: 'pa', 'rhode island': 'ri', 'south carolina': 'sc', 'south dakota': 'sd', tennessee: 'tn', texas: 'tx', utah: 'ut', vermont: 'vt', virginia: 'va', washington: 'wa', 'west virginia': 'wv', wisconsin: 'wi', wyoming: 'wy', 'district of columbia': 'dc',
};

const PRICE_RANGES: Record<string, { min: number; max: number }> = {
  lt_100k: { min: 0, max: 100_000 },
  '100_200k': { min: 100_000, max: 200_000 },
  '200_400k': { min: 200_000, max: 400_000 },
  '400_800k': { min: 400_000, max: 800_000 },
  '800k_plus': { min: 800_000, max: Number.POSITIVE_INFINITY },
};

const TYPE_ALIASES: Record<string, string> = {
  sfr: 'single_family',
  singlefamily: 'single_family',
  multifamily: 'multifamily',
  multifamily24: 'multifamily',
  multifamily5: 'multifamily',
  condotownhouse: 'condo_townhouse',
  condo: 'condo_townhouse',
  townhouse: 'condo_townhouse',
  land: 'land',
  commercial: 'commercial',
  mixeduse: 'mixed_use',
  mobilemanufactured: 'mobile_manufactured',
  manufactured: 'mobile_manufactured',
  mobile: 'mobile_manufactured',
};

const OBJECTIVE_ALIASES: Record<string, string> = {
  buyhold: 'buy_hold',
  fixflip: 'fix_flip',
  brrrr: 'brrrr',
  wholesale: 'wholesale',
  rent: 'rent',
  development: 'development',
  develop: 'development',
  newconstruction: 'new_construction',
  wholetail: 'wholetail',
};

const normalizeText = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();
const compact = (value: unknown) => normalizeText(value).replace(/\s+/g, '');
const uniqueText = (value: unknown) => Array.from(new Set(
  (Array.isArray(value) ? value : []).map((item) => normalizeText(item)).filter(Boolean),
));

function reason(
  key: PropertyMatchReason['key'],
  label: string,
  maxPoints: number,
  matched: boolean | null,
  detail: string,
): PropertyMatchReason {
  return {
    key,
    label,
    status: matched === null ? 'not_evaluated' : matched ? 'matched' : 'not_matched',
    matched,
    points: matched === true ? maxPoints : 0,
    maxPoints,
    detail,
  };
}

function evaluateMarket(profile: MaxxisInvestmentProfile, property: PropertyMatchProperty) {
  const targets = uniqueText(profile.targetMarkets);
  const city = normalizeText(property.city);
  const stateRaw = normalizeText(property.state);
  const state = STATE_NAMES[stateRaw] || stateRaw;
  const propertyMarkets = uniqueText(property.markets);
  const candidates = new Set([city, state, ...propertyMarkets].filter(Boolean));
  if (city && state) candidates.add(`${city} ${state}`);

  if (!targets.length || !candidates.size) {
    return reason('market', 'Market', CRITERIA.market, null, 'Target market or property location is missing.');
  }
  const matched = targets.some((target) => {
    const normalizedState = STATE_NAMES[target] || target;
    if (candidates.has(normalizedState)) return true;
    const targetParts = target.split(' ').filter(Boolean);
    return targetParts.length > 1 && targetParts.every((part) => candidates.has(STATE_NAMES[part] || part));
  });
  return reason('market', 'Market', CRITERIA.market, matched, matched ? 'Property location matches a target market.' : 'Property location is outside the target markets.');
}

function evaluatePrice(profile: MaxxisInvestmentProfile, property: PropertyMatchProperty) {
  const rangeKey = String(profile.priceRange || '').trim();
  const range = PRICE_RANGES[rangeKey];
  const rawPrice = property.price;
  const price = rawPrice === null || rawPrice === undefined || rawPrice === '' ? Number.NaN : Number(rawPrice);
  if (!range || !Number.isFinite(price) || price <= 0) {
    return reason('price', 'Price range', CRITERIA.price, null, 'Profile price range or property price is missing.');
  }
  const matched = price >= range.min && price < range.max;
  return reason('price', 'Price range', CRITERIA.price, matched, matched ? 'Property price is inside the configured range.' : 'Property price is outside the configured range.');
}

function evaluatePropertyType(profile: MaxxisInvestmentProfile, property: PropertyMatchProperty) {
  const desired = uniqueText(profile.propertyTypes).map((item) => TYPE_ALIASES[compact(item)]).filter(Boolean);
  const actual = TYPE_ALIASES[compact(property.type)];
  if (!desired.length || !actual) {
    return reason('property_type', 'Property type', CRITERIA.property_type, null, 'Desired type or comparable property type is missing.');
  }
  const matched = desired.includes(actual);
  return reason('property_type', 'Property type', CRITERIA.property_type, matched, matched ? 'Property type matches the configured profile.' : 'Property type does not match the configured profile.');
}

function evaluateStrategy(profile: MaxxisInvestmentProfile, property: PropertyMatchProperty) {
  const desired = uniqueText([...(profile.strategies || []), ...(profile.taxDealObjectives || [])])
    .map((item) => OBJECTIVE_ALIASES[compact(item)])
    .filter(Boolean);
  const actual = OBJECTIVE_ALIASES[compact(property.objective)];
  if (!desired.length || !actual) {
    return reason('strategy', 'Strategy / objective', CRITERIA.strategy, null, 'Comparable strategy or property objective is missing.');
  }
  const matched = desired.includes(actual);
  return reason('strategy', 'Strategy / objective', CRITERIA.strategy, matched, matched ? 'Property objective matches a configured strategy.' : 'Property objective does not match the configured strategies.');
}

function classificationFor(score: number | null): PropertyMatchClassification {
  if (score === null) return 'unavailable';
  if (score < 40) return 'low';
  if (score < 60) return 'moderate';
  if (score < 80) return 'good';
  return 'excellent';
}

export function calculatePropertyMatch(
  profile: MaxxisInvestmentProfile | null | undefined,
  property: PropertyMatchProperty | null | undefined,
): PropertyMatchResult {
  if (!profile || !property) {
    return {
      score: null,
      classification: 'unavailable',
      calculable: false,
      reasons: [],
      evaluatedCriteria: 0,
      possibleCriteria: Object.keys(CRITERIA).length,
      earnedPoints: 0,
      evaluatedWeight: 0,
    };
  }

  const reasons = [
    evaluateMarket(profile, property),
    evaluatePrice(profile, property),
    evaluatePropertyType(profile, property),
    evaluateStrategy(profile, property),
  ];
  const evaluated = reasons.filter((item) => item.status !== 'not_evaluated');
  const evaluatedWeight = evaluated.reduce((total, item) => total + item.maxPoints, 0);
  const earnedPoints = evaluated.reduce((total, item) => total + item.points, 0);
  const rawScore = evaluatedWeight > 0 ? (earnedPoints / evaluatedWeight) * 100 : null;
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

export const PROPERTY_MATCH_WEIGHTS = Object.freeze({ ...CRITERIA });
