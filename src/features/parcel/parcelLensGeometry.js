import { geometryContains, validGeometry, validPoint } from '../../../supabase/functions/_shared/public-parcel/geometry.ts';
import { PARCEL_MAX_RESULTS } from '../../../supabase/functions/_shared/public-parcel/types.ts';

export const PARCEL_LENS_DIAMETER_MILES = 0.20;
export const PARCEL_LENS_RADIUS_MILES = PARCEL_LENS_DIAMETER_MILES / 2;
export const PARCEL_LENS_RADIUS_METERS = PARCEL_LENS_RADIUS_MILES * 1609.344;
export const PARCEL_LENS_COLOR = '#00cbd4';
const EARTH_RADIUS = 6371008.8;
const radians = value => value * Math.PI / 180;
const longitudeDelta = value => ((value + 540) % 360) - 180;

export function parcelGeometryBounds(geometry) {
  if (!validGeometry(geometry)) return null;
  const coordinates = geometry.type === 'Polygon' ? geometry.coordinates.flat() : geometry.coordinates.flat(2);
  return coordinates.reduce((bounds, [lng, lat]) => [Math.min(bounds[0], lng), Math.min(bounds[1], lat), Math.max(bounds[2], lng), Math.max(bounds[3], lat)], [180, 90, -180, -90]);
}

export function parcelLensBounds(point, radius = PARCEL_LENS_RADIUS_METERS) {
  if (!validPoint(point) || !Number.isFinite(radius) || radius <= 0) return null;
  const latitudeDelta = radius / EARTH_RADIUS * 180 / Math.PI;
  const lngDelta = latitudeDelta / Math.max(Math.cos(radians(point.lat)), .01);
  return [Math.max(-180, point.lng - lngDelta), Math.max(-90, point.lat - latitudeDelta), Math.min(180, point.lng + lngDelta), Math.min(90, point.lat + latitudeDelta)];
}

// Fixed-radius spatial context, NOT an area/valuation calculation. Include
// parcels intersecting the circle, including large parcels and boundary edges;
// keep their original public geometry intact rather than invent clipped lots.
export function parcelIntersectsLens(geometry, point, radius = PARCEL_LENS_RADIUS_METERS) {
  if (!validGeometry(geometry) || !validPoint(point)) return false;
  if (geometryContains(geometry, point)) return true;
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const project = ([lng, lat]) => [radians(longitudeDelta(lng - point.lng)) * EARTH_RADIUS * Math.cos(radians(point.lat)), radians(lat - point.lat) * EARTH_RADIUS];
  return polygons.some(polygon => polygon.some(ring => ring.some((coordinate, index) => {
    if (!index) return false;
    const [ax, ay] = project(ring[index - 1]); const [bx, by] = project(coordinate);
    const dx = bx - ax; const dy = by - ay;
    const t = Math.max(0, Math.min(1, (-(ax * dx + ay * dy)) / (dx * dx + dy * dy || 1)));
    return Math.hypot(ax + t * dx, ay + t * dy) <= radius;
  })));
}

export const parcelIdentity = parcel => `${parcel.source}:${parcel.parcelId || parcel.apn || JSON.stringify(parcel.geometry)}`;

export function resolvePrincipalParcel(result, point) {
  if (result?.status !== 'COVERAGE_AVAILABLE') return null;
  const matching = (result.parcels || []).filter(parcel => geometryContains(parcel.geometry, point));
  // Ambiguous stacked/condominium or overlapping public records must not be
  // arbitrarily associated with the DealSifter PIN.
  return matching.length === 1 ? matching[0] : null;
}

export function parcelLensParcels(principal, neighbors, point) {
  const selected = new Map([[parcelIdentity(principal), principal]]);
  for (const parcel of neighbors || []) {
    if (selected.size >= PARCEL_MAX_RESULTS) break;
    if (parcelIntersectsLens(parcel.geometry, point) && !selected.has(parcelIdentity(parcel))) selected.set(parcelIdentity(parcel), parcel);
  }
  return [...selected.values()];
}
