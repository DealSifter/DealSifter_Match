import { isNormalizedPropertyRecord, serializeNormalizedPropertyRecord } from './normalizedRecordSchema.ts';
import { propertyAddressFingerprint } from './address.ts';
import type { NormalizedPropertyRecord } from './types.ts';

export const PROPERTY_RECORD_CACHE_SCHEMA_VERSION = 1;
export const DEFAULT_PROPERTY_RECORD_CACHE_TTL_HOURS = 168;
export const PROPERTY_RECORD_CACHE_DATA_TYPE = 'property_record' as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PropertyRecordCacheEntry = {
  addressFingerprint: string | null;
  propertyId: string;
  provider: 'rentcast';
  dataType: typeof PROPERTY_RECORD_CACHE_DATA_TYPE;
  schemaVersion: typeof PROPERTY_RECORD_CACHE_SCHEMA_VERSION;
  providerPropertyId: string | null;
  record: NormalizedPropertyRecord;
  retrievedAt: string;
  expiresAt: string;
};

export interface PropertyIntelligenceCache {
  getPropertyRecord(propertyId: string): Promise<PropertyRecordCacheEntry | null>;
  setPropertyRecord(propertyId: string, record: NormalizedPropertyRecord): Promise<PropertyRecordCacheEntry>;
}

export function validatePropertyId(propertyId: unknown) {
  const value = String(propertyId || '').trim();
  if (!UUID_PATTERN.test(value)) throw new Error('INVALID_PROPERTY_ID');
  return value;
}

export function normalizePropertyRecordCacheTtlHours(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_PROPERTY_RECORD_CACHE_TTL_HOURS;
  return Math.min(720, Math.trunc(parsed));
}

type StoredEntry = PropertyRecordCacheEntry & { rawRecord?: unknown };

export class InMemoryPropertyIntelligenceCache implements PropertyIntelligenceCache {
  private readonly entries = new Map<string, StoredEntry>();
  private readonly now: () => Date;
  private readonly ttlHours: number;

  constructor(options: { now?: () => Date; ttlHours?: unknown } = {}) {
    this.now = options.now || (() => new Date());
    this.ttlHours = normalizePropertyRecordCacheTtlHours(options.ttlHours);
  }

  async getPropertyRecord(propertyId: string): Promise<PropertyRecordCacheEntry | null> {
    const id = validatePropertyId(propertyId);
    const entry = this.entries.get(id);
    if (!entry || Date.parse(entry.expiresAt) <= this.now().getTime()) return null;
    const candidate = entry.rawRecord === undefined ? entry.record : entry.rawRecord;
    if (!isNormalizedPropertyRecord(candidate)) return null;
    const { rawRecord: _rawRecord, ...safeEntry } = entry;
    return structuredClone({ ...safeEntry, record: candidate });
  }

  async setPropertyRecord(propertyId: string, record: NormalizedPropertyRecord): Promise<PropertyRecordCacheEntry> {
    const id = validatePropertyId(propertyId);
    const normalized = serializeNormalizedPropertyRecord(record);
    const retrievedAt = normalized.sourceMetadata.retrievedAt;
    const expiresAt = new Date(Date.parse(retrievedAt) + this.ttlHours * 3_600_000).toISOString();
    const entry: PropertyRecordCacheEntry = {
      addressFingerprint: await recordAddressFingerprint(normalized),
      propertyId: id,
      provider: 'rentcast',
      dataType: PROPERTY_RECORD_CACHE_DATA_TYPE,
      schemaVersion: PROPERTY_RECORD_CACHE_SCHEMA_VERSION,
      providerPropertyId: normalized.sourceMetadata.providerPropertyId || null,
      record: normalized,
      retrievedAt,
      expiresAt,
    };
    this.entries.set(id, structuredClone(entry));
    return structuredClone(entry);
  }

  seedRaw(propertyId: string, rawRecord: unknown, expiresAt: string) {
    const id = validatePropertyId(propertyId);
    this.entries.set(id, {
      addressFingerprint: null,
      propertyId: id, provider: 'rentcast', dataType: PROPERTY_RECORD_CACHE_DATA_TYPE,
      schemaVersion: PROPERTY_RECORD_CACHE_SCHEMA_VERSION, providerPropertyId: null,
      record: rawRecord as NormalizedPropertyRecord, rawRecord, retrievedAt: this.now().toISOString(), expiresAt,
    });
  }

