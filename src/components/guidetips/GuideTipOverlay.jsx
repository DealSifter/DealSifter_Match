import React, { useEffect, useMemo, useState } from 'react';
import { C } from '../../theme/colors';
import { Icon } from '../ui/Icon';
import { useGuideTips } from './useGuideTips';
import { useT } from '../../i18n/translations';

const getRect = (selector) => {
  if (!selector || typeof document === 'undefined') return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return rect;
};

export function GuideTipOverlay({ page }) {
  const { enabled, setEnabled } = useGuideTips();
  const allT = useT('global');
  const t = allT.guideTips || {};
  const steps = useMemo(() => (page === 'dashboard' ? (t.feedSteps || []) : []), [page, t.feedSteps]);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);

  const step = steps[index] || null;

  useEffect(() => {
    if (!enabled || !step) return undefined;
    let frame = null;
    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => setRect(getRect(step.target)));
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [enabled, step]);

  if (!enabled || !step || !rect) return null;

  const margin = 12;
  const cardW = Math.min(340, Math.max(260, window.innerWidth - 28));
  const below = rect.bottom + 14 + 170 < window.innerHeight;
  const left = Math.min(Math.max(14, rect.left + rect.width / 2 - cardW / 2), window.innerWidth - cardW - 14);
  const top = below ? rect.bottom + 12 : Math.max(70, rect.top - 176);
  const progress = `${index + 1}/${steps.length}`;

  return (
    <div aria-live="polite" style={{ position: 'fixed', inset: 0, zIndex: 2147482500, pointerEvents: 'none' }}>
      <div
        style={{
          position: 'fixed',
          left: Math.max(margin, rect.left - 6),
          top: Math.max(margin, rect.top - 6),
          width: rect.width + 12,
          height: rect.height + 12,
          borderRadius: 16,
          border: `2px solid ${C.gold}`,
          boxShadow: `0 0 0 9999px ${C.alpha('#020617', 0.32)}, 0 0 24px ${C.alpha(C.gold, 0.55)}`,
          transition: 'all .16s ease',
        }}
      />
      <div
        role="dialog"
        aria-label={t.title || 'GuideTips'}
        style={{
          position: 'fixed',
          left,
          top,
          width: cardW,
          borderRadius: 18,
          border: `1px solid ${C.alpha(C.accent, 0.48)}`,
          background: C.card,
          color: C.t1,
          padding: 14,
          boxShadow: `0 20px 50px ${C.alpha(C.shadow, 0.22)}`,
          pointerEvents: 'auto',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: C.gold, fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.08em' }}>
            <Icon name="lightbulb" size={16} color={C.gold} strokeWidth={2} />
            {t.title || 'GuideTips'}
          </span>
          <span style={{ color: C.t3, fontSize: 11, fontWeight: 800 }}>{progress}</span>
        </div>
        <div style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.15, marginBottom: 6 }}>{step.title}</div>
        <div style={{ fontSize: 13, lineHeight: 1.45, color: C.t2, fontWeight: 600 }}>{step.body}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button
            type="button"
            onClick={() => setEnabled(false)}
            style={{ flex: 1, border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, borderRadius: 10, padding: '9px 10px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
          >
            {t.turnOff || 'Turn off'}
          </button>
          <button
            type="button"
            onClick={() => setIndex((prev) => (prev + 1 >= steps.length ? 0 : prev + 1))}
            style={{ flex: 1, border: `1px solid ${C.accent}`, background: C.accent, color: '#fff', borderRadius: 10, padding: '9px 10px', fontSize: 12, fontWeight: 900, cursor: 'pointer' }}
          >
            {index + 1 >= steps.length ? (t.restart || 'Restart') : (t.next || 'Next')}
          </button>
        </div>
      </div>
    </div>
  );
}
