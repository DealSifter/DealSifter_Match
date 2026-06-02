import React from 'react';
import { C } from '../theme/colors';
import { useT } from '../i18n/translations';

export function TermsPage({ setPage, onReturnToCheckout = null }) {
  const t = useT('terms').terms;
  const checkoutT = useT().modals || {};
  const showCheckoutReturn = Boolean(onReturnToCheckout);
  const renderCheckoutButton = () => (
    <button
      type="button"
      onClick={onReturnToCheckout}
      style={{
        border: 'none',
        background: C.accent,
        color: '#fff',
        borderRadius: 12,
        padding: '10px 14px',
        fontSize: 13,
        fontWeight: 800,
        cursor: 'pointer',
        boxShadow: `0 10px 24px ${C.alpha(C.accent, 0.22)}`,
      }}
    >
      {checkoutT.checkoutBackToCheckout || 'Back to checkout'}
    </button>
  );

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px 80px', color: C.t1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => setPage('landing')}
          style={{ background: 'none', border: 'none', color: C.accent, fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0 }}
        >
          {t.back}
        </button>
        {showCheckoutReturn ? renderCheckoutButton() : null}
      </div>

      <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>{t.title}</h1>
      <p style={{ fontSize: 12, color: C.t3, marginBottom: 32 }}>{t.lastUpdated}</p>

      <div style={{ display: 'grid', gap: 20, fontSize: 14, lineHeight: '1.7', color: C.t2 }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <section key={n}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: C.t1, marginBottom: 8 }}>{t[`s${n}h`]}</h2>
            <p>{t[`s${n}p`]}</p>
          </section>
        ))}
        <section>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: C.t1, marginBottom: 8 }}>{t.s11h}</h2>
          <p>{t.s11p} <strong>{t.s11email}</strong></p>
        </section>
      </div>

      {showCheckoutReturn ? (
        <div style={{ marginTop: 34, padding: 16, borderRadius: 16, border: `1px solid ${C.border}`, background: C.alpha(C.accent, 0.06), display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ color: C.t2, fontSize: 13, fontWeight: 700 }}>
            {checkoutT.checkoutReturnHint || 'Ready to continue? Return to the checkout modal to finish payment.'}
          </div>
          {renderCheckoutButton()}
        </div>
      ) : null}
    </div>
  );
}
