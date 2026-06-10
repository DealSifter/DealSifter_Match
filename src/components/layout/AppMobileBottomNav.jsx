import React, { useEffect, useMemo, useRef, useState } from 'react';
import { C } from '../../theme/colors';
import { useT } from '../../i18n/translations';
import { Icon } from '../ui/Icon';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import feedMatchIcon from '../../assets/feed-match-icon.png';
import newCardTaskbarIcon from '../../assets/taskbar-newcard-icon.png';
import mapViewTaskbarIcon from '../../assets/taskbar-mapview-icon.png';
import matchesTaskbarIcon from '../../assets/taskbar-matches-icon.png';

const HIDDEN_PAGES = new Set(['landing', 'pricing', 'terms', 'privacy', 'admin']);

export function AppMobileBottomNav({ page, setPage, collapsed = false, onCollapsedChange, needsPrimaryProfileAttention = false }) {
  const TABLET_PORTRAIT_QUERY = '(min-width: 768px) and (max-width: 1080px) and (orientation: portrait)';
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isTabletPortrait = useMediaQuery(TABLET_PORTRAIT_QUERY);
  const [isDraggingHandle, setIsDraggingHandle] = useState(false);
  const [pressedItemId, setPressedItemId] = useState(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [navMeasuredHeight, setNavMeasuredHeight] = useState(84);
  const navRef = useRef(null);
  const dragRef = useRef({ active: false, pointerId: null, startY: 0 });
  const suppressNextClickRef = useRef(false);
  const isCompactViewport = isMobile || isTabletPortrait;
  const isTabletCompactOnly = isTabletPortrait && !isMobile;
  const collapsedVisibleHeight = isTabletCompactOnly ? 8 : 6;
  const collapsedTranslateY = Math.max(0, navMeasuredHeight - collapsedVisibleHeight);
  const navGridHeight = isTabletCompactOnly ? 66 : 62;
  const navIconBoxSize = isTabletCompactOnly ? 34 : 30;
  const navIconSize = isTabletCompactOnly ? 17 : 16;
  const navLabelSize = isTabletCompactOnly ? 12 : 11;
  const handleWidth = isTabletCompactOnly ? 52 : 44;

  const t = useT('global').nav;

  useEffect(() => {
    if (!isCompactViewport) return undefined;
    const navEl = navRef.current;
    if (!navEl) return undefined;

    const updateNavHeight = () => {
      const nextHeight = Number(navEl.offsetHeight || 0);
      if (nextHeight > 0) setNavMeasuredHeight(nextHeight);
    };

    updateNavHeight();

    let resizeObserver;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => updateNavHeight());
      resizeObserver.observe(navEl);
    }

    window.addEventListener('resize', updateNavHeight);
    return () => {
      window.removeEventListener('resize', updateNavHeight);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [isCompactViewport, collapsed]);

  const navItems = useMemo(() => ([
    { id: 'dashboard', label: t.feed, icon: 'grid' },
    { id: 'mapview', label: t.mapView, icon: 'mapView' },
    { id: 'matches', label: t.matches, icon: 'matches' },
    { id: 'onboarding', label: t.newCard || 'New Card', icon: 'newCard' },
  ]), [t.feed, t.mapView, t.matches, t.newCard]);
  const neonGlow = 'drop-shadow(0 0 6px rgba(53,202,201,0.95)) drop-shadow(0 0 12px rgba(53,202,201,0.8)) drop-shadow(0 0 18px rgba(53,202,201,0.55))';

  const emitCollapsedChange = (nextValue) => {
    if (typeof onCollapsedChange === 'function') onCollapsedChange(Boolean(nextValue));
  };

  const resetDrag = () => {
    dragRef.current.active = false;
    dragRef.current.pointerId = null;
    setIsDraggingHandle(false);
    setDragOffsetY(0);
  };

  const handlePointerDown = (event) => {
    suppressNextClickRef.current = false;
    dragRef.current.active = true;
    dragRef.current.pointerId = event.pointerId;
    dragRef.current.startY = event.clientY;
    setIsDraggingHandle(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (!dragRef.current.active) return;
    if (dragRef.current.pointerId !== null && event.pointerId !== dragRef.current.pointerId) return;
    const deltaY = event.clientY - dragRef.current.startY;
    const minDelta = collapsed ? -collapsedTranslateY : 0;
    const maxDelta = collapsed ? 28 : collapsedTranslateY;
    const next = Math.max(minDelta, Math.min(maxDelta, deltaY));
    setDragOffsetY(next);
  };

  const handlePointerEnd = (event) => {
    if (!dragRef.current.active) return;
    if (dragRef.current.pointerId !== null && event.pointerId !== dragRef.current.pointerId) return;
    const deltaY = event.clientY - dragRef.current.startY;
    if (Math.abs(deltaY) > 6) suppressNextClickRef.current = true;
    if (!collapsed && deltaY > 24) {
      suppressNextClickRef.current = true;
      emitCollapsedChange(true);
    } else if (collapsed && deltaY < -18) {
      suppressNextClickRef.current = true;
      emitCollapsedChange(false);
    }
    resetDrag();
  };

  const handleGripClick = () => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    emitCollapsedChange(!collapsed);
  };

  const navTranslateY = Math.max(
    0,
    Math.min(
      collapsedTranslateY,
      (collapsed ? collapsedTranslateY : 0) + (isDraggingHandle ? dragOffsetY : 0),
    ),
  );

  if (!isCompactViewport || HIDDEN_PAGES.has(page)) return null;

  return (
    <nav
      ref={navRef}
      aria-label={t.mobileNavLabel || 'App mobile navigation'}
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 900,
        background: C.card,
        borderTop: `1px solid ${C.border}`,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        transform: `translateY(${navTranslateY}px)`,
        transition: isDraggingHandle ? 'none' : 'transform .22s ease',
      }}
    >
      <style>{`
        @keyframes dsNavPulseRed {
          0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.40); }
          70% { box-shadow: 0 0 0 9px rgba(220, 38, 38, 0.0); }
          100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.0); }
        }
      `}</style>
      <button
        type="button"
        aria-label={collapsed ? (t.expandFooterModules || 'Expand footer modules') : (t.collapseFooterModules || 'Collapse footer modules')}
        onClick={handleGripClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={resetDrag}
        style={{
          width: '100%',
          border: 'none',
          background: 'transparent',
          cursor: 'grab',
          padding: collapsed ? '1px 0 2px' : '2px 0 4px',
          touchAction: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <span style={{ width: handleWidth, height: 4, borderRadius: 999, background: C.alpha(C.t3, 0.65) }} />
        {!collapsed ? (
          <span style={{ fontSize: isTabletCompactOnly ? 10 : 9, fontWeight: 700, color: C.t3, lineHeight: 1 }}>
            {t.dragDownHint || 'drag down'}
          </span>
        ) : null}
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', height: navGridHeight }}>
        {navItems.map((item) => {
          const isActive = page === item.id;
          const isPressed = pressedItemId === item.id;
          const isOnboardingAttention = item.id === 'onboarding' && needsPrimaryProfileAttention;
          const iconColor = isOnboardingAttention ? C.danger : (isActive ? C.accent : C.t2);
          const iconGlow = isOnboardingAttention
            ? 'drop-shadow(0 0 6px rgba(220,38,38,0.95)) drop-shadow(0 0 12px rgba(220,38,38,0.72))'
            : (isActive ? neonGlow : 'none');
          const iconImage = item.id === 'dashboard'
            ? feedMatchIcon
            : item.id === 'onboarding'
              ? newCardTaskbarIcon
              : item.id === 'mapview'
                ? mapViewTaskbarIcon
                : item.id === 'matches'
                  ? matchesTaskbarIcon
                  : null;
          const iconInnerScale = item.id === 'dashboard'
            ? 0.95
            : item.id === 'mapview'
              ? 0.8
              : item.id === 'matches'
                ? 0.95
                : item.id === 'onboarding'
                  ? 0.92
                  : 1;
          const iconInset = `${((1 - iconInnerScale) * 100) / 2}%`;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setPage && setPage(item.id)}
              onPointerDown={() => setPressedItemId(item.id)}
              onPointerUp={() => setPressedItemId(null)}
              onPointerCancel={() => setPressedItemId(null)}
              onPointerLeave={() => setPressedItemId((current) => (current === item.id ? null : current))}
              aria-current={isActive ? 'page' : undefined}
              style={{
                border: 'none',
                borderTop: isOnboardingAttention
                  ? `2px solid ${C.danger}`
                  : isActive
                    ? `2px solid ${C.accent}`
                    : '2px solid transparent',
                background: isOnboardingAttention
                  ? C.alpha(C.danger, isPressed ? 0.18 : 0.12)
                  : isActive
                  ? C.alpha(C.accent, isPressed ? 0.14 : 0.08)
                  : isPressed
                    ? C.alpha(C.t3, 0.1)
                    : 'transparent',
                color: iconColor,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                fontSize: navLabelSize,
                fontWeight: isOnboardingAttention ? 800 : (isActive ? 700 : 600),
                transform: isPressed ? 'translateY(1px)' : 'translateY(0)',
                transition: 'all .12s ease',
                animation: isOnboardingAttention ? 'dsNavPulseRed 1.15s infinite' : 'none',
              }}
            >
              <span
                style={{
                  width: navIconBoxSize,
                  height: navIconBoxSize,
                  borderRadius: 10,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isActive
                    ? C.alpha(C.accent, isPressed ? 0.24 : 0.18)
                    : isPressed
                      ? C.alpha(C.t3, 0.14)
                      : 'transparent',
                  transition: 'all .12s ease',
                }}
              >
                {iconImage ? (
                  <span
                    aria-hidden="true"
                    style={{
                      width: navIconSize + 8,
                      height: navIconSize + 8,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      filter: iconGlow,
                      opacity: 1,
                      transition: 'filter .12s ease, opacity .12s ease, background-color .12s ease, transform .12s ease',
                      transform: isPressed ? 'scale(0.97)' : 'scale(1)',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        inset: iconInset,
                        backgroundColor: iconColor,
                        WebkitMaskImage: `url(${iconImage})`,
                        WebkitMaskRepeat: 'no-repeat',
                        WebkitMaskSize: 'contain',
                        WebkitMaskPosition: 'center',
                        maskImage: `url(${iconImage})`,
                        maskRepeat: 'no-repeat',
                        maskSize: 'contain',
                        maskPosition: 'center',
                      }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        inset: iconInset,
                        transform: 'translate(0.45px, 0)',
                        backgroundColor: iconColor,
                        opacity: 0.9,
                        WebkitMaskImage: `url(${iconImage})`,
                        WebkitMaskRepeat: 'no-repeat',
                        WebkitMaskSize: 'contain',
                        WebkitMaskPosition: 'center',
                        maskImage: `url(${iconImage})`,
                        maskRepeat: 'no-repeat',
                        maskSize: 'contain',
                        maskPosition: 'center',
                      }}
                    />
                  </span>
                ) : (
                  <Icon
                    name={item.icon}
                    size={navIconSize}
                    color={iconColor}
                    strokeWidth={isActive ? 2 : 1.8}
                  />
                )}
              </span>
              <span style={{ lineHeight: 1.1 }}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default AppMobileBottomNav;
