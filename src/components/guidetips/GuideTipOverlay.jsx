import React, { useEffect, useMemo, useRef, useState } from 'react';
import { C } from '../../theme/colors';
import { useTheme } from '../../theme/hooks';
import { Icon } from '../ui/Icon';
import { useGuideTips } from './useGuideTips';
import { useLang } from '../../i18n/translations';
import { getGuideTourCopy } from './guideTourContent';
import appLogo from '../../assets/logo.png';
import { viewportBounds, visibleTargetBounds, focusBounds, clampPosition } from './guideGeometry';

const getTarget = (selector) => {
  if (!selector || typeof document === 'undefined') return null;
  const candidates = Array.from(document.querySelectorAll(selector));
  let fallback = null;
  for (const el of candidates) {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    if (
      rect.width
      && rect.height
      && style.visibility !== 'hidden'
      && style.display !== 'none'
      && Number(style.opacity || 1) > 0
    ) {
      const visible = visibleTargetBounds(el, viewportBounds());
      if (visible) return { element: el, rect: visible };
      fallback ||= { element: el, rect: null };
    }
  }
  return fallback;
};

const sameRect = (a, b) => a === b || Boolean(
  a
  && b
  && Math.abs(a.left - b.left) < 0.5
  && Math.abs(a.top - b.top) < 0.5
  && Math.abs(a.width - b.width) < 0.5
  && Math.abs(a.height - b.height) < 0.5
);

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
  const [targetSnapshot, setTargetSnapshot] = useState({ selector: null, rect: null });
  const [targetPending, setTargetPending] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);
  const cardRef = useRef(null);
  const [viewport, setViewport] = useState(viewportBounds);
  const [cardHeight, setCardHeight] = useState(0);
  const overviewVideoUrl = String(import.meta.env.VITE_OVERVIEW_VIDEO_URL || '').trim();
  const rect = targetSnapshot.selector === step?.target ? targetSnapshot.rect : null;

  useEffect(() => {
    if (!enabled) return;
    const update = () => setViewport((current) => {
      const next = viewportBounds();
      return sameRect(current, next) ? current : next;
    });
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    const frame = window.requestAnimationFrame(update);
    const observer = new ResizeObserver(() => {
      if (cardRef.current) setCardHeight(cardRef.current.getBoundingClientRect().height);
    });
    if (cardRef.current) observer.observe(cardRef.current);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !step) return;
    const dispatchStep = () => window.dispatchEvent(new CustomEvent('ds-guidetip-step', {
      detail: { page, tour: activeTour, index: stepIndex, target: step.target, stepId: step.id },
    }));
    dispatchStep();
    const retryTimers = [80, 280].map((delay) => window.setTimeout(dispatchStep, delay));
    return () => retryTimers.forEach((timer) => window.clearTimeout(timer));
  }, [activeTour, enabled, page, step, stepIndex]);

  useEffect(() => {
    const resetTimer = window.setTimeout(() => {
      setDragOffset({ x: 0, y: 0 });
      dragRef.current = null;
    }, 0);
    return () => window.clearTimeout(resetTimer);
  }, [activeTour, stepIndex]);

  useEffect(() => {
    if (!enabled || !step?.target) {
      const resetTimer = window.setTimeout(() => {
        setTargetSnapshot({ selector: null, rect: null });
        setTargetPending(false);
      }, 0);
      return () => window.clearTimeout(resetTimer);
    }
    let frame = null;
    let retryTimer = null;
    let stopped = false;
    let observer = null;
    let scrolledElement = null;
    let observedElement = null;
    const resizeObserver = new ResizeObserver(() => update());
    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        if (stopped) return;
        const target = getTarget(step.target);
        const next = target?.rect || null;
        setTargetSnapshot((current) => (
          current.selector === step.target && sameRect(current.rect, next)
            ? current
            : { selector: step.target, rect: next }
        ));
        setTargetPending(!next);
        if (target && observedElement !== target.element) {
          resizeObserver.disconnect();
          resizeObserver.observe(target.element);
          observedElement = target.element;
        }
        // Scroll once per target; repeated smooth scrolling hides highlights on large panels.
        if (target && scrolledElement !== target.element) {
          scrolledElement = target.element;
          if (!next) target.element.scrollIntoView?.({ behavior: 'instant', block: 'nearest', inline: 'nearest' });
        }
        window.clearTimeout(retryTimer);
        if (!next) retryTimer = window.setTimeout(update, 250);
      });
    };
    update();
    if (typeof MutationObserver !== 'undefined' && document.body) {
      observer = new MutationObserver((records) => {
        if (records.some((record) => !record.target.closest?.('[data-guide-overlay]'))) update();
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'data-guide', 'hidden'],
      });
    }
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    window.addEventListener('scroll', update, true);
    return () => {
      stopped = true;
      window.cancelAnimationFrame(frame);
      window.clearTimeout(retryTimer);
      observer?.disconnect();
      resizeObserver.disconnect();
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [enabled, page, step]);

  useEffect(() => {
    if (!enabled || !step) return;
    if ((step.mobileOnly && window.innerWidth >= 768) || (step.desktopOnly && window.innerWidth < 768)) {
      const skipTimer = window.setTimeout(() => {
        setStepIndex((current) => Math.min(current + 1, steps.length - 1));
      }, 0);
      return () => window.clearTimeout(skipTimer);
    }
    if (step.kind === 'free-plan' && !isFreePlan) {
      setStepIndex((current) => Math.min(current + 1, steps.length - 1));
    }
  }, [enabled, isFreePlan, setStepIndex, step, steps.length]);

  if (!enabled || !step) return null;

  const isModalStep = !step.target || !rect;
  const margin = 12;
  const mobileViewport = window.innerWidth < 768;
  const cardW = Math.min(mobileViewport ? 320 : 380, viewport.width - 24);
  const cardMaxHeight = mobileViewport ? Math.min(440, viewport.height * 0.65) : viewport.height - 24;
  const cardHGuess = Math.min(cardHeight || (step.kind === 'video' ? 390 : 230), cardMaxHeight);
  const wideViewport = window.innerWidth >= 768;
  const roomOnLeft = rect ? rect.left - margin * 2 : 0;
  const roomOnRight = rect ? window.innerWidth - rect.right - margin * 2 : 0;
  const placeBesideTarget = Boolean(
    rect
    && wideViewport
    && Math.max(roomOnLeft, roomOnRight) >= cardW
  );
  const placeOnRight = placeBesideTarget && roomOnRight >= cardW && roomOnRight >= roomOnLeft;
  const below = rect ? rect.bottom + 14 + cardHGuess < window.innerHeight : false;
  const left = rect
    ? (
      placeBesideTarget
        ? (placeOnRight ? rect.right + margin : rect.left - cardW - margin)
        : Math.min(Math.max(14, rect.left + rect.width / 2 - cardW / 2), window.innerWidth - cardW - 14)
    )
    : Math.max(14, (window.innerWidth - cardW) / 2);
  const top = rect
    ? (
      placeBesideTarget
        ? Math.min(
          Math.max(70, rect.top + rect.height / 2 - cardHGuess / 2),
          Math.max(70, window.innerHeight - cardHGuess - 18),
        )
        : (below ? rect.bottom + 12 : Math.max(70, rect.top - cardHGuess - 12))
    )
    : Math.max(72, (window.innerHeight - cardHGuess) / 2);
  const positionedLeft = clampPosition(left + dragOffset.x, viewport.left + 12, viewport.right - cardW - 12);
  const positionedTop = clampPosition(top + dragOffset.y, viewport.top + 12, viewport.bottom - cardHGuess - 12);
  const progress = `${stepIndex + 1}/${steps.length}`;
  const isDark = theme === 'dark';
  const cardText = '#101827';
  const cardTextSoft = '#475569';
  const cardTextMuted = '#64748b';
  const focus = focusBounds(rect, viewport);
  const focusLeft = focus?.left || 0;
  const focusTop = focus?.top || 0;
  const focusWidth = focus?.width || 0;
  const focusHeight = focus?.height || 0;
  const blockedByOnboarding = Boolean(
    !onboardingComplete
    && activeTour !== 'initial'
    && activeTour !== 'onboarding-entry'
    && activeTour !== 'onboarding'
  );
  const canContinue = !blockedByOnboarding && (!step.requiresOnboarding || onboardingComplete);
  const needsProfileRegistration = Boolean(
    !onboardingComplete
    && (blockedByOnboarding || step.requiresOnboarding)
  );
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
  const goToOnboarding = () => {
    setActiveTour('onboarding');
    setStepIndex(0);
    if (page !== 'onboarding') setPage?.('onboarding');
  };
  const closeGuide = (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    setEnabled(false);
  };
  const beginDrag = (event) => {
    if (event.button > 0 || event.target.closest('button')) return;
    event.preventDefault();
    dragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      left: positionedLeft,
      top: positionedTop,
      baseLeft: left,
      baseTop: top,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const moveDrag = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setDragOffset({
      x: clampPosition(drag.left + event.clientX - drag.clientX, viewport.left + 12, viewport.right - cardW - 12) - drag.baseLeft,
      y: clampPosition(drag.top + event.clientY - drag.clientY, viewport.top + 12, viewport.bottom - cardHGuess - 12) - drag.baseTop,
    });
  };
  const endDrag = (event) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const overlayPiece = {
    position: 'fixed',
    background: isDark ? 'rgba(2,8,7,0.72)' : 'rgba(2,6,23,0.38)',
    transition: 'all .16s ease',
    pointerEvents: 'auto',
  };

  return (
    <div data-guide-overlay="true" aria-live="polite" style={{ position: 'fixed', inset: 0, zIndex: 2147482500, pointerEvents: 'none' }}>
      <style>{`
        @keyframes dsGuideRequiredPulse {
          0%, 100% { box-shadow: 0 0 0 rgba(220, 38, 38, 0); transform: scale(1); }
          50% { box-shadow: 0 0 18px rgba(220, 38, 38, 0.42); transform: scale(1.012); }
        }
      `}</style>
      {isModalStep ? (
        <div style={{ ...overlayPiece, inset: 0 }} />
      ) : (
        <>
          <div style={{ ...overlayPiece, left: 0, top: 0, right: 0, height: focusTop }} />
          <div style={{ ...overlayPiece, left: 0, top: focusTop + focusHeight, right: 0, bottom: 0 }} />
          <div style={{ ...overlayPiece, left: 0, top: focusTop, width: focusLeft, height: focusHeight }} />
          <div style={{ ...overlayPiece, left: focusLeft + focusWidth, top: focusTop, right: 0, height: focusHeight }} />
          <div
            data-guide-highlight="true"
            aria-hidden="true"
            style={{
              boxSizing: 'border-box',
              pointerEvents: 'none',
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
        ref={cardRef}
        role="dialog"
        aria-modal={isModalStep ? 'true' : undefined}
        aria-label={copy.common.title}
        style={{
          position: 'fixed',
          left: positionedLeft,
          top: positionedTop,
          width: cardW,
          maxHeight: cardMaxHeight,
          overflowY: 'auto',
          borderRadius: 16,
          border: `1px solid ${C.alpha(C.accent, 0.52)}`,
          background: 'rgba(255,255,255,0.96)',
          color: cardText,
          padding: mobileViewport ? 12 : 15,
          backdropFilter: 'blur(16px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(16px) saturate(1.2)',
          boxShadow: '0 22px 62px rgba(0,0,0,0.30)',
          pointerEvents: 'auto',
          boxSizing: 'border-box',
        }}
      >
        <div
          data-guide-drag-handle="true"
          title={copy.common.drag}
          onPointerDown={beginDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: mobileViewport ? 7 : 10,
            cursor: 'grab',
            touchAction: 'none',
            userSelect: 'none',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: C.gold, fontSize: 11, fontWeight: 900, textTransform: 'uppercase' }}>
            <Icon name="lightbulb" size={16} color={C.gold} strokeWidth={2} />
            {copy.common.title}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: cardTextMuted, fontSize: 11, fontWeight: 800 }}>{progress}</span>
            {!mobileViewport ? (
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={closeGuide}
                aria-label={copy.common.skip}
                title={copy.common.skip}
                style={{
                  width: 27,
                  height: 27,
                  borderRadius: '50%',
                  border: `1.5px solid ${C.gold}`,
                  background: 'transparent',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <Icon name="x" size={15} color={C.gold} strokeWidth={2.1} />
              </button>
            ) : null}
          </span>
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

        <div style={{ fontSize: mobileViewport ? 15 : 17, fontWeight: 900, lineHeight: 1.2, marginBottom: 7 }}>{step.title}</div>
        <div style={{ fontSize: mobileViewport ? 12 : 13, lineHeight: mobileViewport ? 1.4 : 1.5, color: cardTextSoft, fontWeight: 600 }}>{step.body}</div>
        {targetPending && step.target && !step.optionalTarget ? (
          <div style={{ marginTop: 8, color: C.gold, fontSize: 11, fontWeight: 800 }}>
            {copy.common.locating || copy.common.waiting}
          </div>
        ) : null}
        {needsProfileRegistration ? (
          <div style={{ marginTop: 10, borderRadius: 9, border: '1px solid #dc2626', background: '#fff1f2', color: '#b42318', padding: '8px 10px', fontSize: 11, fontWeight: 900, animation: 'dsGuideRequiredPulse 1.25s ease-in-out infinite' }}>
            {copy.common.profileRequired}
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: 8, marginTop: mobileViewport ? 10 : 15 }}>
          {stepIndex > 0 ? (
            <button type="button" onClick={goBack} style={{ flex: 0.8, border: '1px solid #cbd5e1', background: 'transparent', color: cardTextSoft, borderRadius: 9, padding: '9px 10px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
              {copy.common.back}
            </button>
          ) : null}
          {(!mandatory || mobileViewport) ? (
            <button type="button" onClick={closeGuide} style={{ flex: 1, border: '1px solid #cbd5e1', background: 'transparent', color: cardTextSoft, borderRadius: 9, padding: '9px 10px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
              {copy.common.skip}
            </button>
          ) : null}
          <button
            type="button"
            onClick={needsProfileRegistration ? goToOnboarding : goNext}
            disabled={!canContinue && !needsProfileRegistration}
            style={{ flex: 1.2, border: `1px solid ${(canContinue || needsProfileRegistration) ? C.accent : '#d4d9df'}`, background: (canContinue || needsProfileRegistration) ? C.accent : '#e5e7eb', color: (canContinue || needsProfileRegistration) ? '#fff' : '#8b95a3', borderRadius: 9, padding: '9px 10px', fontSize: 12, fontWeight: 900, cursor: (canContinue || needsProfileRegistration) ? 'pointer' : 'not-allowed' }}
          >
            {needsProfileRegistration
              ? copy.common.profileRegistration
              : (step.actionLabel || (step.completesCycle ? copy.common.finish : copy.common.next))}
          </button>
        </div>
      </div>
    </div>
  );
}
