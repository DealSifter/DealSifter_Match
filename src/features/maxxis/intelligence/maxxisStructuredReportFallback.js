export function hasUsableStructuredReportFallback(result = {}, requestedReportType = '') {
  if (!requestedReportType || result?.type !== 'deal_insight') return false;
  const context = result?.data?.dealIntelligence;
  const structuredAnalysis = result?.data?.structuredAnalysis;
  return result?.fallbackSource === 'structured_tool_result'
    && result?.data?.state === 'available'
    && context?.type === 'deal_intelligence_context'
    && structuredAnalysis?.type === 'maxxis_structured_analysis';
}

export function didStructuredReportGenerationFail(result = {}, requestedReportType = '') {
  return Boolean(
    requestedReportType
      && result?.degraded
      && !hasUsableStructuredReportFallback(result, requestedReportType),
  );
}
