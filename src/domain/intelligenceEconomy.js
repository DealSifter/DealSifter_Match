export const INTELLIGENCE_ECONOMY_CONFIG = Object.freeze({
  fullPropertyIntelligenceNuggetCost: null,
  proMonthlyPropertyIntelligenceAllowance: null,
  enterpriseFairUseThreshold: null,
  paidPropertyIntelligenceUnlockEnabled: true,
  revenueBackedProviderOverageEnabled: false,
});

export const MAXXIS_CAPABILITY_CATALOG = Object.freeze({
  PROPERTY_RELEASE: Object.freeze({
    description: 'Basic property information.',
    includes: Object.freeze(['CARD_DATA', 'EXISTING_PHOTOS', 'LOCATION', 'REGISTERED_INFORMATION']),
    oneTimeUnlockNuggetCost: 0,
    reportRelationship: 'FREE_EXPORT',
    unlockSku: null,
  }),
  MAXXIS_ANALYSIS: Object.freeze({
    description: 'AI assisted investment analysis.',
    includes: Object.freeze(['EXECUTIVE_SUMMARY', 'INVESTOR_PROFILE_ALIGNMENT', 'RISK_ANALYSIS', 'LIMITATIONS', 'NEXT_STEPS']),
    oneTimeUnlockNuggetCost: 3,
    reportRelationship: 'PRO_REPORT',
    unlockSku: 'MAXXIS_ANALYSIS_UNLOCK',
  }),
  DEAL_INTELLIGENCE: Object.freeze({
    description: 'Complete investment intelligence analysis.',
    includes: Object.freeze(['MAXXIS_ANALYSIS', 'COMPARABLE_SALES', 'VALUATION_EVIDENCE', 'ARV_INTELLIGENCE', 'KPI_SCENARIOS', 'CONFIDENCE_LAYER', 'INVESTOR_REPORT']),
    oneTimeUnlockNuggetCost: 5,
    reportRelationship: 'ENTERPRISE_REPORT',
    unlockSku: 'DEAL_INTELLIGENCE_UNLOCK',
  }),
});

export const CAPABILITY_ENTITLEMENT_MATRIX = Object.freeze({
  FREE: Object.freeze({ included: Object.freeze(['PROPERTY_RELEASE']), optionalUnlock: Object.freeze(['MAXXIS_ANALYSIS', 'DEAL_INTELLIGENCE']) }),
  PRO: Object.freeze({ included: Object.freeze(['PROPERTY_RELEASE', 'MAXXIS_ANALYSIS']), optionalUnlock: Object.freeze(['DEAL_INTELLIGENCE']) }),
  ENTERPRISE: Object.freeze({ included: Object.freeze(['PROPERTY_RELEASE', 'MAXXIS_ANALYSIS', 'DEAL_INTELLIGENCE']), optionalUnlock: Object.freeze([]) }),
});

export const INTELLIGENCE_ECONOMY_RUNTIME = Object.freeze({
  oneTimeUnlockExecutionEnabled: true,
  nuggetDebitEnabled: true,
  stripeEnabled: false,
});

export function createIntelligenceUsageEvent({ userId, capability, entitlementType, timestamp = new Date().toISOString() } = {}) {
  if (!Object.hasOwn(MAXXIS_CAPABILITY_CATALOG, capability)) return null;
  if (!['SUBSCRIPTION_INCLUDED', 'ONE_TIME_UNLOCK'].includes(entitlementType)) return null;
  return Object.freeze({
    userId: String(userId || '').trim(), capability,
    source: entitlementType === 'ONE_TIME_UNLOCK' ? 'NUGGET_UNLOCK' : 'SUBSCRIPTION',
    timestamp, entitlementType,
  });
}

export const INTELLIGENCE_PLAN_CAPABILITIES = Object.freeze({
  free: Object.freeze({
    includedIntelligence: true,
    maxxisIncluded: true,
    fullPropertyIntelligence: 'nugget_unlock',
    hasIncludedPropertyIntelligenceAllowance: false,
    canUseNuggetOverage: true,
    enterpriseIntelligenceIncluded: false,
  }),
  pro: Object.freeze({
    includedIntelligence: true,
    maxxisIncluded: true,
    fullPropertyIntelligence: 'included_allowance_then_nuggets',
    hasIncludedPropertyIntelligenceAllowance: true,
    canUseNuggetOverage: true,
    enterpriseIntelligenceIncluded: false,
  }),
  enterprise: Object.freeze({
    includedIntelligence: true,
    maxxisIncluded: true,
    fullPropertyIntelligence: 'included_fair_use',
    hasIncludedPropertyIntelligenceAllowance: true,
    canUseNuggetOverage: false,
    enterpriseIntelligenceIncluded: true,
  }),
});

export function normalizeIntelligencePlanId(value) {
  const planId = String(value?.planId || value?.id || value || 'free').trim().toLowerCase();
  if (planId === 'pro' || planId === 'professional') return 'pro';
  if (planId === 'enterprise' || planId === 'admin') return 'enterprise';
  return 'free';
}

export function getIntelligencePlanCapabilities(plan) {
  return INTELLIGENCE_PLAN_CAPABILITIES[normalizeIntelligencePlanId(plan)];
}

export function resolveIntelligenceEconomyPresentation({ plan, hasPersistentEntitlement = false } = {}) {
  const planId = normalizeIntelligencePlanId(plan);
  const capabilities = getIntelligencePlanCapabilities(planId);
  const hasAccess = hasPersistentEntitlement === true;
  const priceConfigured = Number.isFinite(INTELLIGENCE_ECONOMY_CONFIG.fullPropertyIntelligenceNuggetCost)
    && INTELLIGENCE_ECONOMY_CONFIG.fullPropertyIntelligenceNuggetCost > 0;
  return {
    planId,
    ...capabilities,
    backendAuthoritative: true,
    frontendCanGrantAccess: false,
    canReadFullPropertyIntelligence: hasAccess,
    requiresPropertyIntelligenceUnlock: planId === 'free' && !hasAccess,
    repeatReadCharge: hasAccess ? 0 : null,
    paidUnlockEnabled: Boolean(INTELLIGENCE_ECONOMY_CONFIG.paidPropertyIntelligenceUnlockEnabled && priceConfigured),
    configuredNuggetCost: priceConfigured ? INTELLIGENCE_ECONOMY_CONFIG.fullPropertyIntelligenceNuggetCost : null,
  };
}
