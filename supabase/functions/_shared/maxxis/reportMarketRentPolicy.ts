import type { RentAvmSubject } from '../property-data/rentAvmSubject.ts';

/** Only an explicit analytical report may acquire missing/stale rent evidence.
 * Entitlement, subject validation, provider configuration and budget are checked by MarketRentService.
 * Export/preview and background cache-only recomputations must remain non-billable.
 */
export function shouldAcquireReportMarketRent(reportType: unknown, cacheOnly = false): boolean {
  return !cacheOnly && (reportType === 'MAXXIS_ANALYSIS' || reportType === 'DEAL_INTELLIGENCE');
}

/** Let the provider discover its own subject by validated address. Disputed
 * physical measurements must not be submitted as AVM overrides or adopted as facts.
 * Unknown/land/multi-unit types still require their existing applicability checks.
 */
export function reportMarketRentSubject(subject: RentAvmSubject): RentAvmSubject {
  if (subject.state !== 'RENT_AVM_REVIEW_REQUIRED' || !subject.lookup
    || !['Single Family', 'Condo', 'Townhouse', 'Manufactured'].includes(subject.overrides?.propertyType || '')) return subject;
  return { ...subject, state: 'READY', overrides: {}, scope: 'PROPERTY' };
}
