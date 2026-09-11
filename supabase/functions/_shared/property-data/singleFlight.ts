import type { PropertyIntelligenceRpcClient } from './cache.ts';
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
// Database lease coordinates independent Edge isolates; failures retain the lease.
export class SupabasePropertySingleFlight implements PropertySingleFlight {
  constructor(private client: PropertyIntelligenceRpcClient) {}
  async run<T>(key: string, work: () => Promise<T>): Promise<T> {
    const token = crypto.randomUUID();
    const deadline = Date.now() + 40_000;
    while (Date.now() < deadline) {
      const { data, error } = await this.client.rpc('ds_acquire_property_evidence_lease', { p_key: key, p_token: token });
      if (error) throw new Error('PROPERTY_EVIDENCE_LEASE_UNAVAILABLE');
      if (data === true) {
        const result = await work();
        const released = await this.client.rpc('ds_release_property_evidence_lease', { p_key: key, p_token: token });
        if (released.error) throw new Error('PROPERTY_EVIDENCE_LEASE_RELEASE_FAILED');
        return result;
      }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error('PROPERTY_EVIDENCE_BUSY');
  }
}
