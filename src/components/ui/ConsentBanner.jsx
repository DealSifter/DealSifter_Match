import React, { useState } from 'react';
import { C } from '../../theme/colors';
import { DealSifterLogo } from './DealSifterLogo';
import { Icon } from './Icon';
import { useT } from '../../i18n/translations';

/**
 * LGPD Consent Banner — shown once after first login before the user can proceed.
 * Records acceptance timestamp; proof is persisted server-side via onAccept callback.
 */
export function ConsentBanner({ onAccept, onReject, onOpenTerms, onOpenPrivacy, processing = false }) {
  const [expanded, setExpanded] = useState(false);
  const [checked, setChecked] = useState(false);
  const t = useT('consent').consent;
  const canAccept = checked && !processing;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.65)',
        padding: 16,
      }}
    >
      <div
        style={{
          background: C.card || '#1e1e2e',
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          maxWidth: 480,
          width: '100%',
          padding: '24px 20px',
          display: 'grid',
          gap: 16,
          maxHeight: '90dvh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <DealSifterLogo size={32} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.t1 }}>{t.title}</div>
            <div style={{ fontSize: 11, color: C.t3 }}>{t.subtitle}</div>
          </div>
        </div>

        <div style={{ fontSize: 12, lineHeight: '1.6', color: C.t2 }}>
          <p style={{ margin: '0 0 8px' }}>
            {t.intro}
          </p>
          <ul style={{ margin: '0 0 8px', paddingLeft: 18 }}>
            <li><strong>{t.dataProfile.split(' — ')[0]}</strong> — {t.dataProfile.split(' — ')[1]}</li>
            <li><strong>{t.dataProfessional.split(' — ')[0]}</strong> — {t.dataProfessional.split(' — ')[1]}</li>
            <li><strong>{t.dataProperty.split(' — ')[0]}</strong> — {t.dataProperty.split(' — ')[1]}</li>
            <li><strong>{t.dataUsage.split(' — ')[0]}</strong> — {t.dataUsage.split(' — ')[1]}</li>
          </ul>
          <p style={{ margin: '0 0 8px' }}>
            {t.storageNote}
          </p>
        </div>

        {expanded ? (
          <div style={{ fontSize: 11, lineHeight: '1.6', color: C.t3, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 6, color: C.t2 }}>{t.rightsTitle}</div>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              <li><strong>{t.rightAccess.split(' — ')[0]}</strong> — {t.rightAccess.split(' — ')[1]}</li>
              <li><strong>{t.rightCorrection.split(' — ')[0]}</strong> — {t.rightCorrection.split(' — ')[1]}</li>
              <li><strong>{t.rightDeletion.split(' — ')[0]}</strong> — {t.rightDeletion.split(' — ')[1]}</li>
              <li><strong>{t.rightPortability.split(' — ')[0]}</strong> — {t.rightPortability.split(' — ')[1]}</li>
              <li><strong>{t.rightRevocation.split(' — ')[0]}</strong> — {t.rightRevocation.split(' — ')[1]}</li>
            </ul>
            <p style={{ margin: '8px 0 0' }}>
              {t.rightsContact}
            </p>
          </div>
        ) : (
          <button
            onClick={() => setExpanded(true)}
            style={{
              background: 'none',
              border: 'none',
              color: C.accent,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              padding: 0,
              textAlign: 'left',
            }}
          >
            {t.expandRights}
          </button>
        )}

        <div style={{ display: 'grid', gap: 8 }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 12,
              border: `1px solid ${checked ? C.accent : C.border}`,
              background: checked ? C.alpha(C.accent, 0.08) : C.alpha(C.t1, 0.03),
              color: C.t2,
              fontSize: 11,
              lineHeight: 1.45,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => setChecked(event.target.checked)}
              style={{ marginTop: 2, accentColor: C.accent, width: 15, height: 15, flexShrink: 0 }}
            />
            <span>{t.readConfirm}</span>
          </label>
          <button
            onClick={() => {
              if (!canAccept) return;
              onAccept?.();
            }}
            disabled={!canAccept}
            style={{
              width: '100%',
              border: 'none',
              borderRadius: 10,
              background: canAccept ? C.accent : C.alpha(C.t1, 0.16),
              color: '#fff',
              padding: '12px 14px',
              fontSize: 13,
              fontWeight: 800,
              cursor: canAccept ? 'pointer' : 'not-allowed',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: canAccept ? 1 : 0.72,
            }}
          >
            <Icon name="check" size={14} color="#fff" />
            {processing ? t.processing : t.accept}
          </button>
          {onReject && (
            <button
              onClick={onReject}
              style={{
                width: '100%',
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                background: 'transparent',
                color: C.t2,
                padding: '10px 14px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {t.reject}
            </button>
          )}
          <div style={{ fontSize: 10, color: C.t3, textAlign: 'center' }}>
            {t.legalText}{' '}
            {onOpenPrivacy ? (
              <button onClick={onOpenPrivacy} style={{ background: 'none', border: 'none', color: C.accent, fontSize: 10, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>{t.privacyLink}</button>
            ) : t.privacyLink}
            {' '}{t.termsJoiner}{' '}
            {onOpenTerms ? (
              <button onClick={onOpenTerms} style={{ background: 'none', border: 'none', color: C.accent, fontSize: 10, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>{t.termsLink}</button>
            ) : t.termsLink}
            {t.legalSuffix}
          </div>
        </div>
      </div>
    </div>
  );
}
