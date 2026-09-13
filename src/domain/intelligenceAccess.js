export const INTELLIGENCE_REPORT_TYPES = Object.freeze({
  PROPERTY_RELEASE: 'PROPERTY_RELEASE',
  MAXXIS_ANALYSIS: 'MAXXIS_ANALYSIS',
  DEAL_INTELLIGENCE: 'DEAL_INTELLIGENCE',
});

export const INTELLIGENCE_ACCESS_LEVELS = Object.freeze({
  FREE: 'FREE',
  PRO: 'PRO',
  ENTERPRISE: 'ENTERPRISE',
  NUGGET_UNLOCK: 'NUGGET_UNLOCK',
});

export const REPORT_ACCESS_SOURCES = Object.freeze({
  SUBSCRIPTION: 'SUBSCRIPTION',
  NUGGET_UNLOCK: 'NUGGET_UNLOCK',
});

export const INTELLIGENCE_REPORT_CONFIG = Object.freeze({
  maxxisAnalysisNuggetCost: null,
  dealIntelligenceNuggetCost: null,
  paidUnlockEnabled: false,
});

const REPORT_ORDER = Object.freeze({
  [INTELLIGENCE_REPORT_TYPES.PROPERTY_RELEASE]: 1,
  [INTELLIGENCE_REPORT_TYPES.MAXXIS_ANALYSIS]: 2,
  [INTELLIGENCE_REPORT_TYPES.DEAL_INTELLIGENCE]: 3,
});

export const INTELLIGENCE_REPORT_LEVELS = Object.freeze({
  [INTELLIGENCE_REPORT_TYPES.PROPERTY_RELEASE]: Object.freeze({
    level: 1,
    provenance: 'USER_PROVIDED',
    includedPlans: Object.freeze(['FREE', 'PRO', 'ENTERPRISE']),
    contentKeys: Object.freeze(['property']),
  }),
  [INTELLIGENCE_REPORT_TYPES.MAXXIS_ANALYSIS]: Object.freeze({
    level: 2,
    provenance: 'MAXXIS_INTERPRETATION',
    includedPlans: Object.freeze(['PRO', 'ENTERPRISE']),
    contentKeys: Object.freeze(['property', 'maxxisInterpretation', 'investorContext']),
  }),
  [INTELLIGENCE_REPORT_TYPES.DEAL_INTELLIGENCE]: Object.freeze({
    level: 3,
    provenance: 'EVIDENCE_BASED',
    includedPlans: Object.freeze(['ENTERPRISE']),
    contentKeys: Object.freeze([
      'property',
      'maxxisInterpretation',
      'investorContext',
      'propertyIntelligence',
      'valuationIntelligence',
      'decisionIntelligence',
    ]),
  }),
});

export function normalizeIntelligenceAccessLevel(value) {
  const plan = String(value?.planId || value?.id || value?.plan_id || value || 'free').trim().toLowerCase();
  if (plan === 'enterprise' || plan === 'admin') return INTELLIGENCE_ACCESS_LEVELS.ENTERPRISE;
  if (plan === 'pro' || plan === 'professional') return INTELLIGENCE_ACCESS_LEVELS.PRO;
  return INTELLIGENCE_ACCESS_LEVELS.FREE;
}

export function isIntelligenceReportType(value) {
  return Object.hasOwn(REPORT_ORDER, String(value || '').trim().toUpperCase());
}

export function createReportEntitlement({ reportType, accessSource, expires = null } = {}) {
  const normalizedReportType = String(reportType || '').trim().toUpperCase();
  const normalizedSource = String(accessSource || '').trim().toUpperCase();
  if (!isIntelligenceReportType(normalizedReportType)) return null;
  if (!Object.values(REPORT_ACCESS_SOURCES).includes(normalizedSource)) return null;
  const expiresAt = expires ? new Date(expires) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) return null;
  return Object.freeze({
    reportType: normalizedReportType,
    accessSource: normalizedSource,
    expires: expiresAt ? expiresAt.toISOString() : null,
  });
}

function findActiveEntitlement(reportType, entitlements, now) {
  return (Array.isArray(entitlements) ? entitlements : [])
    .map(createReportEntitlement)
    .filter(Boolean)
    .find((entitlement) => (
      entitlement.reportType === reportType
      && (!entitlement.expires || Date.parse(entitlement.expires) > now)
    )) || null;
}

function nuggetCostFor(reportType) {
  if (reportType === INTELLIGENCE_REPORT_TYPES.MAXXIS_ANALYSIS) {
    return INTELLIGENCE_REPORT_CONFIG.maxxisAnalysisNuggetCost;
  }
  if (reportType === INTELLIGENCE_REPORT_TYPES.DEAL_INTELLIGENCE) {
    return INTELLIGENCE_REPORT_CONFIG.dealIntelligenceNuggetCost;
  }
  return 0;
}

