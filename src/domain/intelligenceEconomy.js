export const INTELLIGENCE_ECONOMY_CONFIG = Object.freeze({
  fullPropertyIntelligenceNuggetCost: null,
  proMonthlyPropertyIntelligenceAllowance: null,
  enterpriseFairUseThreshold: null,
  paidPropertyIntelligenceUnlockEnabled: false,
  revenueBackedProviderOverageEnabled: false,
});

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
