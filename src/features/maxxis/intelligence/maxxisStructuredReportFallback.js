export function hasUsableStructuredReportFallback(result = {}, requestedReportType = '') {
  if (!requestedReportType || result?.type !== 'deal_insight') return false;
  const context = result?.data?.dealIntelligence;
  return result?.fallbackSource === 'structured_tool_result'
    && result?.data?.state === 'available'
    && context?.type === 'deal_intelligence_context';
}

export function didStructuredReportGenerationFail(result = {}, requestedReportType = '') {
  return Boolean(
    requestedReportType
      && result?.degraded
      && !hasUsableStructuredReportFallback(result, requestedReportType),
  );
}
