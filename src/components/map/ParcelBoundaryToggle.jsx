import React from 'react';
import { Icon } from '../ui/Icon';
import { parcelLabels } from '../../features/parcel/parcelPresentation';

export default function ParcelBoundaryToggle({ eligible, enabled, language, onToggle }) {
  if (!eligible) return null;
  const t = parcelLabels(language);
  return <button type="button" className={`map-chip map-parcel-toggle ${enabled ? 'map-chip-active' : ''}`}
    aria-label={t.boundaries} aria-pressed={enabled === true} title={t.publicGIS} onClick={onToggle}>
    <span aria-hidden="true"><Icon name="layers" size={14} /></span>
    <span>{t.boundaries}</span><span aria-hidden="true">{enabled ? t.on : t.off}</span>
  </button>;
}
