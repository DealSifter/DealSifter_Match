import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { C } from '../../theme/colors';
import { getProfileZipLocation, lookupProfileZip } from '../../services/profileZipLocation';

export function ProfileZipCodeField({ value, onChange, copy, id }) {
  const zip = String(value?.zip || '');
  const location = getProfileZipLocation(value);
  const [failure, setFailure] = useState(null);
  const [retry, setRetry] = useState(0);
  const [engaged, setEngaged] = useState(false);
  const [position, setPosition] = useState(null);
  const inputRef = useRef(null);
  const popoverRef = useRef(null);
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
  const showPopover = engaged && !location;
  const message = !zip ? copy.profileZipHint
    : !/^\d{5}$/.test(zip) ? copy.profileZipInvalid
      : failed ? (failure.notFound ? copy.profileZipNotFound : copy.profileZipUnavailable)
        : copy.profileZipLoading;
  useEffect(() => {
    if (!showPopover) return undefined;
    const update = () => {
      const input = inputRef.current;
      const popover = popoverRef.current;
      if (!input || !popover) return;
      const rect = input.getBoundingClientRect();
      const height = popover.getBoundingClientRect().height;
      const width = Math.min(300, window.innerWidth - 24);
      const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
      const top = rect.bottom + height + 18 <= window.innerHeight
        ? rect.bottom + 6 : Math.max(12, rect.top - height - 6);
      setPosition((previous) => previous?.left === left && previous?.top === top ? previous : { left, top });
    };
    update();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    if (inputRef.current) observer?.observe(inputRef.current);
    if (popoverRef.current) observer?.observe(popoverRef.current);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [showPopover, message, failed]);
  return (
    <div style={{ display: 'grid', alignContent: 'start', gap: 4, minWidth: 0 }}>
      <label htmlFor={id} style={{ fontSize: 10, color: C.t3 }}>ZIP CODE</label>
      <input
        ref={inputRef}
        id={id}
        value={zip}
        onFocus={() => setEngaged(true)}
        onClick={() => setEngaged(true)}
        onChange={(event) => {
          setEngaged(true);
          onChange({ zip: event.target.value.replace(/\D/g, '').slice(0, 5) });
        }}
        inputMode="numeric"
        autoComplete="postal-code"
        maxLength={5}
        placeholder="00000"
        aria-invalid={invalid}
        aria-describedby={showPopover ? `${id}-status` : undefined}
        aria-busy={Boolean(zip.length === 5 && !location && !failed)}
        title={location ? `${location.city}, ${location.state} · ${copy.profileZipMapHint}` : undefined}
        style={{ width: '100%', padding: '9px 10px', borderRadius: 9, border: `1px solid ${invalid ? C.danger : C.border}`, background: C.card, color: C.t1, boxSizing: 'border-box', fontSize: 12 }}
      />
      {showPopover ? createPortal(
        <div ref={popoverRef} id={`${id}-status`} data-testid="profile-zip-popover" role="status" aria-live="polite"
          style={{ position: 'fixed', zIndex: 12020, left: position?.left ?? 12, top: position?.top ?? 12, visibility: position ? 'visible' : 'hidden', width: 'min(300px, calc(100vw - 24px))', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: `1px solid ${invalid ? C.danger : C.accent}`, background: C.card, color: invalid ? C.danger : C.t2, fontSize: 11, lineHeight: 1.4, boxShadow: '0 8px 24px rgba(0,0,0,.25)', overflowWrap: 'anywhere' }}>
          {message}
          {failed && !failure.notFound ? (
            <button type="button" onClick={() => setRetry((current) => current + 1)} style={{ display: 'block', background: 'transparent', border: 0, padding: '6px 0 0', color: C.accent, fontSize: 11, cursor: 'pointer' }}>{copy.profileZipRetry}</button>
          ) : null}
        </div>, document.body,
      ) : null}
    </div>
  );
}
