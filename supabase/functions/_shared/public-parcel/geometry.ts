import type { ParcelGeometry, Point } from './types.ts';
import { classifyAreaDifference, SQFT_PER_ACRE } from './areaPolicy.ts';
const EARTH_RADIUS = 6371008.8;
const SQFT_PER_SQM = 10.763910416709722;
const radians = (value: number) => value * Math.PI / 180;
export function validPoint(value: unknown): value is Point {
  const p = value as Point | undefined;
  return !!p && typeof p.lat === 'number' && typeof p.lng === 'number' && Number.isFinite(p.lat) && Number.isFinite(p.lng)
    && p.lat >= -90 && p.lat <= 90 && p.lng >= -180 && p.lng <= 180;
}
function ringArea(ring: number[][]) {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    let d = radians(ring[i + 1][0] - ring[i][0]);
    if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
    sum += d * (2 + Math.sin(radians(ring[i][1])) + Math.sin(radians(ring[i + 1][1])));
  }
  return Math.abs(sum * EARTH_RADIUS ** 2 / 2);
}
export function pointInRing(point: number[], ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]; const b = ring[j];
    const cross = (point[0] - a[0]) * (b[1] - a[1]) - (point[1] - a[1]) * (b[0] - a[0]);
    if (Math.abs(cross) < 1e-12 && point[0] >= Math.min(a[0], b[0]) && point[0] <= Math.max(a[0], b[0])
      && point[1] >= Math.min(a[1], b[1]) && point[1] <= Math.max(a[1], b[1])) return true;
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
export function validGeometry(input: unknown): input is ParcelGeometry {
  const geometry = input as ParcelGeometry | null;
  if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type) || !Array.isArray(geometry.coordinates)) return false;
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  let vertices = 0;
  return polygons.length > 0 && polygons.length <= 500 && polygons.every(poly => Array.isArray(poly) && poly.length > 0 && poly.every(ring =>
    Array.isArray(ring) && ring.length >= 4 && (vertices += ring.length) <= 30000 && ring.every(c => Array.isArray(c) && c.length >= 2 && validPoint({ lng: c[0], lat: c[1] }))
    && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]));
}
export function arcgisRingsToGeometry(rings: number[][][]): ParcelGeometry | null {
  if (!validGeometry({ type: 'Polygon', coordinates: rings })) return null;
  const sorted = [...rings].sort((a, b) => ringArea(b) - ringArea(a));
  const polygons: number[][][][] = [];
  const parents: { ring: number[][]; depth: number; polygon: number }[] = [];
  for (const ring of sorted) {
    const parent = [...parents].reverse().find(item => pointInRing(ring[0], item.ring));
    const depth = parent ? parent.depth + 1 : 0;
    if (depth % 2 === 0) { polygons.push([ring]); parents.push({ ring, depth, polygon: polygons.length - 1 }); }
    else { polygons[parent!.polygon].push(ring); parents.push({ ring, depth, polygon: parent!.polygon }); }
  }
  return polygons.length === 1 ? { type: 'Polygon', coordinates: polygons[0] } : { type: 'MultiPolygon', coordinates: polygons };
}
export function geodesicParcelArea(geometry: ParcelGeometry | null) {
  if (!validGeometry(geometry)) return { sqft: null, acres: null };
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const sqm = polygons.reduce((total, poly) => total + Math.max(0, ringArea(poly[0]) - poly.slice(1).reduce((sum, ring) => sum + ringArea(ring), 0)), 0);
  return { sqft: sqm * SQFT_PER_SQM, acres: sqm * SQFT_PER_SQM / SQFT_PER_ACRE };
}
export function geometryContains(geometry: ParcelGeometry | null, point: Point) {
  if (!validGeometry(geometry)) return false;
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some(poly => pointInRing([point.lng, point.lat], poly[0]) && !poly.slice(1).some(hole => pointInRing([point.lng, point.lat], hole)));
}
export function areaCrossCheck(values: (number | null)[]) {
  const available = values.filter((value): value is number => value !== null && Number.isFinite(value) && value > 0);
  if (available.length < 2) return { status: 'NOT_EVALUATED' as const, relativeDifference: null };
  const difference = (Math.max(...available) - Math.min(...available)) / Math.max(...available);
  return { status: classifyAreaDifference(difference), relativeDifference: difference };
}
