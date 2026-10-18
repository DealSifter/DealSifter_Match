/** Provider AVM comparables are listing references, never recorded-sale inputs. */
export function projectProviderListingReferences(input: unknown) {
  const number = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? v : null;
  const text = (v: unknown) => typeof v === 'string' ? v.trim() : '';
  const seen = new Set<string>();
  return (Array.isArray(input) ? input : []).flatMap((raw: unknown) => {
    if (!raw || typeof raw !== 'object') return [];
    const row = raw as Record<string, unknown>, address = text(row.formattedAddress || row.address || row.addressLine1);
    const price = number(row.price);
    if (row.priceSemantic !== 'PROVIDER_LISTING_PRICE' || !address || price === null || price <= 0 || seen.has(address)) return [];
    seen.add(address);
    return [{ address, price, priceSemantic: 'PROVIDER_LISTING_PRICE' as const, latitude: number(row.latitude), longitude: number(row.longitude),
      bedrooms: number(row.bedrooms), bathrooms: number(row.bathrooms), livingAreaSqft: number(row.livingAreaSqft),
      distanceMiles: number(row.distanceMiles), providerCorrelation: number(row.providerCorrelation), lastSeenDate: text(row.lastSeenDate) }];
  }).sort((a, b) => (b.providerCorrelation ?? -1) - (a.providerCorrelation ?? -1)).slice(0, 5);
}

/** Presentation ordering only; does not promote supporting evidence into ARV. */
export function rankReportComparables<T extends Record<string, unknown>>(rows: T[]): T[] {
  const score = (row: T) => {
    const raw = row.similarity ?? row.structuralComparabilityScore ?? row.providerCorrelation;
    return typeof raw === 'number' && Number.isFinite(raw) ? raw <= 1 ? raw * 100 : raw : -1;
  };
  return [...rows].sort((a, b) => score(b) - score(a));
}
