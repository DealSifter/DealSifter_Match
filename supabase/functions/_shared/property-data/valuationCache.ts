import { propertyAddressFingerprint } from './address.ts';
import { validatePropertyId, type PropertyIntelligenceRpcClient } from './cache.ts';
import { isNormalizedValuationEvidence, serializeNormalizedValuationEvidence } from './valuationSchema.ts';
import type { NormalizedValuationEvidence } from './valuationTypes.ts';

export const VALUATION_CACHE_SCHEMA_VERSION = 1;
export const VALUATION_CACHE_DATA_TYPE = 'property_value_avm' as const;
export const DEFAULT_VALUATION_CACHE_TTL_HOURS = 72;

export type ValuationCacheEntry = {
  propertyId: string;
  provider: 'rentcast';
  dataType: typeof VALUATION_CACHE_DATA_TYPE;
  schemaVersion: typeof VALUATION_CACHE_SCHEMA_VERSION;
  providerPropertyId: string | null;
  addressFingerprint: string | null;
  valuation: NormalizedValuationEvidence;
  retrievedAt: string;
  expiresAt: string;
};

export interface ValuationEvidenceCache {
  getValuation(propertyId: string): Promise<ValuationCacheEntry | null>;
  setValuation(propertyId: string, addressFingerprint: string, valuation: NormalizedValuationEvidence): Promise<ValuationCacheEntry>;
}

export function normalizeValuationCacheTtlHours(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_VALUATION_CACHE_TTL_HOURS;
  return Math.min(720, Math.trunc(parsed));
}

type Stored = ValuationCacheEntry & { rawValuation?: unknown };
export class InMemoryValuationEvidenceCache implements ValuationEvidenceCache {
  private readonly entries = new Map<string, Stored>();
  private readonly now: () => Date;
  private readonly ttlHours: number;

  constructor(options: { now?: () => Date; ttlHours?: unknown } = {}) {
    this.now = options.now || (() => new Date());
    this.ttlHours = normalizeValuationCacheTtlHours(options.ttlHours);
  }

  async getValuation(propertyId: string): Promise<ValuationCacheEntry | null> {
    const id = validatePropertyId(propertyId);
    const entry = this.entries.get(id);
    if (!entry || Date.parse(entry.expiresAt) <= this.now().getTime()) return null;
    const candidate = entry.rawValuation === undefined ? entry.valuation : entry.rawValuation;
    if (!isNormalizedValuationEvidence(candidate)) return null;
    const { rawValuation: _raw, ...safe } = entry;
    return structuredClone({ ...safe, valuation: candidate });
  }

  async setValuation(propertyId: string, addressFingerprint: string, valuation: NormalizedValuationEvidence): Promise<ValuationCacheEntry> {
    const id = validatePropertyId(propertyId);
    const normalized = serializeNormalizedValuationEvidence(valuation);
    if (!/^[0-9a-f]{64}$/i.test(addressFingerprint)) throw new Error('INVALID_ADDRESS_FINGERPRINT');
    const expiresAt = new Date(Date.parse(normalized.retrievedAt) + this.ttlHours * 3_600_000).toISOString();
    const entry: ValuationCacheEntry = {
      propertyId: id, provider: 'rentcast', dataType: VALUATION_CACHE_DATA_TYPE,
      schemaVersion: VALUATION_CACHE_SCHEMA_VERSION, providerPropertyId: normalized.subjectProperty.providerPropertyId.value,
      addressFingerprint, valuation: normalized, retrievedAt: normalized.retrievedAt, expiresAt,
    };
    this.entries.set(id, structuredClone(entry));
    return structuredClone(entry);
  }

