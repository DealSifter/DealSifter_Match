import type {
  BehaviorAdjustmentResult,
  BehaviorAffinity,
  BehaviorAffinityReason,
  BehaviorAffinityTrend,
  PropertyMatchClassification,
  PropertyMatchProperty,
  UserPropertyBehaviorAction,
} from './types.ts';

export const MIN_BEHAVIOR_ACTIONS = 5;
export const MAX_BEHAVIOR_ADJUSTMENT = 10;
const DOMINANT_SHARE = 0.6;
const DIMENSION_WEIGHTS = {
  market: 4,
  propertyType: 3,
  objective: 2,
  priceRange: 1,
} as const;

const normalize = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const compact = (value: unknown) => normalize(value).replace(/\s+/g, '');

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

function marketValues(property: PropertyMatchProperty) {
  const city = normalize(property.city);
  const state = normalize(property.state);
  const markets = (Array.isArray(property.markets) ? property.markets : []).map(normalize).filter(Boolean);
  return Array.from(new Set([state, city && state ? `${city} ${state}` : city, ...markets].filter(Boolean)));
}

function propertyTypeValues(property: PropertyMatchProperty) {
  const value = TYPE_ALIASES[compact(property.type)] || normalize(property.type);
  return value ? [value] : [];
}

function objectiveValues(property: PropertyMatchProperty) {
  const value = OBJECTIVE_ALIASES[compact(property.objective)] || normalize(property.objective);
  return value ? [value] : [];
}

function priceRangeValues(property: PropertyMatchProperty) {
  const price = Number(property.price);
  if (!Number.isFinite(price) || price <= 0) return [];
  if (price < 100_000) return ['lt_100k'];
  if (price < 200_000) return ['100_200k'];
  if (price < 400_000) return ['200_400k'];
  if (price < 800_000) return ['400_800k'];
  return ['800k_plus'];
}

function dominantTrend(valueSets: string[][], actionCount: number): BehaviorAffinityTrend | null {
  const minimumOccurrences = Math.max(3, Math.ceil(actionCount * DOMINANT_SHARE));
  const counts = new Map<string, number>();
  valueSets.forEach((values) => Array.from(new Set(values)).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1)));
  const values = Array.from(counts.entries())
    .filter(([, count]) => count >= minimumOccurrences)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([value]) => value);
  return values.length ? {
    values,
    observations: actionCount,
    minimumOccurrences,
    evidenceCounts: Object.fromEntries(values.map((value) => [value, counts.get(value) || 0])),
  } : null;
}

export function calculateBehaviorAffinity(actions: UserPropertyBehaviorAction[]): BehaviorAffinity {
  const validActions = (Array.isArray(actions) ? actions : []).filter((item) => item?.action === 'interested' && item?.signal === 'positive' && item?.property);
  const actionCount = validActions.length;
  const unavailable: BehaviorAffinity = {
    available: false,
    actionCount,
    trends: { market: null, propertyType: null, objective: null, priceRange: null },
  };
  if (actionCount < MIN_BEHAVIOR_ACTIONS) return unavailable;

  const properties = validActions.map((item) => item.property);
  const trends = {
    market: dominantTrend(properties.map(marketValues), actionCount),
    propertyType: dominantTrend(properties.map(propertyTypeValues), actionCount),
    objective: dominantTrend(properties.map(objectiveValues), actionCount),
    priceRange: dominantTrend(properties.map(priceRangeValues), actionCount),
  };
  return { available: Object.values(trends).some(Boolean), actionCount, trends };
}

function evaluateTrend(
  trend: BehaviorAffinityTrend | null,
  candidateValues: string[],
  weight: number,
  key: BehaviorAffinityReason['key'],
  positiveDetail: string,
  negativeDetail: string,
): BehaviorAffinityReason | null {
  if (!trend || !candidateValues.length) return null;
  const matched = candidateValues.some((value) => trend.values.includes(value));
  return { key, effect: matched ? weight : -weight, detail: matched ? positiveDetail : negativeDetail };
}

export function calculateBehaviorAdjustment(
  affinity: BehaviorAffinity,
  property: PropertyMatchProperty,
): BehaviorAdjustmentResult {
  if (!affinity.available) return { adjustment: 0, reasons: [] };
  const reasons = [
    evaluateTrend(affinity.trends.market, marketValues(property), DIMENSION_WEIGHTS.market, 'behavior_market_affinity', 'Recent interactions indicate interest in similar markets.', 'Recent interactions indicate a different market tendency.'),
    evaluateTrend(affinity.trends.propertyType, propertyTypeValues(property), DIMENSION_WEIGHTS.propertyType, 'behavior_property_type_affinity', 'Recent interactions indicate interest in similar property types.', 'Recent interactions indicate a different property-type tendency.'),
    evaluateTrend(affinity.trends.objective, objectiveValues(property), DIMENSION_WEIGHTS.objective, 'behavior_objective_affinity', 'Recent interactions indicate interest in similar investment objectives.', 'Recent interactions indicate a different investment-objective tendency.'),
    evaluateTrend(affinity.trends.priceRange, priceRangeValues(property), DIMENSION_WEIGHTS.priceRange, 'behavior_price_affinity', 'Recent interactions indicate interest in a similar price range.', 'Recent interactions indicate a different price-range tendency.'),
  ].filter((item): item is BehaviorAffinityReason => item !== null);
  const rawAdjustment = reasons.reduce((total, item) => total + item.effect, 0);
  return {
    adjustment: Math.max(-MAX_BEHAVIOR_ADJUSTMENT, Math.min(MAX_BEHAVIOR_ADJUSTMENT, rawAdjustment)),
    reasons,
  };
}

export function applyBehaviorAdjustment(structuralScore: number, adjustment: number) {
  return Math.max(0, Math.min(100, Math.round(structuralScore + adjustment)));
}

export function classifyFinalScore(score: number): PropertyMatchClassification {
  if (score < 40) return 'low';
  if (score < 60) return 'moderate';
  if (score < 80) return 'good';
  return 'excellent';
}

export const BEHAVIOR_DIMENSION_WEIGHTS = Object.freeze({ ...DIMENSION_WEIGHTS });
