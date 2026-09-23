import { resolveReportExportEntitlements } from './reportExportEntitlement';

export function withCurrentReportExportEntitlements(message, { plan = 'free', entitlements = [] } = {}) {
  const reportType = String(message?.data?.maxxisReport?.reportType || '').trim().toUpperCase();
  if (!reportType) return message;

  const reportExportEntitlements = resolveReportExportEntitlements({
    plan,
    entitlements,
    reportType,
    grantedAccessDecision: message?.data?.reportAccessDecision || null,
  });

  return {
    ...message,
    data: {
      ...message.data,
      reportExportEntitlements,
    },
  };
}
