import { trackAppEvent } from '../../lib/adminEventTracking';

const actions = new Set(['enabled', 'disabled', 'viewport', 'click', 'no_coverage', 'unavailable', 'cache_hit', 'cache_miss']);
export function trackParcelEvent(action, metadata = {}, transport = trackAppEvent) {
  if (!actions.has(action)) return Promise.resolve(false);
  const safe = {};
  for (const key of ['zoom', 'parcelCount', 'sourceCount']) {
    const value = metadata[key];
    if (typeof value === 'number' && Number.isFinite(value)) safe[key] = Math.max(0, Math.min(1000, value));
  }
  if (typeof metadata.stale === 'boolean') safe.stale = metadata.stale;
  try { return Promise.resolve(transport(`public_parcel_${action}`, { entityType: 'map_layer', metadata: safe })).catch(() => false); }
  catch { return Promise.resolve(false); }
}
