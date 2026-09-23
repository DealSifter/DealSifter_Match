import { INTELLIGENCE_ACCESS_LEVELS, isIntelligenceReportType, REPORT_ACCESS_SOURCES } from '../../../domain/intelligenceAccess';

const SAVED_ACCESS_SOURCES = new Set(['SUBSCRIPTION_INCLUDED', 'ONE_TIME_UNLOCK']);

export function resolveSavedReportAccessDecision(report = {}) {
  const reportType = String(report?.capability || '').trim().toUpperCase();
  const schemaType = String(report?.reportPayload?.data?.maxxisReport?.reportType || '').trim().toUpperCase();
  const persistedSource = String(report?.accessSource || '').trim().toUpperCase();
  if (!report?.id || !isIntelligenceReportType(reportType) || schemaType !== reportType
    || !SAVED_ACCESS_SOURCES.has(persistedSource)) return null;
  const nuggetUnlock = persistedSource === 'ONE_TIME_UNLOCK';
  return Object.freeze({
    allowed: true,
    state: 'ENTITLED',
    reason: 'OWNED_SAVED_REPORT_ARTIFACT',
    reportType,
    accessLevel: nuggetUnlock
      ? INTELLIGENCE_ACCESS_LEVELS.NUGGET_UNLOCK
      : reportType === 'DEAL_INTELLIGENCE' ? INTELLIGENCE_ACCESS_LEVELS.ENTERPRISE : INTELLIGENCE_ACCESS_LEVELS.PRO,
    accessSource: nuggetUnlock ? REPORT_ACCESS_SOURCES.NUGGET_UNLOCK : REPORT_ACCESS_SOURCES.SUBSCRIPTION,
    requiredAccessMethod: null,
    nuggetCost: 0,
    paidUnlockEnabled: false,
  });
}
