import React, { useEffect, useMemo, useState } from 'react';
import { GeoJSON, Pane, Popup } from 'react-leaflet';
import { C } from '../../theme/colors';
import { queryPublicParcels } from '../../services/publicParcelService';
import { ParcelViewportController } from '../../features/parcel/parcelViewportController';
import { parcelLabels, parcelPanelRows, parcelFieldProvenance } from '../../features/parcel/parcelPresentation';
import { trackParcelEvent } from '../../features/parcel/parcelTelemetry';
import { geometryContains } from '../../../supabase/functions/_shared/public-parcel/geometry.ts';
import './PublicParcelLayer.css';

export default function PublicParcelLayer({ enabled, active, viewport, language, selectedPoint = null, popupPaddingLeft = 12 }) {
  const [result, setResult] = useState({ status: 'LOADING', parcels: [] });
  const controller = useMemo(() => new ParcelViewportController((query, options) => {
    void trackParcelEvent('viewport', { zoom: query.zoom });
    return queryPublicParcels(query, options);
  }, setResult), []);
  const t = parcelLabels(language);
  useEffect(() => {
    controller.update({ enabled, active, viewport });
    return () => controller.cancel();
  }, [controller, enabled, active, viewport]);
  useEffect(() => () => controller.dispose(), [controller]);
  useEffect(() => {
    if (!enabled || !active) return;
    if (result.status === 'NO_ACTIVE_PUBLIC_SOURCE') void trackParcelEvent('no_coverage');
    if (result.status === 'SOURCE_TEMPORARILY_UNAVAILABLE') void trackParcelEvent('unavailable');
    if (result.status === 'COVERAGE_AVAILABLE') void trackParcelEvent(result.cacheHit || result.viewportCacheHit ? 'cache_hit' : 'cache_miss',
      { parcelCount: result.parcels.length, sourceCount: result.sourceIds?.length || 0, stale: result.freshness === 'STALE_USABLE' });
  }, [enabled, active, result]);
  const tooMany = result.exceededLimit === true;
  const status = result.status === 'LOADING' ? t.loading : tooMany ? t.NARROWER_VIEWPORT_REQUIRED : t[result.reason] || t[result.status];
  if (!enabled || !active) return null;
  return <>
    {status && <div className="ds-parcel-status" role="status" style={{ color: C.t1, background: C.card, borderColor: C.border,
      left: popupPaddingLeft, maxWidth: `min(340px, calc(100% - ${popupPaddingLeft + 12}px))` }}>{status}</div>}
    <Pane name="public-parcels" style={{ zIndex: 410 }}>
      {!tooMany && result.parcels.filter(parcel => parcel.geometry).map((parcel, index) => <GeoJSON
        key={`${parcel.source}:${parcel.apn || parcel.parcelId || index}:${JSON.stringify(parcel.geometry)}`}
        data={{ type: 'Feature', properties: {}, geometry: parcel.geometry }}
        eventHandlers={{ popupopen: event => {
          void trackParcelEvent('click');
          event.popup.getElement()?.querySelector('.leaflet-popup-close-button')?.setAttribute('aria-label', t.close);
        } }}
        style={{ color: '#29a9a5', weight: 1.5, fillColor: '#29a9a5', fillOpacity: .05 }}>
        <Popup pane="popupPane" className="ds-parcel-popup" maxWidth={340}
          autoPanPaddingTopLeft={[popupPaddingLeft, 80]} autoPanPaddingBottomRight={[12, 20]}>
          <article style={{ color: C.t1, background: C.card }} data-testid="public-parcel-panel">
            <strong>{t.title}</strong>
            {parcel.situsAddress && <p>{parcel.situsAddress}</p>}
            {parcel.areaCrossCheck?.status === 'MATERIAL_CONFLICT' && <p className="ds-parcel-warning">{t.conflict}</p>}
            {result.freshness === 'STALE_USABLE' && <p className="ds-parcel-warning">{t.stale}</p>}
            <dl>{parcelPanelRows(parcel, language).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
            {parcelFieldProvenance(parcel, language).length > 0 && <details>
              <summary>{t.provenance}</summary>
              <dl>{parcelFieldProvenance(parcel, language).map(([label, field]) => <div key={label}><dt>{label}</dt><dd>{field}</dd></div>)}</dl>
            </details>}
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
