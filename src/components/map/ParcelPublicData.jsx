import React from 'react';
import { C } from '../../theme/colors';
import { parcelLabels, parcelPanelRows, parcelFieldProvenance } from '../../features/parcel/parcelPresentation';
import { geometryContains } from '../../../supabase/functions/_shared/public-parcel/geometry.ts';
import './PublicParcelLayer.css';

// Shared public-record view inside the existing Leaflet/property popups.
export function ParcelPublicData({ parcel, result, language = 'en', selectedPoint, showUnavailable = false }) {
  const t = parcelLabels(language); const provenance = parcelFieldProvenance(parcel, language);
  return <article className="ds-public-parcel-data" style={{ color: C.t1, background: C.card }} data-testid="public-parcel-panel">
    <strong>{t.title}</strong>
    <p>{parcel.situsAddress || t.unavailable}</p>
    {parcel.areaCrossCheck?.status === 'MATERIAL_CONFLICT' && <p className="ds-parcel-warning">{t.conflict}</p>}
    {result?.freshness === 'STALE_USABLE' && <p className="ds-parcel-warning">{t.stale}</p>}
    <dl>{parcelPanelRows(parcel, language, { showUnavailable }).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    {provenance.length > 0 && <details><summary>{t.provenance}</summary>
      <dl>{provenance.map(([label, field]) => <div key={label}><dt>{label}</dt><dd>{field}</dd></div>)}</dl>
    </details>}
    {selectedPoint && geometryContains(parcel.geometry, selectedPoint) && <p>{t.relation}</p>}
    <p>{t.source}: <a href={parcel.sourceUrl} target="_blank" rel="noreferrer">{parcel.sourceAuthority}</a></p>
    {parcel.sourceUpdatedAt && <p>{t.updated}: {new Date(parcel.sourceUpdatedAt).toLocaleDateString(language)}</p>}
    <p>{t.retrieved}: {new Date(parcel.retrievedAt).toLocaleDateString(language)}</p>
    <small>{t.disclaimer}</small>
  </article>;
}
