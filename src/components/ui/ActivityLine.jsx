import React from 'react';
import { activityLabels } from '../../lib/activityLabels';

// Keep locality outside the skills text, reserve its space and preserve row height.
export function ActivityLine({ values = [], location = '', language = 'en', style }) {
  const text = activityLabels(values, language, true).join(' · ');
  return <span title={[text, location].filter(Boolean).join(' / ')} style={{ display: 'flex', alignItems: 'baseline', gap: 4, minWidth: 0, maxWidth: '100%', ...style }}>
    {text ? <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text}</span> : null}
    {location ? <span style={{ flexShrink: 0, maxWidth: text ? '42%' : '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>/ {location}</span> : null}
  </span>;
}
