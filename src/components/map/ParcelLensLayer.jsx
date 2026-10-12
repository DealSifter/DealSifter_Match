import React, { useState } from 'react';
import { Circle, GeoJSON, Pane, Popup } from 'react-leaflet';
import { ParcelPublicData } from './ParcelPublicData';
import { Icon } from '../ui/Icon';
import { parcelLabels } from '../../features/parcel/parcelPresentation';
import { parcelIdentity, PARCEL_LENS_COLOR, PARCEL_LENS_RADIUS_METERS, PARCEL_LENS_RADIUS_MILES } from '../../features/parcel/parcelLensGeometry';
import './ParcelLens.css';

export default function ParcelLensLayer({ lens, language = 'en', onClose, onPrincipalClick, popupPaddingLeft = 12 }) {
  const [selectedNeighbor, setSelectedNeighbor] = useState(null); const t = parcelLabels(language);
  if (!lens) return null;
  const principalId = parcelIdentity(lens.principal);
  return <>
    <div className="ds-parcel-lens-status" style={{ left: popupPaddingLeft, maxWidth: `calc(100% - ${popupPaddingLeft + 12}px)` }}>
      <span>{t.lens} · {new Intl.NumberFormat(language).format(PARCEL_LENS_RADIUS_MILES)} mi</span>
      <button type="button" onClick={onClose} aria-label={t.closeLens} title={t.closeLens}><Icon name="x" size={16} /></button>
      {lens.loading && <small role="status">{t.loading}</small>}
      {lens.limited && <small role="status">{t.limited}</small>}
      {lens.neighborResult?.status === 'SOURCE_TEMPORARILY_UNAVAILABLE' && <small role="status">{t.neighborUnavailable}</small>}
    </div>
    <Pane name="contextual-parcel-lens" style={{ zIndex: 410 }}>
      <Circle center={[lens.context.point.lat, lens.context.point.lng]} radius={PARCEL_LENS_RADIUS_METERS} interactive={false}
        className="ds-parcel-lens-circle" pathOptions={{ color: PARCEL_LENS_COLOR, weight: 2, fill: false }} />
      {lens.parcels.map(parcel => {
        const identity = parcelIdentity(parcel); const principal = identity === principalId;
        return <GeoJSON key={`${identity}:${JSON.stringify(parcel.geometry)}`} data={{ type: 'Feature', properties: {}, geometry: parcel.geometry }}
          style={{ color: PARCEL_LENS_COLOR, weight: principal ? 3 : selectedNeighbor === identity ? 2.5 : 1.5,
            fillColor: PARCEL_LENS_COLOR, fillOpacity: principal ? .1 : .035, className: principal ? 'ds-parcel-lens-principal' : 'ds-parcel-lens-neighbor' }}
          eventHandlers={principal ? { click: onPrincipalClick } : { popupopen: event => {
            setSelectedNeighbor(identity); event.popup.getElement()?.querySelector('.leaflet-popup-close-button')?.setAttribute('aria-label', t.close);
          } }}>
          {!principal && <Popup pane="popupPane" className="ds-property-leaflet-popup ds-parcel-popup" maxWidth={400} autoPanPaddingTopLeft={[popupPaddingLeft, 96]} autoPanPaddingBottomRight={[12, 20]}>
            <ParcelPublicData parcel={parcel} result={lens.neighborResult} language={language} showUnavailable />
          </Popup>}
        </GeoJSON>;
      })}
    </Pane>
  </>;
}
