import React from 'react';
import { C } from '../theme/colors';
import { useT } from '../i18n/translations';

const boldSplit = (item) => {
  const idx = item.indexOf(':');
  if (idx > 0 && idx < 45) {
    return <><strong>{item.slice(0, idx + 1)}</strong>{item.slice(idx + 1)}</>;
  }
  return item;
};

export function PrivacyPolicyPage({ setPage }) {
  const t = useT('privacy').privacy;
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
        <section>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: C.t1, marginBottom: 8 }}>{t.s1h}</h2>
          <p>{t.s1p} <strong>{t.s1dpo}</strong></p>
        </section>

        <section>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: C.t1, marginBottom: 8 }}>{t.s2h}</h2>
          <p>{t.s2p}</p>
          <ul style={{ paddingLeft: 18, margin: '8px 0' }}>
            {t.s2l.map((item, i) => <li key={i}>{boldSplit(item)}</li>)}
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: C.t1, marginBottom: 8 }}>{t.s3h}</h2>
          <p>{t.s3p}</p>
          <ul style={{ paddingLeft: 18, margin: '8px 0' }}>
            {t.s3l.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: C.t1, marginBottom: 8 }}>{t.s4h}</h2>
          <p>{t.s4p}</p>
          <ul style={{ paddingLeft: 18, margin: '8px 0' }}>
            {t.s4l.map((item, i) => <li key={i}>{boldSplit(item)}</li>)}
          </ul>
          <p style={{ marginTop: 8 }}>{t.s4p2}</p>
        </section>

        <section>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: C.t1, marginBottom: 8 }}>{t.s5h}</h2>
          <p>{t.s5p}</p>
          <ul style={{ paddingLeft: 18, margin: '8px 0' }}>
            {t.s5l.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: C.t1, marginBottom: 8 }}>{t.s6h}</h2>
          <p>{t.s6p}</p>
          <ul style={{ paddingLeft: 18, margin: '8px 0' }}>
            {t.s6l.map((item, i) => <li key={i}>{boldSplit(item)}</li>)}
          </ul>
          <p style={{ marginTop: 8 }}>{t.s6p2}</p>
        </section>

        <section>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: C.t1, marginBottom: 8 }}>{t.s7h}</h2>
          <p>{t.s7p}</p>
        </section>

        <section>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: C.t1, marginBottom: 8 }}>{t.s8h}</h2>
          <p>{t.s8p}</p>
        </section>

        <section>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: C.t1, marginBottom: 8 }}>{t.s9h}</h2>
          <p>{t.s9p}</p>
        </section>

        <section>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: C.t1, marginBottom: 8 }}>{t.s10h}</h2>
          <p>{t.s10p}</p>
          <p style={{ marginTop: 8 }}>
            <strong>{t.s10email}</strong><br />
            <strong>{t.s10response}</strong>
          </p>
        </section>
      </div>
    </div>
  );
}
