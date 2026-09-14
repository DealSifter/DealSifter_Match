export const INTELLIGENCE_REPORT_TYPES = [
  'PROPERTY_RELEASE',
  'MAXXIS_ANALYSIS',
  'DEAL_INTELLIGENCE',
] as const;

export type IntelligenceReportType = typeof INTELLIGENCE_REPORT_TYPES[number];
export type IntelligenceAccessLevel = 'FREE' | 'PRO' | 'ENTERPRISE' | 'NUGGET_UNLOCK';
export type ReportAccessSource = 'SUBSCRIPTION' | 'NUGGET_UNLOCK';

export type ReportEntitlement = {
  reportType: IntelligenceReportType;
  accessSource: ReportAccessSource;
  expires?: string | null;
};

export type IntelligenceReportAccess = {
  allowed: boolean;
  state: 'INCLUDED' | 'ENTITLED' | 'NUGGET_UNLOCK_REQUIRED' | 'DENIED';
  reportType: IntelligenceReportType | null;
  accessLevel: IntelligenceAccessLevel;
  accessSource: ReportAccessSource | null;
  requiredAccessMethod: 'NUGGET_UNLOCK' | null;
  nuggetCost: number | null;
  paidUnlockEnabled: false;
};

import { intelligenceNuggetCost } from './intelligenceEconomy.ts';

const INCLUDED_PLANS: Record<IntelligenceReportType, ReadonlySet<IntelligenceAccessLevel>> = {
  PROPERTY_RELEASE: new Set(['FREE', 'PRO', 'ENTERPRISE']),
  MAXXIS_ANALYSIS: new Set(['PRO', 'ENTERPRISE']),
  DEAL_INTELLIGENCE: new Set(['ENTERPRISE']),
};

const CONTENT_KEYS: Record<IntelligenceReportType, readonly string[]> = {
  PROPERTY_RELEASE: ['property'],
  MAXXIS_ANALYSIS: ['property', 'maxxisInterpretation', 'investorContext'],
  DEAL_INTELLIGENCE: [
    'property', 'maxxisInterpretation', 'investorContext', 'propertyIntelligence',
    'valuationIntelligence', 'decisionIntelligence',
  ],
};

export function normalizeIntelligenceAccessLevel(value: unknown): IntelligenceAccessLevel {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : null;
  const raw = String(row?.planId || row?.id || row?.plan_id || value || 'free').trim().toLowerCase();
  if (raw === 'enterprise' || raw === 'admin') return 'ENTERPRISE';
  if (raw === 'pro' || raw === 'professional') return 'PRO';
  return 'FREE';
}

export function normalizeIntelligenceReportType(value: unknown): IntelligenceReportType | null {
  const normalized = String(value || '').trim().toUpperCase();
  return INTELLIGENCE_REPORT_TYPES.includes(normalized as IntelligenceReportType)
    ? normalized as IntelligenceReportType
    : null;
}

function activeEntitlement(reportType: IntelligenceReportType, entitlements: readonly ReportEntitlement[], now: number) {
  return entitlements.find((entitlement) => {
    if (normalizeIntelligenceReportType(entitlement?.reportType) !== reportType) return false;
    if (!['SUBSCRIPTION', 'NUGGET_UNLOCK'].includes(String(entitlement?.accessSource || ''))) return false;
    if (!entitlement.expires) return true;
    const expiresAt = Date.parse(entitlement.expires);
    return Number.isFinite(expiresAt) && expiresAt > now;
  }) || null;
}

export function resolveIntelligenceReportAccess(input: {
  plan?: unknown;
  reportType?: unknown;
  entitlements?: readonly ReportEntitlement[];
  now?: number;
} = {}): IntelligenceReportAccess {
  const accessLevel = normalizeIntelligenceAccessLevel(input.plan);
  const reportType = normalizeIntelligenceReportType(input.reportType);
  if (!reportType) {
    return { allowed: false, state: 'DENIED', reportType: null, accessLevel, accessSource: null, requiredAccessMethod: null, nuggetCost: null, paidUnlockEnabled: false };
  }
  const entitlement = activeEntitlement(reportType, input.entitlements || [], input.now ?? Date.now());
  if (entitlement) {
    return {
      allowed: true, state: 'ENTITLED', reportType,
      accessLevel: entitlement.accessSource === 'NUGGET_UNLOCK' ? 'NUGGET_UNLOCK' : accessLevel,
      accessSource: entitlement.accessSource, requiredAccessMethod: null, nuggetCost: 0, paidUnlockEnabled: false,
    };
  }
  if (INCLUDED_PLANS[reportType].has(accessLevel)) {
    return { allowed: true, state: 'INCLUDED', reportType, accessLevel, accessSource: 'SUBSCRIPTION', requiredAccessMethod: null, nuggetCost: 0, paidUnlockEnabled: false };
  }
  return { allowed: false, state: 'NUGGET_UNLOCK_REQUIRED', reportType, accessLevel, accessSource: null, requiredAccessMethod: 'NUGGET_UNLOCK', nuggetCost: intelligenceNuggetCost(reportType), paidUnlockEnabled: false };
}

export function filterIntelligenceReportContent(reportTypeValue: unknown, payload: Record<string, unknown>) {
  const reportType = normalizeIntelligenceReportType(reportTypeValue);
  if (!reportType || !payload || typeof payload !== 'object' || Array.isArray(payload)) return {};
  return Object.fromEntries(CONTENT_KEYS[reportType]
    .filter((key) => Object.hasOwn(payload, key))
    .map((key) => [key, payload[key]]));
}
