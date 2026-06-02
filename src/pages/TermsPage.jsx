import React from 'react';
import { C } from '../theme/colors';
import { useLang, useT } from '../i18n/translations';
import { getTermsContent } from '../legal/termsContent';

function renderInline(text) {
  if (!text) return null;
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

function TermsBullet({ item }) {
  const label = item?.label ? `${item.label}: ` : '';
  return (
    <li style={{ marginBottom: 8 }}>
      {label ? <strong>{label}</strong> : null}
      {renderInline(item?.text || item)}
    </li>
  );
}

function TermsParagraph({ text, highlight = false }) {
  return (
    <p style={{ margin: '0 0 10px', fontWeight: highlight ? 850 : 500, color: highlight ? C.t1 : C.t2 }}>
      {renderInline(text)}
    </p>
  );
}

export function TermsPage({ setPage, onReturnToCheckout = null }) {
  const lang = useLang('terms');
  const t = useT('terms').terms;
  const checkoutT = useT().modals || {};
  const terms = getTermsContent(lang);
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
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '40px 20px 80px', color: C.t1 }}>
      <button
        onClick={() => setPage('landing')}
        style={{ background: 'none', border: 'none', color: C.accent, fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0, marginBottom: 24 }}
      >
        {t.back}
      </button>

      <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>{terms.title}</h1>
      <div style={{ display: 'grid', gap: 4, fontSize: 12, color: C.t3, marginBottom: 30 }}>
        {terms.meta.map((line) => <div key={line}>{line}</div>)}
      </div>

      <div style={{ display: 'grid', gap: 24, fontSize: 14, lineHeight: '1.72', color: C.t2 }}>
        {terms.sections.map((section) => (
          <section key={section.title}>
            <h2 style={{ fontSize: 17, fontWeight: 900, color: C.t1, margin: '0 0 10px' }}>{section.title}</h2>
            {(section.paragraphs || []).map((paragraph, index) => (
              <TermsParagraph key={`${section.title}-p-${index}`} text={paragraph.text || paragraph} highlight={paragraph.highlight} />
            ))}
            {(section.bullets || []).length ? (
              <ul style={{ paddingLeft: 20, margin: '8px 0 12px' }}>
                {section.bullets.map((item, index) => <TermsBullet key={`${section.title}-b-${index}`} item={item} />)}
              </ul>
            ) : null}
            {(section.subsections || []).map((subsection) => (
              <div key={subsection.title} style={{ marginTop: 14 }}>
                <h3 style={{ fontSize: 15, fontWeight: 850, color: C.t1, margin: '0 0 8px' }}>{subsection.title}</h3>
                {(subsection.paragraphs || []).map((paragraph, index) => (
                  <TermsParagraph key={`${subsection.title}-p-${index}`} text={paragraph.text || paragraph} highlight={paragraph.highlight} />
                ))}
                {(subsection.bullets || []).length ? (
                  <ul style={{ paddingLeft: 20, margin: '8px 0 12px' }}>
                    {subsection.bullets.map((item, index) => <TermsBullet key={`${subsection.title}-b-${index}`} item={item} />)}
                  </ul>
                ) : null}
              </div>
            ))}
          </section>
        ))}
      </div>

      <div style={{ marginTop: 30, fontSize: 12, color: C.t3, fontWeight: 800 }}>{terms.effective}</div>

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