export function resolveIntelligenceReportAccess({ plan, reportType, entitlements = [], now = Date.now() } = {}) {
  const normalizedReportType = String(reportType || '').trim().toUpperCase();
  const accessLevel = normalizeIntelligenceAccessLevel(plan);
  const report = INTELLIGENCE_REPORT_LEVELS[normalizedReportType];
  if (!report) {
    return Object.freeze({
      allowed: false,
      state: 'DENIED',
      reason: 'UNKNOWN_REPORT_TYPE',
      reportType: normalizedReportType || null,
      accessLevel,
      accessSource: null,
      requiredAccessMethod: null,
      nuggetCost: null,
      paidUnlockEnabled: false,
    });
  }

  const entitlement = findActiveEntitlement(normalizedReportType, entitlements, Number(now));
  if (entitlement) {
    return Object.freeze({
      allowed: true,
      state: 'ENTITLED',
      reason: 'ACTIVE_REPORT_ENTITLEMENT',
      reportType: normalizedReportType,
      accessLevel: entitlement.accessSource === REPORT_ACCESS_SOURCES.NUGGET_UNLOCK
        ? INTELLIGENCE_ACCESS_LEVELS.NUGGET_UNLOCK
        : accessLevel,
      accessSource: entitlement.accessSource,
      requiredAccessMethod: null,
      nuggetCost: 0,
      paidUnlockEnabled: false,
    });
  }

  if (report.includedPlans.includes(accessLevel)) {
    return Object.freeze({
      allowed: true,
      state: 'INCLUDED',
      reason: 'PLAN_INCLUDED',
      reportType: normalizedReportType,
      accessLevel,
      accessSource: REPORT_ACCESS_SOURCES.SUBSCRIPTION,
      requiredAccessMethod: null,
      nuggetCost: 0,
      paidUnlockEnabled: false,
    });
  }

  return Object.freeze({
    allowed: false,
    state: 'NUGGET_UNLOCK_REQUIRED',
    reason: 'REPORT_NOT_INCLUDED_IN_PLAN',
    reportType: normalizedReportType,
    accessLevel,
    accessSource: null,
    requiredAccessMethod: REPORT_ACCESS_SOURCES.NUGGET_UNLOCK,
    nuggetCost: nuggetCostFor(normalizedReportType),
    paidUnlockEnabled: Boolean(INTELLIGENCE_REPORT_CONFIG.paidUnlockEnabled),
  });
}

export function resolveExportPopupFlow({ plan, entitlements = [] } = {}) {
  const accessLevel = normalizeIntelligenceAccessLevel(plan);
  const directReportType = accessLevel === INTELLIGENCE_ACCESS_LEVELS.ENTERPRISE
    ? INTELLIGENCE_REPORT_TYPES.DEAL_INTELLIGENCE
    : accessLevel === INTELLIGENCE_ACCESS_LEVELS.PRO
      ? INTELLIGENCE_REPORT_TYPES.MAXXIS_ANALYSIS
      : null;
  return Object.freeze({
    accessLevel,
    propertyRelease: resolveIntelligenceReportAccess({ plan, reportType: INTELLIGENCE_REPORT_TYPES.PROPERTY_RELEASE, entitlements }),
    directReportType,
    requiresLevelChoice: !directReportType,
    analysisOptions: Object.freeze([
      resolveIntelligenceReportAccess({ plan, reportType: INTELLIGENCE_REPORT_TYPES.MAXXIS_ANALYSIS, entitlements }),
      resolveIntelligenceReportAccess({ plan, reportType: INTELLIGENCE_REPORT_TYPES.DEAL_INTELLIGENCE, entitlements }),
    ]),
  });
}

export function inferRequestedIntelligenceReportType(message, { explicitReportType = '', hasPropertyContext = false } = {}) {
  const explicit = String(explicitReportType || '').trim().toUpperCase();
  if (isIntelligenceReportType(explicit)) return explicit;
  if (!hasPropertyContext) return null;
  const text = String(message || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/\b(full deal intelligence|deal intelligence|analyze this property deeply|analyze this deal(?: deeply)?|is this property worth looking at|what are the risks|explain this arv|deep analysis|analise (?:este |esse )?deal|vale a pena analisar (?:este |esse )?imovel|quais (?:sao )?os riscos|explique (?:este |o )?arv|analise completa|analise profunda|inteligencia completa|inteligencia do deal|analisis (?:este )?deal|vale la pena revisar esta propiedad|cuales son los riesgos|explica este arv|analisis completo|analisis profundo)\b/.test(text)) {
    return INTELLIGENCE_REPORT_TYPES.DEAL_INTELLIGENCE;
  }
  if (/\b(analyze this property|analyse this property|analyze the property|analise (este|esta|esse|essa) (imovel|propriedade)|analizar (esta|la) propiedad|maxxis analysis)\b/.test(text)) {
    return INTELLIGENCE_REPORT_TYPES.MAXXIS_ANALYSIS;
  }
  return null;
}

export function filterReportContent(reportType, payload = {}) {
  const normalizedReportType = String(reportType || '').trim().toUpperCase();
  const allowedKeys = INTELLIGENCE_REPORT_LEVELS[normalizedReportType]?.contentKeys;
  if (!allowedKeys || !payload || typeof payload !== 'object' || Array.isArray(payload)) return Object.freeze({});
  return Object.freeze(Object.fromEntries(
    allowedKeys.filter((key) => Object.hasOwn(payload, key)).map((key) => [key, payload[key]]),
  ));
}