  seedRaw(propertyId: string, rawValuation: unknown, expiresAt: string, addressFingerprint: string | null = null) {
    const id = validatePropertyId(propertyId);
    this.entries.set(id, {
      propertyId: id, provider: 'rentcast', dataType: VALUATION_CACHE_DATA_TYPE,
      schemaVersion: VALUATION_CACHE_SCHEMA_VERSION, providerPropertyId: null, addressFingerprint,
      valuation: rawValuation as NormalizedValuationEvidence, rawValuation,
      retrievedAt: this.now().toISOString(), expiresAt,
    });
  }
}

export class SupabaseValuationEvidenceCache implements ValuationEvidenceCache {
  private readonly ttlHours: number;
  constructor(private readonly client: PropertyIntelligenceRpcClient, ttlHours: unknown = DEFAULT_VALUATION_CACHE_TTL_HOURS) {
    this.ttlHours = normalizeValuationCacheTtlHours(ttlHours);
  }

  async getValuation(propertyId: string): Promise<ValuationCacheEntry | null> {
    const id = validatePropertyId(propertyId);
    const { data, error } = await this.client.rpc('ds_get_property_intelligence_cache', {
      p_property_id: id, p_provider: 'rentcast', p_data_type: VALUATION_CACHE_DATA_TYPE,
      p_schema_version: VALUATION_CACHE_SCHEMA_VERSION,
    });
    if (error) throw new Error('VALUATION_CACHE_READ_FAILED');
    const row = Array.isArray(data) ? data[0] : null;
    if (!row || typeof row !== 'object') return null;
    const value = row as Record<string, unknown>;
    if (!isNormalizedValuationEvidence(value.payload)) return null;
    const retrievedAt = String(value.retrieved_at || '');
    const expiresAt = String(value.expires_at || '');
    if (!Number.isFinite(Date.parse(retrievedAt)) || Date.parse(expiresAt) <= Date.now()) return null;
    return {
      propertyId: id, provider: 'rentcast' as const, dataType: VALUATION_CACHE_DATA_TYPE,
      schemaVersion: VALUATION_CACHE_SCHEMA_VERSION,
      providerPropertyId: typeof value.provider_property_id === 'string' ? value.provider_property_id : null,
      addressFingerprint: typeof value.address_fingerprint === 'string' ? value.address_fingerprint : null,
      valuation: value.payload, retrievedAt, expiresAt,
    };
  }

  async setValuation(propertyId: string, addressFingerprint: string, valuation: NormalizedValuationEvidence): Promise<ValuationCacheEntry> {
    const id = validatePropertyId(propertyId);
    const normalized = serializeNormalizedValuationEvidence(valuation);
    const expiresAt = new Date(Date.parse(normalized.retrievedAt) + this.ttlHours * 3_600_000).toISOString();
    const { error } = await this.client.rpc('ds_upsert_property_intelligence_cache', {
      p_address_fingerprint: addressFingerprint, p_property_id: id, p_provider: 'rentcast',
      p_provider_property_id: normalized.subjectProperty.providerPropertyId.value,
      p_data_type: VALUATION_CACHE_DATA_TYPE, p_schema_version: VALUATION_CACHE_SCHEMA_VERSION,
      p_payload: normalized, p_retrieved_at: normalized.retrievedAt, p_expires_at: expiresAt,
    });
    if (error) throw new Error('VALUATION_CACHE_WRITE_FAILED');
    return {
      propertyId: id, provider: 'rentcast' as const, dataType: VALUATION_CACHE_DATA_TYPE,
      schemaVersion: VALUATION_CACHE_SCHEMA_VERSION,
      providerPropertyId: normalized.subjectProperty.providerPropertyId.value,
      addressFingerprint, valuation: normalized, retrievedAt: normalized.retrievedAt, expiresAt,
    };
  }
}

export async function valuationSubjectAddressFingerprint(valuation: NormalizedValuationEvidence) {
  return propertyAddressFingerprint({
    street: valuation.subjectProperty.addressLine1.value || '', city: valuation.subjectProperty.city.value || '',
    state: valuation.subjectProperty.state.value || '', zipCode: valuation.subjectProperty.zipCode.value || '',
  });
}
