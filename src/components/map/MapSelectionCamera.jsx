import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import { MapSelectionCamera as SelectionCamera } from '../../features/parcel/mapSelectionCamera';

export function MapSelectionCamera({ request, markers, panelLeft = 0, phone = false }) {
  const map = useMap();
  const options = useRef({ panelLeft, phone });
  useEffect(() => { options.current = { panelLeft, phone }; }, [panelLeft, phone]);
  useEffect(() => {
    if (!request) return undefined;
    const camera = new SelectionCamera(map, id => markers.current.get(String(id)));
    const frame = requestAnimationFrame(() => {
      const bottomNav = Number.parseFloat(getComputedStyle(map.getContainer()).getPropertyValue('--ds-map-bottom-offset')) || 0;
      camera.focus(request, { ...options.current, bottomNav, reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches });
    });
    return () => { cancelAnimationFrame(frame); camera.cancel(); };
  }, [request, map, markers]);
  return null;
}
