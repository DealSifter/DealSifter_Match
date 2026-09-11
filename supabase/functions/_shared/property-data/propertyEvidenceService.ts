import { type PropertyIntelligenceCache, validatePropertyId } from './cache.ts';
import { propertyAddressFingerprint } from './address.ts';
import { InMemoryPropertySingleFlight, type PropertySingleFlight } from './singleFlight.ts';
import { detectPropertyEvidenceConflicts } from './conflicts.ts';
import { logPropertyDataEvent, type PropertyDataLogger } from './logger.ts';
import type {
  InternalPropertyEvidence,
  InternalPropertyRecord,
  PropertyEvidenceRepository,
  PropertyEvidenceResult,
} from './propertyEvidenceTypes.ts';
import { PropertyDataError, type Evidence, type NormalizedPropertyRecord, type PropertyDataProvider } from './types.ts';

const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;
const numeric = (value: unknown, allowZero: boolean) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) && (allowZero ? parsed >= 0 : parsed > 0) ? parsed : null;
};

function internalEvidence<T>(value: T | null): Evidence<T> {
  return value === null
    ? { value: null, status: 'UNAVAILABLE', source: null, retrievedAt: null, effectiveDate: null, providerPropertyId: null, confidence: null }
    : { value, status: 'USER_PROVIDED', source: 'dealSifter', retrievedAt: null, effectiveDate: null, providerPropertyId: null, confidence: null };
}

export function buildInternalPropertyEvidence(property: InternalPropertyRecord): InternalPropertyEvidence {
  return {
    source: 'dealSifter',
    address: {
      addressLine1: internalEvidence(text(property.address)),
      city: internalEvidence(text(property.city)),
      state: internalEvidence(text(property.state)),
      zipCode: internalEvidence(text(property.zip)),
    },
    characteristics: {
      propertyType: internalEvidence(text(property.type)),
      bedrooms: internalEvidence(numeric(property.beds, false)),
      bathrooms: internalEvidence(numeric(property.baths, false)),
      livingAreaSqft: internalEvidence(numeric(property.sqft, false)),
      lotSizeSqft: internalEvidence(numeric(property.lot, false)),
      // The current properties table has no year-built column.
      yearBuilt: internalEvidence<number>(null),
    },
    listing: { askingPrice: internalEvidence(numeric(property.price, false)) },
  };
}

const EXTERNAL_EVIDENCE_PATHS: Array<[string, (record: NormalizedPropertyRecord) => Evidence<unknown>]> = [
  ['address.formattedAddress', (record) => record.address.formattedAddress],
  ['address.addressLine1', (record) => record.address.addressLine1],
  ['address.city', (record) => record.address.city],
  ['address.state', (record) => record.address.state],
  ['address.zipCode', (record) => record.address.zipCode],
  ['address.county', (record) => record.address.county],
  ['address.latitude', (record) => record.address.latitude],
  ['address.longitude', (record) => record.address.longitude],
  ['characteristics.propertyType', (record) => record.characteristics.propertyType],
  ['characteristics.bedrooms', (record) => record.characteristics.bedrooms],
  ['characteristics.bathrooms', (record) => record.characteristics.bathrooms],
  ['characteristics.livingAreaSqft', (record) => record.characteristics.livingAreaSqft],
  ['characteristics.lotSizeSqft', (record) => record.characteristics.lotSizeSqft],
  ['characteristics.yearBuilt', (record) => record.characteristics.yearBuilt],
  ['ownership.ownerNames', (record) => record.ownership.ownerNames],
  ['ownership.ownerOccupied', (record) => record.ownership.ownerOccupied],
  ['tax.assessedValue', (record) => record.tax.assessedValue],
  ['tax.assessmentYear', (record) => record.tax.assessmentYear],
  ['tax.annualPropertyTax', (record) => record.tax.annualPropertyTax],
  ['tax.propertyTaxYear', (record) => record.tax.propertyTaxYear],
  ['lastSale.price', (record) => record.lastSale.price],
  ['lastSale.date', (record) => record.lastSale.date],
];

export function listMissingExternalFields(record: NormalizedPropertyRecord) {
  return EXTERNAL_EVIDENCE_PATHS.filter(([, getEvidence]) => getEvidence(record).status === 'UNAVAILABLE')
    .map(([path]) => path);
}

export class PropertyEvidenceService {
  private readonly repository: PropertyEvidenceRepository;
  private readonly cache: PropertyIntelligenceCache;
  private readonly provider: PropertyDataProvider;
  private readonly logger: PropertyDataLogger;
  private readonly singleFlight: PropertySingleFlight;
  private readonly enabled: boolean;

  constructor(options: {
    repository: PropertyEvidenceRepository;
    cache: PropertyIntelligenceCache;
    provider: PropertyDataProvider;
    logger?: PropertyDataLogger;
    singleFlight?: PropertySingleFlight;
    enabled?: boolean;
  }) {
    this.repository = options.repository;
    this.cache = options.cache;
    this.provider = options.provider;
    this.logger = options.logger || logPropertyDataEvent;
    this.singleFlight = options.singleFlight || new InMemoryPropertySingleFlight();
    this.enabled = options.enabled !== false;
  }

