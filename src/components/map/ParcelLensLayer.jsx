import React, { memo, useMemo, useState } from 'react';
import { Circle, GeoJSON, Pane, Popup } from 'react-leaflet';
import { ParcelPublicData } from './ParcelPublicData';
import { Icon } from '../ui/Icon';
import { parcelLabels } from '../../features/parcel/parcelPresentation';
import { parcelIdentity, PARCEL_LENS_COLOR, PARCEL_LENS_RADIUS_METERS, PARCEL_LENS_DIAMETER_MILES } from '../../features/parcel/parcelLensGeometry';
import './ParcelLens.css';

const LensParcel = memo(function LensParcel({ parcel, principal, highlighted, result, point, language, popupPaddingLeft, onPrincipalClick, onSelect }) {
  const identity = parcelIdentity(parcel); const t = parcelLabels(language);
  const data = useMemo(() => ({ type: 'Feature', properties: {}, geometry: parcel.geometry }), [parcel.geometry]);
  return <GeoJSON data={data}
    style={{ color: PARCEL_LENS_COLOR, weight: principal ? 3 : highlighted ? 2.5 : 1.5,
      fillColor: PARCEL_LENS_COLOR, fillOpacity: principal ? .1 : .035, className: principal ? 'ds-parcel-lens-principal' : 'ds-parcel-lens-neighbor' }}
    eventHandlers={principal ? { click: onPrincipalClick } : { popupopen: event => {
      onSelect(identity); event.popup.getElement()?.querySelector('.leaflet-popup-close-button')?.setAttribute('aria-label', t.close);
    } }}>
    {!principal && <Popup pane="popupPane" className="ds-property-leaflet-popup ds-parcel-popup" maxWidth={400}
      autoPanPaddingTopLeft={[popupPaddingLeft, 80]} autoPanPaddingBottomRight={[12, 104]}>
      <div className="ds-parcel-neighbor-frame"><ParcelPublicData parcel={parcel} result={result} language={language} selectedPoint={point} showUnavailable /></div>
    </Popup>}
  </GeoJSON>;
});

export default memo(function ParcelLensLayer({ lens, language = 'en', onClose, onPrincipalClick, popupPaddingLeft = 12, phone = false }) {
  const [selectedNeighbor, setSelectedNeighbor] = useState(null); const t = parcelLabels(language);
  if (!lens) return null;
  const principalId = parcelIdentity(lens.principal);
  return <>
    <div className={`ds-parcel-lens-status${phone ? ' is-phone' : ''}`} style={{ maxWidth: `calc(100% - ${phone ? 112 : popupPaddingLeft + 76}px)` }}>
      <span>{t.lens} · {t.diameter} {new Intl.NumberFormat(language, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(PARCEL_LENS_DIAMETER_MILES)} mi</span>
      <button type="button" onClick={onClose} aria-label={t.closeLens} title={t.closeLens}><Icon name="x" size={16} /></button>
      {lens.loading && <span className="ds-parcel-lens-query-status" role="status" aria-label={t.loading}>…</span>}
      {(lens.limited || lens.neighborResult?.status === 'SOURCE_TEMPORARILY_UNAVAILABLE') && <details className="ds-parcel-lens-notice">
        <summary aria-label={lens.limited ? t.limited : t.neighborUnavailable} title={lens.limited ? t.limited : t.neighborUnavailable}>⚠</summary>
        <small>{lens.limited ? t.limited : t.neighborUnavailable}</small>
      </details>}
    </div>
    <Pane name="contextual-parcel-lens" style={{ zIndex: 410 }}>
      <Circle center={[lens.context.point.lat, lens.context.point.lng]} radius={PARCEL_LENS_RADIUS_METERS} interactive={false}
        className="ds-parcel-lens-circle" pathOptions={{ color: PARCEL_LENS_COLOR, weight: 2, fill: false }} />
      {lens.parcels.map(parcel => {
        const identity = parcelIdentity(parcel); const principal = identity === principalId;
        return <LensParcel key={identity} parcel={parcel} principal={principal} highlighted={selectedNeighbor === identity}
          result={lens.neighborResult} point={lens.context.point} language={language} popupPaddingLeft={popupPaddingLeft}
          onPrincipalClick={onPrincipalClick} onSelect={setSelectedNeighbor} />;
      })}
    </Pane>
  </>;
});
