export function waitForParcelRequest<T>(pending: Promise<T>, signal?: AbortSignal): Promise<T> {
  if(!signal) return pending;
  if(signal.aborted) return Promise.reject(new DOMException('Request cancelled','AbortError'));
  return new Promise((resolve,reject)=>{
    const abort=()=>{signal.removeEventListener('abort',abort);reject(new DOMException('Request cancelled','AbortError'));};
    signal.addEventListener('abort',abort,{once:true});
    pending.then(value=>{signal.removeEventListener('abort',abort);resolve(value);},error=>{signal.removeEventListener('abort',abort);reject(error);});
  });
}

export class ParcelRequestCache<T> {
  private rows = new Map<string, { value: T; expiresAt: number; staleUntil: number; bytes: number }>();
  private pending = new Map<string, Promise<T>>();
  readonly health = new Map<string, { lastSuccessfulQuery: string | null; lastFailure: string | null; consecutiveFailures: number; nextAllowedAt: number; status: 'HEALTHY' | 'BACKOFF' | 'CIRCUIT_OPEN' }>();
  constructor(private now = () => Date.now(), readonly ttlMs = 24 * 3600_000, readonly staleMs = 7 * 86400_000, private maxEntries = 128) {}
  get(key: string) {
    const row = this.rows.get(key); if (!row) return null;
    if (row.staleUntil <= this.now()) { this.rows.delete(key); return null; }
    this.rows.delete(key); this.rows.set(key, row);
    return { ...row, fresh: row.expiresAt > this.now() };
  }
  put(key: string, value: T) {
    const bytes = JSON.stringify(value).length * 2;
    if (bytes > 8_000_000) return;
    const stamp = this.now(); this.rows.delete(key); this.rows.set(key, { value, bytes, expiresAt: stamp + this.ttlMs, staleUntil: stamp + this.ttlMs + this.staleMs });
    while (this.rows.size > this.maxEntries || [...this.rows.values()].reduce((sum, row) => sum + row.bytes, 0) > 16_000_000) this.rows.delete(this.rows.keys().next().value!);
  }
  async run(key: string, sourceId: string, work: () => Promise<T>) {
    const existing = this.pending.get(key); if (existing) return existing;
    const health = this.health.get(sourceId) || { lastSuccessfulQuery: null, lastFailure: null, consecutiveFailures: 0, nextAllowedAt: 0, status: 'HEALTHY' as const };
    if (health.nextAllowedAt > this.now() && health.status !== 'HEALTHY') throw new Error(health.status === 'CIRCUIT_OPEN' ? 'SOURCE_CIRCUIT_OPEN' : 'SOURCE_COURTESY_BACKOFF');
    const scheduledAt = Math.max(this.now(), health.nextAllowedAt);
    const waitMs = scheduledAt - this.now();
    // Healthy courtesy is a bounded scheduling interval, NOT a source outage.
    // Reserve slots synchronously so different viewport keys cannot all wake up
    // together and hammer an authority. Backoff/circuit-open still fail closed.
    if (waitMs > 3000) throw new Error('SOURCE_COURTESY_BACKOFF');
    this.health.set(sourceId, { ...health, nextAllowedAt: scheduledAt + 1500 });
    const request = (async () => {
      let attempted = false;
      try {
        if (waitMs) await new Promise(resolve => setTimeout(resolve, waitMs));
        const current = this.health.get(sourceId)!;
        if (waitMs && current.status !== 'HEALTHY' && current.nextAllowedAt > this.now()) throw new Error(current.status === 'CIRCUIT_OPEN' ? 'SOURCE_CIRCUIT_OPEN' : 'SOURCE_COURTESY_BACKOFF');
        attempted = true;
        const value = await work(); this.put(key, value);
        this.health.set(sourceId, { lastSuccessfulQuery: new Date(this.now()).toISOString(), lastFailure: this.health.get(sourceId)?.lastFailure || null, consecutiveFailures: 0,
          nextAllowedAt: Math.max(this.health.get(sourceId)?.nextAllowedAt || 0, this.now() + 1500), status: 'HEALTHY' });
        return value;
      } catch (error) {
        if (!attempted) throw error; // Waiting on another query is not a government failure.
        if ((error as Error)?.name === 'AbortError') {
          const current = this.health.get(sourceId) || health;
          this.health.set(sourceId, { ...current, nextAllowedAt: Math.max(current.nextAllowedAt, this.now() + 1500) });
          throw error;
        }
        const failures = (this.health.get(sourceId)?.consecutiveFailures ?? health.consecutiveFailures) + 1;
        this.health.set(sourceId, { ...health, lastFailure: new Date(this.now()).toISOString(), consecutiveFailures: failures,
          nextAllowedAt: this.now() + Math.min(300_000, 5000 * 2 ** Math.min(failures, 6)), status: failures >= 3 ? 'CIRCUIT_OPEN' : 'BACKOFF' });
        throw error;
      } finally { this.pending.delete(key); }
    })();
    this.pending.set(key, request); return request;
  }
}
