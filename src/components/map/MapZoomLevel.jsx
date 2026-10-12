import { useEffect, useRef } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import './ParcelLens.css';

export function MapZoomLevel({ language = 'en' }) {
  const map = useMap(); const label = useRef(null);
  const update = () => { if (label.current) label.current.textContent = `Z${Math.round(map.getZoom())}`; };
  useMapEvents({ zoomend: update });
  useEffect(() => {
    const control = map.getContainer().querySelector('.leaflet-control-zoom');
    if (!control) return undefined;
    const element = document.createElement('span'); element.className = 'ds-map-zoom-level'; element.dataset.testid = 'map-zoom-level';
    element.setAttribute('aria-label', language.startsWith('pt') ? 'Nível de zoom' : language.startsWith('es') ? 'Nivel de zoom' : 'Zoom level');
    element.setAttribute('role', 'status'); element.setAttribute('aria-live', 'polite');
    element.textContent = `Z${Math.round(map.getZoom())}`; control.insertBefore(element, control.querySelector('.leaflet-control-zoom-out'));
    label.current = element;
    return () => { element.remove(); label.current = null; };
  }, [map, language]);
  return null;
}