  async getCachedPropertyEvidence(input: { propertyId: string; userId?: string | null }): Promise<PropertyEvidenceResult> {
    const startedAt = Date.now();
    const propertyId = validatePropertyId(input.propertyId);
    try {
      const property = await this.repository.getById(propertyId, input.userId);
      if (!property) throw new PropertyDataError('PROPERTY_NOT_FOUND');
      const internalData = buildInternalPropertyEvidence(property);
      const fingerprint = await propertyAddressFingerprint({
        street: property.address || '', city: property.city || '', state: property.state || '', zipCode: property.zip || '',
      });
      const cached = await this.cache.getPropertyRecord(propertyId);
      if (!cached || cached.addressFingerprint !== fingerprint) {
        throw new PropertyDataError('PROPERTY_EVIDENCE_CACHE_MISS');
      }
      const cachedFingerprint = await propertyAddressFingerprint({
        street: cached.record.address.addressLine1.value || '', city: cached.record.address.city.value || '',
        state: cached.record.address.state.value || '', zipCode: cached.record.address.zipCode.value || '',
      }).catch(() => '');
      if (cachedFingerprint !== fingerprint) throw new PropertyDataError('PROPERTY_EVIDENCE_CACHE_INVALID');
      const result: PropertyEvidenceResult = {
        propertyId,
        internalData,
        externalData: cached.record,
        conflicts: detectPropertyEvidenceConflicts(internalData, cached.record),
        missingFields: listMissingExternalFields(cached.record),
        provider: 'rentcast',
        cacheHit: true,
        retrievedAt: cached.record.sourceMetadata.retrievedAt,
      };
      this.logger({ operation: 'property_evidence', success: true, durationMs: Date.now() - startedAt, cacheHit: true });
      return result;
    } catch (error) {
      this.logger({
        operation: 'property_evidence', success: false, durationMs: Date.now() - startedAt,
        cacheHit: false, errorCode: error instanceof Error ? error.message : 'PROPERTY_EVIDENCE_CACHE_READ_FAILED',
      });
      throw error;
    }
  }

  async getPropertyEvidence(input: { propertyId: string; userId?: string | null }): Promise<PropertyEvidenceResult> {
    const startedAt = Date.now();
    const propertyId = validatePropertyId(input.propertyId);
    let cacheHit = false;
    try {
      if (!this.enabled) throw new PropertyDataError('PROVIDER_DISABLED');
      const property = await this.repository.getById(propertyId, input.userId);
      if (!property) throw new PropertyDataError('PROPERTY_NOT_FOUND');
      const internalData = buildInternalPropertyEvidence(property);
      const lookup = {
        street: property.address || '', city: property.city || '', state: property.state || '', zipCode: property.zip || '',
        propertyId, userId: input.userId || null,
      };
      const fingerprint = await propertyAddressFingerprint(lookup);
      const matches = async (record: NormalizedPropertyRecord) => {
        try {
          return await propertyAddressFingerprint({ street: record.address.addressLine1.value || '', city: record.address.city.value || '', state: record.address.state.value || '', zipCode: record.address.zipCode.value || '' }) === fingerprint;
        } catch { return false; }
      };
      const cached = await this.cache.getPropertyRecord(propertyId);
      let externalData: NormalizedPropertyRecord;
      if (cached?.addressFingerprint === fingerprint && await matches(cached.record)) {
        cacheHit = true;
        externalData = cached.record;
      } else {
        const loaded = await this.singleFlight.run(propertyId, async () => {
          const rechecked = await this.cache.getPropertyRecord(propertyId);
          if (rechecked?.addressFingerprint === fingerprint && await matches(rechecked.record)) return { record: rechecked.record, hit: true };
          const record = await this.provider.getPropertyRecord(lookup);
          if (!await matches(record)) throw new PropertyDataError('ADDRESS_MISMATCH');
          const current = await this.repository.getById(propertyId, input.userId);
          if (!current || await propertyAddressFingerprint({street: current.address || '', city: current.city || '', state: current.state || '', zipCode: current.zip || ''}) !== fingerprint) throw new Error('PROPERTY_ADDRESS_CHANGED');
          await this.cache.setPropertyRecord(propertyId, record);
          return {record, hit: false};
        });
        if (!await matches(loaded.record)) throw new Error('PROPERTY_ADDRESS_CHANGED');
        externalData = loaded.record;
        cacheHit = loaded.hit;
      }
      const result: PropertyEvidenceResult = {
        propertyId,
        internalData,
        externalData,
        conflicts: detectPropertyEvidenceConflicts(internalData, externalData),
        missingFields: listMissingExternalFields(externalData),
        provider: 'rentcast',
        cacheHit,
        retrievedAt: externalData.sourceMetadata.retrievedAt,
      };
      this.logger({ operation: 'property_evidence', success: true, durationMs: Date.now() - startedAt, cacheHit });
      return result;
    } catch (error) {
      this.logger({
        operation: 'property_evidence', success: false, durationMs: Date.now() - startedAt,
        cacheHit, errorCode: error instanceof Error ? error.message : 'PROPERTY_EVIDENCE_FAILED',
      });
      throw error;
    }
  }
}
