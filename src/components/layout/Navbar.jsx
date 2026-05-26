import React, { useEffect, useMemo, useRef, useState } from 'react';
import { C } from '../../theme/colors';
import { useTheme } from '../../theme/hooks';
import { useLang, useT, setLang } from '../../i18n/translations';
import { DealSifterLogo } from '../ui/DealSifterLogo';
import { NuggetBadge } from '../ui/NuggetBadge';
import { Icon } from '../ui/Icon';
import appLogo from '../../assets/logo.png';
import logoLightTheme from '../../assets/logo-light-theme.jpg';
import logoDarkTheme from '../../assets/logo-dark-theme.jpg';

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

function NavBtn({ label, onClick, active, icon, filled, minimal }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: minimal ? '6px 8px' : '8px 12px', borderRadius: 8,
    border: filled ? `1px solid ${C.border}` : 'none', cursor: 'pointer', fontWeight: 700,
    background: filled ? C.gold : 'transparent', color: filled ? C.bg : (active ? C.accent : C.t2)
  };

  return (
    <button onClick={onClick} style={base}>
      {icon && <Icon name={icon} size={14} color={filled ? C.bg : (active ? C.accent : C.t2)} />}
      <span style={{ fontSize: 13 }}>{label}</span>
    </button>
  );
}

