import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  normalizeIntelligenceReportType,
  resolveIntelligenceReportAccess,
  type IntelligenceAccessLevel,
  type IntelligenceReportAccess,
  type IntelligenceReportType,
  type ReportEntitlement,
} from './intelligenceAccess.ts';

export type MaxxisRuntimeCapability = IntelligenceReportType;
export type MaxxisRuntimeEntitlementError =
  | 'UNAUTHENTICATED'
  | 'ENTITLEMENT_MISSING'
  | 'INSUFFICIENT_PLAN'
  | 'CAPABILITY_NOT_AVAILABLE';

export type MaxxisRuntimeEntitlementDecision = IntelligenceReportAccess & {
  capability: MaxxisRuntimeCapability | null;
  result: 'ALLOW' | 'DENY';
  error: MaxxisRuntimeEntitlementError | null;
  upgradeTo: 'PRO' | 'ENTERPRISE' | null;
};

export type MaxxisRuntimeAccessContext = {
  userId: string;
  plan: IntelligenceAccessLevel;
  entitlements: readonly ReportEntitlement[];
};

const PREMIUM_INTENT_PATTERNS: Array<[IntelligenceReportType, RegExp]> = [
  ['DEAL_INTELLIGENCE', /\b(full deal intelligence|deal intelligence|analy[sz]e this (?:property|deal) deeply|analy[sz]e this deal|is this property worth looking at|what are the risks|explain this arv|calculate (?:the )?arv|arv and mao|deep analysis|analise (?:este |esse )?deal|vale a pena analisar (?:este |esse )?imovel|quais (?:sao )?os riscos|explique (?:este |o )?arv|calcule (?:este |o )?arv|arv e mao|analise completa|analise profunda|inteligencia completa|inteligencia do deal|analisis (?:este )?deal|vale la pena revisar esta propiedad|cuales son los riesgos|explica este arv|calcula (?:este |el )?arv|arv y mao|analisis completo|analisis profundo)\b/],
  ['MAXXIS_ANALYSIS', /\b(analy[sz]e this property|analy[sz]e the property|analise (?:este|esta|esse|essa) (?:imovel|propriedade)|analizar (?:esta|la) propiedad|maxxis analysis)\b/],
];

function normalizeIntent(value: unknown) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function inferMaxxisRuntimeCapability(input: {
  message?: unknown;
  requestedCapability?: unknown;
  requestedReportLevel?: unknown;
  hasPropertyContext?: boolean;
}): MaxxisRuntimeCapability | null {
  const explicit = normalizeIntelligenceReportType(input.requestedCapability)
    || normalizeIntelligenceReportType(input.requestedReportLevel);
  const inferred = input.hasPropertyContext
    ? PREMIUM_INTENT_PATTERNS.find(([, pattern]) => pattern.test(normalizeIntent(input.message)))?.[0] || null
    : null;
  if (!explicit) return inferred;
  if (!inferred) return explicit;
  const rank: Record<IntelligenceReportType, number> = { PROPERTY_RELEASE: 1, MAXXIS_ANALYSIS: 2, DEAL_INTELLIGENCE: 3 };
  return rank[inferred] >= rank[explicit] ? inferred : explicit;
}

export function capabilityForMaxxisTool(toolName: unknown): MaxxisRuntimeCapability | null {
  const name = String(toolName || '');
  if (name === 'getDealInsightContext' || name === 'getDealCopilotOverview') return 'DEAL_INTELLIGENCE';
  return null;
}

export function guardMaxxisRuntimeEntitlement(input: {
  userId?: unknown;
  requestedCapability?: unknown;
  requestedReportLevel?: unknown;
  plan?: unknown;
  entitlements?: readonly ReportEntitlement[];
}): MaxxisRuntimeEntitlementDecision {
  const capability = normalizeIntelligenceReportType(input.requestedCapability)
    || normalizeIntelligenceReportType(input.requestedReportLevel);
  if (!String(input.userId || '').trim()) {
    return { ...resolveIntelligenceReportAccess({ plan: input.plan, reportType: capability }), allowed: false, capability, result: 'DENY', error: 'UNAUTHENTICATED', upgradeTo: null };
  }
  if (!capability) {
    return { ...resolveIntelligenceReportAccess({ plan: input.plan, reportType: null }), capability: null, result: 'DENY', error: 'CAPABILITY_NOT_AVAILABLE', upgradeTo: null };
  }
  const access = resolveIntelligenceReportAccess({ plan: input.plan, reportType: capability, entitlements: input.entitlements });
  return {
    ...access,
    capability,
    result: access.allowed ? 'ALLOW' : 'DENY',
    error: access.allowed ? null : 'INSUFFICIENT_PLAN',
    upgradeTo: access.allowed || capability === 'PROPERTY_RELEASE' ? null : capability === 'MAXXIS_ANALYSIS' ? 'PRO' : 'ENTERPRISE',
  };
}

export async function loadMaxxisRuntimeAccessContext(
  userId: string,
  client: Pick<SupabaseClient, 'from'>,
): Promise<{ ok: true; context: MaxxisRuntimeAccessContext } | { ok: false; error: 'ENTITLEMENT_MISSING' }> {
  const { data, error } = await client
    .from('subscriptions')
    .select('plan_id, status, current_period_end, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false, error: 'ENTITLEMENT_MISSING' };
  const { data: entitlementRows, error: entitlementError } = await client
    .from('maxxis_report_entitlements')
    .select('capability, access_source')
    .eq('user_id', userId);
  if (entitlementError) return { ok: false, error: 'ENTITLEMENT_MISSING' };
  const status = String(data?.status || '').toLowerCase();
  const plan = status === 'active' || status === 'trialing' ? data?.plan_id : 'free';
  return {
    ok: true,
    context: {
      userId,
      plan: resolveIntelligenceReportAccess({ plan, reportType: 'PROPERTY_RELEASE' }).accessLevel,
      entitlements: (entitlementRows || []).map((row: { capability: IntelligenceReportType; access_source: string }) => ({
        reportType: row.capability,
        accessSource: row.access_source === 'ONE_TIME_UNLOCK' ? 'NUGGET_UNLOCK' : 'SUBSCRIPTION',
        expires: null,
      })),
    },
  };
}
