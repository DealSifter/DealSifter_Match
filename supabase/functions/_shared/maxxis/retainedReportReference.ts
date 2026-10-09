import { propertyAddressFingerprint } from '../property-data/address.ts';
import { matchesCachedSubject } from '../property-data/cacheIdentity.ts';
import type { InternalPropertyRecord } from '../property-data/propertyEvidenceTypes.ts';

export async function findRetainedRecentSalesReference(reports: Array<{ id: string; created_at: string; report_payload: unknown }>, property: InternalPropertyRecord) {
  for (const report of reports) {
    const payload = report.report_payload as any;
    const schema = payload?.data?.maxxisReport;
    const saved = schema?.sections?.propertySummary?.data;
    const estimate = schema?.sections?.valuationEvidence?.data?.recentSalesMarketEstimate;
    if (!saved || String(saved.id || '') !== property.id || !estimate || !(Number(estimate.centralEstimate) > 0)
      || estimate.methodology !== 'RECENT_SALES_MARKET_ESTIMATE'
      || !Number.isFinite(Date.parse(report.created_at)) || Date.parse(report.created_at) > Date.now()) continue;
    const subject = { addressLine1: { value: saved.address }, city: { value: saved.city }, state: { value: saved.state }, zipCode: { value: saved.zip },
      latitude: { value: saved.latitude }, longitude: { value: saved.longitude } };
    if (!await matchesCachedSubject(property, subject)) continue;
    const comps = Array.isArray(estimate.valuationComps) ? estimate.valuationComps : [];
    if (comps.length < 2 || comps.some((comp: any) => !comp.address || !comp.saleDate || !Number.isFinite(Date.parse(comp.saleDate)) || !(Number(comp.salePrice) > 0))) continue;
    return { ...estimate, status: 'STALE_CALCULATED_REFERENCE', referenceState: 'STALE_CALCULATED_REFERENCE',
      sourceReportId: report.id, calculatedAt: report.created_at,
      identityFingerprint: await propertyAddressFingerprint({ street: property.address || '', city: property.city || '', state: property.state || '', zipCode: property.zip || '' }),
      // Historical reference is separate from the current 180-day valuation engine.
      valuationComps: comps.map((comp: any) => ({ ...comp, classification: 'HISTORICAL_MARKET_REFERENCE' })) };
  }
  return null;
}