export function Navbar({ page, prevPage, setPage, nuggets = 0, setModal = () => {}, chatNotifications = [], systemNotifications = [], setSystemNotifications = () => {}, onOpenChatNotification = () => {}, onOpenAuthModal = () => {}, onOpenSettings = () => {}, onOpenAdmin = () => {}, onLogoutUser = () => {}, isAdmin = false, showInstallAppButton = false, onInstallApp = () => {} }) {
  const TABLET_PORTRAIT_QUERY = '(min-width: 768px) and (max-width: 1080px) and (orientation: portrait)';
  const isApp = page !== 'landing';
  const isLanding = page === 'landing';
  const allT = useT('global');
  const t = allT.nav;
  const { theme, toggleTheme } = useTheme();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifTab, setNotifTab] = useState('matches');
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(max-width: 767px)').matches;
  });
  const [isTabletPortrait, setIsTabletPortrait] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(TABLET_PORTRAIT_QUERY).matches;
  });
  const [landingMenuOpen, setLandingMenuOpen] = useState(false);
  const [appMenuOpen, setAppMenuOpen] = useState(false);
  const [appNotifOpen, setAppNotifOpen] = useState(false);
  const notifRef = useRef(null);
  const isCompactViewport = isMobile || isTabletPortrait;
  const isLandingCompact = isLanding && isCompactViewport;
  const isAppCompact = isApp && isCompactViewport;
  const isCompactTopbar = isLandingCompact || isAppCompact;
  const useImageLogoInHeader = isMobile;
  const compactDarkLogoSrc = logoDarkTheme;
  const compactLightLogoSrc = logoLightTheme;

  const systemUnreadCount = useMemo(
    () => (systemNotifications || []).filter((n) => !n.read).length,
    [systemNotifications],
  );
  const consolidatedCount = (chatNotifications?.length || 0) + systemUnreadCount;

  useEffect(() => {
    const onClickOutside = (e) => {
      if (!notifRef.current) return;
      if (!notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const handleViewportChange = (event) => setIsMobile(Boolean(event.matches));

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
    if (isCompactViewport) return;
    setLandingMenuOpen(false);
    setAppMenuOpen(false);
    setAppNotifOpen(false);
    setNotifOpen(false);
  }, [isCompactViewport]);

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

  useEffect(() => {
    if (!appMenuOpen) return;
    const timer = window.setTimeout(() => setAppNotifOpen(false), 0);
    return () => window.clearTimeout(timer);
  }, [page, appMenuOpen]);

  const markSystemAsRead = () => {
    setSystemNotifications((prev) => (prev || []).map((n) => ({ ...n, read: true })));
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
                src={theme === 'dark' ? compactDarkLogoSrc : compactLightLogoSrc}
                alt="DealSifter Match"
                style={{ height: 34, width: 'auto', display: 'block' }}
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
            <NavBtn icon="mapPin" label={t.mapView} onClick={() => setPage && setPage('mapview')} active={page === 'mapview'} />
            <NavBtn icon="grid" label={t.feed} onClick={() => setPage && setPage('dashboard')} active={page === 'dashboard'} />
            <NavBtn icon="chat" label={t.matches} onClick={() => setPage && setPage('matches')} active={page === 'matches'} />
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
                {showInstallAppButton ? (
                  <button
                    onClick={onInstallApp}
                    title="Adicionar à Tela"
                    aria-label="Adicionar à Tela"
                    style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  >
                    <Icon name="download" size={15} color={C.t2} />
                  </button>
                ) : null}
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
                      <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.t3, marginBottom: 4 }}>
                        {t.profile || 'Profile'}
                      </div>

                      <button
                        onClick={() => setAppNotifOpen((value) => !value)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderRadius: 10, border: `1px solid ${appNotifOpen ? C.accent : C.border}`, background: appNotifOpen ? C.alpha(C.accent, 0.08) : 'transparent', color: appNotifOpen ? C.accent : C.t2, fontWeight: 700, fontSize: 14, padding: '10px 12px', cursor: 'pointer' }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <Icon name="bell" size={15} color={appNotifOpen ? C.accent : C.t2} />
                          <span>{t.notificationsTitle || 'Notifications'}</span>
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          {consolidatedCount > 0 ? (
                            <span style={{ minWidth: 18, height: 18, padding: '0 4px', borderRadius: 999, background: C.danger, color: '#fff', fontSize: 10, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                              {consolidatedCount > 99 ? '99+' : consolidatedCount}
                            </span>
                          ) : null}
                          <Icon name={appNotifOpen ? 'chevUp' : 'chevDown'} size={14} color={appNotifOpen ? C.accent : C.t2} />
                        </span>
                      </button>

                      {appNotifOpen ? (
                        <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, background: C.alpha(C.bg, 0.3), overflow: 'hidden' }}>
                          <div style={{ display: 'flex', gap: 6, padding: 8, borderBottom: `1px solid ${C.border}` }}>
                            <button onClick={() => setNotifTab('matches')} style={{ flex: 1, border: `1px solid ${notifTab === 'matches' ? C.accent : C.border}`, background: notifTab === 'matches' ? C.alpha(C.accent, 0.1) : 'transparent', color: notifTab === 'matches' ? C.accent : C.t2, borderRadius: 8, padding: '6px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                              {(t.matchesMessagesTab || 'Matches Msgs')} ({chatNotifications?.length || 0})
                            </button>
                            <button onClick={() => setNotifTab('system')} style={{ flex: 1, border: `1px solid ${notifTab === 'system' ? C.accent : C.border}`, background: notifTab === 'system' ? C.alpha(C.accent, 0.1) : 'transparent', color: notifTab === 'system' ? C.accent : C.t2, borderRadius: 8, padding: '6px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                              {(t.systemMessagesTab || 'System Msgs')} ({systemUnreadCount})
                            </button>
                          </div>

                          <div style={{ padding: 8, display: 'grid', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
                            {notifTab === 'matches' ? (
                              (chatNotifications?.length ? chatNotifications : [{ id: 'empty-matches', title: t.emptyMessagesTitle || 'No messages', message: t.emptyMessagesBody || 'No chat activity right now.' }]).map((item) => {
                                const clickable = Boolean(item?.ownerId);
                                return (
                                  <div
                                    key={item.id}
                                    onClick={() => {
                                      if (!clickable) return;
                                      openChatNotificationFromMenu(item);
                                    }}
                                    role={clickable ? 'button' : undefined}
                                    tabIndex={clickable ? 0 : undefined}
                                    onKeyDown={(e) => {
                                      if (!clickable) return;
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        openChatNotificationFromMenu(item);
                                      }
                                    }}
                                    style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 8, cursor: clickable ? 'pointer' : 'default', background: clickable ? C.alpha(C.accent, 0.03) : 'transparent' }}
                                  >
                                    <div style={{ fontSize: 11, fontWeight: 700, color: C.t1 }}>{item.title}</div>
                                    <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>{item.message}</div>
                                  </div>
                                );
                              })
                            ) : (
                              <>
                                {(systemNotifications?.length ? systemNotifications : [{ id: 'empty-system', title: t.emptySystemTitle || 'No alerts', message: t.emptySystemBody || 'No system messages right now.', read: true }]).map((item) => (
                                  <div key={item.id} style={{ border: `1px solid ${item.read ? C.border : C.accent}`, borderRadius: 8, padding: 8, background: item.read ? 'transparent' : C.alpha(C.accent, 0.06) }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: C.t1 }}>{item.title}</div>
                                    <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>{item.message}</div>
                                  </div>
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

                      <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderRadius: 10, border: `1px solid ${C.border}`, color: C.t2, fontWeight: 700, fontSize: 14, padding: '10px 12px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <Icon name="globe" size={15} color={C.t2} />
                          <span>{t.language || 'Language'}</span>
                        </span>
                        <LangPicker compact />
                      </div>

                      <button onClick={toggleTheme} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, borderRadius: 10, border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, fontWeight: 700, fontSize: 14, padding: '10px 12px', cursor: 'pointer' }}>
                        <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15} color={C.t2} />
                        <span>{theme === 'dark' ? (t.themeToLight || 'Enable light mode') : (t.themeToDark || 'Enable dark mode')}</span>
                      </button>

                      <button onClick={openAppSettings} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, borderRadius: 10, border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, fontWeight: 700, fontSize: 14, padding: '10px 12px', cursor: 'pointer' }}>
                        <Icon name="user" size={15} color={C.t2} />
                        <span>{t.editProfile || 'Edit profile'}</span>
                      </button>

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
                    </div>
                  </>
                ) : null}
              </>
            ) : (
              <>
                <NuggetBadge count={nuggets} onClick={() => setModal && setModal('store')} />
                <div ref={notifRef} style={{ position: 'relative' }}>
                  <button
                    onClick={() => setNotifOpen((v) => !v)}
                    title={t.notificationsTitle || 'Notifications'}
                    style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}
                  >
                    <Icon name="bell" size={16} color={C.t2} />
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
                          {(t.systemMessagesTab || 'System Msgs')} ({systemUnreadCount})
                        </button>
                      </div>

                      <div style={{ padding: 8, display: 'grid', gap: 6 }}>
                        {notifTab === 'matches' ? (
                          (chatNotifications?.length ? chatNotifications : [{ id: 'empty-matches', title: t.emptyMessagesTitle || 'No messages', message: t.emptyMessagesBody || 'No chat activity right now.' }]).map((item) => {
                            const clickable = Boolean(item?.ownerId);
                            return (
                              <div
                                key={item.id}
                                onClick={() => {
                                  if (!clickable) return;
                                  onOpenChatNotification(item);
                                  setNotifOpen(false);
                                }}
                                role={clickable ? 'button' : undefined}
                                tabIndex={clickable ? 0 : undefined}
                                onKeyDown={(e) => {
                                  if (!clickable) return;
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    onOpenChatNotification(item);
                                    setNotifOpen(false);
                                  }
                                }}
                                style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 8, cursor: clickable ? 'pointer' : 'default', background: clickable ? C.alpha(C.accent, 0.03) : 'transparent' }}
                              >
                                <div style={{ fontSize: 11, fontWeight: 700, color: C.t1 }}>{item.title}</div>
                                <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>{item.message}</div>
                              </div>
                            );
                          })
                        ) : (
                          <>
                            {(systemNotifications?.length ? systemNotifications : [{ id: 'empty-system', title: t.emptySystemTitle || 'No alerts', message: t.emptySystemBody || 'No system messages right now.', read: true }]).map((item) => (
                              <div key={item.id} style={{ border: `1px solid ${item.read ? C.border : C.accent}`, borderRadius: 8, padding: 8, background: item.read ? 'transparent' : C.alpha(C.accent, 0.06) }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: C.t1 }}>{item.title}</div>
                                <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>{item.message}</div>
                              </div>
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
                <button onClick={toggleTheme} title={theme === 'dark' ? (t.themeToLight || 'Enable light mode') : (t.themeToDark || 'Enable dark mode')} style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} color={C.t2} />
                </button>
                <button
                  onClick={onOpenSettings}
                  title={t.editProfile || 'Edit profile'}
                  style={{ width: 36, height: 36, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', opacity: 1 }}
                >
                  <Icon name="user" size={18} color={C.t2} />
                </button>
              </>
            )
          ) : (
            isLandingCompact ? (
              <>
                {showInstallAppButton ? (
                  <button
                    onClick={onInstallApp}
                    title="Adicionar à Tela"
                    aria-label="Adicionar à Tela"
                    style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  >
                    <Icon name="download" size={15} color={C.t2} />
                  </button>
                ) : null}
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
