import React, { useEffect, useMemo, useState } from 'react';
import { C } from '../../theme/colors';
import { useTheme } from '../../theme/hooks';
import { Icon } from '../ui/Icon';
import { useGuideTips } from './useGuideTips';
import { useLang } from '../../i18n/translations';
import { getGuideTourCopy } from './guideTourContent';
import appLogo from '../../assets/logo.png';

const getRect = (selector) => {
  if (!selector || typeof document === 'undefined') return null;
  const candidates = Array.from(document.querySelectorAll(selector));
  for (const el of candidates) {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    if (rect.width && rect.height && style.visibility !== 'hidden' && style.display !== 'none') return rect;
  }
  return null;
};

export function GuideTipOverlay({ page, setPage, isFreePlan = true }) {
  const {
    enabled,
    setEnabled,
    activeTour,
    setActiveTour,
    stepIndex,
    setStepIndex,
    completeTour,
    mandatory,
    onboardingComplete,
  } = useGuideTips();
  const { theme } = useTheme();
  const language = useLang('global');
  const copy = useMemo(() => getGuideTourCopy(language), [language]);
  const steps = copy[activeTour] || [];
  const step = steps[stepIndex] || null;
  const [rect, setRect] = useState(null);
  const [targetPending, setTargetPending] = useState(false);
  const overviewVideoUrl = String(import.meta.env.VITE_OVERVIEW_VIDEO_URL || '').trim();

  useEffect(() => {
    if (!enabled || !step) return;
    window.dispatchEvent(new CustomEvent('ds-guidetip-step', {
      detail: { page, tour: activeTour, index: stepIndex, target: step.target, stepId: step.id },
    }));
  }, [activeTour, enabled, page, step, stepIndex]);

  useEffect(() => {
    if (!enabled || !step?.target) {
      const resetTimer = window.setTimeout(() => {
        setRect(null);
        setTargetPending(false);
      }, 0);
      return () => window.clearTimeout(resetTimer);
    }
    let frame = null;
    let attempts = 0;
    let retryTimer = null;
    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const next = getRect(step.target);
        setRect(next);
        setTargetPending(!next);
        if (next) {
          const outside = next.top < 72 || next.bottom > window.innerHeight - 72;
          if (outside) {
            document.querySelector(step.target)?.scrollIntoView?.({ behavior: 'smooth', block: 'center', inline: 'nearest' });
          }
        } else if (attempts < 12) {
          attempts += 1;
          retryTimer = window.setTimeout(update, 180);
        }
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(retryTimer);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [enabled, page, step]);

  useEffect(() => {
    if (!enabled || !step) return;
    if (step.kind === 'free-plan' && !isFreePlan) {
      setStepIndex((current) => Math.min(current + 1, steps.length - 1));
    }
  }, [enabled, isFreePlan, setStepIndex, step, steps.length]);

  if (!enabled || !step) return null;

  const isModalStep = !step.target || !rect;
  const margin = 12;
  const cardW = Math.min(380, Math.max(280, window.innerWidth - 28));
  const cardHGuess = step.kind === 'video' ? 390 : 230;
  const below = rect ? rect.bottom + 14 + cardHGuess < window.innerHeight : false;
  const left = rect
    ? Math.min(Math.max(14, rect.left + rect.width / 2 - cardW / 2), window.innerWidth - cardW - 14)
    : Math.max(14, (window.innerWidth - cardW) / 2);
  const top = rect
    ? (below ? rect.bottom + 12 : Math.max(70, rect.top - cardHGuess - 12))
    : Math.max(72, (window.innerHeight - cardHGuess) / 2);
  const progress = `${stepIndex + 1}/${steps.length}`;
  const isDark = theme === 'dark';
  const cardText = '#101827';
  const cardTextSoft = '#475569';
  const cardTextMuted = '#64748b';
  const focusLeft = rect ? Math.max(margin, rect.left - 7) : margin;
  const focusTop = rect ? Math.max(margin, rect.top - 7) : margin;
  const focusWidth = rect ? rect.width + 14 : 0;
  const focusHeight = rect ? rect.height + 14 : 0;
  const canContinue = !step.requiresOnboarding || onboardingComplete;
  const isLast = stepIndex + 1 >= steps.length;

  const goBack = () => setStepIndex((current) => Math.max(0, current - 1));
  const goNext = () => {
    if (!canContinue) return;
    if (step.completesCycle) {
      completeTour(activeTour, true);
      return;
    }
    if (step.nextTour) {
      completeTour(activeTour, false);
      if (!mandatory) {
        setEnabled(false);
        return;
      }
      setActiveTour(step.nextTour);
      setStepIndex(0);
      if (step.nextPage && page !== step.nextPage) setPage?.(step.nextPage);
      return;
    }
    if (isLast) {
      completeTour(activeTour, false);
      setEnabled(false);
      return;
    }
    setStepIndex((current) => current + 1);
  };

  const overlayPiece = {
    position: 'fixed',
    background: isDark ? 'rgba(2,8,7,0.72)' : 'rgba(2,6,23,0.38)',
    backdropFilter: 'blur(5px)',
    WebkitBackdropFilter: 'blur(5px)',
    transition: 'all .16s ease',
    pointerEvents: 'auto',
  };

  return (
    <div aria-live="polite" style={{ position: 'fixed', inset: 0, zIndex: 2147482500, pointerEvents: 'none' }}>
      {isModalStep ? (
        <div style={{ ...overlayPiece, inset: 0 }} />
      ) : (
        <>
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
              borderRadius: 14,
              border: `2px solid ${C.gold}`,
              boxShadow: `0 0 28px ${C.alpha(C.gold, 0.72)}, inset 0 0 18px ${C.alpha(C.gold, 0.14)}`,
              transition: 'all .16s ease',
            }}
          />
        </>
      )}
      <div
        role="dialog"
        aria-modal={isModalStep ? 'true' : undefined}
        aria-label={copy.common.title}
        style={{
          position: 'fixed',
          left,
          top,
          width: cardW,
          maxHeight: 'calc(100dvh - 88px)',
          overflowY: 'auto',
          borderRadius: 16,
          border: `1px solid ${C.alpha(C.accent, 0.52)}`,
          background: 'rgba(255,255,255,0.96)',
          color: cardText,
          padding: 15,
          backdropFilter: 'blur(16px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(16px) saturate(1.2)',
          boxShadow: '0 22px 62px rgba(0,0,0,0.30)',
          pointerEvents: 'auto',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: C.gold, fontSize: 11, fontWeight: 900, textTransform: 'uppercase' }}>
            <Icon name="lightbulb" size={16} color={C.gold} strokeWidth={2} />
            {copy.common.title}
          </span>
          <span style={{ color: cardTextMuted, fontSize: 11, fontWeight: 800 }}>{progress}</span>
        </div>

        {step.kind === 'video' ? (
          <div style={{ marginBottom: 12, borderRadius: 12, overflow: 'hidden', border: '1px solid #d7e1e8', background: '#0d1815', aspectRatio: '16 / 9', display: 'grid', placeItems: 'center' }}>
            {overviewVideoUrl ? (
              <video controls playsInline preload="metadata" src={overviewVideoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ padding: 18, textAlign: 'center', color: '#d7f8f4' }}>
                <img src={appLogo} alt="DealSifter" style={{ width: 54, height: 54, objectFit: 'contain', marginBottom: 8 }} />
                <div style={{ fontSize: 12, lineHeight: 1.45 }}>{copy.common.videoSoon}</div>
              </div>
            )}
          </div>
        ) : null}

        {step.kind === 'free-plan' ? (
          <div style={{ marginBottom: 12, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7 }}>
            {['Swipes', 'Matches', 'Nuggets'].map((label) => (
              <div key={label} style={{ border: '1px solid #f1cf8c', borderRadius: 9, background: '#fff9ed', padding: '8px 5px', textAlign: 'center', color: '#9a6413', fontSize: 10, fontWeight: 900 }}>
                {label}
              </div>
            ))}
          </div>
        ) : null}

        <div style={{ fontSize: 17, fontWeight: 900, lineHeight: 1.2, marginBottom: 7 }}>{step.title}</div>
        <div style={{ fontSize: 13, lineHeight: 1.5, color: cardTextSoft, fontWeight: 600 }}>{step.body}</div>
        {targetPending && step.target ? (
          <div style={{ marginTop: 8, color: C.gold, fontSize: 11, fontWeight: 800 }}>
            {copy.common.waiting}
          </div>
        ) : null}
        {!canContinue ? (
          <div style={{ marginTop: 10, borderRadius: 9, border: '1px solid #efb6b6', background: '#fff4f4', color: '#b42318', padding: '8px 10px', fontSize: 11, fontWeight: 800 }}>
            {copy.common.waiting}: 1 profile + 1 linked property or service.
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: 8, marginTop: 15 }}>
          {stepIndex > 0 ? (
            <button type="button" onClick={goBack} style={{ flex: 0.8, border: '1px solid #cbd5e1', background: 'transparent', color: cardTextSoft, borderRadius: 9, padding: '9px 10px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
              {copy.common.back}
            </button>
          ) : null}
          {!mandatory ? (
            <button type="button" onClick={() => setEnabled(false)} style={{ flex: 1, border: '1px solid #cbd5e1', background: 'transparent', color: cardTextSoft, borderRadius: 9, padding: '9px 10px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
              {copy.common.skip}
            </button>
          ) : null}
          <button
            type="button"
            onClick={goNext}
            disabled={!canContinue}
            style={{ flex: 1.2, border: `1px solid ${canContinue ? C.accent : '#d4d9df'}`, background: canContinue ? C.accent : '#e5e7eb', color: canContinue ? '#fff' : '#8b95a3', borderRadius: 9, padding: '9px 10px', fontSize: 12, fontWeight: 900, cursor: canContinue ? 'pointer' : 'not-allowed' }}
          >
            {step.completesCycle ? copy.common.finish : copy.common.next}
          </button>
        </div>
      </div>
    </div>
  );
}
