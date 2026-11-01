/** Shared ARV/rental map framing. Geometry only; never performs I/O. */
export interface ComparableCoordinate {
  latitude: number;
  longitude: number;
}

function worldPoint(latitude: number, longitude: number, zoom: number) {
  const scale = 256 * (2 ** zoom);
  const boundedLatitude = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  const sinLatitude = Math.sin((boundedLatitude * Math.PI) / 180);
  return {
    x: ((longitude + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)) * scale,
  };
}

export function comparableMapViewport<T extends ComparableCoordinate>(all: readonly T[], width = 900, height = 330, padding = 65) {
  if (!all.length) throw new Error('REPORT_MAP_POINTS_REQUIRED');
  let zoom = 16;
  let world: Array<{ x: number; y: number; item: T }> = [];
  for (; zoom >= 1; zoom -= 1) {
    world = all.map(item => ({ ...worldPoint(item.latitude, item.longitude, zoom), item }));
    const spanX = Math.max(...world.map(point => point.x)) - Math.min(...world.map(point => point.x));
    const spanY = Math.max(...world.map(point => point.y)) - Math.min(...world.map(point => point.y));
    if ((spanX <= width - padding * 2 && spanY <= height - padding * 2) || zoom === 1) break;
  }
  const left = (Math.min(...world.map(point => point.x)) + Math.max(...world.map(point => point.x))) / 2 - width / 2;
  const top = (Math.min(...world.map(point => point.y)) + Math.max(...world.map(point => point.y))) / 2 - height / 2;
  return { zoom, world, left, top, width, height, padding };
}

/** Display offsets only. Leader lines preserve the true coordinate of each marker. */
export function comparableMapMarkers<T extends ComparableCoordinate>(view: ReturnType<typeof comparableMapViewport<T>>) {
  const placed: Array<{ x: number; y: number; anchorX: number; anchorY: number; item: T }> = [];
  for (const point of view.world) {
    const anchorX = point.x - view.left, anchorY = point.y - view.top;
    let x = anchorX, y = anchorY, found = false;
    for (let ring = 0; ring <= 12 && !found; ring++) {
      const count = ring ? ring * 12 : 1;
      for (let i = 0; i < count; i++) {
        const angle = i / count * Math.PI * 2;
        const px = anchorX + Math.cos(angle) * ring * 20, py = anchorY + Math.sin(angle) * ring * 20;
        if (px < 25 || px > view.width - 25 || py < 25 || py > view.height - 35) continue;
        if (placed.some(previous => Math.hypot(previous.x - px, previous.y - py) < 42)) continue;
        x = px; y = py; found = true; break;
      }
    }
    if (!found) throw Error('REPORT_MAP_MARKER_LAYOUT_EXHAUSTED');
    placed.push({ x, y, anchorX, anchorY, item: point.item });
  }
  return placed;
}
