import type { ProviderBudgetPlan } from '../property-data/providerBudget.ts';

export type ProviderEvidenceFamily = 'PROPERTY_RECORD' | 'VALUATION' | 'PROVIDER_AVM_COMPS'
  | 'RECORDED_SOLD' | 'SALE_LISTINGS' | 'RENT_ESTIMATE' | 'RENTAL_COMPS' | 'MARKET_DATA';
export type ProviderReportLevel = 'CHAT' | 'PROPERTY_RELEASE' | 'MAXXIS_ANALYSIS' | 'DEAL_INTELLIGENCE';
export type EvidenceCacheState = 'FRESH' | 'STALE' | 'MISS' | 'UNAVAILABLE' | 'UNKNOWN';

export type ProviderEvidencePlan = Readonly<{
  reportLevel: ProviderReportLevel;
  strategy: string;
  propertyCategory: 'LAND' | 'IMPROVED';
  families: Readonly<Record<ProviderEvidenceFamily, Readonly<{
    required: boolean;
    visibleWhenCached: boolean;
    cacheReadAllowed: boolean;
    providerCallAllowed: boolean;
    cacheState: EvidenceCacheState;
    reason: string;
  }>>>;
}>;

const ALL_FAMILIES: ProviderEvidenceFamily[] = [
  'PROPERTY_RECORD', 'VALUATION', 'PROVIDER_AVM_COMPS', 'RECORDED_SOLD',
  'SALE_LISTINGS', 'RENT_ESTIMATE', 'RENTAL_COMPS', 'MARKET_DATA',
];

const normalizedStrategy = (value: unknown, land: boolean) => {
  if (land) return 'LAND';
  const text = String(value || '').toUpperCase().replace(/[^A-Z]+/g, '_');
  if (/BUY.*HOLD|RENT/.test(text)) return 'BUY_AND_HOLD';
  if (/WHOLESALE/.test(text)) return 'WHOLESALE';
  if (/SUB.*TO/.test(text)) return 'SUB_TO';
  if (/SELLER.*FINANC/.test(text)) return 'SELLER_FINANCING';
  return 'FLIP';
};

function desiredFamilies(strategy: string) {
  // A current-market estimate requires recorded closed sales for every valuation-relevant strategy.
  const common: ProviderEvidenceFamily[] = ['PROPERTY_RECORD', 'VALUATION', 'RECORDED_SOLD', 'MARKET_DATA'];
  if (strategy === 'BUY_AND_HOLD') return new Set([...common, 'RENT_ESTIMATE', 'RENTAL_COMPS']);
  if (strategy === 'SUB_TO' || strategy === 'SELLER_FINANCING') return new Set(common);
  return new Set([...common, 'PROVIDER_AVM_COMPS', 'RECORDED_SOLD', 'SALE_LISTINGS']);
}

export function buildProviderEvidencePlan(input: {
  propertyType?: unknown;
  strategy?: unknown;
  reportLevel: ProviderReportLevel;
  plan: ProviderBudgetPlan;
  entitled?: boolean;
  cacheOnly?: boolean;
  cacheState?: Partial<Record<ProviderEvidenceFamily, EvidenceCacheState>>;
}): ProviderEvidencePlan {
  const land = /^(?:vacant\s+land|land|lot|terreno|solar)$/i.test(String(input.propertyType || '').trim());
  const strategy = normalizedStrategy(input.strategy, land);
  const desired = desiredFamilies(strategy);
  const commerciallyAuthorized = input.plan !== 'FREE' || input.entitled === true;
  const acquisitionDepth = input.reportLevel === 'DEAL_INTELLIGENCE';
  const cacheReadAllowed = commerciallyAuthorized;
  const families = Object.fromEntries(ALL_FAMILIES.map((family) => {
    const required = desired.has(family);
    const state = input.cacheState?.[family] || 'UNKNOWN';
    const providerCallAllowed = required && commerciallyAuthorized && acquisitionDepth && !input.cacheOnly;
    return [family, Object.freeze({
      required,
      visibleWhenCached: required && commerciallyAuthorized,
      cacheReadAllowed: required && cacheReadAllowed,
      providerCallAllowed,
      cacheState: state,
      reason: !required ? 'NOT_REQUIRED_FOR_STRATEGY'
        : !commerciallyAuthorized ? 'CAPABILITY_NOT_AUTHORIZED'
          : providerCallAllowed ? 'CACHE_FIRST_THEN_AUTHORIZED_PROVIDER'
            : 'AUTHORIZED_CACHE_ONLY',
    })];
  })) as Record<ProviderEvidenceFamily, ProviderEvidencePlan['families'][ProviderEvidenceFamily]>;
  return Object.freeze({
    reportLevel: input.reportLevel,
    strategy,
    propertyCategory: land ? 'LAND' : 'IMPROVED',
    families: Object.freeze(families),
  });
}
