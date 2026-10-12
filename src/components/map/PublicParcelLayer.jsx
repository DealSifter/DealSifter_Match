import React, { useEffect, useMemo, useState } from 'react';
import { GeoJSON, Pane, Popup } from 'react-leaflet';
import { C } from '../../theme/colors';
import { queryPublicParcels } from '../../services/publicParcelService';
import { ParcelViewportController } from '../../features/parcel/parcelViewportController';
import { parcelLabels, parcelPanelRows } from '../../features/parcel/parcelPresentation';
import { geometryContains } from '../../../supabase/functions/_shared/public-parcel/geometry.ts';
import './PublicParcelLayer.css';

export default function PublicParcelLayer({ enabled, active, viewport, language, selectedPoint = null }) {
  const [result, setResult] = useState({ status: 'LOADING', parcels: [] });
  const controller = useMemo(() => new ParcelViewportController(queryPublicParcels, setResult), []);
  const t = parcelLabels(language);
  useEffect(() => {
    controller.update({ enabled, active, viewport });
    return () => controller.cancel();
  }, [controller, enabled, active, viewport]);
  useEffect(() => () => controller.dispose(), [controller]);
  const tooMany = result.exceededLimit === true;
  const status = result.status === 'LOADING' ? t.loading : tooMany ? t.NARROWER_VIEWPORT_REQUIRED : t[result.reason] || t[result.status];
  if (!enabled || !active) return null;
  return <>
    {status && <div className="ds-parcel-status" role="status" style={{ color: C.t1, background: C.card, borderColor: C.border }}>{status}</div>}
    <Pane name="public-parcels" style={{ zIndex: 410 }}>
      {!tooMany && result.parcels.filter(parcel => parcel.geometry).map((parcel, index) => <GeoJSON
        key={`${parcel.source}:${parcel.apn || parcel.parcelId || index}:${parcel.retrievedAt}`}
        data={{ type: 'Feature', properties: {}, geometry: parcel.geometry }}
        style={{ color: '#29a9a5', weight: 1.5, fillColor: '#29a9a5', fillOpacity: .05 }}>
        <Popup pane="popupPane" className="ds-parcel-popup" maxWidth={340}>
          <article style={{ color: C.t1, background: C.card }} data-testid="public-parcel-panel">
            <strong>{t.title}</strong>
            {parcel.situsAddress && <p>{parcel.situsAddress}</p>}
            {parcel.areaCrossCheck?.status === 'MATERIAL_CONFLICT' && <p className="ds-parcel-warning">{t.conflict}</p>}
            {result.freshness === 'STALE_USABLE' && <p className="ds-parcel-warning">{t.stale}</p>}
            <dl>{parcelPanelRows(parcel, language).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
            {selectedPoint && geometryContains(parcel.geometry, selectedPoint) && <p>{t.relation}</p>}
            <p>{t.source}: <a href={parcel.sourceUrl} target="_blank" rel="noreferrer">{parcel.sourceAuthority}</a></p>
            {parcel.sourceUpdatedAt && <p>{t.updated}: {new Date(parcel.sourceUpdatedAt).toLocaleDateString(language)}</p>}
            <p>{t.retrieved}: {new Date(parcel.retrievedAt).toLocaleDateString(language)}</p>
            <small>{t.disclaimer}</small>
          </article>
        </Popup>
      </GeoJSON>)}
    </Pane>
  </>;
}
