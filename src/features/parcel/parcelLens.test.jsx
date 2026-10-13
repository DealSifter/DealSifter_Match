import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ParcelLensController } from './parcelLensController';
import { propertyParcelContext } from './parcelLensAccess';
import { parcelGeometryBounds, parcelLensBounds, parcelIntersectsLens, parcelLensParcels, resolvePrincipalParcel, PARCEL_LENS_RADIUS_METERS, PARCEL_LENS_COLOR } from './parcelLensGeometry';
import { parcelLabels, parcelPanelRows } from './parcelPresentation';
import { PropertyPinPopup } from '../../components/map/PropertyPinPopup';
import { resolveFeatureFlags } from '../../../supabase/functions/_shared/featureFlags';

const point = { lat: 42, lng: -71 };
const geometry = (x = 0, y = 0, size = .0001) => ({ type: 'Polygon', coordinates: [[[-71 + x, 42 + y], [-71 + x + size, 42 + y], [-71 + x + size, 42 + y + size], [-71 + x, 42 + y + size], [-71 + x, 42 + y]]] });
const parcel = { source: 'approved-public-source', apn: 'MAIN', parcelId: 'MAIN', geometry: geometry(-.00005, -.00005), sourceAuthority: 'Public authority', retrievedAt: '2026-10-12T10:00:00Z', propertyTax: null };
const result = { status: 'COVERAGE_AVAILABLE', parcels: [parcel], freshness: 'FRESH' };
const context = { itemId: 'property-1', point };
afterEach(() => vi.useRealTimers());

describe('contextual parcel lens geometry', () => {
  it('uses a 0.20-mile diameter (0.10-mile radius), solid turquoise color and normalized bounds', () => {
    expect(PARCEL_LENS_RADIUS_METERS).toBe(160.9344); expect(PARCEL_LENS_COLOR).toBe('#00cbd4');
    const bounds = parcelLensBounds(point); expect(bounds[0]).toBeLessThan(point.lng); expect(bounds[2]).toBeGreaterThan(point.lng);
    expect(parcelGeometryBounds(parcel.geometry)).toEqual([-71.00005, 41.99995, -70.99995, 42.00005]);
  });
  it('supports multipolygon bounds and rejects invalid coordinates/geometries', () => {
    parcelGeometryBounds({ type: 'MultiPolygon', coordinates: [geometry().coordinates, geometry(.01).coordinates] }).forEach((value, index) => expect(value).toBeCloseTo([-71, 42, -70.9899, 42.0001][index], 8));
    expect(parcelGeometryBounds(null)).toBeNull(); expect(parcelLensBounds({ lat: null, lng: 0 })).toBeNull(); expect(parcelLensBounds(point, -1)).toBeNull();
  });
  it('includes intersecting nearby lots, not remote lots', () => {
    expect(parcelIntersectsLens(geometry(.001), point)).toBe(true); expect(parcelIntersectsLens(geometry(.1), point)).toBe(false);
  });
  it('includes parcels crossing the lens even when no vertex is within its radius', () => {
    const crossing = { type: 'Polygon', coordinates: [[[-71.01, 42.001], [-70.99, 42.001], [-70.99, 42.0011], [-71.01, 42.0011], [-71.01, 42.001]]] };
    expect(parcelIntersectsLens(crossing, point)).toBe(true);
  });
  it('resolves only a unique real containing parcel, never coverage registration or ambiguous stacks', () => {
    expect(resolvePrincipalParcel(result, point)).toBe(parcel);
    expect(resolvePrincipalParcel({ ...result, parcels: [parcel, { ...parcel, apn: 'OTHER' }] }, point)).toBeNull();
    expect(resolvePrincipalParcel({ ...result, parcels: [{ ...parcel, geometry: null }] }, point)).toBeNull();
    expect(resolvePrincipalParcel({ ...result, parcels: [{ ...parcel, geometry: geometry(.1) }] }, point)).toBeNull();
    expect(resolvePrincipalParcel({ ...result, parcels: [] }, point)).toBeNull();
  });
  it('retains the principal, deduplicates public neighbors and never exceeds the existing 120-result cap', () => {
    const neighbors = Array.from({ length: 150 }, (_, index) => ({ ...parcel, parcelId: `NEIGHBOR-${index}` }));
    const selected = parcelLensParcels(parcel, [parcel, ...neighbors], point); expect(selected).toHaveLength(120); expect(selected[0]).toBe(parcel);
    expect(parcelLensParcels(parcel, [{ ...parcel, parcelId: 'FAR', geometry: geometry(.1) }], point)).toEqual([parcel]);
  });
});

