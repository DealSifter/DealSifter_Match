import React from 'react';
import { useLang } from '../../i18n/translations';
import { servicePresentation } from '../../lib/activityLabels';
import { ActivityLine } from '../ui/ActivityLine';
import { SmartImage } from '../ui/SmartImage';
import { C } from '../../theme/colors';

export function ServiceMiniCard({ service, onOpen }) {
  const language = useLang('matches');
  const info = servicePresentation(service, language);
  const detail = info.title !== info.category ? info.title : info.description;
  const price = Number(service.price);
  return <button type="button" onClick={() => onOpen?.(service)} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', cursor: 'pointer', padding: 8, minWidth: 0, textAlign: 'left', fontFamily: 'inherit' }}>
    <div style={{ height: 80, position: 'relative', overflow: 'hidden' }}>
      <SmartImage src={service.media?.images?.[0]} alt={info.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
    <ActivityLine values={[info.category]} location={info.location} language={language} style={{ paddingTop: 8, fontSize: 11, fontWeight: 700, color: C.t1 }} />
    {detail ? <div title={detail} style={{ fontSize: 10, color: C.t2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{detail}</div> : null}
    {Number.isFinite(price) && price > 0 ? <div style={{ fontSize: 10, color: C.gold, fontWeight: 700 }}>{new Intl.NumberFormat(language, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(price)}</div> : null}
    {service.publishToConnections === false ? <div style={{ fontSize: 9, fontWeight: 800, color: C.danger, textTransform: 'uppercase', marginTop: 2 }}>Stand By</div> : null}
  </button>;
}
