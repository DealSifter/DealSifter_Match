import {
  INTELLIGENCE_ACCESS_LEVELS,
  INTELLIGENCE_REPORT_TYPES,
  normalizeIntelligenceAccessLevel,
  resolveIntelligenceReportAccess,
} from '../../../domain/intelligenceAccess';

export const MAXXIS_INTELLIGENCE_UPGRADE_VERSION = 'MAXXIS_INTELLIGENCE_UPGRADE_V1';

export const INTELLIGENCE_UNLOCK_TYPES = Object.freeze({
  SUBSCRIPTION: 'SUBSCRIPTION',
  ONE_TIME_UNLOCK: 'ONE_TIME_UNLOCK',
});

const BENEFITS = Object.freeze({
  PROPERTY_RELEASE: Object.freeze(['Property information', 'Photos available in portfolio', 'Location map', 'Basic property details']),
  MAXXIS_ANALYSIS: Object.freeze(['Everything in Property Release', 'Executive Summary', 'Investor Profile Alignment', 'Risk Analysis', 'Limitations', 'Recommended Next Steps']),
  DEAL_INTELLIGENCE: Object.freeze(['Everything in Maxxis Analysis', 'Comparable Sales Analysis', 'Valuation Intelligence', 'ARV Range', 'Investment Scenario KPIs', 'Evidence Review', 'Confidence Analysis']),
});

const TITLES = Object.freeze({
  PROPERTY_RELEASE: 'PROPERTY RELEASE',
  MAXXIS_ANALYSIS: 'MAXXIS ANALYSIS',
  DEAL_INTELLIGENCE: 'MAXXIS DEAL INTELLIGENCE',
});

function option(reportType, accessDecision, actionLabel) {
  return Object.freeze({
    reportType,
    title: TITLES[reportType],
    benefits: BENEFITS[reportType],
    accessDecision,
    actionLabel,
    unlockTypes: Object.freeze([INTELLIGENCE_UNLOCK_TYPES.SUBSCRIPTION, INTELLIGENCE_UNLOCK_TYPES.ONE_TIME_UNLOCK]),
    price: accessDecision.allowed ? 0 : accessDecision.nuggetCost,
    unlockExecutionEnabled: !accessDecision.allowed && Number(accessDecision.nuggetCost) > 0,
    premiumPreview: reportType === INTELLIGENCE_REPORT_TYPES.DEAL_INTELLIGENCE
      ? Object.freeze(['Comparable Analysis', 'ARV Intelligence', 'Investment Scenarios'])
      : Object.freeze([]),
  });
}

export function buildMaxxisIntelligenceUpgradeExperience({ plan, entitlements = [], requestedReportType = null } = {}) {
  const accessLevel = normalizeIntelligenceAccessLevel(plan);
  const propertyRelease = resolveIntelligenceReportAccess({ plan, entitlements, reportType: INTELLIGENCE_REPORT_TYPES.PROPERTY_RELEASE });
  const maxxisAnalysis = resolveIntelligenceReportAccess({ plan, entitlements, reportType: INTELLIGENCE_REPORT_TYPES.MAXXIS_ANALYSIS });
  const dealIntelligence = resolveIntelligenceReportAccess({ plan, entitlements, reportType: INTELLIGENCE_REPORT_TYPES.DEAL_INTELLIGENCE });
  const requestedDecision = requestedReportType === INTELLIGENCE_REPORT_TYPES.MAXXIS_ANALYSIS ? maxxisAnalysis
    : requestedReportType === INTELLIGENCE_REPORT_TYPES.DEAL_INTELLIGENCE ? dealIntelligence : null;
  const directAccess = Boolean(requestedDecision?.allowed);
  const options = accessLevel === INTELLIGENCE_ACCESS_LEVELS.FREE
    ? [option(INTELLIGENCE_REPORT_TYPES.MAXXIS_ANALYSIS, maxxisAnalysis, 'Unlock Maxxis Analysis'), option(INTELLIGENCE_REPORT_TYPES.DEAL_INTELLIGENCE, dealIntelligence, 'Unlock Deal Intelligence')]
    : accessLevel === INTELLIGENCE_ACCESS_LEVELS.PRO
      ? [option(INTELLIGENCE_REPORT_TYPES.DEAL_INTELLIGENCE, dealIntelligence, 'Unlock Advanced Intelligence')]
      : [];

  return Object.freeze({
    type: 'maxxis_intelligence_upgrade_experience',
    version: MAXXIS_INTELLIGENCE_UPGRADE_VERSION,
    accessLevel,
    requestedReportType,
    showModal: !directAccess && options.length > 0,
    directAccess,
    included: Object.freeze(accessLevel === INTELLIGENCE_ACCESS_LEVELS.FREE
      ? [option(INTELLIGENCE_REPORT_TYPES.PROPERTY_RELEASE, propertyRelease, null)]
      : accessLevel === INTELLIGENCE_ACCESS_LEVELS.PRO
        ? [option(INTELLIGENCE_REPORT_TYPES.PROPERTY_RELEASE, propertyRelease, null), option(INTELLIGENCE_REPORT_TYPES.MAXXIS_ANALYSIS, maxxisAnalysis, null)]
        : [option(INTELLIGENCE_REPORT_TYPES.PROPERTY_RELEASE, propertyRelease, null), option(INTELLIGENCE_REPORT_TYPES.MAXXIS_ANALYSIS, maxxisAnalysis, null), option(INTELLIGENCE_REPORT_TYPES.DEAL_INTELLIGENCE, dealIntelligence, null)]),
    options: Object.freeze(options),
    premiumPayload: null,
    commercialMessage: 'Use the intelligence you need when you need it, or upgrade your plan for ongoing access.',
    pricing: Object.freeze({ configured: true, currency: 'NUGGETS', executionEnabled: true }),
    mutation: null,
  });
}
