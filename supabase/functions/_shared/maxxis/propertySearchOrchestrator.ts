import { calculatePropertyMatch } from './calculatePropertyMatch.ts';
import {
  applyBehaviorAdjustment,
  calculateBehaviorAdjustment,
  calculateBehaviorAffinity,
  classifyFinalScore,
} from './behaviorAffinity.ts';
import { detectInvestmentProfileDrift } from './detectInvestmentProfileDrift.ts';
import type {
  MaxxisInvestmentProfile,
  MaxxisPropertyResult,
  SearchMatchedPropertiesResult,
  UserPropertyBehavior,
} from './types.ts';
import type { SearchPropertiesInput } from './searchProperties.ts';

const MAX_CANDIDATE_LIMIT = 20;
const PRICE_FILTERS: Record<string, { minPrice?: number; maxPrice?: number }> = {
  lt_100k: { maxPrice: 99_999.99 },
  '100_200k': { minPrice: 100_000, maxPrice: 199_999.99 },
  '200_400k': { minPrice: 200_000, maxPrice: 399_999.99 },
  '400_800k': { minPrice: 400_000, maxPrice: 799_999.99 },
  '800k_plus': { minPrice: 800_000 },
};
const PROPERTY_TYPE_FILTERS: Record<string, string> = {
  'single family': 'SFR',
  'multi family 2 4': 'Multifamily',
  'multi family 5': 'Multifamily',
  'condo townhouse': 'Condo',
  land: 'Land',
  commercial: 'Commercial',
  'mixed use': 'Mixed-Use',
  'mobile manufactured': 'Manufactured',
};
const OBJECTIVE_FILTERS: Record<string, string> = {
  'buy hold': 'Buy&Hold',
  'fix flip': 'Fix&Flip',
  brrrr: 'BRRRR',
  wholesale: 'Wholesale',
  rent: 'Rent',
  development: 'Develop',
  'new construction': 'New Construction',
};
const STATE_NAMES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY', 'district of columbia': 'DC',
};
const STATE_CODES = new Set(Object.values(STATE_NAMES));

type ProfileResult = {
  profile: MaxxisInvestmentProfile | null;
  exists: boolean;
  complete: boolean;
};
type Dependencies = {
  getProfile: () => Promise<ProfileResult>;
  search: (filters: SearchPropertiesInput) => Promise<MaxxisPropertyResult[]>;
  getBehavior?: () => Promise<UserPropertyBehavior>;
};

const EMPTY_BEHAVIOR: UserPropertyBehavior = {
  actions: [],
  actionCount: 0,
  resolvedActionCount: 0,
  historyAvailable: false,
  windowDays: 90,
  limit: 100,
};

const normalize = (value: unknown) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function stateFromMarket(value: string) {
  const normalized = normalize(value);
  if (STATE_NAMES[normalized]) return STATE_NAMES[normalized];
  const parts = normalized.split(' ').filter(Boolean);
  const last = String(parts.at(-1) || '').toUpperCase();
  return STATE_CODES.has(last) ? last : '';
}

function profileCanCalculate(profile: MaxxisInvestmentProfile | null) {
  if (!profile) return false;
  return Boolean(
    profile.targetMarkets?.length
    || profile.priceRange
    || profile.propertyTypes?.length
    || profile.strategies?.length
    || profile.taxDealObjectives?.length
  );
}

export function derivePersonalizedPropertyFilters(
  explicit: SearchPropertiesInput,
  profile: MaxxisInvestmentProfile,
): SearchPropertiesInput {
  const filters: SearchPropertiesInput = { ...explicit };
  const hasExplicitLocation = Boolean(explicit.state?.length || explicit.city || explicit.zipCode);
  if (!hasExplicitLocation && profile.targetMarkets?.length) {
    const states = Array.from(new Set(profile.targetMarkets.map(stateFromMarket).filter(Boolean)));
    if (states.length) filters.state = states;
    if (profile.targetMarkets.length === 1) {
      const market = String(profile.targetMarkets[0] || '').trim();
      const firstPart = market.split(',')[0].trim();
      if (!stateFromMarket(market) && firstPart) filters.city = firstPart;
      else if (market.includes(',') && firstPart) filters.city = firstPart;
    }
  }

  if (explicit.minPrice === undefined && explicit.maxPrice === undefined && profile.priceRange && PRICE_FILTERS[profile.priceRange]) {
    Object.assign(filters, PRICE_FILTERS[profile.priceRange]);
  }
  if (!explicit.propertyType && profile.propertyTypes?.length === 1) {
    const propertyType = PROPERTY_TYPE_FILTERS[normalize(profile.propertyTypes[0])];
    if (propertyType) filters.propertyType = propertyType;
  }
  if (!explicit.objective) {
    const objectives = Array.from(new Set([...(profile.strategies || []), ...(profile.taxDealObjectives || [])]
      .map((item) => OBJECTIVE_FILTERS[normalize(item)])
      .filter(Boolean)));
    if (objectives.length === 1) filters.objective = objectives[0];
  }
  return filters;
}