describe('contextual parcel session', () => {
  it('issues zero requests while ineligible or with invalid point/unknown item', async () => {
    const request = vi.fn(); const controller = new ParcelLensController(request, vi.fn());
    await controller.lookup(context, false); await controller.lookup(context, 'true'); await controller.lookup({ ...context, point: null }, true);
    await controller.activate(); expect(request).not.toHaveBeenCalled(); expect(controller.state.lens).toBeNull();
  });
  it('looks up only the selected point; activation makes exactly one fixed-radius neighbor query', async () => {
    const neighbor = { ...parcel, parcelId: 'NEIGHBOR', apn: 'NEXT', geometry: geometry(.001) };
    const request = vi.fn().mockResolvedValueOnce(result).mockResolvedValueOnce({ ...result, parcels: [parcel, neighbor], exceededLimit: true });
    const controller = new ParcelLensController(request, vi.fn()); await controller.lookup(context, true); expect(controller.state.lens).toBeNull();
    await controller.activate(); expect(request.mock.calls.map(([query]) => query.operation)).toEqual(['query-point', 'query-bounds']);
    expect(request.mock.calls[1][0].bounds).toEqual(parcelLensBounds(point)); expect(controller.state.lens.parcels).toEqual([parcel, neighbor]); expect(controller.state.lens.limited).toBe(true);
  });
  it('has no viewport/zoom dependency: loaded lens survives arbitrary zoom-out and page switches with zero calls', async () => {
    const request = vi.fn(async () => result); const controller = new ParcelLensController(request, vi.fn());
    await controller.lookup(context, true); await controller.activate(); const lens = controller.state.lens;
    for (const zoom of [20, 16, 12, 4, 2]) { void zoom; controller.setPage('property'); controller.setPage('parcel'); }
    expect(controller.state.lens).toBe(lens); expect(request).toHaveBeenCalledTimes(2);
    await controller.activate(); expect(request).toHaveBeenCalledTimes(2);
  });
  it('reopens/reselects a cached contextual lens without repeated public requests', async () => {
    const request = vi.fn(async () => result); const controller = new ParcelLensController(request, vi.fn());
    await controller.lookup(context, true); await controller.activate(); controller.closeLens(); await controller.activate();
    controller.clear(); await controller.lookup(context, true); await controller.activate(); expect(request).toHaveBeenCalledTimes(2);
  });
  it('does not repeat a pending point lookup on duplicate popup events', async () => {
    let finish; const request = vi.fn(() => new Promise(resolve => { finish = resolve; })); const controller = new ParcelLensController(request, vi.fn());
    const pending = controller.lookup(context, true); const duplicate = controller.lookup(context, true); expect(request).toHaveBeenCalledOnce(); finish(result); await Promise.all([pending, duplicate]);
  });
  it('refreshes expired inactive evidence but never destroys an active frozen lens automatically', async () => {
    vi.useFakeTimers(); const request = vi.fn(async () => result); const controller = new ParcelLensController(request, vi.fn());
    await controller.lookup(context, true); await controller.activate(); await vi.advanceTimersByTimeAsync(600000);
    await controller.lookup(context, true); expect(request).toHaveBeenCalledTimes(2); expect(controller.state.lens).not.toBeNull();
    controller.closeLens(); await controller.lookup(context, true); expect(request).toHaveBeenCalledTimes(3);
  });
  it('switching PIN or explicit clear closes the lens and cancels stale requests', async () => {
    let finish; const request = vi.fn().mockResolvedValueOnce(result).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const controller = new ParcelLensController(request, vi.fn()); await controller.lookup(context, true); const pending = controller.activate();
    const signal = request.mock.calls[1][1].signal; controller.select('property-2'); expect(signal.aborted).toBe(true); expect(controller.state.lens).toBeNull();
    finish(result); await pending; expect(controller.state.lens).toBeNull(); expect(controller.state.context).toBeNull();
  });
  it('a failed neighbor query retains the loaded principal, while missing/ambiguous lookups never activate', async () => {
    const request = vi.fn().mockResolvedValueOnce(result).mockRejectedValueOnce(new Error('source down'));
    const controller = new ParcelLensController(request, vi.fn()); await controller.lookup(context, true); await controller.activate();
    expect(controller.state.lens.parcels).toEqual([parcel]); expect(controller.state.lens.neighborResult.status).toBe('SOURCE_TEMPORARILY_UNAVAILABLE');
    const ambiguous = new ParcelLensController(async () => ({ ...result, parcels: [parcel, parcel] }), vi.fn()); await ambiguous.lookup(context, true); await ambiguous.activate(); expect(ambiguous.state.lens).toBeNull();
  });
  it('keeps stale evidence labeled and never introduces financial/social/property writes', async () => {
    const stale = { ...result, freshness: 'STALE_USABLE' }; const request = vi.fn(async () => stale); const controller = new ParcelLensController(request, vi.fn());
    await controller.lookup(context, true); await controller.activate(); expect(controller.state.result.freshness).toBe('STALE_USABLE');
    expect(Object.keys(controller.state)).not.toContain('valuation'); expect(request.mock.calls.every(([query]) => !('propertyId' in query) && !('userId' in query))).toBe(true);
    controller.dispose(); expect(controller.cache.size).toBe(0);
  });
});

