import { PARCEL_MIN_ZOOM } from '../../../supabase/functions/_shared/public-parcel/types.ts';

// Local to the layer: no app-wide state, persistence, or analytical data writes.
export class ParcelViewportController {
  constructor(request, publish, { delay = 450, timers = globalThis } = {}) {
    this.request = request; this.publish = publish; this.delay = delay; this.timers = timers;
    this.generation = 0; this.cache = new Map(); this.lastRequestedAt = 0;
    this.visibleParcels = [];
  }
  update({ enabled, active = true, viewport }) {
    this.cancel(); const generation = this.generation;
    if (!enabled || !active) { this.visibleParcels = []; this.publish({ status: 'DISABLED', parcels: [] }); return; }
    if (viewport?.zoom < PARCEL_MIN_ZOOM || !Array.isArray(viewport?.bounds)) { this.visibleParcels = []; this.publish({ status: 'PARCEL_NOT_FOUND', reason: 'ZOOM_REQUIRED', parcels: [] }); return; }
    const query = { operation: 'query-bounds', bounds: viewport.bounds, zoom: viewport.zoom };
    const key = JSON.stringify(query); const cached = this.cache.get(key);
    if (cached?.expiresAt > Date.now()) { this.visibleParcels = cached.data.parcels || []; this.publish(cached.data); return; }
    const signal = new AbortController(); this.abort = signal;
    // Leaflet may pan to fit an opened popup. Do not destroy its GeoJSON owner
    // while the resulting viewport query is pending; new/failed results replace it.
    this.publish({ status: 'LOADING', parcels: this.visibleParcels });
    this.timer = this.timers.setTimeout(async () => {
      this.lastRequestedAt = Date.now();
      try {
        const data = await this.request(query, { signal: signal.signal });
        if (this.generation !== generation || signal.signal.aborted) return;
        if (data.status === 'COVERAGE_AVAILABLE' && data.freshness !== 'STALE_USABLE') {
          this.cache.set(key, { data, expiresAt: Math.min(Date.parse(data.expiresAt) || Date.now() + 300000, Date.now() + 300000) });
          while (this.cache.size > 8) this.cache.delete(this.cache.keys().next().value);
        }
        this.visibleParcels = data.exceededLimit ? [] : data.parcels || [];
        this.publish(data);
      } catch {
        if (this.generation === generation && !signal.signal.aborted) { this.visibleParcels = []; this.publish({ status: 'SOURCE_TEMPORARILY_UNAVAILABLE', parcels: [] }); }
      }
    }, Math.max(this.delay, 2000 - (Date.now() - this.lastRequestedAt)));
  }
  cancel() { this.generation++; if (this.timer) this.timers.clearTimeout(this.timer); this.abort?.abort(); }
  dispose() { this.cancel(); this.cache.clear(); this.visibleParcels = []; }
}
