import { describe, expect, it } from 'vitest';
import { clearMapSession, openMapSession } from './mapSession';

function memoryStorage() {
  const data = new Map();
  return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) };
}
const key = 'ds_mapview_ui_state_v1';
const master = { initialZoom: 3, defaultStyle: 'satellite_streets' };

describe('map sidebar session lifecycle', () => {
  it('retains temporary filters and camera on reopening in the same login', () => {
    const storage = memoryStorage();
    const session = openMapSession('a', master, storage);
    const override = { mapStyle: 'topo', showPeople: false, viewport: { zoom: 10 } };
    session.write(key, override);
    expect(openMapSession('a', master, storage).read(key)).toEqual(override);
    expect(master).toEqual({ initialZoom: 3, defaultStyle: 'satellite_streets' });
  });
  it('discards legacy unowned filters and camera', () => {
    const storage = memoryStorage();
    storage.setItem(key, '{"mapStyle":"topo"}');
    storage.setItem('mapViewport', '{"zoom":15}');
    const session = openMapSession('a', master, storage);
    expect(session.read(key)).toBeNull();
    expect(session.read('mapViewport')).toBeNull();
  });
  it('logout clears all camera sources and rejects late unmount writes', () => {
    const storage = memoryStorage();
    const old = openMapSession('a', master, storage);
    for (const k of [key, 'mapViewport', 'ds_map_return_viewport']) old.write(k, { zoom: 15 });
    clearMapSession(storage);
    old.write(key, { mapStyle: 'topo' });
    const next = openMapSession('a', master, storage);
    old.write(key, { mapStyle: 'simple' });
    for (const k of [key, 'mapViewport', 'ds_map_return_viewport']) expect(next.read(k)).toBeNull();
  });
  it('isolates another account and rejects previous account writes', () => {
    const storage = memoryStorage();
    const a = openMapSession('a', master, storage);
    a.write(key, { locationQuery: 'Miami' });
    const b = openMapSession('b', master, storage);
    a.write(key, { locationQuery: 'Boston' });
    expect(b.read(key)).toBeNull();
  });
  it('starts with new master defaults after changing Settings', () => {
    const storage = memoryStorage();
    openMapSession('a', master, storage).write(key, { mapStyle: 'topo' });
    expect(openMapSession('a', { ...master, initialZoom: 7 }, storage).read(key)).toBeNull();
  });
  it('works without browser storage', () => {
    const session = openMapSession('a', master, null);
    session.write(key, {});
    expect(session.read(key)).toBeNull();
    clearMapSession(null);
  });
});