describe('existing popup public-data page and internal QA isolation', () => {
  it.each(['pt', 'en', 'es'])('renders magnifier for eligible properties independently of lookup outcome; preserves normal image/feed/Match behavior: %s', language => {
    const props = { property: { id: 'property-1', price: 10 }, label: 'Property', language, onMatch: () => {} };
    expect(renderToStaticMarkup(<PropertyPinPopup {...props} />)).not.toContain(parcelLabels(language).magnifier);
    expect(renderToStaticMarkup(<PropertyPinPopup {...props} parcelEligible />)).toContain(parcelLabels(language).magnifier);
    const markup = renderToStaticMarkup(<PropertyPinPopup {...props} parcelEligible parcelState={{ parcel, page: 'property' }} />);
    expect(markup).toContain(parcelLabels(language).magnifier); expect(markup).toContain('ds-property-pin-match'); expect(markup).toContain('ds-property-pin-photo');
    expect(markup).not.toContain('ds-property-pin-parcel-nav');
    const page = renderToStaticMarkup(<PropertyPinPopup {...props} parcelEligible parcelState={{ parcel, result, lens: {}, page: 'parcel' }} />);
    expect(page).toContain(parcelLabels(language).unavailable); expect(page).toContain('public-parcel-panel'); expect(page).not.toContain('ds-property-pin-photo');
    expect(page).toContain(parcelLabels(language).source); expect(page).not.toContain('MATERIAL_CONFLICT');
  });
  it.each(['pt', 'en', 'es'])('displays unknown explicitly without converting it to zero: %s', language => {
    const rows = parcelPanelRows({ propertyTax: null, assessedValue: 0 }, language, { showUnavailable: true });
    expect(rows).toContainEqual([parcelLabels(language).tax, parcelLabels(language).unavailable]);
    expect(rows.find(([label]) => label === parcelLabels(language).assessed)[1]).not.toBe(parcelLabels(language).unavailable);
  });
  it('does not enable QA grid by ordinary parcel eligibility and requires its own server allowlist', () => {
    const config = { public_parcel_intelligence: { enabled: true, environments: ['production'], percentage: 100, internalUserIds: ['internal'] } };
    expect(resolveFeatureFlags({ userId: 'internal', environment: 'production', remoteConfig: config }).public_parcel_qa_grid).toBe(false);
    config.public_parcel_qa_grid = { enabled: true, environments: ['production'], percentage: 100, internalUserIds: ['qa'] };
    expect(resolveFeatureFlags({ userId: 'internal', environment: 'production', remoteConfig: config, overrides: { public_parcel_qa_grid: true }, allowOverride: true }).public_parcel_qa_grid).toBe(false);
    expect(resolveFeatureFlags({ userId: 'qa', environment: 'production', remoteConfig: config }).public_parcel_qa_grid).toBe(true);
  });
});

