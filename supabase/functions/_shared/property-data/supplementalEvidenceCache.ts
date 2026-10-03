import { validatePropertyId, type PropertyIntelligenceRpcClient } from './cache.ts';
import type { SupplementalEvidence, SupplementalEvidenceFamily } from './supplementalEvidenceTypes.ts';

export const SUPPLEMENTAL_CACHE_SCHEMA_VERSION = 1;
export const SUPPLEMENTAL_CACHE_DATA_TYPES: Record<SupplementalEvidenceFamily, string> = Object.freeze({
  saleListings: 'sale_listing_evidence', rentEstimate: 'rent_estimate_evidence',
  rentalListings: 'rental_listing_evidence', market: 'market_evidence',
});
export const SUPPLEMENTAL_CACHE_TTL_HOURS: Record<SupplementalEvidenceFamily, number> = Object.freeze({
  saleListings: 24, rentEstimate: 72, rentalListings: 24, market: 168,
});

export type SupplementalCacheEntry = {
  propertyId: string;
  family: SupplementalEvidenceFamily;
  addressFingerprint: string;
  queryFingerprint: string;
  evidence: SupplementalEvidence;
  retrievedAt: string;
  expiresAt: string;
};

export interface SupplementalEvidenceCache {
  get(propertyId: string, family: SupplementalEvidenceFamily, addressFingerprint: string, queryFingerprint: string): Promise<SupplementalCacheEntry | null>;
  set(propertyId: string, family: SupplementalEvidenceFamily, addressFingerprint: string, evidence: SupplementalEvidence): Promise<SupplementalCacheEntry>;
}

export async function supplementalQueryFingerprint(addressFingerprint: string, family: SupplementalEvidenceFamily, filters: Record<string, unknown>) {
  const canonical = JSON.stringify({ addressFingerprint, family, filters: Object.keys(filters).sort().reduce((out, key) => {
    out[key] = filters[key]; return out;
  }, {} as Record<string, unknown>) });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
}

function validEvidence(value: unknown, family: SupplementalEvidenceFamily): value is SupplementalEvidence {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const evidence = value as Record<string, unknown>;
  const expected = { saleListings: 'sale_listings', rentEstimate: 'rent_estimate', rentalListings: 'rental_listings', market: 'market_data' }[family];
  return evidence.provider === 'rentcast' && evidence.evidenceType === expected && evidence.schemaVersion === 1
    && typeof evidence.queryFingerprint === 'string' && Number.isFinite(Date.parse(String(evidence.retrievedAt || '')));
}

export class InMemorySupplementalEvidenceCache implements SupplementalEvidenceCache {
  private readonly entries = new Map<string, SupplementalCacheEntry>();
  constructor(private readonly now: () => Date = () => new Date()) {}
  private key(propertyId: string, family: SupplementalEvidenceFamily) { return `${validatePropertyId(propertyId)}:${family}`; }
  async get(propertyId: string, family: SupplementalEvidenceFamily, addressFingerprint: string, queryFingerprint: string) {
    const entry = this.entries.get(this.key(propertyId, family));
    if (!entry || entry.addressFingerprint !== addressFingerprint || entry.queryFingerprint !== queryFingerprint
      || Date.parse(entry.expiresAt) <= this.now().getTime() || !validEvidence(entry.evidence, family)) return null;
    return structuredClone(entry);
  }
  async set(propertyId: string, family: SupplementalEvidenceFamily, addressFingerprint: string, evidence: SupplementalEvidence) {
    if (!validEvidence(evidence, family)) throw new Error('INVALID_SUPPLEMENTAL_EVIDENCE');
    const entry: SupplementalCacheEntry = { propertyId: validatePropertyId(propertyId), family, addressFingerprint,
      queryFingerprint: evidence.queryFingerprint, evidence: structuredClone(evidence), retrievedAt: evidence.retrievedAt,
      expiresAt: new Date(Date.parse(evidence.retrievedAt) + SUPPLEMENTAL_CACHE_TTL_HOURS[family] * 3_600_000).toISOString() };
    this.entries.set(this.key(propertyId, family), entry);
    return structuredClone(entry);
  }
}

export class SupabaseSupplementalEvidenceCache implements SupplementalEvidenceCache {
  constructor(private readonly client: PropertyIntelligenceRpcClient) {}
  async get(propertyId: string, family: SupplementalEvidenceFamily, addressFingerprint: string, queryFingerprint: string) {
    const id = validatePropertyId(propertyId);
    const { data, error } = await this.client.rpc('ds_get_property_intelligence_cache', {
      p_property_id: id, p_provider: 'rentcast', p_data_type: SUPPLEMENTAL_CACHE_DATA_TYPES[family],
      p_schema_version: SUPPLEMENTAL_CACHE_SCHEMA_VERSION,
    });
    if (error) throw new Error('SUPPLEMENTAL_CACHE_READ_FAILED');
    const row = Array.isArray(data) ? data[0] as Record<string, unknown> | undefined : undefined;
    if (!row || row.address_fingerprint !== addressFingerprint || Date.parse(String(row.expires_at || '')) <= Date.now()
      || !validEvidence(row.payload, family)) return null;
    const evidence = row.payload as SupplementalEvidence;
    if (evidence.queryFingerprint !== queryFingerprint) return null;
    return { propertyId: id, family, addressFingerprint, queryFingerprint, evidence,
      retrievedAt: String(row.retrieved_at), expiresAt: String(row.expires_at) };
  }
  async set(propertyId: string, family: SupplementalEvidenceFamily, addressFingerprint: string, evidence: SupplementalEvidence) {
    const id = validatePropertyId(propertyId);
    if (!validEvidence(evidence, family)) throw new Error('INVALID_SUPPLEMENTAL_EVIDENCE');
    const expiresAt = new Date(Date.parse(evidence.retrievedAt) + SUPPLEMENTAL_CACHE_TTL_HOURS[family] * 3_600_000).toISOString();
    const { error } = await this.client.rpc('ds_upsert_property_intelligence_cache', {
      p_address_fingerprint: addressFingerprint, p_property_id: id, p_provider: 'rentcast', p_provider_property_id: null,
      p_data_type: SUPPLEMENTAL_CACHE_DATA_TYPES[family], p_schema_version: SUPPLEMENTAL_CACHE_SCHEMA_VERSION,
      p_payload: evidence, p_retrieved_at: evidence.retrievedAt, p_expires_at: expiresAt,
    });
    if (error) throw new Error('SUPPLEMENTAL_CACHE_WRITE_FAILED');
    return { propertyId: id, family, addressFingerprint, queryFingerprint: evidence.queryFingerprint,
      evidence, retrievedAt: evidence.retrievedAt, expiresAt };
  }
}