export function sortPropertiesByMatch(properties: MaxxisPropertyResult[]) {
  return properties.map((property, index) => ({ property, index })).sort((left, right) => {
    const leftScore = left.property.match?.calculable ? left.property.match.score : null;
    const rightScore = right.property.match?.calculable ? right.property.match.score : null;
    if (leftScore === null && rightScore !== null) return 1;
    if (leftScore !== null && rightScore === null) return -1;
    if (leftScore !== null && rightScore !== null && rightScore !== leftScore) return rightScore - leftScore;
    return left.index - right.index;
  }).map(({ property }) => property);
}

export async function orchestratePropertySearch(
  explicitFilters: SearchPropertiesInput,
  personalized: boolean,
  dependencies: Dependencies,
): Promise<SearchMatchedPropertiesResult> {
  const profileResult = await dependencies.getProfile();
  const profile = profileResult.exists ? profileResult.profile : null;
  const profileCalculable = profileCanCalculate(profile);
  const displayLimit = Math.max(1, Math.min(20, Number(explicitFilters.limit || 10)));

  if (personalized && !profileCalculable) {
    return {
      properties: [],
      filters: explicitFilters,
      personalized: true,
      profileAvailable: profileResult.exists,
      requiresProfile: true,
      evaluatedProperties: 0,
      scoredProperties: 0,
      rankingDurationMs: 0,
      behaviorHistoryAvailable: false,
      behaviorActionCount: 0,
      behaviorSignalApplied: false,
      behaviorDurationMs: 0,
      profileSuggestions: [],
      profileDriftDetected: false,
      profileDriftDurationMs: 0,
    };
  }

  const mergedFilters = personalized && profile
    ? derivePersonalizedPropertyFilters(explicitFilters, profile)
    : { ...explicitFilters };
  const queryFilters = {
    ...mergedFilters,
    limit: personalized ? Math.min(MAX_CANDIDATE_LIMIT, Math.max(displayLimit, displayLimit * 2)) : displayLimit,
  };
  const candidates = await dependencies.search(queryFilters);
  const rankingStartedAt = Date.now();
  const structurallyEnriched = profileResult.exists && profile
    ? candidates.map((property) => ({
      ...property,
      match: calculatePropertyMatch(profile, {
        city: property.city,
        state: property.state,
        price: property.price,
        type: property.propertyType,
        objective: property.objective,
      }),
    }))
    : candidates;
  const behaviorStartedAt = Date.now();
  let behavior = EMPTY_BEHAVIOR;
  if (dependencies.getBehavior && structurallyEnriched.some((property) => property.match?.calculable)) {
    try {
      behavior = await dependencies.getBehavior();
    } catch {
      behavior = EMPTY_BEHAVIOR;
    }
  }
  const affinity = calculateBehaviorAffinity(behavior.actions);
  const driftStartedAt = Date.now();
  const drift = personalized && profile
    ? detectInvestmentProfileDrift(profile, affinity)
    : { hasDrift: false, suggestions: [] };
  const profileDriftDurationMs = Date.now() - driftStartedAt;
  const enriched = affinity.available
    ? structurallyEnriched.map((property) => {
      const structural = property.match;
      if (!structural) return property;
      if (!structural.calculable || structural.score === null) {
        return {
          ...property,
          match: {
            ...structural,
            structuralScore: structural.score,
            behaviorAdjustment: 0,
            behaviorReasons: [],
          },
        };
      }
      const behavioral = calculateBehaviorAdjustment(affinity, {
        city: property.city,
        state: property.state,
        price: property.price,
        type: property.propertyType,
        objective: property.objective,
      });
      const score = applyBehaviorAdjustment(structural.score, behavioral.adjustment);
      return {
        ...property,
        match: {
          ...structural,
          structuralScore: structural.score,
          behaviorAdjustment: behavioral.adjustment,
          behaviorReasons: behavioral.reasons,
          score,
          classification: classifyFinalScore(score),
        },
      };
    })
    : structurallyEnriched.map((property) => property.match ? ({
      ...property,
      match: {
        ...property.match,
        structuralScore: property.match.score,
        behaviorAdjustment: 0,
        behaviorReasons: [],
      },
    }) : property);
  const behaviorDurationMs = Date.now() - behaviorStartedAt;
  const ranked = profileResult.exists ? sortPropertiesByMatch(enriched) : enriched;
  const properties = ranked.slice(0, displayLimit);
  return {
    properties,
    filters: mergedFilters,
    personalized,
    profileAvailable: profileResult.exists,
    requiresProfile: false,
    evaluatedProperties: candidates.length,
    scoredProperties: enriched.filter((property) => property.match?.calculable).length,
    rankingDurationMs: Date.now() - rankingStartedAt,
    behaviorHistoryAvailable: behavior.historyAvailable,
    behaviorActionCount: affinity.actionCount,
    behaviorSignalApplied: enriched.some((property) => Boolean(property.match?.behaviorAdjustment)),
    behaviorDurationMs,
    profileSuggestions: drift.suggestions,
    profileDriftDetected: drift.hasDrift,
    profileDriftDurationMs,
  };
}