describe('payment-independent parcel access and explicit activation', () => {
  it.each([false, true])('does not depend on the property unlock state: %s', isUnlocked => {
    expect(propertyParcelContext({ id: context.itemId, ...point, isUnlocked }, true)).toEqual(context);
  });
  it.each([false, 'true', undefined])('requires a literal server-resolved feature gate: %s', enabled => {
    expect(propertyParcelContext({ id: context.itemId, ...point }, enabled)).toBeNull();
  });
  it.each(['hideStreetAddressOnCard', 'hide_street_address_on_card'])('blocks private addresses even after paid unlock: %s', key => {
    expect(propertyParcelContext({ id: context.itemId, ...point, isUnlocked: true, [key]: true }, true)).toBeNull();
  });
  it('rejects missing coordinates/item IDs without a GIS request', async () => {
    const request = vi.fn(); const controller = new ParcelLensController(request, vi.fn());
    expect(propertyParcelContext({ id: 'x' }, true)).toBeNull();
    expect(propertyParcelContext({ ...point }, true)).toBeNull();
    expect(await controller.activateFor(null, false)).toBe('DISABLED');
    expect(request).not.toHaveBeenCalled();
  });
  it('joins the pending popup lookup and activates exactly once without an extra query', async () => {
    let finish; const ready = vi.fn();
    const request = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue(result);
    const controller = new ParcelLensController(request, vi.fn());
    const lookup = controller.lookup(context, true); const activation = controller.activateFor(context, true, ready);
    expect(request).toHaveBeenCalledOnce(); expect(ready).not.toHaveBeenCalled(); finish(result);
    await lookup; expect(await activation).toBe('ACTIVE');
    expect(ready).toHaveBeenCalledWith({ itemId: context.itemId, alreadyActive: false });
    expect(request.mock.calls.map(([query]) => query.operation)).toEqual(['query-point', 'query-bounds']);
  });
  it.each(['SOURCE_TEMPORARILY_UNAVAILABLE', 'PARCEL_NOT_FOUND'])('allows explicit retry after a negative result: %s', status => {
    return (async () => {
      const request = vi.fn().mockResolvedValueOnce({ status, parcels: [] }).mockResolvedValue(result);
      const controller = new ParcelLensController(request, vi.fn()); const ready = vi.fn();
      expect(await controller.activateFor(context, true, ready)).toBe(status); expect(ready).not.toHaveBeenCalled();
      expect(await controller.activateFor(context, true, ready)).toBe('ACTIVE'); expect(ready).toHaveBeenCalledOnce();
      expect(request).toHaveBeenCalledTimes(3);
    })();
  });
  it('never opens or zooms stale requests after switching PINs', async () => {
    let finish; const ready = vi.fn(); const request = vi.fn(() => new Promise(resolve => { finish = resolve; }));
    const controller = new ParcelLensController(request, vi.fn()); const activation = controller.activateFor(context, true, ready);
    controller.select('other-property'); finish(result);
    expect(await activation).toBe('CANCELLED'); expect(ready).not.toHaveBeenCalled(); expect(controller.state.lens).toBeNull();
  });
});
