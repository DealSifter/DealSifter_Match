import React, { useEffect, useMemo, useRef, useState } from 'react';
import { C } from '../../theme/colors';
import { useT } from '../../i18n/translations';
import { Icon } from '../ui/Icon';
import feedMatchIcon from '../../assets/feed-match-icon.jpeg';

const HIDDEN_PAGES = new Set(['landing', 'terms', 'privacy', 'admin']);

export function AppMobileBottomNav({ page, setPage, collapsed = false, onCollapsedChange }) {
  const TABLET_PORTRAIT_QUERY = '(min-width: 768px) and (max-width: 1080px) and (orientation: portrait)';
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(max-width: 767px)').matches;
  });
  const [isTabletPortrait, setIsTabletPortrait] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(TABLET_PORTRAIT_QUERY).matches;
  });
  const [isDraggingHandle, setIsDraggingHandle] = useState(false);
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
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const handleViewportChange = (event) => setIsMobile(event.matches);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleViewportChange);
      return () => mediaQuery.removeEventListener('change', handleViewportChange);
    }

    mediaQuery.addListener(handleViewportChange);
    return () => mediaQuery.removeListener(handleViewportChange);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mediaQuery = window.matchMedia(TABLET_PORTRAIT_QUERY);
    const handleViewportChange = (event) => setIsTabletPortrait(Boolean(event.matches));

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleViewportChange);
      return () => mediaQuery.removeEventListener('change', handleViewportChange);
    }

    mediaQuery.addListener(handleViewportChange);
    return () => mediaQuery.removeListener(handleViewportChange);
  }, [TABLET_PORTRAIT_QUERY]);

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
    { id: 'mapview', label: t.mapView, icon: 'mapPin' },
    { id: 'matches', label: t.matches, icon: 'chat' },
    { id: 'onboarding', label: t.newCard || 'New Card', icon: 'plus' },
  ]), [t.feed, t.mapView, t.matches, t.newCard]);

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
      aria-label="App mobile navigation"
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
      <button
        type="button"
        aria-label={collapsed ? 'Expandir módulos do rodapé' : 'Ocultar módulos do rodapé'}
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
            arraste para baixo
          </span>
        ) : null}
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', height: navGridHeight }}>
        {navItems.map((item) => {
          const isActive = page === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setPage && setPage(item.id)}
              aria-current={isActive ? 'page' : undefined}
              style={{
                border: 'none',
                borderTop: isActive ? `2px solid ${C.accent}` : '2px solid transparent',
                background: isActive ? C.alpha(C.accent, 0.06) : 'transparent',
                color: isActive ? C.accent : C.t3,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                fontSize: navLabelSize,
                fontWeight: isActive ? 700 : 500,
                transition: 'all .15s ease',
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
                  background: isActive ? C.alpha(C.accent, 0.18) : 'transparent',
                  transition: 'all .15s ease',
                }}
              >
                {item.id === 'dashboard' ? (
                  <img
                    src={feedMatchIcon}
                    alt=""
                    aria-hidden="true"
                    style={{
                      width: navIconSize + 8,
                      height: navIconSize + 8,
                      objectFit: 'contain',
                      borderRadius: 4,
                    }}
                  />
                ) : (
                  <Icon
                    name={item.icon}
                    size={navIconSize}
                    color={isActive ? C.accent : C.t3}
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
