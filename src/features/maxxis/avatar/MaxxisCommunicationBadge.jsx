import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { maxxisCommunicationCopy, placeMaxxisCommunication } from './maxxisCommunicationPlacement';
import './MaxxisCommunicationBadge.css';

export function MaxxisCommunicationBadge({ anchorRef, bubble, positionKey, motionEnabled = true, language = 'en', onOpen, onAccept, onDismiss, onPhaseChange }) {
  const [phase, setPhase] = useState(bubble ? 'EXPANDING' : 'IDLE_BADGE');
  const [previousBubble, setPreviousBubble] = useState(bubble);
  const [displayed, setDisplayed] = useState(bubble);
  const [placement, setPlacement] = useState(null);
  const surfaceRef = useRef(null);
  const active = Boolean(bubble);
  const critical = bubble?.signal?.priority === 'P0';

  if (previousBubble !== bubble) {
    setPreviousBubble(bubble);
    if (bubble) setDisplayed(bubble);
    setPhase(bubble ? 'EXPANDING' : 'COLLAPSING');
  }

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const timer = window.setTimeout(() => {
      setPhase(bubble ? (bubble.signal?.actions?.length ? 'WAITING' : 'MESSAGE') : 'IDLE_BADGE');
      if (!bubble) setDisplayed(null);
    }, motionEnabled && !query.matches ? 220 : 0);
    return () => window.clearTimeout(timer);
  }, [bubble, motionEnabled]);

  useEffect(() => { onPhaseChange?.(phase); }, [onPhaseChange, phase]);

  useLayoutEffect(() => {
    let frame;
    const update = () => {
      const anchor = anchorRef.current;
      if (!anchor || !surfaceRef.current) return;
      const rect = anchor.getBoundingClientRect();
      const art = anchor.querySelector('.maxxis-avatar-art')?.getBoundingClientRect() || rect;
      const visual = window.visualViewport;
      const rootStyle = getComputedStyle(document.documentElement);
      const bottomNav = parseFloat(rootStyle.getPropertyValue('--ds-mobile-bottom-nav-visible-height')) || 0;
      const style = getComputedStyle(anchor);
      const safeTop = parseFloat(style.getPropertyValue('--maxxis-safe-top')) || 0;
      const safeBottom = parseFloat(style.getPropertyValue('--maxxis-safe-bottom')) || 0;
      const safeLeft = parseFloat(style.getPropertyValue('--maxxis-safe-left')) || 0;
      const safeRight = parseFloat(style.getPropertyValue('--maxxis-safe-right')) || 0;
      const viewportTop = (visual?.offsetTop || 0) + safeTop;
      const viewportBottom = Math.min((visual?.offsetTop || 0) + (visual?.height || window.innerHeight) - safeBottom, window.innerHeight - bottomNav - safeBottom);
      const next = placeMaxxisCommunication({ anchor: rect, avatar: art,
        viewport: { left: (visual?.offsetLeft || 0) + safeLeft, top: viewportTop, width: (visual?.width || window.innerWidth) - safeLeft - safeRight, height: Math.max(0, viewportBottom - viewportTop) },
        height: parseFloat(getComputedStyle(surfaceRef.current).height) || surfaceRef.current.offsetHeight || 150 });
      const badge = anchor.querySelector('.maxxis-ai-idle')?.getBoundingClientRect();
      if (badge) {
        next.originX = badge.left + badge.width / 2 - rect.left - next.left;
        next.originY = badge.top + badge.height / 2 - rect.top - next.top;
      }
      if (!anchor.getClientRects().length || getComputedStyle(anchor).visibility === 'hidden') next.visible = false;
      setPlacement((previous) => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    update();
    const observer = new ResizeObserver(schedule);
    if (anchorRef.current) observer.observe(anchorRef.current);
    if (surfaceRef.current) observer.observe(surfaceRef.current);
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect();
      window.removeEventListener('resize', schedule); window.removeEventListener('scroll', schedule, true);
      window.visualViewport?.removeEventListener('resize', schedule); window.visualViewport?.removeEventListener('scroll', schedule);
    };
  }, [anchorRef, positionKey, displayed, phase]);

  const expanded = Boolean(displayed) && phase !== 'IDLE_BADGE';
  const dismissLabel = language === 'pt' ? 'Agora não' : language === 'es' ? 'Ahora no' : 'Not now';
  return (
    <div className="maxxis-communication-badge" data-testid="maxxis-communication-badge" data-phase={phase}
      data-motion={motionEnabled ? 'on' : 'off'} data-side={placement?.side || 'left'}
      style={{ '--bubble-left': `${placement?.left || 0}px`, '--bubble-top': `${placement?.top || 0}px`,
        '--bubble-width': `${placement?.width || 312}px`, '--bubble-max-height': `${placement?.maxHeight || 600}px`, '--bubble-tail': `${placement?.tail || 24}px`,
        '--badge-origin-x': `${placement?.originX || 0}px`, '--badge-origin-y': `${placement?.originY || 0}px` }}>
      <button type="button" className="maxxis-ai-idle" data-testid="maxxis-ai-badge" onClick={onOpen}
        aria-label="Maxxis Deal AI" tabIndex={expanded ? -1 : 0} aria-hidden={expanded}>AI</button>
      <div ref={surfaceRef} className="maxxis-speech-surface" data-testid={active && placement?.visible ? 'maxxis-proactive-bubble' : undefined}
        data-trigger-id={displayed?.signal?.id} data-property-id={displayed?.signal?.propertyId} data-state-version={displayed?.signal?.generatedFromStateVersion}
        hidden={!expanded} aria-hidden={!active || !placement?.visible} inert={!active || !placement?.visible ? true : undefined}
        style={{ visibility: placement?.visible ? 'visible' : 'hidden' }}
        onKeyDown={(event) => { if (event.key === 'Escape' && active) { event.preventDefault(); event.stopPropagation(); onDismiss(); anchorRef.current?.querySelector('button')?.focus(); } }}>
        <span className="maxxis-speech-tail" aria-hidden="true" />
        <p key={displayed?.id} role={critical ? 'alert' : 'status'} aria-live={critical ? 'assertive' : 'polite'} aria-atomic="true">{maxxisCommunicationCopy(displayed?.message)}</p>
        <div className="maxxis-speech-actions">
          <button type="button" data-testid="maxxis-proactive-review" onClick={onAccept}>{displayed?.message?.ctaLabel}</button>
          <button type="button" data-testid="maxxis-proactive-dismiss" onClick={onDismiss}>{dismissLabel}</button>
        </div>
      </div>
    </div>
  );
}
