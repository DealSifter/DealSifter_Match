import React from 'react';
import { C } from '../theme/colors';
import { useT } from '../i18n/translations';

export function TermsPage({ setPage }) {
  const t = useT('terms').terms;
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px 80px', color: C.t1 }}>
      <button
        onClick={() => setPage('landing')}
        style={{ background: 'none', border: 'none', color: C.accent, fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0, marginBottom: 24 }}
      >
        {t.back}
      </button>

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
    </div>
  );
}