  size() { return this.entries.size; }
}

export type PropertyIntelligenceRpcClient = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};

export class SupabasePropertyIntelligenceCache implements PropertyIntelligenceCache {
  private readonly client: PropertyIntelligenceRpcClient;
  private readonly ttlHours: number;

  constructor(client: PropertyIntelligenceRpcClient, ttlHours: unknown = DEFAULT_PROPERTY_RECORD_CACHE_TTL_HOURS) {
    this.client = client;
    this.ttlHours = normalizePropertyRecordCacheTtlHours(ttlHours);
  }

  async getPropertyRecord(propertyId: string): Promise<PropertyRecordCacheEntry | null> {
    const id = validatePropertyId(propertyId);
    const { data, error } = await this.client.rpc('ds_get_property_intelligence_cache', {
      p_property_id: id,
      p_provider: 'rentcast',
      p_data_type: PROPERTY_RECORD_CACHE_DATA_TYPE,
      p_schema_version: PROPERTY_RECORD_CACHE_SCHEMA_VERSION,
    });
    if (error) throw new Error('PROPERTY_INTELLIGENCE_CACHE_READ_FAILED');
    const row = Array.isArray(data) ? data[0] : null;
    if (!row || typeof row !== 'object') return null;
    const value = row as Record<string, unknown>;
    if (!isNormalizedPropertyRecord(value.payload)) return null;
    const retrievedAt = String(value.retrieved_at || '');
    const expiresAt = String(value.expires_at || '');
    if (!Number.isFinite(Date.parse(retrievedAt)) || Date.parse(expiresAt) <= Date.now()) return null;
    return {
      propertyId: id, provider: 'rentcast', dataType: PROPERTY_RECORD_CACHE_DATA_TYPE,
      addressFingerprint: typeof value.address_fingerprint === 'string' ? value.address_fingerprint : null,
      schemaVersion: PROPERTY_RECORD_CACHE_SCHEMA_VERSION,
      providerPropertyId: typeof value.provider_property_id === 'string' ? value.provider_property_id : null,
      record: value.payload,
      retrievedAt,
      expiresAt,
    };
  }

  async setPropertyRecord(propertyId: string, record: NormalizedPropertyRecord): Promise<PropertyRecordCacheEntry> {
    const id = validatePropertyId(propertyId);
    const normalized = serializeNormalizedPropertyRecord(record);
    const retrievedAt = normalized.sourceMetadata.retrievedAt;
    const expiresAt = new Date(Date.parse(retrievedAt) + this.ttlHours * 3_600_000).toISOString();
    const addressFingerprint = await recordAddressFingerprint(normalized);
    const { error } = await this.client.rpc('ds_upsert_property_intelligence_cache', {
      p_address_fingerprint: addressFingerprint,
      p_property_id: id,
      p_provider: 'rentcast',
      p_provider_property_id: normalized.sourceMetadata.providerPropertyId,
      p_data_type: PROPERTY_RECORD_CACHE_DATA_TYPE,
      p_schema_version: PROPERTY_RECORD_CACHE_SCHEMA_VERSION,
      p_payload: normalized,
      p_retrieved_at: retrievedAt,
      p_expires_at: expiresAt,
    });
    if (error) throw new Error('PROPERTY_INTELLIGENCE_CACHE_WRITE_FAILED');
    return {
      propertyId: id, provider: 'rentcast', dataType: PROPERTY_RECORD_CACHE_DATA_TYPE,
      schemaVersion: PROPERTY_RECORD_CACHE_SCHEMA_VERSION,
      providerPropertyId: normalized.sourceMetadata.providerPropertyId || null,
      record: normalized, retrievedAt, expiresAt,
      addressFingerprint,
    };
  }
}

async function recordAddressFingerprint(record: NormalizedPropertyRecord) {
  return propertyAddressFingerprint({
    street: record.address.addressLine1.value || '', city: record.address.city.value || '',
    state: record.address.state.value || '', zipCode: record.address.zipCode.value || '',
  });
}
