import React, { useEffect, useState } from 'react';
import { C } from '../../theme/colors';
import { getProfileZipLocation, lookupProfileZip } from '../../services/profileZipLocation';

export function ProfileZipCodeField({ value, onChange, copy, id }) {
  const zip = String(value?.zip || '');
  const location = getProfileZipLocation(value);
  const [failure, setFailure] = useState(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (location || !/^\d{5}$/.test(zip)) return undefined;
    let active = true;
    const timer = setTimeout(() => {
      lookupProfileZip(zip).then((resolved) => {
        if (active) onChange(resolved);
      }).catch((error) => {
        if (active) setFailure({ zip, retry, notFound: error.message === 'ZIP_NOT_FOUND' });
      });
    }, 400);
    return () => { active = false; clearTimeout(timer); };
  }, [zip, location, onChange, retry]);

  const failed = failure?.zip === zip && failure.retry === retry && !location;
  const invalid = Boolean(zip) && (!/^\d{5}$/.test(zip) || failed);
  return (
    <div style={{ display: 'grid', alignContent: 'start', gap: 4, minWidth: 0 }}>
      <label htmlFor={id} style={{ fontSize: 10, color: C.t3 }}>ZIP CODE</label>
      <input
        id={id}
        value={zip}
        onChange={(event) => onChange({ zip: event.target.value.replace(/\D/g, '').slice(0, 5) })}
        inputMode="numeric"
        autoComplete="postal-code"
        maxLength={5}
        placeholder="00000"
        aria-invalid={invalid}
        aria-describedby={`${id}-status`}
        style={{ width: '100%', padding: '9px 10px', borderRadius: 9, border: `1px solid ${invalid ? C.danger : C.border}`, background: C.card, color: C.t1, boxSizing: 'border-box', fontSize: 12 }}
      />
      <span id={`${id}-status`} role="status" style={{ fontSize: 10, color: invalid ? C.danger : C.t3, lineHeight: 1.35 }}>
        {location ? `${location.city}, ${location.state} · ${copy.profileZipMapHint}`
          : !zip ? copy.profileZipHint
            : !/^\d{5}$/.test(zip) ? copy.profileZipInvalid
              : failed ? (failure.notFound ? copy.profileZipNotFound : copy.profileZipUnavailable)
                : copy.profileZipLoading}
      </span>
      {failed && !failure.notFound ? (
        <button type="button" onClick={() => setRetry((current) => current + 1)} style={{ justifySelf: 'start', background: 'transparent', border: 0, padding: 0, color: C.accent, fontSize: 10, cursor: 'pointer' }}>{copy.profileZipRetry}</button>
      ) : null}
    </div>
  );
}
