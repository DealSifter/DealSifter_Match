import { propertyAddressFingerprint } from './address.ts';
import { validatePropertyId } from './cache.ts';
import type { PropertyEvidenceRepository } from './propertyEvidenceTypes.ts';
import { InMemoryPropertySingleFlight, type PropertySingleFlight } from './singleFlight.ts';
import { supplementalQueryFingerprint, type SupplementalEvidenceCache } from './supplementalEvidenceCache.ts';
import type { SupplementalEvidence, SupplementalEvidenceFamily, SupplementalEvidenceProvider } from './supplementalEvidenceTypes.ts';
import { cacheFreshness, type EvidenceFreshness } from './cacheFreshness.ts';
import { isProviderUnavailableError } from './providerAvailability.ts';

export type SupplementalEvidenceBundle = {
  propertyId: string;
  saleListings: SupplementalEvidence | null;
  rentEstimate: SupplementalEvidence | null;
  rentalListings: SupplementalEvidence | null;
  market: SupplementalEvidence | null;
  cacheHits: Partial<Record<SupplementalEvidenceFamily, boolean>>;
  freshness?: Partial<Record<SupplementalEvidenceFamily, EvidenceFreshness>>;
};

const FILTERS: Record<SupplementalEvidenceFamily, Record<string, unknown>> = {
  saleListings: { radius: 5, status: 'Active', limit: 50 },
  rentEstimate: { maxRadius: 5, daysOld: 180, compCount: 20 },
  rentalListings: { radius: 5, status: 'Active', limit: 50 },
  market: { geography: 'ZIP' },
};

export class SupplementalEvidenceService {
  private readonly singleFlight: PropertySingleFlight;
  constructor(private readonly options: { repository: PropertyEvidenceRepository; cache: SupplementalEvidenceCache;
    provider: SupplementalEvidenceProvider; singleFlight?: PropertySingleFlight; enabled?: boolean }) {
    this.singleFlight = options.singleFlight || new InMemoryPropertySingleFlight();
  }

  private async context(input: { propertyId: string; userId?: string | null }, family: SupplementalEvidenceFamily) {
    const propertyId = validatePropertyId(input.propertyId);
    const property = await this.options.repository.getById(propertyId, input.userId);
    if (!property) throw new Error('PROPERTY_NOT_FOUND');
    const lookup = { street: property.address || '', city: property.city || '', state: property.state || '', zipCode: property.zip || '',
      propertyId, userId: input.userId || null };
    const addressFingerprint = await propertyAddressFingerprint(lookup);
    const filters = { ...FILTERS[family], propertyType: property.type || null };
    const queryFingerprint = await supplementalQueryFingerprint(addressFingerprint, family, filters);
    return { propertyId, property, lookup, addressFingerprint, queryFingerprint };
  }

  private async load(input: { propertyId: string; userId?: string | null }, family: SupplementalEvidenceFamily, cacheOnly: boolean): Promise<{ evidence: SupplementalEvidence; cacheHit: boolean; freshness?: EvidenceFreshness } | null> {
    const context = await this.context(input, family);
    const cached = await this.options.cache.get(context.propertyId, family, context.addressFingerprint, context.queryFingerprint);
    if (cached) return { evidence: cached.evidence, cacheHit: true, freshness: cacheFreshness(cached) };
    if (cacheOnly || this.options.enabled === false) {
      const retained = await this.options.cache.get(context.propertyId, family, context.addressFingerprint, context.queryFingerprint, { allowStale: true });
      return retained ? { evidence: retained.evidence, cacheHit: true, freshness: cacheFreshness(retained) } : null;
    }
    try { return await this.singleFlight.run(context.propertyId, async () => {
      const rechecked = await this.options.cache.get(context.propertyId, family, context.addressFingerprint, context.queryFingerprint);
      if (rechecked) return { evidence: rechecked.evidence, cacheHit: true };
      const request = { ...context.lookup, queryFingerprint: context.queryFingerprint, propertyType: context.property.type };
      const evidence = family === 'saleListings' ? await this.options.provider.getSaleListings(request)
        : family === 'rentEstimate' ? await this.options.provider.getRentEstimate(request)
        : family === 'rentalListings' ? await this.options.provider.getRentalListings(request)
        : await this.options.provider.getMarketData(request);
      const current = await this.options.repository.getById(context.propertyId, input.userId);
      const currentFingerprint = current ? await propertyAddressFingerprint({ street: current.address || '', city: current.city || '',
        state: current.state || '', zipCode: current.zip || '' }) : null;
      if (currentFingerprint !== context.addressFingerprint) throw new Error('PROPERTY_ADDRESS_CHANGED');
      await this.options.cache.set(context.propertyId, family, context.addressFingerprint, evidence);
      return { evidence, cacheHit: false };
    }); } catch (error) {
      if (isProviderUnavailableError(error)) return this.load(input, family, true);
      throw error;
    }
  }

  getCached(input: { propertyId: string; userId?: string | null }, family: SupplementalEvidenceFamily) {
    return this.load(input, family, true);
  }
  get(input: { propertyId: string; userId?: string | null }, family: SupplementalEvidenceFamily) {
    return this.load(input, family, false);
  }

  async getBundle(input: { propertyId: string; userId?: string | null; families: SupplementalEvidenceFamily[]; cacheOnly?: boolean }) {
    const bundle: SupplementalEvidenceBundle = { propertyId: validatePropertyId(input.propertyId), saleListings: null,
      rentEstimate: null, rentalListings: null, market: null, cacheHits: {}, freshness: {} };
    // Sequential provider access intentionally preserves the global usage guard and single-flight semantics.
    for (const family of [...new Set(input.families)]) {
      try {
        const result = await this.load(input, family, input.cacheOnly === true);
        if (!result) continue;
        bundle[family] = result.evidence;
        bundle.cacheHits[family] = result.cacheHit;
        if ('freshness' in result && result.freshness) bundle.freshness![family] = result.freshness;
      } catch {
        // Each evidence family is independently optional; one provider endpoint must not erase the others.
      }
    }
    return bundle;
  }
}
