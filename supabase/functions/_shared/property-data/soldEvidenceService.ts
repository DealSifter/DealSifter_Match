import { propertyAddressFingerprint } from './address.ts';
import { crossValidateSoldComparables } from './soldCompEngine.ts';
import { validatePropertyId } from './cache.ts';
import { InMemoryPropertySingleFlight, type PropertySingleFlight } from './singleFlight.ts';
import { soldSearchQueryFingerprint, type SoldRecordPoolCache } from './soldCache.ts';
import { DEFAULT_SOLD_SEARCH_POLICY, normalizeSoldSearchPolicy } from './soldProvider.ts';
import type { NormalizedSoldRecordPool, SoldEvidenceResult, SoldRecordDataProvider, SoldSearchPolicy } from './soldTypes.ts';
import type { PropertyEvidenceRepository } from './propertyEvidenceTypes.ts';
import { valuationSubjectAddressFingerprint, type ValuationEvidenceCache } from './valuationCache.ts';
import type { NormalizedValuationEvidence } from './valuationTypes.ts';

function providerPropertyType(value: string | null) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'sfr' || normalized === 'single family') return 'Single Family';
  if (normalized === 'condo') return 'Condo';
  if (normalized === 'townhouse') return 'Townhouse';
  throw new Error('UNSUPPORTED_SOLD_SEARCH_PROPERTY_TYPE');
}

export class SoldEvidenceService {
  private readonly policyOverrides: Partial<SoldSearchPolicy>;
  private readonly singleFlight: PropertySingleFlight;
  constructor(private readonly options: {
    repository: PropertyEvidenceRepository;
    valuationCache: ValuationEvidenceCache;
    soldCache: SoldRecordPoolCache;
    provider: SoldRecordDataProvider;
    singleFlight?: PropertySingleFlight;
    policy?: Partial<SoldSearchPolicy>;
    enabled?: boolean;
  }) {
    this.policyOverrides = options.policy || {};
    this.singleFlight = options.singleFlight || new InMemoryPropertySingleFlight();
  }

  private result(propertyId: string, cacheHit: boolean,
    soldPool: NormalizedSoldRecordPool, valuation: NormalizedValuationEvidence): SoldEvidenceResult {
    return { propertyId, cacheHit, soldPool, valuation,
      soldCompSet: crossValidateSoldComparables(valuation, soldPool.records) };
  }

  private async context(input: { propertyId: string; userId?: string | null }) {
    const propertyId = validatePropertyId(input.propertyId);
    const property = await this.options.repository.getById(propertyId, input.userId);
    if (!property) throw new Error('PROPERTY_NOT_FOUND');
    const lookup = { street: property.address || '', city: property.city || '', state: property.state || '',
      zipCode: property.zip || '', propertyId, userId: input.userId || null };
    const addressFingerprint = await propertyAddressFingerprint(lookup);
    const policy = normalizeSoldSearchPolicy({ ...DEFAULT_SOLD_SEARCH_POLICY, ...this.policyOverrides,
      propertyType: providerPropertyType(property.type) });
    const queryFingerprint = await soldSearchQueryFingerprint(addressFingerprint, policy);
    const valuationEntry = await this.options.valuationCache.getValuation(propertyId);
    if (!valuationEntry || valuationEntry.addressFingerprint !== addressFingerprint
      || await valuationSubjectAddressFingerprint(valuationEntry.valuation) !== addressFingerprint) {
      throw new Error('VALUATION_EVIDENCE_CACHE_REQUIRED');
    }
    return { propertyId, property, lookup, addressFingerprint, policy, queryFingerprint, valuation: valuationEntry.valuation };
  }

  async getCachedSoldEvidence(input: { propertyId: string; userId?: string | null }) {
    const context = await this.context(input);
    const cached = await this.options.soldCache.getSoldPool(context.propertyId, context.addressFingerprint, context.queryFingerprint);
    return cached ? this.result(context.propertyId, true, cached.pool, context.valuation) : null;
  }

  async getSoldEvidence(input: { propertyId: string; userId?: string | null }) {
    if (this.options.enabled === false) throw new Error('PROVIDER_DISABLED');
    const context = await this.context(input);
    const validCached = () => this.options.soldCache.getSoldPool(
      context.propertyId, context.addressFingerprint, context.queryFingerprint,
    );
    const cached = await validCached();
    if (cached) return this.result(context.propertyId, true, cached.pool, context.valuation);
    const loaded = await this.singleFlight.run(context.propertyId, async () => {
      const rechecked = await validCached();
      if (rechecked) return { pool: rechecked.pool, cacheHit: true };
      const pool = await this.options.provider.getSoldRecordPool({ ...context.lookup,
        policy: context.policy, queryFingerprint: context.queryFingerprint });
      const current = await this.options.repository.getById(context.propertyId, input.userId);
      const currentFingerprint = current ? await propertyAddressFingerprint({ street: current.address || '', city: current.city || '',
        state: current.state || '', zipCode: current.zip || '' }) : null;
      if (currentFingerprint !== context.addressFingerprint) throw new Error('PROPERTY_ADDRESS_CHANGED');
      await this.options.soldCache.setSoldPool(context.propertyId, context.addressFingerprint, pool);
      return { pool, cacheHit: false };
    });
    return this.result(context.propertyId, loaded.cacheHit, loaded.pool, context.valuation);
  }
}
