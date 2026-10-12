import { validPoint } from '../../../supabase/functions/_shared/public-parcel/geometry.ts';
import { PARCEL_MIN_ZOOM, PARCEL_MAX_RESULTS } from '../../../supabase/functions/_shared/public-parcel/types.ts';
import { parcelLensBounds, parcelLensParcels, resolvePrincipalParcel } from './parcelLensGeometry';

// A contextual session, separate from the QA viewport controller. It deliberately
// has NO pan/zoom input: loaded evidence survives zoom-out without further calls.
export class ParcelLensController {
  constructor(request, publish) {
    this.request = request; this.publish = publish; this.cache = new Map(); this.generation = 0;
    this.state = { context: null, parcel: null, result: null, lens: null, page: 'property' };
  }
  emit(value) { this.state = { ...this.state, ...value }; this.publish(this.state); }
  cancel() { this.generation++; this.abort?.abort(); this.loadingKey = null; }
  clear() { this.cancel(); this.emit({ context: null, parcel: null, result: null, lens: null, page: 'property' }); }
  select(itemId) { if (this.state.context && this.state.context.itemId !== String(itemId)) this.clear(); }
  async lookup(context, eligible) {
    if (eligible !== true || !validPoint(context?.point) || !context?.itemId) { this.clear(); return; }
    const key = JSON.stringify([String(context.itemId), context.point.lng, context.point.lat]);
    if (this.state.context?.key === key && (this.state.lens || this.loadingKey === key || this.cache.get(key)?.expiresAt > Date.now())) return;
    this.cancel(); const generation = this.generation;
    const target = { ...context, itemId: String(context.itemId), key };
    this.emit({ context: target, parcel: null, result: null, lens: null, page: 'property' });
    const cached = this.cache.get(key);
    if (cached?.expiresAt > Date.now()) {
      this.emit({ parcel: cached.parcel, result: cached.result }); return;
    }
    const abort = new AbortController(); this.abort = abort;
    this.loadingKey = key;
    try {
      const result = await this.request({ operation: 'query-point', point: context.point }, { signal: abort.signal });
      if (generation !== this.generation || abort.signal.aborted) return;
      this.loadingKey = null;
      const parcel = resolvePrincipalParcel(result, context.point);
      this.cache.set(key, { parcel, result, expiresAt: Math.min(Date.parse(result.expiresAt) || Date.now() + 300000, Date.now() + 300000) });
      while (this.cache.size > 8) this.cache.delete(this.cache.keys().next().value);
      this.emit({ parcel, result });
    } catch {
      if (generation === this.generation && !abort.signal.aborted) { this.loadingKey = null; this.emit({ parcel: null, result: { status: 'SOURCE_TEMPORARILY_UNAVAILABLE', parcels: [] } }); }
    }
  }
  async activate() {
    const { parcel, context, result, lens } = this.state;
    if (!parcel || !context) return;
    if (lens) { this.emit({ page: 'parcel' }); return; }
    const cached = this.cache.get(context.key);
    this.emit({ page: 'parcel', lens: { context, principal: parcel, parcels: cached?.neighbors ? parcelLensParcels(parcel, cached.neighbors.parcels, context.point) : [parcel],
      result, neighborResult: cached?.neighbors || null, loading: !cached?.neighbors, limited: cached?.neighbors?.exceededLimit === true } });
    if (cached?.neighbors) return;
    const generation = this.generation;
    const abort = new AbortController(); this.abort = abort;
    try {
      const neighbors = await this.request({ operation: 'query-bounds', bounds: parcelLensBounds(context.point), zoom: PARCEL_MIN_ZOOM }, { signal: abort.signal });
      if (generation !== this.generation || abort.signal.aborted || !this.state.lens) return;
      if (cached) cached.neighbors = neighbors;
      this.emit({ lens: { ...this.state.lens, parcels: parcelLensParcels(parcel, (neighbors.parcels || []).slice(0, PARCEL_MAX_RESULTS - 1), context.point),
        neighborResult: neighbors, loading: false, limited: neighbors.exceededLimit === true } });
    } catch {
      if (generation === this.generation && !abort.signal.aborted && this.state.lens) this.emit({ lens: { ...this.state.lens, loading: false,
        neighborResult: { status: 'SOURCE_TEMPORARILY_UNAVAILABLE', parcels: [] } } });
    }
  }
  setPage(page) { this.emit({ page: page === 'parcel' && this.state.parcel ? 'parcel' : 'property' }); }
  closeLens() { this.cancel(); this.emit({ lens: null, page: 'property' }); }
  dispose() { this.cancel(); this.cache.clear(); }
}
