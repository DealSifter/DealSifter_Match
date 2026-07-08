import React, { useEffect, useMemo, useRef, useState } from 'react';
import { C } from '../../theme/colors';
import { useTheme } from '../../theme/hooks';
import { useLang, useT, setLang } from '../../i18n/translations';
import { DealSifterLogo } from '../ui/DealSifterLogo';
import { NuggetBadge } from '../ui/NuggetBadge';
import { Icon } from '../ui/Icon';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import appLogo from '../../assets/logo.png';
import { getLogoSrc, getThemeToggleTarget } from '../../services/themeService';
import feedMatchIcon from '../../assets/feed-match-icon.png';
import mapViewTaskbarIcon from '../../assets/taskbar-mapview-icon.png';
import matchesTaskbarIcon from '../../assets/taskbar-matches-icon.png';
import { useGuideTips } from '../guidetips/useGuideTips';

const LANGS = [
  { code: 'en-US', label: 'EN' },
  { code: 'pt-BR', label: 'PT' },
  { code: 'es-ES', label: 'ES' },
];

function LangPicker({ compact = false }) {
  const [open, setOpen] = useState(false);
  const currentLang = useLang('global');
  const cur = LANGS.find(l => l.code === currentLang) || LANGS[0];
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: compact ? '6px 8px' : '6px 10px', borderRadius: 16, background: 'transparent', border: '1px solid transparent', color: C.t2, fontSize: 12, cursor: 'pointer'
        }}
        onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
        onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
      >
        <span style={{ fontWeight: 700 }}>{cur.label}</span>
        <Icon name="chevDown" size={12} color={C.t2} />
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 6, zIndex: 999 }}>
          {LANGS.map(l => (
            <div key={l.code} onClick={() => { setLang(l.code); setOpen(false); }} style={{ padding: '6px 10px', cursor: 'pointer', color: C.t2, fontSize: 12, fontWeight: 700, lineHeight: 1.2 }}>{l.label}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function NavBtn({
  label,
  onClick,
  active,
  icon,
  iconImage,
  filled,
  minimal,
  iconColorOverride,
  iconColorActive,
  iconImageSize = 14,
  iconImageBold = false,
  labelWeight = 700,
  activeGlow = false,
}) {
  const iconColor = active
    ? (iconColorActive || iconColorOverride || C.accent)
    : (iconColorOverride || (filled ? C.bg : C.t2));
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: minimal ? '6px 8px' : '8px 12px', borderRadius: 8,
    border: filled ? `1px solid ${C.border}` : 'none', cursor: 'pointer', fontWeight: labelWeight,
    background: filled ? C.gold : 'transparent', color: iconColor,
    textShadow: active && activeGlow ? `0 0 8px ${C.alpha(iconColor, 0.55)}` : 'none',
  };

  return (
    <button onClick={onClick} style={base}>
      {iconImage ? (
        <span
          aria-hidden
          style={{
            display: 'inline-block',
            backgroundColor: iconColor,
            WebkitMaskImage: `url(${iconImage})`,
            WebkitMaskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center',
            WebkitMaskSize: 'contain',
            maskImage: `url(${iconImage})`,
            maskRepeat: 'no-repeat',
            maskPosition: 'center',
            maskSize: 'contain',
            width: iconImageSize,
            height: iconImageSize,
            filter: iconImageBold
              ? `${active && activeGlow ? `drop-shadow(0 0 8px ${C.alpha(iconColor, 0.6)}) ` : ''}drop-shadow(0 0 0 ${iconColor}) drop-shadow(0 0 0 ${iconColor}) drop-shadow(0 0 0 ${iconColor}) drop-shadow(0 0 0 ${iconColor})`
              : (active && activeGlow ? `drop-shadow(0 0 8px ${C.alpha(iconColor, 0.6)})` : 'none'),
          }}
        />
      ) : null}
      {!iconImage && icon && <Icon name={icon} size={14} color={iconColor} />}
      <span style={{ fontSize: 13 }}>{label}</span>
    </button>
  );
}

function SwipeableNotificationItem({
  item,
  children,
  onClick,
  onSwipeRight,
  onSwipeLeft,
  disabled = false,
}) {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ active: false, startX: 0, pointerId: null, moved: false });

  const reset = () => {
    dragRef.current.active = false;
    dragRef.current.pointerId = null;
    dragRef.current.moved = false;
    setDragX(0);
    setIsDragging(false);
  };

  const onPointerDown = (e) => {
    if (disabled) return;
    dragRef.current.active = true;
    dragRef.current.startX = e.clientX;
    dragRef.current.pointerId = e.pointerId;
    dragRef.current.moved = false;
    setIsDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (disabled || !dragRef.current.active) return;
    if (dragRef.current.pointerId !== null && e.pointerId !== dragRef.current.pointerId) return;
    const dx = e.clientX - dragRef.current.startX;
    if (Math.abs(dx) > 6) dragRef.current.moved = true;
    setDragX(Math.max(-120, Math.min(120, dx)));
  };

  const onPointerEnd = (e) => {
    if (disabled || !dragRef.current.active) return;
    if (dragRef.current.pointerId !== null && e.pointerId !== dragRef.current.pointerId) return;
    const dx = e.clientX - dragRef.current.startX;
    if (dx >= 72) onSwipeRight?.(item);
    else if (dx <= -72) onSwipeLeft?.(item);
    reset();
  };

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={reset}
      onClick={() => {
        if (disabled) return;
        if (dragRef.current.moved) return;
        onClick?.(item);
      }}
      style={{
        transform: `translateX(${dragX}px)`,
        transition: isDragging ? 'none' : 'transform .14s ease',
      }}
    >
      {children}
    </div>
  );
}

