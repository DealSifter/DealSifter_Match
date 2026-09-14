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

export function isMatchingReportExportEntitlement(decision, reportType, channel) {
  return Boolean(decision?.allowed
    && decision.reportType === String(reportType || '').trim().toUpperCase()
    && decision.channel === String(channel || '').trim().toUpperCase());
}
