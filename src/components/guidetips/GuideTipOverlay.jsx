import React, { useEffect, useMemo, useState } from 'react';
import { C } from '../../theme/colors';
import { useTheme } from '../../theme/hooks';
import { Icon } from '../ui/Icon';
import { useGuideTips } from './useGuideTips';
import { useT } from '../../i18n/translations';

const getRect = (selector) => {
  if (!selector || typeof document === 'undefined') return null;
  const candidates = Array.from(document.querySelectorAll(selector));
  for (const el of candidates) {
    const rect = el.getBoundingClientRect();
    if (rect.width && rect.height) return rect;
  }
  return null;
};

export function GuideTipOverlay({ page }) {
  const { enabled, setEnabled } = useGuideTips();
  const { theme } = useTheme();
  const allT = useT('global');
  const t = allT.guideTips || {};
  const steps = useMemo(() => (page === 'dashboard' ? (t.feedSteps || []) : []), [page, t.feedSteps]);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);

  const step = steps[index] || null;

  useEffect(() => {
    if (!enabled || !step) return;
    window.dispatchEvent(new CustomEvent('ds-guidetip-step', {
      detail: { page, index, target: step.target },
    }));
  }, [enabled, index, page, step]);

  useEffect(() => {
    if (!enabled || !step) return undefined;
    let frame = null;
    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => setRect(getRect(step.target)));
    };
    update();
    const retryOne = window.setTimeout(update, 140);
    const retryTwo = window.setTimeout(update, 320);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(retryOne);
      window.clearTimeout(retryTwo);
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
  const isDark = theme === 'dark';
  const overlayBackground = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(2,6,23,0.30)';
  const overlayBorder = isDark ? C.alpha('#ffffff', 0.16) : C.alpha('#020617', 0.12);
  const cardText = isDark ? '#101827' : C.t1;
  const cardTextSoft = isDark ? '#475569' : C.t2;
  const cardTextMuted = isDark ? '#64748b' : C.t3;
  const overlayPiece = {
    position: 'fixed',
    background: overlayBackground,
    border: `1px solid ${overlayBorder}`,
    backdropFilter: 'blur(8px) saturate(1.3)',
    WebkitBackdropFilter: 'blur(8px) saturate(1.3)',
    transition: 'all .16s ease',
  };
  const focusLeft = Math.max(margin, rect.left - 7);
  const focusTop = Math.max(margin, rect.top - 7);
  const focusWidth = rect.width + 14;
  const focusHeight = rect.height + 14;

  return (
    <div aria-live="polite" style={{ position: 'fixed', inset: 0, zIndex: 2147482500, pointerEvents: 'none' }}>
      <div style={{ ...overlayPiece, left: 0, top: 0, right: 0, height: focusTop }} />
      <div style={{ ...overlayPiece, left: 0, top: focusTop + focusHeight, right: 0, bottom: 0 }} />
      <div style={{ ...overlayPiece, left: 0, top: focusTop, width: focusLeft, height: focusHeight }} />
      <div style={{ ...overlayPiece, left: focusLeft + focusWidth, top: focusTop, right: 0, height: focusHeight }} />
      <div
        style={{
          position: 'fixed',
          left: focusLeft,
          top: focusTop,
          width: focusWidth,
          height: focusHeight,
          borderRadius: 16,
          border: `2px solid ${C.gold}`,
          boxShadow: `0 0 24px ${C.alpha(C.gold, 0.6)}, inset 0 0 18px ${C.alpha(C.gold, 0.12)}`,
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
          background: isDark ? C.alpha('#ffffff', 0.92) : C.alpha('#ffffff', 0.88),
          color: cardText,
          padding: 14,
          backdropFilter: 'blur(14px) saturate(1.25)',
          WebkitBackdropFilter: 'blur(14px) saturate(1.25)',
          boxShadow: `0 20px 50px ${C.alpha(C.shadow, 0.26)}`,
          pointerEvents: 'auto',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: C.gold, fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.08em' }}>
            <Icon name="lightbulb" size={16} color={C.gold} strokeWidth={2} />
            {t.title || 'GuideTips'}
          </span>
          <span style={{ color: cardTextMuted, fontSize: 11, fontWeight: 800 }}>{progress}</span>
        </div>
        <div style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.15, marginBottom: 6 }}>{step.title}</div>
        <div style={{ fontSize: 13, lineHeight: 1.45, color: cardTextSoft, fontWeight: 600 }}>{step.body}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button
            type="button"
            onClick={() => setEnabled(false)}
            style={{ flex: 1, border: `1px solid ${C.border}`, background: 'transparent', color: cardTextSoft, borderRadius: 10, padding: '9px 10px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
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
