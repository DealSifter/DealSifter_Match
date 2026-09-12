import { validatePropertyId, type PropertyIntelligenceRpcClient } from './cache.ts';
import { isNormalizedSoldRecordPool, serializeNormalizedSoldRecordPool } from './soldSchema.ts';
import type { NormalizedSoldRecordPool, SoldSearchPolicy } from './soldTypes.ts';

export const SOLD_POOL_CACHE_DATA_TYPE = 'property_sold_record_pool' as const;
export const SOLD_POOL_CACHE_SCHEMA_VERSION = 1;
export const DEFAULT_SOLD_POOL_CACHE_TTL_HOURS = 720;

export type SoldPoolCacheEntry = {
  propertyId: string;
  addressFingerprint: string | null;
  queryFingerprint: string;
  pool: NormalizedSoldRecordPool;
  retrievedAt: string;
  expiresAt: string;
};

export interface SoldRecordPoolCache {
  getSoldPool(propertyId: string, addressFingerprint: string, queryFingerprint: string): Promise<SoldPoolCacheEntry | null>;
  setSoldPool(propertyId: string, addressFingerprint: string, pool: NormalizedSoldRecordPool): Promise<SoldPoolCacheEntry>;
}

export function normalizeSoldPoolCacheTtlHours(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_SOLD_POOL_CACHE_TTL_HOURS;
  return Math.min(2_160, Math.trunc(parsed));
}

export async function soldSearchQueryFingerprint(addressFingerprint: string, policy: SoldSearchPolicy) {
  const canonical = JSON.stringify({ addressFingerprint, radiusMiles: policy.radiusMiles,
    saleDateRangeDays: policy.saleDateRangeDays, propertyType: policy.propertyType, limit: policy.limit });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
}

export class InMemorySoldRecordPoolCache implements SoldRecordPoolCache {
  private entries = new Map<string, SoldPoolCacheEntry & { raw?: unknown }>();
  constructor(private readonly options: { now?: () => Date; ttlHours?: unknown } = {}) {}
  async getSoldPool(propertyId: string, addressFingerprint: string, queryFingerprint: string) {
    const entry = this.entries.get(validatePropertyId(propertyId));
    const now = (this.options.now || (() => new Date()))().getTime();
    const candidate = entry?.raw === undefined ? entry?.pool : entry.raw;
    if (!entry || Date.parse(entry.expiresAt) <= now || entry.addressFingerprint !== addressFingerprint
      || entry.queryFingerprint !== queryFingerprint || !isNormalizedSoldRecordPool(candidate)) return null;
    return structuredClone({ ...entry, pool: candidate, raw: undefined }) as SoldPoolCacheEntry;
  }
  async setSoldPool(propertyId: string, addressFingerprint: string, pool: NormalizedSoldRecordPool) {
    const id = validatePropertyId(propertyId);
    const normalized = serializeNormalizedSoldRecordPool(pool);
    if (!/^[0-9a-f]{64}$/i.test(addressFingerprint)) throw new Error('INVALID_ADDRESS_FINGERPRINT');
    const expiresAt = new Date(Date.parse(normalized.retrievedAt)
      + normalizeSoldPoolCacheTtlHours(this.options.ttlHours) * 3_600_000).toISOString();
    const entry: SoldPoolCacheEntry = { propertyId: id, addressFingerprint, queryFingerprint: normalized.queryFingerprint,
      pool: normalized, retrievedAt: normalized.retrievedAt, expiresAt };
    this.entries.set(id, structuredClone(entry));
    return structuredClone(entry);
  }
  seedRaw(propertyId: string, raw: unknown, addressFingerprint: string, queryFingerprint: string, expiresAt: string) {
    this.entries.set(validatePropertyId(propertyId), { propertyId, addressFingerprint, queryFingerprint,
      pool: raw as NormalizedSoldRecordPool, raw, retrievedAt: new Date().toISOString(), expiresAt });
  }
}

export class SupabaseSoldRecordPoolCache implements SoldRecordPoolCache {
  private readonly ttlHours: number;
  constructor(private readonly client: PropertyIntelligenceRpcClient, ttlHours: unknown) {
    this.ttlHours = normalizeSoldPoolCacheTtlHours(ttlHours);
  }
  async getSoldPool(propertyId: string, addressFingerprint: string, queryFingerprint: string) {
    const id = validatePropertyId(propertyId);
    const { data, error } = await this.client.rpc('ds_get_property_intelligence_cache', {
      p_property_id: id, p_provider: 'rentcast', p_data_type: SOLD_POOL_CACHE_DATA_TYPE,
      p_schema_version: SOLD_POOL_CACHE_SCHEMA_VERSION,
    });
    if (error) throw new Error('SOLD_POOL_CACHE_READ_FAILED');
    const row = Array.isArray(data) ? data[0] : null;
    if (!row || typeof row !== 'object') return null;
    const value = row as Record<string, unknown>;
    if (value.address_fingerprint !== addressFingerprint || !isNormalizedSoldRecordPool(value.payload)
      || value.payload.queryFingerprint !== queryFingerprint) return null;
    const expiresAt = String(value.expires_at || '');
    if (Date.parse(expiresAt) <= Date.now()) return null;
    return { propertyId: id, addressFingerprint, queryFingerprint, pool: value.payload,
      retrievedAt: String(value.retrieved_at || ''), expiresAt };
  }
  async setSoldPool(propertyId: string, addressFingerprint: string, pool: NormalizedSoldRecordPool) {
    const id = validatePropertyId(propertyId);
    const normalized = serializeNormalizedSoldRecordPool(pool);
    const expiresAt = new Date(Date.parse(normalized.retrievedAt) + this.ttlHours * 3_600_000).toISOString();
    const { error } = await this.client.rpc('ds_upsert_property_intelligence_cache', {
      p_address_fingerprint: addressFingerprint, p_property_id: id, p_provider: 'rentcast', p_provider_property_id: null,
      p_data_type: SOLD_POOL_CACHE_DATA_TYPE, p_schema_version: SOLD_POOL_CACHE_SCHEMA_VERSION,
      p_payload: normalized, p_retrieved_at: normalized.retrievedAt, p_expires_at: expiresAt,
    });
    if (error) throw new Error('SOLD_POOL_CACHE_WRITE_FAILED');
    return { propertyId: id, addressFingerprint, queryFingerprint: normalized.queryFingerprint,
      pool: normalized, retrievedAt: normalized.retrievedAt, expiresAt };
  }
}
