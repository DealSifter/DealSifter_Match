import React from 'react';
import { C } from '../../theme/colors';
import { useT } from '../../i18n/translations';

/**
 * Cookie consent banner — non-blocking bottom bar on the landing page.
 * Stores acceptance in localStorage ('ds_cookie_consent').
 */
export function CookieBanner({ onAccept, onLearnMore }) {
  const t = useT('cookie').cookie;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: C.card || '#1e1e2e',
        borderTop: `1px solid ${C.border}`,
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        flexWrap: 'wrap',
        boxShadow: '0 -2px 12px rgba(0,0,0,0.25)',
      }}
    >
      <span style={{ fontSize: 12, color: C.t2, maxWidth: 560, textAlign: 'center' }}>
        {t.message}
      </span>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onAccept}
          style={{
            border: 'none',
            borderRadius: 8,
            background: C.accent,
            color: '#fff',
            padding: '8px 16px',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {t.accept}
        </button>
        {onLearnMore && (
          <button
            onClick={onLearnMore}
            style={{
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              background: 'transparent',
              color: C.t3,
              padding: '8px 12px',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {t.learnMore}
          </button>
        )}
      </div>
    </div>
  );
}
