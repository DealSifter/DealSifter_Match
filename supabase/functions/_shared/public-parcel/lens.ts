import { validPoint } from './geometry.ts';
import { PARCEL_LENS_RADIUS_METERS, type Bounds, type Point } from './types.ts';

export function contextualLensBounds(point: Point, radius = PARCEL_LENS_RADIUS_METERS): Bounds | null {
  if (!validPoint(point) || !Number.isFinite(radius) || radius <= 0) return null;
  const delta = radius / 6371008.8 * 180 / Math.PI;
  const longitude = delta / Math.max(Math.cos(point.lat * Math.PI / 180), .01);
  return [Math.max(-180,point.lng-longitude),Math.max(-90,point.lat-delta),Math.min(180,point.lng+longitude),Math.min(90,point.lat+delta)];
}

// Viewport queries remain a separate internal capability. Client supplied
// bounds/radii cannot widen the contextual public query into a global grid.
export function parcelOperationAllowed(operation: string, flags: { public_parcel_intelligence: boolean; public_parcel_qa_grid: boolean }) {
  return flags.public_parcel_intelligence && (operation !== 'query-bounds' || flags.public_parcel_qa_grid);
}
