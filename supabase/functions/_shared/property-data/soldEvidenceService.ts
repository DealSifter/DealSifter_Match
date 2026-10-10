import { propertyAddressFingerprint } from './address.ts';
import { crossValidateSoldComparables, selectRecordedSoldComparables } from './soldCompEngine.ts';
import { validatePropertyId } from './cache.ts';
import { InMemoryPropertySingleFlight, type PropertySingleFlight } from './singleFlight.ts';
import { soldSearchQueryFingerprint, legacySoldSearchQueryFingerprint, type SoldRecordPoolCache } from './soldCache.ts';
import { DEFAULT_SOLD_SEARCH_POLICY, normalizeSoldSearchPolicy } from './soldProvider.ts';
import type { NormalizedSoldRecordPool, SoldEvidenceResult, SoldRecordDataProvider, SoldSearchPolicy } from './soldTypes.ts';
import type { PropertyEvidenceRepository } from './propertyEvidenceTypes.ts';
import { valuationSubjectAddressFingerprint, type ValuationEvidenceCache } from './valuationCache.ts';
import type { NormalizedValuationEvidence } from './valuationTypes.ts';
import { cacheFreshness } from './cacheFreshness.ts';
import { mapRentCastValueEstimate } from './valuationMapper.ts';
import { parseCanonicalLotArea } from '../maxxis/landMetrics.ts';
import { matchesCachedSubject } from './cacheIdentity.ts';
import { isProviderUnavailableError, providerAvailabilityFromError } from './providerAvailability.ts';

