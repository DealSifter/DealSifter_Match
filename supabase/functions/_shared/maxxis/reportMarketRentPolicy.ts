import type { RentAvmSubject } from '../property-data/rentAvmSubject.ts';

/** Only an explicit analytical report may acquire missing/stale rent evidence.
 * Entitlement, subject validation, provider configuration and budget are checked by MarketRentService.
 * Export/preview and background cache-only recomputations must remain non-billable.
 */
export function shouldAcquireReportMarketRent(reportType: unknown, cacheOnly = false): boolean {
  return !cacheOnly && (reportType === 'MAXXIS_ANALYSIS' || reportType === 'DEAL_INTELLIGENCE');
}

/** Missing optional attributes may be discovered by the provider, but an
 * unresolved material disagreement is not an absent attribute. */
export function reportMarketRentSubject(subject: RentAvmSubject): RentAvmSubject {
  return subject;
}
