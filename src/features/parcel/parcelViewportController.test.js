import { describe, it, expect, vi, afterEach } from 'vitest';
import { ParcelViewportController } from './parcelViewportController';
import { parcelLabels, parcelPanelRows } from './parcelPresentation';

const viewport = { zoom: 17, bounds: [-122, 47, -121.99, 47.01] };
afterEach(() => vi.useRealTimers());
describe('isolated MapView parcel behavior', () => {
  it('OFF makes zero requests, even with a close viewport', async () => {
    vi.useFakeTimers(); const request = vi.fn(); const publish = vi.fn(); const controller = new ParcelViewportController(request, publish);
    controller.update({ enabled: false, viewport }); await vi.runAllTimersAsync(); expect(request).not.toHaveBeenCalled(); expect(publish).toHaveBeenLastCalledWith({ status: 'DISABLED', parcels: [] });
  });
  it('low zoom and inactive map make zero requests', async () => {
    vi.useFakeTimers(); const request = vi.fn(); const publish = vi.fn(); const controller = new ParcelViewportController(request, publish);
    controller.update({ enabled: true, viewport: { ...viewport, zoom: 12 } }); controller.update({ enabled: true, active: false, viewport });
    await vi.runAllTimersAsync(); expect(request).not.toHaveBeenCalled();
  });
  it('debounces pan and ignores/aborts old responses', async () => {
    vi.useFakeTimers(); let firstResolve; const request = vi.fn().mockImplementationOnce(() => new Promise(resolve => { firstResolve = resolve; })).mockResolvedValue({ status: 'PARCEL_NOT_FOUND', parcels: [] });
    const publish = vi.fn(); const controller = new ParcelViewportController(request, publish);
    controller.update({ enabled: true, viewport }); await vi.advanceTimersByTimeAsync(500);
    const signal = request.mock.calls[0][1].signal;
    controller.update({ enabled: true, viewport: { ...viewport, bounds: [-122, 47, -121.98, 47.01] } });
    expect(signal.aborted).toBe(true); firstResolve({ status: 'COVERAGE_AVAILABLE', parcels: [{ apn: 'old' }] });
    await vi.runAllTimersAsync(); expect(publish).toHaveBeenLastCalledWith({ status: 'PARCEL_NOT_FOUND', parcels: [] });
    expect(publish.mock.calls.some(([data]) => data.parcels?.[0]?.apn === 'old')).toBe(false);
  });
  it('uses bounded short-lived viewport cache without storing facts into the property', async () => {
    vi.useFakeTimers(); const value = { status: 'COVERAGE_AVAILABLE', parcels: [{ apn: 'new' }], freshness: 'FRESH' };
    const request = vi.fn(async () => value); const publish = vi.fn(); const controller = new ParcelViewportController(request, publish);
    controller.update({ enabled: true, viewport }); await vi.runAllTimersAsync(); controller.update({ enabled: true, viewport }); expect(request).toHaveBeenCalledOnce(); controller.dispose(); expect(controller.cache.size).toBe(0);
  });
  it('handles network outage without breaking the map controller', async () => {
    vi.useFakeTimers(); const publish = vi.fn(); const controller = new ParcelViewportController(vi.fn(async () => { throw new Error('outage'); }), publish);
    controller.update({ enabled: true, viewport }); await vi.runAllTimersAsync(); expect(publish).toHaveBeenLastCalledWith({ status: 'SOURCE_TEMPORARILY_UNAVAILABLE', parcels: [] });
  });
  it.each(['pt', 'en', 'es'])('localizes UI and only displays available fields: %s', language => {
    expect(Object.values(parcelLabels(language)).every(value => typeof value === 'string' && value.length)).toBe(true);
    const rows = parcelPanelRows({ apn: '001', acres: null, propertyTax: null, assessedValue: null, ownerName: null }, language);
    expect(rows).toEqual([['APN', '001']]);
  });
});
