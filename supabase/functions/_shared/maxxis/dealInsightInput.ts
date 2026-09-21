import { resolvePropertyDetailsInput } from './propertyDetails.ts';

export function resolveDealInsightInput(input: unknown, trustedPropertyId: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('INVALID_DEAL_INSIGHT_INPUT');
  const raw = input as Record<string, unknown>;
  if (Object.keys(raw).some((key) => key !== 'propertyId' && key !== 'reportType')) {
    throw new Error('INVALID_DEAL_INSIGHT_INPUT');
  }
  const reportType = raw.reportType === undefined ? '' : String(raw.reportType).trim().toUpperCase();
  if (reportType && reportType !== 'MAXXIS_ANALYSIS' && reportType !== 'DEAL_INTELLIGENCE') {
    throw new Error('INVALID_DEAL_INSIGHT_INPUT');
  }
  const { propertyId } = resolvePropertyDetailsInput({ propertyId: raw.propertyId }, trustedPropertyId);
  return { propertyId, reportType };
}