export function Navbar({ page, prevPage, setPage, nuggets = 0, setModal = () => {}, chatNotifications = [], systemNotifications = [], setSystemNotifications = () => {}, onOpenChatNotification = () => {}, onMarkChatNotificationRead = () => {}, onDeleteChatNotification = () => {}, onDeleteAllChatNotifications = () => {}, onDeleteSystemNotification = () => {}, onDeleteAllSystemNotifications = () => {}, onOpenAuthModal = () => {}, onOpenSettings = () => {}, onOpenAdmin = () => {}, onLogoutUser = () => {}, isAdmin = false, showInstallAppButton = false, onInstallApp = () => {}, userPreferences = null }) {
  const TABLET_PORTRAIT_QUERY = '(min-width: 768px) and (max-width: 1080px) and (orientation: portrait)';
  const isApp = page !== 'landing';
  const isLanding = page === 'landing';
  const allT = useT('global');
  const t = allT.nav;
  const guideT = allT.guideTips || {};
  const { enabled: guideTipsEnabled, toggle: toggleGuideTips } = useGuideTips();
  const { theme, effectiveTheme, toggleTheme } = useTheme();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifTab, setNotifTab] = useState('matches');
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isTabletPortrait = useMediaQuery(TABLET_PORTRAIT_QUERY);
  const [landingMenuOpen, setLandingMenuOpen] = useState(false);
  const [appMenuOpen, setAppMenuOpen] = useState(false);
  const [appNotifOpen, setAppNotifOpen] = useState(false);
  const [deferredChatIds, setDeferredChatIds] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('ds_notif_deferred_chat') || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch { return []; }
  });
  const [deferredSystemIds, setDeferredSystemIds] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('ds_notif_deferred_system') || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch { return []; }
  });
  const notifRef = useRef(null);
  const isCompactViewport = isMobile || isTabletPortrait;
  const isLandingCompact = isLanding && isCompactViewport;
  const isAppCompact = isApp && isCompactViewport;
  const isCompactTopbar = isLandingCompact || isAppCompact;
  const presenceStatus = String(userPreferences?.privacy?.presenceStatus || 'online');
  const presenceColor = presenceStatus === 'standby' ? '#facc15' : (presenceStatus === 'offline' ? '#ef4444' : '#22c55e');
  const allowMessagePreview = Boolean(userPreferences?.privacy?.messagePreview ?? true);
  const useImageLogoInHeader = isMobile;
  const visualTheme = effectiveTheme || theme || 'light';
  const themeToggleTarget = getThemeToggleTarget(visualTheme);
  const themeToggleLabel = themeToggleTarget === 'light'
    ? (t.themeToLight || 'Enable light mode')
    : (t.themeToDark || 'Enable dark mode');
  const themeToggleIcon = themeToggleTarget === 'light' ? 'sun' : 'moon';
  const headerIconButtonStyle = {
    width: 34,
    height: 34,
    borderRadius: 999,
    border: 'none',
    background: 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    position: 'relative',
    padding: 0,
  };

  const systemUnreadCount = useMemo(
    () => (systemNotifications || []).filter((n) => !n.read).length,
    [systemNotifications],
  );
  const chatUnreadCount = useMemo(
    () => (chatNotifications || []).filter((n) => !n.read).reduce((sum, n) => sum + Math.max(1, Number(n?.count || 0)), 0),
    [chatNotifications],
  );
  const consolidatedCount = chatUnreadCount + systemUnreadCount;
  const visibleChatNotifications = useMemo(
    () => (chatNotifications || []).filter((n) => !deferredChatIds.includes(String(n.id))),
    [chatNotifications, deferredChatIds],
  );
  const visibleSystemNotifications = useMemo(
    () => (systemNotifications || []).filter((n) => !deferredSystemIds.includes(String(n.id))),
    [systemNotifications, deferredSystemIds],
  );

  useEffect(() => {
    try { localStorage.setItem('ds_notif_deferred_chat', JSON.stringify(deferredChatIds)); } catch { /* noop */ }
  }, [deferredChatIds]);

  useEffect(() => {
    try { localStorage.setItem('ds_notif_deferred_system', JSON.stringify(deferredSystemIds)); } catch { /* noop */ }
  }, [deferredSystemIds]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (!notifRef.current) return;
      if (!notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (!landingMenuOpen && !appMenuOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setLandingMenuOpen(false);
      if (event.key === 'Escape') {
        setAppMenuOpen(false);
        setAppNotifOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [landingMenuOpen, appMenuOpen]);

  const markSystemAsRead = () => {
    setSystemNotifications((prev) => (prev || []).map((n) => ({ ...n, read: true })));
    setDeferredSystemIds([]);
  };

  const deferChatNotification = (item) => {
    const id = String(item?.id || '');
    if (!id) return;
    setDeferredChatIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const deferSystemNotification = (item) => {
    const id = String(item?.id || '');
    if (!id) return;
    setDeferredSystemIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const markChatNotificationRead = (item) => {
    if (!item?.ownerId) return;
    onMarkChatNotificationRead(item);
    const id = String(item?.id || '');
    if (id) setDeferredChatIds((prev) => prev.filter((x) => x !== id));
  };

  const deleteChatNotification = (item) => {
    if (!item || item.id === 'empty-matches') return;
    onDeleteChatNotification(item);
    const id = String(item?.id || '');
    if (id) setDeferredChatIds((prev) => prev.filter((x) => x !== id));
  };

  const deleteSystemNotification = (item) => {
    if (!item || item.id === 'empty-system') return;
    onDeleteSystemNotification(item);
    const id = String(item?.id || '');
    if (id) setDeferredSystemIds((prev) => prev.filter((x) => x !== id));
  };

  const deleteAllVisibleNotifications = () => {
    if (notifTab === 'matches') {
      onDeleteAllChatNotifications();
      setDeferredChatIds([]);
    } else {
      onDeleteAllSystemNotifications();
      setDeferredSystemIds([]);
    }
  };

  const markSystemNotificationRead = (item) => {
    const id = String(item?.id || '');
    if (!id) return;
    setSystemNotifications((prev) => (prev || []).map((n) => (
      String(n.id) === id ? { ...n, read: true } : n
    )));
    setDeferredSystemIds((prev) => prev.filter((x) => x !== id));
  };

  const openSystemNotification = (item) => {
    if (!item || item.id === 'empty-system') return;
    markSystemNotificationRead(item);
    if (item.source === 'support_notification') {
      onOpenChatNotification(item);
      setAppMenuOpen(false);
      setAppNotifOpen(false);
      setNotifOpen(false);
    }
  };

  const openLandingAuth = (tab) => {
    setLandingMenuOpen(false);
    onOpenAuthModal(tab);
  };

  const openLandingPricing = () => {
    setLandingMenuOpen(false);
    setPage && setPage('pricing');
  };

  const openAppSettings = () => {
    setAppMenuOpen(false);
    setAppNotifOpen(false);
    onOpenSettings();
  };

  const openAppPricing = () => {
    setAppMenuOpen(false);
    setAppNotifOpen(false);
    setPage && setPage('pricing');
  };

  const openAppAdmin = () => {
    setAppMenuOpen(false);
    setAppNotifOpen(false);
    onOpenAdmin();
  };

  const logoutUserFromMenu = async () => {
    setAppMenuOpen(false);
    setAppNotifOpen(false);
    await onLogoutUser();
  };

  const openChatNotificationFromMenu = (item) => {
    const id = String(item?.id || '');
    if (id) setDeferredChatIds((prev) => prev.filter((x) => x !== id));
    onOpenChatNotification(item);
    setAppMenuOpen(false);
    setAppNotifOpen(false);
  };

  // If visiting pricing from landing, hide navbar as before
  if (page === 'pricing' && prevPage === 'landing') return null;

  // Homepage mobile: keep logo + language picker + hamburger on the top bar.
  return (
    <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10000, background: C.card, borderBottom: `1px solid ${C.border}` }}>
      <div style={{ maxWidth: '100%', margin: '0 auto', padding: isCompactTopbar ? '0 12px' : '0 4%', height: 58, display: 'grid', gridTemplateColumns: isCompactTopbar ? '1fr auto' : '1fr auto 1fr', alignItems: 'center', gap: isCompactTopbar ? 10 : 20 }}>

        {/* Left: Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifySelf: 'start' }}>
          <div className="logo-general" data-logo="general" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => setPage && setPage('landing')}>
            {useImageLogoInHeader ? (
              <img
                src={getLogoSrc(isLanding ? 'light' : visualTheme, 'mobile')}
                alt="DealSifter Match"
                style={{ height: 44, width: 'auto', display: 'block' }}
                onError={(e) => {
                  // Fallback while custom theme logo files are not present in /public.
                  e.currentTarget.src = appLogo;
                }}
              />
            ) : (
              <>
                <div className="logo-image" style={{ display: 'inline-block' }}>
                  <DealSifterLogo size={42} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
                  <div className="logo-text" style={{ position: 'relative', display: 'inline-block' }}>
                    <span className="logo-text-main" style={{
                      fontFamily: "'Eras Bold ITC', 'Eras ITC', sans-serif",
                      fontWeight: 800,
                      fontSize: 28.71,
                      color: C.t1,
                      letterSpacing: '-0.5px'
                    }}>
                      <span className="logo-text-deal">Deal</span><span className="logo-text-sifter" style={{ color: C.accent }}>Sifter</span>
                    </span>
                    <span className="logo-match" aria-hidden="true" style={{
                      position: 'absolute',
                      top: -5,
                      right: -25,
                      fontSize: 9.6,
                      fontStyle: 'italic',
                      color: C.gold,
                      textTransform: 'uppercase',
                      fontWeight: 700,
                      textShadow: '0.5px 0.5px 1px rgba(0,0,0,0.9)'
                    }}>Match</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Center: Main nav (desktop) */}
        {isCompactTopbar ? null : isApp ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifySelf: 'center' }}>
            <NavBtn iconImage={mapViewTaskbarIcon} iconImageSize={18} iconImageBold iconColorOverride={C.t2} iconColorActive={C.accent} labelWeight={700} label={t.mapView} onClick={() => setPage && setPage('mapview')} active={page === 'mapview'} />
            <NavBtn iconImage={feedMatchIcon} iconImageSize={18} iconImageBold iconColorOverride={C.t2} iconColorActive={C.accent} labelWeight={700} label={t.feed} onClick={() => setPage && setPage('dashboard')} active={page === 'dashboard'} />
            <NavBtn iconImage={matchesTaskbarIcon} iconImageSize={18} iconImageBold iconColorOverride={C.t2} iconColorActive={C.accent} labelWeight={700} label={t.matches} onClick={() => setPage && setPage('matches')} active={page === 'matches'} />
            <NavBtn icon="creditCard" label={t.pricing} onClick={() => setPage && setPage('pricing')} active={page === 'pricing'} />
            {isAdmin ? (
              <NavBtn icon="shield" label={t.adminSystem || 'Adm.System'} onClick={onOpenAdmin} active={page === 'admin'} />
            ) : null}
          </div>
        ) : (
          <div />
        )}

        {/* Right: actions */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifySelf: 'end' }}>
          {isApp ? (
            isAppCompact ? (
              <>
                <NuggetBadge count={nuggets} onClick={() => setModal && setModal('store')} />
                <button
                  onClick={() => setAppMenuOpen((value) => !value)}
                  title={t.menu || 'Menu'}
                  aria-label={t.menu || 'Menu'}
                  aria-expanded={appMenuOpen}
                  aria-controls="app-mobile-menu"
                  style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}
                >
                  <Icon name={appMenuOpen ? 'close' : 'menu'} size={16} color={C.t2} />
                  <span style={{ position: 'absolute', top: -3, left: -3, width: 9, height: 9, borderRadius: 999, background: presenceColor, border: `1px solid ${C.card}` }} />
                  {!appMenuOpen && consolidatedCount > 0 ? (
                    <span style={{ position: 'absolute', top: -5, right: -5, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, background: C.danger, color: '#fff', fontSize: 9, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                      {consolidatedCount > 99 ? '99+' : consolidatedCount}
                    </span>
                  ) : null}
                </button>

                {appMenuOpen ? (
                  <>
                    <button
                      onClick={() => {
                        setAppMenuOpen(false);
                        setAppNotifOpen(false);
                      }}
                      aria-label={t.close || 'Close'}
                      style={{ position: 'fixed', top: 58, left: 0, right: 0, bottom: 0, border: 'none', background: 'rgba(15, 23, 42, 0.3)', zIndex: 10005, cursor: 'pointer' }}
                    />

                    <div
                      id="app-mobile-menu"
                      role="dialog"
                      aria-modal="true"
                      aria-label={t.menu || 'Menu'}
                      style={{ position: 'fixed', top: 58, right: 0, bottom: 0, width: 'min(86vw, 340px)', background: C.card, borderLeft: `1px solid ${C.border}`, boxShadow: '-10px 0 24px rgba(15,23,42,0.12)', zIndex: 10006, padding: '16px 14px 22px', display: 'grid', alignContent: 'start', gap: 10, overflowY: 'auto' }}
                    >
                      {appNotifOpen ? (
                        <>
                          <button
                            onClick={() => setAppNotifOpen(false)}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, borderRadius: 10, border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, fontWeight: 700, fontSize: 14, padding: '10px 12px', cursor: 'pointer' }}
                          >
                            <Icon name="back" size={14} color={C.t2} />
                            <span>{t.back || 'Back'}</span>
                          </button>

                          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.t3 }}>
                            {t.notificationsTitle || 'Notifications'}
                          </div>

                          <div style={{ display: 'flex', gap: 6, padding: 8, border: `1px solid ${C.border}`, borderRadius: 10 }}>
                            <button onClick={() => setNotifTab('matches')} style={{ flex: 1, border: `1px solid ${notifTab === 'matches' ? C.accent : C.border}`, background: notifTab === 'matches' ? C.alpha(C.accent, 0.1) : 'transparent', color: notifTab === 'matches' ? C.accent : C.t2, borderRadius: 8, padding: '8px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                              {(t.matchesMessagesTab || 'Matches Msgs')} ({chatNotifications?.length || 0})
                            </button>
                            <button onClick={() => setNotifTab('system')} style={{ flex: 1, border: `1px solid ${notifTab === 'system' ? C.accent : C.border}`, background: notifTab === 'system' ? C.alpha(C.accent, 0.1) : 'transparent', color: notifTab === 'system' ? C.accent : C.t2, borderRadius: 8, padding: '8px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                              {(t.systemMessagesTab || 'System Msgs')} ({systemNotifications?.length || 0})
                            </button>
                          </div>

                          {((notifTab === 'matches' && visibleChatNotifications?.length) || (notifTab === 'system' && visibleSystemNotifications?.length)) ? (
                            <button onClick={deleteAllVisibleNotifications} style={{ border: `1px solid ${C.border}`, background: 'transparent', color: C.danger || '#ef4444', borderRadius: 8, padding: '7px 10px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                              {t.deleteAll || 'Excluir todas'}
                            </button>
                          ) : null}

                          <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, background: C.alpha(C.bg, 0.3), padding: 8, display: 'grid', gap: 6, maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
                            {notifTab === 'matches' ? (
                              (visibleChatNotifications?.length ? visibleChatNotifications : [{ id: 'empty-matches', title: t.emptyMessagesTitle || 'No messages', message: t.emptyMessagesBody || 'No chat activity right now.' }]).map((item) => {
                                const clickable = Boolean(item?.ownerId);
                                return (
                                  <SwipeableNotificationItem
                                    key={item.id}
                                    item={item}
                                    disabled={!clickable}
                                    onClick={() => clickable && openChatNotificationFromMenu(item)}
                                    onSwipeRight={() => clickable && markChatNotificationRead(item)}
                                    onSwipeLeft={() => clickable && deferChatNotification(item)}
                                  >
                                    <div
                                      role={clickable ? 'button' : undefined}
                                      tabIndex={clickable ? 0 : undefined}
                                      onKeyDown={(e) => {
                                        if (!clickable) return;
                                        if (e.key === 'Enter' || e.key === ' ') {
                                          e.preventDefault();
                                          openChatNotificationFromMenu(item);
                                        }
                                      }}
                                      style={{ border: `1px solid ${item.read ? C.border : C.accent}`, borderRadius: 8, padding: 10, cursor: clickable ? 'pointer' : 'default', background: item.read ? 'transparent' : C.alpha(C.accent, 0.06), position: 'relative' }}
                                    >
                                      {item.id !== 'empty-matches' ? (
                                        <button
                                          type="button"
                                          aria-label={t.delete || 'Delete'}
                                          onClick={(event) => { event.stopPropagation(); deleteChatNotification(item); }}
                                          style={{ position: 'absolute', top: 6, right: 6, border: 'none', background: 'transparent', color: C.t3, cursor: 'pointer', fontSize: 14, fontWeight: 900, lineHeight: 1 }}
                                        >
                                          x
                                        </button>
                                      ) : null}
                                      <div style={{ fontSize: 12, fontWeight: 700, color: C.t1 }}>{item.title}</div>
                                      <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>{item.message}</div>
                                    </div>
                                  </SwipeableNotificationItem>
                                );
                              })
                            ) : (
                              (visibleSystemNotifications?.length ? visibleSystemNotifications : [{ id: 'empty-system', title: t.emptySystemTitle || 'No alerts', message: t.emptySystemBody || 'No system messages right now.', read: true }]).map((item) => {
                                const clickable = item.source === 'support_notification';
                                return (
                                  <SwipeableNotificationItem
                                    key={item.id}
                                    item={item}
                                    disabled={item.id === 'empty-system'}
                                    onSwipeRight={() => item.id !== 'empty-system' && markSystemNotificationRead(item)}
                                    onSwipeLeft={() => item.id !== 'empty-system' && deferSystemNotification(item)}
                                  >
                                    <div
                                      role={clickable ? 'button' : undefined}
                                      tabIndex={clickable ? 0 : undefined}
                                      onClick={() => clickable && openSystemNotification(item)}
                                      onKeyDown={(e) => {
                                        if (!clickable) return;
                                        if (e.key === 'Enter' || e.key === ' ') {
                                          e.preventDefault();
                                          openSystemNotification(item);
                                        }
                                      }}
                                      style={{ border: `1px solid ${item.read ? C.border : C.accent}`, borderRadius: 8, padding: 10, background: item.read ? 'transparent' : C.alpha(C.accent, 0.06), cursor: clickable ? 'pointer' : 'default', position: 'relative' }}
                                    >
                                      {item.id !== 'empty-system' ? (
                                        <button
                                          type="button"
                                          aria-label={t.delete || 'Delete'}
                                          onClick={(event) => { event.stopPropagation(); deleteSystemNotification(item); }}
                                          style={{ position: 'absolute', top: 6, right: 6, border: 'none', background: 'transparent', color: C.t3, cursor: 'pointer', fontSize: 14, fontWeight: 900, lineHeight: 1 }}
                                        >
                                          x
                                        </button>
                                      ) : null}
                                      <div style={{ fontSize: 12, fontWeight: 700, color: C.t1 }}>{item.title}</div>
                                      <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>{item.message}</div>
                                    </div>
                                  </SwipeableNotificationItem>
                                );
                              })
                            )}
                            {notifTab === 'system' && systemUnreadCount > 0 ? (
                              <button onClick={markSystemAsRead} style={{ border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, borderRadius: 8, padding: '8px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginTop: 4 }}>
                                {t.markAllRead || t.markSystemRead || 'Mark all as read'}
                              </button>
                            ) : null}
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.t3, marginBottom: 4 }}>
                            {t.profile || 'Profile'}
                          </div>

                          <button onClick={openAppSettings} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, borderRadius: 10, border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, fontWeight: 700, fontSize: 14, padding: '10px 12px', cursor: 'pointer' }}>
                            <Icon name="user" size={15} color={C.t2} />
                            <span>{t.editProfile || 'Edit profile'}</span>
                          </button>

                          <button
                            onClick={() => setAppNotifOpen(true)}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderRadius: 10, border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, fontWeight: 700, fontSize: 14, padding: '10px 12px', cursor: 'pointer' }}
                          >
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                              <Icon name="bell" size={15} color={C.t2} />
                              <span>{t.notificationsTitle || 'Notifications'}</span>
                            </span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                              {consolidatedCount > 0 ? (
                                <span style={{ minWidth: 18, height: 18, padding: '0 4px', borderRadius: 999, background: C.danger, color: '#fff', fontSize: 10, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                                  {consolidatedCount > 99 ? '99+' : consolidatedCount}
                                </span>
                              ) : null}
                              <Icon name="arrowRight" size={14} color={C.t2} />
                            </span>
                          </button>

                          <button
                            onClick={toggleGuideTips}
                            aria-pressed={guideTipsEnabled}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, borderRadius: 10, border: `1px solid ${guideTipsEnabled ? C.gold : C.border}`, background: guideTipsEnabled ? C.alpha(C.gold, 0.14) : 'transparent', color: guideTipsEnabled ? C.gold : C.t2, fontWeight: 800, fontSize: 14, padding: '10px 12px', cursor: 'pointer' }}
                          >
                            <Icon name="lightbulb" size={15} color={guideTipsEnabled ? C.gold : C.t2} strokeWidth={2} />
                            <span>{guideTipsEnabled ? (guideT.turnOff || 'Turn off GuideTips') : (guideT.turnOn || 'GuideTips')}</span>
                          </button>

                          <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderRadius: 10, border: `1px solid ${C.border}`, color: C.t2, fontWeight: 700, fontSize: 14, padding: '10px 12px' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                              <Icon name="globe" size={15} color={C.t2} />
                              <span>{t.language || 'Language'}</span>
                            </span>
                            <LangPicker compact />
                          </div>

                          <button onClick={toggleTheme} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, borderRadius: 10, border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, fontWeight: 700, fontSize: 14, padding: '10px 12px', cursor: 'pointer' }}>
                            <Icon name={themeToggleIcon} size={15} color={C.t2} />
                            <span>{themeToggleLabel}</span>
                          </button>

                          {showInstallAppButton ? (
                            <button onClick={onInstallApp} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, borderRadius: 10, border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, fontWeight: 700, fontSize: 14, padding: '10px 12px', cursor: 'pointer' }}>
                              <Icon name="installDevice" size={17} color={C.t2} strokeWidth={1.7} />
                              <span>{t.installToHome || 'Add to Home Screen'}</span>
                            </button>
                          ) : null}

                          <button onClick={openAppPricing} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, borderRadius: 10, border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, fontWeight: 700, fontSize: 14, padding: '10px 12px', cursor: 'pointer' }}>
                            <Icon name="creditCard" size={15} color={C.t2} />
                            <span>{t.pricing}</span>
                          </button>

                          <button onClick={logoutUserFromMenu} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, borderRadius: 10, border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, fontWeight: 700, fontSize: 14, padding: '10px 12px', cursor: 'pointer' }}>
                            <Icon name="logOut" size={15} color={C.t2} />
                            <span>{t.logout || 'Sign out'}</span>
                          </button>

                          {isAdmin ? (
                            <button onClick={openAppAdmin} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, borderRadius: 10, border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, fontWeight: 700, fontSize: 14, padding: '10px 12px', cursor: 'pointer' }}>
                              <Icon name="shield" size={15} color={C.t2} />
                              <span>{t.adminSystem || 'Adm.System'}</span>
                            </button>
                          ) : null}
                        </>
                      )}
                    </div>
                  </>
                ) : null}
              </>
            ) : (
              <>
                <button
                  onClick={toggleGuideTips}
                  title={guideTipsEnabled ? (guideT.turnOff || 'Turn off GuideTips') : (guideT.turnOn || 'GuideTips')}
                  aria-pressed={guideTipsEnabled}
                  style={headerIconButtonStyle}
                >
                  <span style={{ display: 'inline-flex', filter: guideTipsEnabled ? `drop-shadow(0 0 7px ${C.alpha(C.gold, 0.74)})` : 'none' }}>
                    <Icon name="lightbulb" size={18} color={guideTipsEnabled ? C.gold : C.t2} strokeWidth={2.2} />
                  </span>
                </button>
                <NuggetBadge count={nuggets} onClick={() => setModal && setModal('store')} />
                <div ref={notifRef} style={{ position: 'relative' }}>
                  <button
                    onClick={() => setNotifOpen((v) => !v)}
                    title={t.notificationsTitle || 'Notifications'}
                    style={headerIconButtonStyle}
                  >
                    <Icon name="bell" size={18} color={C.t2} strokeWidth={1.9} />
                    {consolidatedCount > 0 ? (
                      <span style={{ position: 'absolute', top: -5, right: -5, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, background: C.danger, color: '#fff', fontSize: 9, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                        {consolidatedCount > 99 ? '99+' : consolidatedCount}
                      </span>
                    ) : null}
                  </button>

                  {notifOpen ? (
                    <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 320, maxHeight: 360, overflow: 'auto', background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: '0 12px 30px rgba(0,0,0,0.12)', zIndex: 1200 }}>
                      <div style={{ display: 'flex', gap: 6, padding: 8, borderBottom: `1px solid ${C.border}` }}>
                        <button onClick={() => setNotifTab('matches')} style={{ flex: 1, border: `1px solid ${notifTab === 'matches' ? C.accent : C.border}`, background: notifTab === 'matches' ? C.alpha(C.accent, 0.1) : 'transparent', color: notifTab === 'matches' ? C.accent : C.t2, borderRadius: 8, padding: '6px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                          {(t.matchesMessagesTab || 'Matches Msgs')} ({chatNotifications?.length || 0})
                        </button>
                        <button onClick={() => setNotifTab('system')} style={{ flex: 1, border: `1px solid ${notifTab === 'system' ? C.accent : C.border}`, background: notifTab === 'system' ? C.alpha(C.accent, 0.1) : 'transparent', color: notifTab === 'system' ? C.accent : C.t2, borderRadius: 8, padding: '6px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                          {(t.systemMessagesTab || 'System Msgs')} ({systemNotifications?.length || 0})
                        </button>
                      </div>

                      <div style={{ padding: 8, display: 'grid', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
                        {((notifTab === 'matches' && visibleChatNotifications?.length) || (notifTab === 'system' && visibleSystemNotifications?.length)) ? (
                          <button onClick={deleteAllVisibleNotifications} style={{ border: `1px solid ${C.border}`, background: 'transparent', color: C.danger || '#ef4444', borderRadius: 8, padding: '6px 8px', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
                            {t.deleteAll || 'Excluir todas'}
                          </button>
                        ) : null}
                        {notifTab === 'matches' ? (
                          (visibleChatNotifications?.length ? visibleChatNotifications : [{ id: 'empty-matches', title: t.emptyMessagesTitle || 'No messages', message: t.emptyMessagesBody || 'No chat activity right now.' }]).map((item) => {
                            const clickable = Boolean(item?.ownerId);
                            return (
                              <SwipeableNotificationItem
                                key={item.id}
                                item={item}
                                disabled={!clickable}
                                onClick={() => {
                                  if (!clickable) return;
                                  const id = String(item?.id || '');
                                  if (id) setDeferredChatIds((prev) => prev.filter((x) => x !== id));
                                  onOpenChatNotification(item);
                                  setNotifOpen(false);
                                }}
                                onSwipeRight={() => clickable && markChatNotificationRead(item)}
                                onSwipeLeft={() => clickable && deferChatNotification(item)}
                              >
                                <div
                                  role={clickable ? 'button' : undefined}
                                  tabIndex={clickable ? 0 : undefined}
                                  onKeyDown={(e) => {
                                    if (!clickable) return;
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      const id = String(item?.id || '');
                                      if (id) setDeferredChatIds((prev) => prev.filter((x) => x !== id));
                                      onOpenChatNotification(item);
                                      setNotifOpen(false);
                                    }
                                  }}
                                  style={{ border: `1px solid ${item.read ? C.border : C.accent}`, borderRadius: 8, padding: 8, cursor: clickable ? 'pointer' : 'default', background: item.read ? 'transparent' : C.alpha(C.accent, 0.06), position: 'relative' }}
                                >
                                  {item.id !== 'empty-matches' ? (
                                    <button
                                      type="button"
                                      aria-label={t.delete || 'Delete'}
                                      onClick={(event) => { event.stopPropagation(); deleteChatNotification(item); }}
                                      style={{ position: 'absolute', top: 5, right: 5, border: 'none', background: 'transparent', color: C.t3, cursor: 'pointer', fontSize: 13, fontWeight: 900, lineHeight: 1 }}
                                    >
                                      x
                                    </button>
                                  ) : null}
                                  <div style={{ fontSize: 11, fontWeight: 700, color: C.t1 }}>{item.title}</div>
                                  <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>{allowMessagePreview ? item.message : '•••'}</div>
                                </div>
                              </SwipeableNotificationItem>
                            );
                          })
                        ) : (
                          <>
                            {(visibleSystemNotifications?.length ? visibleSystemNotifications : [{ id: 'empty-system', title: t.emptySystemTitle || 'No alerts', message: t.emptySystemBody || 'No system messages right now.', read: true }]).map((item) => (
                              <SwipeableNotificationItem
                                key={item.id}
                                item={item}
                                disabled={item.id === 'empty-system'}
                                onSwipeRight={() => item.id !== 'empty-system' && markSystemNotificationRead(item)}
                                onSwipeLeft={() => item.id !== 'empty-system' && deferSystemNotification(item)}
                              >
                                <div
                                  role={item.source === 'support_notification' ? 'button' : undefined}
                                  tabIndex={item.source === 'support_notification' ? 0 : undefined}
                                  onClick={() => item.source === 'support_notification' && openSystemNotification(item)}
                                  onKeyDown={(e) => {
                                    if (item.source !== 'support_notification') return;
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      openSystemNotification(item);
                                    }
                                  }}
                                  style={{ border: `1px solid ${item.read ? C.border : C.accent}`, borderRadius: 8, padding: 8, background: item.read ? 'transparent' : C.alpha(C.accent, 0.06), cursor: item.source === 'support_notification' ? 'pointer' : 'default', position: 'relative' }}
                                >
                                  {item.id !== 'empty-system' ? (
                                    <button
                                      type="button"
                                      aria-label={t.delete || 'Delete'}
                                      onClick={(event) => { event.stopPropagation(); deleteSystemNotification(item); }}
                                      style={{ position: 'absolute', top: 5, right: 5, border: 'none', background: 'transparent', color: C.t3, cursor: 'pointer', fontSize: 13, fontWeight: 900, lineHeight: 1 }}
                                    >
                                      x
                                    </button>
                                  ) : null}
                                  <div style={{ fontSize: 11, fontWeight: 700, color: C.t1 }}>{item.title}</div>
                                  <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>{allowMessagePreview ? item.message : '•••'}</div>
                                </div>
                              </SwipeableNotificationItem>
                            ))}
                            {systemUnreadCount > 0 ? (
                              <button onClick={markSystemAsRead} style={{ border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, borderRadius: 8, padding: '6px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                                {t.markSystemRead || 'Mark system as read'}
                              </button>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
                <LangPicker />
                <button onClick={toggleTheme} title={themeToggleLabel} style={headerIconButtonStyle}>
                  <Icon name={themeToggleIcon} size={18} color={C.t2} strokeWidth={1.9} />
                </button>
                <button
                  onClick={onOpenSettings}
                  title={t.editProfile || 'Edit profile'}
                  style={headerIconButtonStyle}
                >
                  <Icon name="user" size={19} color={C.t2} strokeWidth={1.9} />
                </button>
              </>
            )
          ) : (
            isLandingCompact ? (
              <>
                <LangPicker compact />
                <button
                  onClick={() => setLandingMenuOpen((value) => !value)}
                  title={t.menu || 'Menu'}
                  aria-label={t.menu || 'Menu'}
                  aria-expanded={landingMenuOpen}
                  aria-controls="landing-mobile-menu"
                  style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <Icon name={landingMenuOpen ? 'close' : 'menu'} size={16} color={C.t2} />
                </button>

                {landingMenuOpen ? (
                  <>
                    <button
                      onClick={() => setLandingMenuOpen(false)}
                      aria-label={t.close || 'Close'}
                      style={{ position: 'fixed', top: 58, left: 0, right: 0, bottom: 0, border: 'none', background: 'rgba(15, 23, 42, 0.3)', zIndex: 10005, cursor: 'pointer' }}
                    />

                    <div
                      id="landing-mobile-menu"
                      role="dialog"
                      aria-modal="true"
                      aria-label={t.menu || 'Menu'}
                      style={{ position: 'fixed', top: 58, right: 0, bottom: 0, width: 'min(84vw, 320px)', background: C.card, borderLeft: `1px solid ${C.border}`, boxShadow: '-10px 0 24px rgba(15,23,42,0.12)', zIndex: 10006, padding: '16px 14px 22px', display: 'grid', alignContent: 'start', gap: 10 }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.t3, marginBottom: 6 }}>
                        Navigation
                      </div>
                      <button onClick={openLandingPricing} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, borderRadius: 10, border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, fontWeight: 700, fontSize: 14, padding: '10px 12px', cursor: 'pointer' }}>
                        <Icon name="creditCard" size={15} color={C.t2} />
                        <span>{t.pricing}</span>
                      </button>
                      {showInstallAppButton ? (
                        <button onClick={onInstallApp} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, borderRadius: 10, border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, fontWeight: 700, fontSize: 14, padding: '10px 12px', cursor: 'pointer' }}>
                          <Icon name="installDevice" size={17} color={C.t2} strokeWidth={1.7} />
                          <span>{t.installToHome || 'Add to Home Screen'}</span>
                        </button>
                      ) : null}
                      <button onClick={() => openLandingAuth('login')} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, borderRadius: 10, border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, fontWeight: 700, fontSize: 14, padding: '10px 12px', cursor: 'pointer' }}>
                        <Icon name="user" size={15} color={C.t2} />
                        <span>{t.signIn}</span>
                      </button>
                      <button onClick={() => openLandingAuth('signup')} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 10, border: `1px solid ${C.gold}`, background: C.gold, color: C.bg, fontWeight: 800, fontSize: 14, padding: '11px 12px', cursor: 'pointer', marginTop: 2 }}>
                        <Icon name="heart" size={15} color={C.bg} />
                        <span>{t.getStarted}</span>
                      </button>
                    </div>
                  </>
                ) : null}
              </>
            ) : (
              <>
                <LangPicker />
                <NavBtn label={t.pricing} onClick={() => setPage && setPage('pricing')} />
                <NavBtn label={t.signIn} onClick={() => onOpenAuthModal('login')} />
                <NavBtn label={t.getStarted} onClick={() => onOpenAuthModal('signup')} />
              </>
            )
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
