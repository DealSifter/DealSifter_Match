import { propertyAddressFingerprint } from './address.ts';
import { analyzeSaleComparables } from './compEngine.ts';
import { validatePropertyId } from './cache.ts';
import { InMemoryPropertySingleFlight, type PropertySingleFlight } from './singleFlight.ts';
import type { PropertyEvidenceRepository } from './propertyEvidenceTypes.ts';
import { PropertyDataError } from './types.ts';
import {
  valuationSubjectAddressFingerprint,
  type ValuationEvidenceCache,
} from './valuationCache.ts';
import type { NormalizedValuationEvidence, ValuationDataProvider, ValuationEvidenceResult } from './valuationTypes.ts';

export class ValuationEvidenceService {
  private readonly repository: PropertyEvidenceRepository;
  private readonly cache: ValuationEvidenceCache;
  private readonly provider: ValuationDataProvider;
  private readonly singleFlight: PropertySingleFlight;
  private readonly enabled: boolean;

  constructor(options: {
    repository: PropertyEvidenceRepository;
    cache: ValuationEvidenceCache;
    provider: ValuationDataProvider;
    singleFlight?: PropertySingleFlight;
    enabled?: boolean;
  }) {
    this.repository = options.repository;
    this.cache = options.cache;
    this.provider = options.provider;
    this.singleFlight = options.singleFlight || new InMemoryPropertySingleFlight();
    this.enabled = options.enabled !== false;
  }

  private result(propertyId: string, valuation: NormalizedValuationEvidence, cacheHit: boolean): ValuationEvidenceResult {
    return { propertyId, cacheHit, valuation, comparableAnalysis: analyzeSaleComparables(valuation) };
  }

  async getCachedValuationEvidence(input: { propertyId: string; userId?: string | null }) {
    const propertyId = validatePropertyId(input.propertyId);
    const property = await this.repository.getById(propertyId, input.userId);
    if (!property) throw new PropertyDataError('PROPERTY_NOT_FOUND');
    const fingerprint = await propertyAddressFingerprint({
      street: property.address || '', city: property.city || '', state: property.state || '', zipCode: property.zip || '',
    });
    const cached = await this.cache.getValuation(propertyId);
    if (!cached || cached.addressFingerprint !== fingerprint) return null;
    try {
      if (await valuationSubjectAddressFingerprint(cached.valuation) !== fingerprint) return null;
    } catch {
      return null;
    }
    return this.result(propertyId, cached.valuation, true);
  }

  async getValuationEvidence(input: { propertyId: string; userId?: string | null }) {
    if (!this.enabled) throw new PropertyDataError('PROVIDER_DISABLED');
    const propertyId = validatePropertyId(input.propertyId);
    const property = await this.repository.getById(propertyId, input.userId);
    if (!property) throw new PropertyDataError('PROPERTY_NOT_FOUND');
    const lookup = {
      street: property.address || '', city: property.city || '', state: property.state || '', zipCode: property.zip || '',
      propertyId, userId: input.userId || null,
    };
    const fingerprint = await propertyAddressFingerprint(lookup);
    const validCached = async () => {
      const cached = await this.cache.getValuation(propertyId);
      if (!cached || cached.addressFingerprint !== fingerprint) return null;
      try {
        return await valuationSubjectAddressFingerprint(cached.valuation) === fingerprint ? cached : null;
      } catch {
        return null;
      }
    };
    const cached = await validCached();
    if (cached) return this.result(propertyId, cached.valuation, true);

    const loaded = await this.singleFlight.run(propertyId, async () => {
      const rechecked = await validCached();
      if (rechecked) return { valuation: rechecked.valuation, cacheHit: true };
      const valuation = await this.provider.getValuationEvidence(lookup);
      if (await valuationSubjectAddressFingerprint(valuation) !== fingerprint) throw new PropertyDataError('ADDRESS_MISMATCH');
      const current = await this.repository.getById(propertyId, input.userId);
      if (!current || await propertyAddressFingerprint({
        street: current.address || '', city: current.city || '', state: current.state || '', zipCode: current.zip || '',
      }) !== fingerprint) throw new Error('PROPERTY_ADDRESS_CHANGED');
      await this.cache.setValuation(propertyId, fingerprint, valuation);
      return { valuation, cacheHit: false };
    });
    return this.result(propertyId, loaded.valuation, loaded.cacheHit);
  }
}