function providerPropertyType(value: string | null) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'sfr' || normalized === 'single family') return 'Single Family';
  if (normalized === 'condo') return 'Condo';
  if (normalized === 'townhouse') return 'Townhouse';
  if (normalized === 'land' || normalized === 'lot' || normalized === 'vacant land') return 'Land';
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
    developmentPropertyType?: string;
  }) {
    this.policyOverrides = options.policy || {};
    this.singleFlight = options.singleFlight || new InMemoryPropertySingleFlight();
  }

  private result(propertyId: string, cacheHit: boolean,
    soldPool: NormalizedSoldRecordPool, valuation: NormalizedValuationEvidence): SoldEvidenceResult {
    return {
      propertyId,
      cacheHit,
      soldPool,
      valuation,
      soldCompSet: crossValidateSoldComparables(valuation, soldPool.records),
      recordedSoldCompSelection: selectRecordedSoldComparables(valuation, soldPool.records),
    };
  }

  private async context(input: { propertyId: string; userId?: string | null }) {
    const propertyId = validatePropertyId(input.propertyId);
    const property = await this.options.repository.getById(propertyId, input.userId);
    if (!property) throw new Error('PROPERTY_NOT_FOUND');
    const lookup = { street: property.address || '', city: property.city || '', state: property.state || '',
      zipCode: property.zip || '', propertyId, userId: input.userId || null };
    const addressFingerprint = await propertyAddressFingerprint(lookup);
    // Fetch the allowed outer window once; the development selector still prefers
    // 180 days and admits older sales only through its explicit low-confidence gate.
    const policy = normalizeSoldSearchPolicy({ ...DEFAULT_SOLD_SEARCH_POLICY,
      ...(/^(land|lot|vacant land)$/i.test(property.type || '') ? { saleDateRangeDays: 365 } : {}), ...this.policyOverrides,
      propertyType: providerPropertyType(this.options.developmentPropertyType || property.type) });
    let valuationEntry = await this.options.valuationCache.getValuation(propertyId, { allowStale: true });
    const valuationEntryPersisted = Boolean(valuationEntry);
    // Land sold searches need subject identity/location, not a purchased residential AVM.
    if (!valuationEntry && /^(land|lot|vacant land)$/i.test(property.type || '')) {
      const valuation = mapRentCastValueEstimate({ lookup, requestPolicy: { maxRadius: 5, daysOld: 365, compCount: 0, lookupSubjectAttributes: false },
        raw: { subjectProperty: { addressLine1: lookup.street, city: lookup.city, state: lookup.state, zipCode: lookup.zipCode,
          propertyType: 'Land', latitude: property.lat ?? undefined, longitude: property.lng ?? undefined,
          lotSize: parseCanonicalLotArea(property.lot).lotSizeSqft ?? undefined }, comparables: [] } });
      for (const field of Object.values(valuation.subjectProperty)) {
        field.source = 'dealSifter'; field.status = field.value === null ? 'UNAVAILABLE' : 'USER_PROVIDED';
      }
      valuationEntry = { propertyId, provider: 'rentcast', dataType: 'property_value_avm', schemaVersion: 1,
        providerPropertyId: null, addressFingerprint, valuation, retrievedAt: valuation.retrievedAt, expiresAt: valuation.retrievedAt };
    }
    if (!valuationEntry || !await matchesCachedSubject(property, valuationEntry.valuation.subjectProperty)
      || await valuationSubjectAddressFingerprint(valuationEntry.valuation) !== addressFingerprint) {
      throw new Error('VALUATION_EVIDENCE_CACHE_REQUIRED');
    }
    const latitude = valuationEntry.valuation.subjectProperty.latitude.value;
    const longitude = valuationEntry.valuation.subjectProperty.longitude.value;
    const searchCenter = latitude !== null && longitude !== null && Number.isFinite(latitude) && Number.isFinite(longitude)
      ? { latitude: Number(latitude), longitude: Number(longitude) } : null;
    const queryFingerprint = await soldSearchQueryFingerprint(addressFingerprint, policy, searchCenter);
    return { propertyId, property, lookup, addressFingerprint, policy, queryFingerprint,
      searchCenter, valuation: valuationEntry.valuation, valuationEntry, valuationEntryPersisted };
  }

  async getCachedSoldEvidence(input: { propertyId: string; userId?: string | null }) {
    const context = await this.context(input);
    const cached = await this.options.soldCache.getSoldPool(context.propertyId, context.addressFingerprint, context.queryFingerprint, {
      allowStale: true, validatedAddressAlias: context.valuationEntry.addressFingerprint || undefined,
      legacyQueryFingerprint: await legacySoldSearchQueryFingerprint(context.valuationEntry.addressFingerprint || context.addressFingerprint, context.policy),
    });
    if (cached && Object.keys(context.policy).some(key => cached.pool.requestPolicy[key as keyof SoldSearchPolicy] !== context.policy[key as keyof SoldSearchPolicy])) return null;
    return cached ? { ...this.result(context.propertyId, true, cached.pool, context.valuation),
      freshness: cacheFreshness(cached), valuationFreshness: cacheFreshness(context.valuationEntryPersisted ? context.valuationEntry : null) } : null;
  }

  async getSoldEvidence(input: { propertyId: string; userId?: string | null }) {
    if (this.options.enabled === false) throw new Error('PROVIDER_DISABLED');
    const context = await this.context(input);
    const validCached = () => this.options.soldCache.getSoldPool(
      context.propertyId, context.addressFingerprint, context.queryFingerprint,
    );
    const cached = await validCached();
    if (cached) return { ...this.result(context.propertyId, true, cached.pool, context.valuation),
      freshness: cacheFreshness(cached), valuationFreshness: cacheFreshness(context.valuationEntryPersisted ? context.valuationEntry : null) };
    try {
    const loaded = await this.singleFlight.run(`sold:${context.propertyId}:${context.queryFingerprint}`, async () => {
      const rechecked = await validCached();
      if (rechecked) return { pool: rechecked.pool, cacheHit: true, entry: rechecked };
      const pool = await this.options.provider.getSoldRecordPool({ ...context.lookup,
        policy: context.policy, queryFingerprint: context.queryFingerprint, searchCenter: context.searchCenter });
      const current = await this.options.repository.getById(context.propertyId, input.userId);
      const currentFingerprint = current ? await propertyAddressFingerprint({ street: current.address || '', city: current.city || '',
        state: current.state || '', zipCode: current.zip || '' }) : null;
      if (currentFingerprint !== context.addressFingerprint) throw new Error('PROPERTY_ADDRESS_CHANGED');
      const entry = await this.options.soldCache.setSoldPool(context.propertyId, context.addressFingerprint, pool);
      return { pool, cacheHit: false, entry };
    });
    return { ...this.result(context.propertyId, loaded.cacheHit, loaded.pool, context.valuation),
      freshness: cacheFreshness(loaded.entry),
      valuationFreshness: cacheFreshness(context.valuationEntryPersisted ? context.valuationEntry : null) };
    } catch (error) {
      if (isProviderUnavailableError(error)) {
        const retained = await this.getCachedSoldEvidence(input);
        if (retained) return { ...retained, providerAvailability: providerAvailabilityFromError(error) };
      }
      throw error;
    }
  }
}
