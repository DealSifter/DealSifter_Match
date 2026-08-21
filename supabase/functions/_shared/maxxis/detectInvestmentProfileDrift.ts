import { MIN_BEHAVIOR_ACTIONS } from './behaviorAffinity.ts';
import type {
  BehaviorAffinity,
  BehaviorAffinityTrend,
  InvestmentProfileDriftResult,
  MaxxisInvestmentProfile,
  ProfileDriftSuggestion,
} from './types.ts';

const STATE_NAMES: Record<string, string> = {
  alabama: 'al', alaska: 'ak', arizona: 'az', arkansas: 'ar', california: 'ca', colorado: 'co', connecticut: 'ct', delaware: 'de', florida: 'fl', georgia: 'ga', hawaii: 'hi', idaho: 'id', illinois: 'il', indiana: 'in', iowa: 'ia', kansas: 'ks', kentucky: 'ky', louisiana: 'la', maine: 'me', maryland: 'md', massachusetts: 'ma', michigan: 'mi', minnesota: 'mn', mississippi: 'ms', missouri: 'mo', montana: 'mt', nebraska: 'ne', nevada: 'nv', 'new hampshire': 'nh', 'new jersey': 'nj', 'new mexico': 'nm', 'new york': 'ny', 'north carolina': 'nc', 'north dakota': 'nd', ohio: 'oh', oklahoma: 'ok', oregon: 'or', pennsylvania: 'pa', 'rhode island': 'ri', 'south carolina': 'sc', 'south dakota': 'sd', tennessee: 'tn', texas: 'tx', utah: 'ut', vermont: 'vt', virginia: 'va', washington: 'wa', 'west virginia': 'wv', wisconsin: 'wi', wyoming: 'wy', 'district of columbia': 'dc',
};
const STATE_CODES = new Set(Object.values(STATE_NAMES));

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
const TYPE_LABELS: Record<string, string> = {
  single_family: 'Single Family',
  condo_townhouse: 'Condo / Townhouse',
  land: 'Land',
  commercial: 'Commercial',
  mixed_use: 'Mixed-Use',
  mobile_manufactured: 'Mobile / Manufactured',
};

const STRATEGY_ALIASES: Record<string, string> = {
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
const STRATEGY_LABELS: Record<string, string> = {
  buy_hold: 'Buy & Hold',
  fix_flip: 'Fix & Flip',
  brrrr: 'BRRRR',
  wholesale: 'Wholesale',
  rent: 'Rent',
  development: 'Development',
  new_construction: 'New Construction',
  wholetail: 'Wholetail',
};

const normalize = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();
const compact = (value: unknown) => normalize(value).replace(/\s+/g, '');

function profileMarketValues(values: unknown) {
  const result = new Set<string>();
  (Array.isArray(values) ? values : []).forEach((item) => {
    const normalized = normalize(item);
    if (!normalized) return;
    result.add(normalized);
    if (STATE_NAMES[normalized]) result.add(STATE_NAMES[normalized]);
    const parts = normalized.split(' ').filter(Boolean);
    const last = String(parts.at(-1) || '').toLowerCase();
    if (STATE_CODES.has(last)) result.add(last);
  });
  return result;
}

function profileCanonicalValues(values: unknown, aliases: Record<string, string>) {
  return new Set((Array.isArray(values) ? values : [])
    .map((item) => aliases[compact(item)] || normalize(item))
    .filter(Boolean));
}

function confidenceFor(evidenceCount: number, observations: number): 'medium' | 'high' | null {
  const share = observations > 0 ? evidenceCount / observations : 0;
  if (share >= 0.8) return 'high';
  if (share >= 0.6) return 'medium';
  return null;
}

function strongestNewTrend(
  trend: BehaviorAffinityTrend | null,
  current: Set<string>,
  allowed?: Record<string, string>,
) {
  if (!trend) return null;
  const candidates = trend.values
    .map((value) => ({
      value,
      evidenceCount: Number(trend.evidenceCounts?.[value] || 0),
      label: allowed ? allowed[value] : value,
    }))
    .filter((item) => !current.has(item.value) && item.label)
    .sort((left, right) => right.evidenceCount - left.evidenceCount || left.value.localeCompare(right.value));
  const selected = candidates[0];
  if (!selected) return null;
  const confidence = confidenceFor(selected.evidenceCount, trend.observations);
  return confidence ? { ...selected, confidence } : null;
}

function marketSuggestion(profile: MaxxisInvestmentProfile, trend: BehaviorAffinityTrend | null): ProfileDriftSuggestion | null {
  const current = profileMarketValues(profile.targetMarkets);
  const stateTrend = trend ? {
    ...trend,
    values: trend.values.filter((value) => STATE_CODES.has(value)),
  } : null;
  const selected = strongestNewTrend(stateTrend?.values.length ? stateTrend : trend, current);
  if (!selected) return null;
  const suggestedValue = STATE_CODES.has(selected.value) ? selected.value.toUpperCase() : selected.value.replace(/\b\w/g, (letter) => letter.toUpperCase());
  return {
    dimension: 'market',
    operation: 'add_market',
    currentValue: [...(profile.targetMarkets || [])],
    suggestedValue,
    confidence: selected.confidence,
    evidenceCount: selected.evidenceCount,
    reason: `Recent activity indicates recurring interest in ${suggestedValue} properties.`,
  };
}

function propertyTypeSuggestion(profile: MaxxisInvestmentProfile, trend: BehaviorAffinityTrend | null): ProfileDriftSuggestion | null {
  const current = profileCanonicalValues(profile.propertyTypes, TYPE_ALIASES);
  const selected = strongestNewTrend(trend, current, TYPE_LABELS);
  if (!selected) return null;
  return {
    dimension: 'property_type',
    operation: 'add_property_type',
    currentValue: [...(profile.propertyTypes || [])],
    suggestedValue: selected.label,
    confidence: selected.confidence,
    evidenceCount: selected.evidenceCount,
    reason: `Recent activity indicates recurring interest in ${selected.label} properties.`,
  };
}

function strategySuggestion(profile: MaxxisInvestmentProfile, trend: BehaviorAffinityTrend | null): ProfileDriftSuggestion | null {
  const currentValues = [...(profile.strategies || []), ...(profile.taxDealObjectives || [])];
  const current = profileCanonicalValues(currentValues, STRATEGY_ALIASES);
  const selected = strongestNewTrend(trend, current, STRATEGY_LABELS);
  if (!selected) return null;
  return {
    dimension: 'strategy',
    operation: 'add_strategy',
    currentValue: currentValues,
    suggestedValue: selected.label,
    confidence: selected.confidence,
    evidenceCount: selected.evidenceCount,
    reason: `Recent activity indicates recurring interest in the ${selected.label} strategy.`,
  };
}

export function detectInvestmentProfileDrift(
  profile: MaxxisInvestmentProfile | null | undefined,
  behaviorSummary: BehaviorAffinity | null | undefined,
): InvestmentProfileDriftResult {
  if (!profile || !behaviorSummary?.available || behaviorSummary.actionCount < MIN_BEHAVIOR_ACTIONS) {
    return { hasDrift: false, suggestions: [] };
  }
  const suggestions = [
    marketSuggestion(profile, behaviorSummary.trends.market),
    propertyTypeSuggestion(profile, behaviorSummary.trends.propertyType),
    strategySuggestion(profile, behaviorSummary.trends.objective),
  ].filter((item): item is ProfileDriftSuggestion => item !== null);
  return { hasDrift: suggestions.length > 0, suggestions };
}
