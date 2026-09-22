import { isIntelligenceReportType, resolveIntelligenceReportAccess } from '../../../domain/intelligenceAccess';

export const MAXXIS_REPORT_EXPORT_CHANNELS = Object.freeze(['PDF', 'EMAIL', 'SHARE']);

export function resolveReportExportEntitlement({ plan, entitlements = [], reportType, channel } = {}) {
  const normalizedChannel = String(channel || '').trim().toUpperCase();
  const normalizedReportType = String(reportType || '').trim().toUpperCase();
  if (!MAXXIS_REPORT_EXPORT_CHANNELS.includes(normalizedChannel) || !isIntelligenceReportType(normalizedReportType)) {
    return Object.freeze({ allowed: false, state: 'DENIED', reason: 'INVALID_EXPORT_REQUEST', channel: normalizedChannel || null, reportType: normalizedReportType || null, accessDecision: null });
  }
  const accessDecision = resolveIntelligenceReportAccess({ plan, entitlements, reportType: normalizedReportType });
  return Object.freeze({
    allowed: accessDecision.allowed,
    state: accessDecision.allowed ? 'AUTHORIZED' : 'AVAILABLE_WITH_UPGRADE',
    reason: accessDecision.reason,
    channel: normalizedChannel,
    reportType: normalizedReportType,
    accessLevel: accessDecision.accessLevel,
    accessSource: accessDecision.accessSource,
    accessDecision,
  });
}

export function resolveReportExportEntitlements({ plan, entitlements = [], reportType, grantedAccessDecision = null } = {}) {
  const normalizedReportType = String(reportType || '').trim().toUpperCase();
  const hasMatchingGrant = Boolean(
    grantedAccessDecision?.allowed
    && String(grantedAccessDecision?.reportType || '').trim().toUpperCase() === normalizedReportType,
  );

  return Object.freeze(Object.fromEntries(MAXXIS_REPORT_EXPORT_CHANNELS.map((channel) => {
    const resolved = resolveReportExportEntitlement({ plan, entitlements, reportType: normalizedReportType, channel });
    if (resolved.allowed || !hasMatchingGrant) return [channel, resolved];
    return [channel, Object.freeze({
      ...resolved,
      allowed: true,
      state: 'AUTHORIZED',
      reason: grantedAccessDecision.reason || 'AUTHORIZED_REPORT_GENERATION',
      accessLevel: grantedAccessDecision.accessLevel || resolved.accessLevel,
      accessSource: grantedAccessDecision.accessSource || resolved.accessSource,
      accessDecision: grantedAccessDecision,
    })];
  })));
}

export function isMatchingReportExportEntitlement(decision, reportType, channel) {
  return Boolean(decision?.allowed
    && decision.reportType === String(reportType || '').trim().toUpperCase()
    && decision.channel === String(channel || '').trim().toUpperCase());
}
