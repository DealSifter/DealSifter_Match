import type { PropertyIntelligenceRpcClient } from './cache.ts';
// Fixed application namespace. Composite identities must never be sent verbatim
// to the UUID-only database lease RPC. Existing property UUIDs stay unchanged.
const LEASE_NAMESPACE = '9da94710-5dd8-5ab7-8655-20ea84627d74';
export async function propertyEvidenceLeaseKey(identity: string): Promise<string> {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identity)) return identity.toLowerCase();
  if (!identity.trim()) throw new Error('PROPERTY_EVIDENCE_LEASE_IDENTITY_REQUIRED');
  const namespace = Uint8Array.from(LEASE_NAMESPACE.replace(/-/g, '').match(/../g)!, byte => parseInt(byte, 16));
  const name = new TextEncoder().encode(identity);
  const input = new Uint8Array(namespace.length + name.length);
  input.set(namespace); input.set(name, namespace.length);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-1', input)).slice(0, 16);
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = Array.from(hash, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export interface PropertySingleFlight { run<T>(key: string, work: () => Promise<T>): Promise<T>; }
export class InMemoryPropertySingleFlight implements PropertySingleFlight {
  private pending = new Map<string, Promise<unknown>>();
  async run<T>(key: string, work: () => Promise<T>): Promise<T> {
    const existing = this.pending.get(key);
    if (existing) return existing as Promise<T>;
    const task = Promise.resolve().then(work);
    this.pending.set(key, task);
    try { return await task; }
    finally { if (this.pending.get(key) === task) this.pending.delete(key); }
  }
}
// Database lease coordinates independent Edge isolates. A settled attempt must not
// strand its lease; the database also expires leases from interrupted isolates.
export class SupabasePropertySingleFlight implements PropertySingleFlight {
  constructor(private client: PropertyIntelligenceRpcClient) {}
  async run<T>(key: string, work: () => Promise<T>): Promise<T> {
    const leaseKey = await propertyEvidenceLeaseKey(key);
    const token = crypto.randomUUID();
    const deadline = Date.now() + 40_000;
    while (Date.now() < deadline) {
      const { data, error } = await this.client.rpc('ds_acquire_property_evidence_lease', { p_key: leaseKey, p_token: token });
      if (error) throw new Error('PROPERTY_EVIDENCE_LEASE_UNAVAILABLE');
      if (data === true) {
        try {
          return await work();
        } finally {
          const released = await this.client.rpc('ds_release_property_evidence_lease', { p_key: leaseKey, p_token: token });
          if (released.error) throw new Error('PROPERTY_EVIDENCE_LEASE_RELEASE_FAILED');
        }
      }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error('PROPERTY_EVIDENCE_BUSY');
  }
}
