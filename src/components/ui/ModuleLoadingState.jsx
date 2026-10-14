import React from 'react';
import { getT } from '../../i18n/translations';

export function ModuleLoadingState({ overlay = false }) {
  const copy = getT().errorBoundary;
  return <div role="status" aria-live="polite" data-testid="module-loading" style={{
    color:'var(--t2)', background:'var(--card)', padding:24, textAlign:'center', borderRadius:12,
    ...(overlay ? { position:'absolute', top:72, left:12, zIndex:1100, maxWidth:300 } : { minHeight:160, display:'grid', placeItems:'center' }),
  }}>{copy.moduleLoading}</div>;
}
