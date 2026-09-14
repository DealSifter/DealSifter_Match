import type { IntelligenceAccessLevel, IntelligenceReportType } from './intelligenceAccess.ts';

export type IntelligenceEntitlementType = 'SUBSCRIPTION_INCLUDED' | 'ONE_TIME_UNLOCK';
export type IntelligenceUnlockSku = 'MAXXIS_ANALYSIS_UNLOCK' | 'DEAL_INTELLIGENCE_UNLOCK';

export type IntelligenceUsageEvent = Readonly<{
  userId: string;
  capability: IntelligenceReportType;
  source: 'SUBSCRIPTION' | 'NUGGET_UNLOCK';
  timestamp: string;
  entitlementType: IntelligenceEntitlementType;
}>;

export const MAXXIS_CAPABILITY_CATALOG = Object.freeze({
  PROPERTY_RELEASE: Object.freeze({
    capability: 'PROPERTY_RELEASE' as const,
    description: 'Basic property information.',
    includes: Object.freeze(['CARD_DATA', 'EXISTING_PHOTOS', 'LOCATION', 'REGISTERED_INFORMATION']),
    oneTimeUnlockNuggetCost: 0,
    reportRelationship: 'FREE_EXPORT' as const,
    unlockSku: null,
  }),
  MAXXIS_ANALYSIS: Object.freeze({
    capability: 'MAXXIS_ANALYSIS' as const,
    description: 'AI assisted investment analysis.',
    includes: Object.freeze(['EXECUTIVE_SUMMARY', 'INVESTOR_PROFILE_ALIGNMENT', 'RISK_ANALYSIS', 'LIMITATIONS', 'NEXT_STEPS']),
    oneTimeUnlockNuggetCost: 3,
    reportRelationship: 'PRO_REPORT' as const,
    unlockSku: 'MAXXIS_ANALYSIS_UNLOCK' as const,
  }),
  DEAL_INTELLIGENCE: Object.freeze({
    capability: 'DEAL_INTELLIGENCE' as const,
    description: 'Complete investment intelligence analysis.',
    includes: Object.freeze(['MAXXIS_ANALYSIS', 'COMPARABLE_SALES', 'VALUATION_EVIDENCE', 'ARV_INTELLIGENCE', 'KPI_SCENARIOS', 'CONFIDENCE_LAYER', 'INVESTOR_REPORT']),
    oneTimeUnlockNuggetCost: 5,
    reportRelationship: 'ENTERPRISE_REPORT' as const,
    unlockSku: 'DEAL_INTELLIGENCE_UNLOCK' as const,
  }),
});

export const CAPABILITY_ENTITLEMENT_MATRIX: Readonly<Record<Exclude<IntelligenceAccessLevel, 'NUGGET_UNLOCK'>, Readonly<{
  included: readonly IntelligenceReportType[];
  optionalUnlock: readonly IntelligenceReportType[];
}>>> = Object.freeze({
  FREE: Object.freeze({ included: Object.freeze(['PROPERTY_RELEASE'] as const), optionalUnlock: Object.freeze(['MAXXIS_ANALYSIS', 'DEAL_INTELLIGENCE'] as const) }),
  PRO: Object.freeze({ included: Object.freeze(['PROPERTY_RELEASE', 'MAXXIS_ANALYSIS'] as const), optionalUnlock: Object.freeze(['DEAL_INTELLIGENCE'] as const) }),
  ENTERPRISE: Object.freeze({ included: Object.freeze(['PROPERTY_RELEASE', 'MAXXIS_ANALYSIS', 'DEAL_INTELLIGENCE'] as const), optionalUnlock: Object.freeze([] as const) }),
});

export const INTELLIGENCE_ECONOMY_RUNTIME = Object.freeze({
  oneTimeUnlockExecutionEnabled: false,
  nuggetDebitEnabled: false,
  stripeEnabled: false,
});

export function intelligenceNuggetCost(capability: IntelligenceReportType) {
  return MAXXIS_CAPABILITY_CATALOG[capability].oneTimeUnlockNuggetCost;
}

export function createIntelligenceUsageEvent(input: {
  userId: string;
  capability: IntelligenceReportType;
  entitlementType: IntelligenceEntitlementType;
  timestamp?: string;
}): IntelligenceUsageEvent {
  return Object.freeze({
    userId: String(input.userId || '').trim(),
    capability: input.capability,
    source: input.entitlementType === 'ONE_TIME_UNLOCK' ? 'NUGGET_UNLOCK' : 'SUBSCRIPTION',
    timestamp: input.timestamp || new Date().toISOString(),
    entitlementType: input.entitlementType,
  });
}
