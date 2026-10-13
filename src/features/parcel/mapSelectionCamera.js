import { PARCEL_LENS_RADIUS_METERS } from './parcelLensGeometry';

export const PIN_SELECTION_ZOOM = 15;
export const parcelSelectionZoom = phone => phone ? 17 : 16;

// One stable screen-space slot for both popup pages, independent of parcel data.
export function selectionLayout({ width, height, panelLeft = 0, bottomNav = 0, phone = false, latitude = 0 }) {
  const left = Math.min(panelLeft + (panelLeft ? 24 : 12), Math.max(12, width - 160));
  const right = width - 12;
  const popupWidth = Math.max(120, Math.min(360, right - left - 12));
  const top = 72;
  const safeBottom = height - Math.max(104, bottomNav + 100);
  const lensPixels = PARCEL_LENS_RADIUS_METERS / (156543.03392 * Math.cos(latitude * Math.PI / 180) / 2 ** parcelSelectionZoom(phone));
  const popupHeight = Math.max(120, Math.min(phone ? 340 : 390, safeBottom - top,
    height - bottomNav - 12 - lensPixels - 42 - top));
  const centeredTop = top + Math.max(0, (safeBottom - top - popupHeight) / 2);
  const lensClearanceTop = height - bottomNav - 12 - lensPixels - 42 - popupHeight;
  const popupTop = Math.max(top, Math.min(centeredTop, lensClearanceTop));
  return { popupWidth, popupHeight, photoHeight: Math.min(phone ? 154 : 196, popupHeight * .47),
    pinX: (left + right) / 2, pinY: popupTop + popupHeight + 42, popupTop };
}

export function selectionCenter(map, point, zoom, layout) {
  const size = map.getSize();
  const projected = map.project(point, zoom);
  return map.unproject([projected.x - (layout.pinX - size.x / 2), projected.y - (layout.pinY - size.y / 2)], zoom);
}

// New commands supersede previous commands. No camera listeners survive a
// selection, so a later page switch/response cannot reopen or refit a popup.
export class MapSelectionCamera {
  constructor(map, getMarker) { this.map = map; this.getMarker = getMarker; }
  focus(request, options) {
    this.cancel();
    const marker = this.getMarker(request.id);
    if (!marker) return;
    const point = marker.getLatLng(); // Includes coincident-pin display offsets.
    const size = this.map.getSize();
    const layout = selectionLayout({ width: size.x, height: size.y, latitude: point.lat, ...options });
    const container = this.map.getContainer();
    container.style.setProperty('--map-selection-popup-width', `${layout.popupWidth}px`);
    container.style.setProperty('--map-selection-popup-height', `${layout.popupHeight}px`);
    container.style.setProperty('--map-selection-photo-height', `${layout.photoHeight}px`);
    marker.openPopup();
    marker.getPopup?.()?.update?.();
    const center = selectionCenter(this.map, point, request.zoom, layout);
    this.map.flyTo(center, request.zoom, { animate: !options.reducedMotion, duration: .5, easeLinearity: .3 });
  }
  cancel() { this.map.stop(); }
}
