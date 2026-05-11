import React from 'react';

// ── SVG Icon System (line-only, minimal) ─────────────────────────────────────
export const Icon = ({ name, size=18, color="currentColor", strokeWidth=1.5 }) => {
  const s = { width:size, height:size, display:"inline-block", flexShrink:0 };
  const p = { fill:"none", stroke:color, strokeWidth, strokeLinecap:"round", strokeLinejoin:"round" };
  const icons = {
    // Nav & UI
    menu:       <svg style={s} viewBox="0 0 24 24"><line {...p} x1="3" y1="6"  x2="21" y2="6"/><line {...p} x1="3" y1="12" x2="21" y2="12"/><line {...p} x1="3" y1="18" x2="21" y2="18"/></svg>,
    filter:     <svg style={s} viewBox="0 0 24 24"><polygon {...p} points="3 5 21 5 14 13 14 19 10 21 10 13 3 5"/></svg>,
    close:      <svg style={s} viewBox="0 0 24 24"><line {...p} x1="18" y1="6" x2="6" y2="18"/><line {...p} x1="6" y1="6" x2="18" y2="18"/></svg>,
    back:       <svg style={s} viewBox="0 0 24 24"><polyline {...p} points="15 18 9 12 15 6"/></svg>,
    chevDown:   <svg style={s} viewBox="0 0 24 24"><polyline {...p} points="6 9 12 15 18 9"/></svg>,
    chevUp:     <svg style={s} viewBox="0 0 24 24"><polyline {...p} points="18 15 12 9 6 15"/></svg>,
    send:       <svg style={s} viewBox="0 0 24 24"><line {...p} x1="22" y1="2" x2="11" y2="13"/><polygon {...p} points="22 2 15 22 11 13 2 9 22 2"/></svg>,
    copy:       <svg style={s} viewBox="0 0 24 24"><rect {...p} x="9" y="9" width="13" height="13" rx="2"/><path {...p} d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
    check:      <svg style={s} viewBox="0 0 24 24"><polyline {...p} points="20 6 9 17 4 12"/></svg>,
    // Locks
    lock:       <svg style={s} viewBox="0 0 24 24"><rect {...p} x="3" y="11" width="18" height="11" rx="2"/><path {...p} d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
    unlock:     <svg style={s} viewBox="0 0 24 24"><rect {...p} x="3" y="11" width="18" height="11" rx="2"/><path {...p} d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>,
    logOut:     <svg style={s} viewBox="0 0 24 24"><path {...p} d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline {...p} points="16 17 21 12 16 7"/><line {...p} x1="21" y1="12" x2="9" y2="12"/></svg>,
    // Contact
    phone:      <svg style={s} viewBox="0 0 24 24"><path {...p} d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11.5 19.79 19.79 0 0 1 1.58 2.92 2 2 0 0 1 3.55 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.73a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21.5 16a2 2 0 0 1 .5.92z"/></svg>,
    sms:        <svg style={s} viewBox="0 0 24 24"><path {...p} d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line {...p} x1="8" y1="9" x2="16" y2="9"/><line {...p} x1="8" y1="13" x2="13" y2="13"/></svg>,
    whatsapp:   <svg style={s} viewBox="0 0 24 24"><path {...p} d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>,
    telegram:   <svg style={s} viewBox="0 0 24 24"><path {...p} d="M21.5 4.5L3.9 11.3c-1 .4-.9 1.9.1 2.2l4.5 1.5 1.6 4.8c.3.9 1.5 1.1 2.1.4l2.6-3.2 4.6 3.4c.8.6 1.9.1 2.1-.9l2.9-13.4c.2-1.1-.9-1.9-1.9-1.6z"/><path {...p} d="M8.5 15l10-8.3"/><path {...p} d="M10.1 19.8l1.1-5.4"/></svg>,
    email:      <svg style={s} viewBox="0 0 24 24"><path {...p} d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline {...p} points="22,6 12,13 2,6"/></svg>,
    // People / profile
    user:       <svg style={s} viewBox="0 0 24 24"><path {...p} d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle {...p} cx="12" cy="7" r="4"/></svg>,
    // Categories
    house:      <svg style={s} viewBox="0 0 24 24"><path {...p} d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline {...p} points="9 22 9 12 15 12 15 22"/></svg>,
    trendUp:    <svg style={s} viewBox="0 0 24 24"><polyline {...p} points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline {...p} points="17 6 23 6 23 12"/></svg>,
    bank:       <svg style={s} viewBox="0 0 24 24"><line {...p} x1="3" y1="22" x2="21" y2="22"/><line {...p} x1="6" y1="18" x2="6" y2="11"/><line {...p} x1="10" y1="18" x2="10" y2="11"/><line {...p} x1="14" y1="18" x2="14" y2="11"/><line {...p} x1="18" y1="18" x2="18" y2="11"/><polygon {...p} points="12 2 20 7 4 7 12 2"/></svg>,
    key:        <svg style={s} viewBox="0 0 24 24"><path {...p} d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>,
    tool:       <svg style={s} viewBox="0 0 24 24"><path {...p} d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
    scale:      <svg style={s} viewBox="0 0 24 24"><line {...p} x1="12" y1="3" x2="12" y2="21"/><path {...p} d="M3 6l9 6 9-6"/><path {...p} d="M3 18l4-8h-8z"/><path {...p} d="M21 18l4-8h-8z" transform="translate(-4,0)"/><line {...p} x1="5" y1="21" x2="19" y2="21"/></svg>,
    briefcase:  <svg style={s} viewBox="0 0 24 24"><rect {...p} x="2" y="7" width="20" height="14" rx="2"/><path {...p} d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line {...p} x1="12" y1="12" x2="12" y2="12"/><line {...p} x1="2" y1="12" x2="22" y2="12"/></svg>,
    bell:       <svg style={s} viewBox="0 0 24 24"><path {...p} d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path {...p} d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
    camera:     <svg style={s} viewBox="0 0 24 24"><path {...p} d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle {...p} cx="12" cy="13" r="4"/></svg>,
    ruler:      <svg style={s} viewBox="0 0 24 24"><path {...p} d="M21.3 15.3a1 1 0 0 1 0 1.4l-2.6 2.6a1 1 0 0 1-1.4 0L2.7 5.7a1 1 0 0 1 0-1.4l2.6-2.6a1 1 0 0 1 1.4 0z"/><line {...p} x1="7.5" y1="7.5" x2="10" y2="10"/><line {...p} x1="10.5" y1="10.5" x2="13" y2="13"/><line {...p} x1="13.5" y1="13.5" x2="16" y2="16"/></svg>,
    doc:        <svg style={s} viewBox="0 0 24 24"><path {...p} d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline {...p} points="14 2 14 8 20 8"/><line {...p} x1="16" y1="13" x2="8" y2="13"/><line {...p} x1="16" y1="17" x2="8" y2="17"/><polyline {...p} points="10 9 9 9 8 9"/></svg>,
    pen:        <svg style={s} viewBox="0 0 24 24"><path {...p} d="M12 20h9"/><path {...p} d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
    home2:      <svg style={s} viewBox="0 0 24 24"><path {...p} d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path {...p} d="M9 22V12h6v10"/></svg>,
    search:     <svg style={s} viewBox="0 0 24 24"><circle {...p} cx="11" cy="11" r="8"/><line {...p} x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
    services:   <svg style={s} viewBox="0 0 24 24"><circle {...p} cx="12" cy="12" r="3"/><path {...p} d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/><path {...p} d="M15.54 8.46a5 5 0 0 1 0 7.07M8.46 8.46a5 5 0 0 0 0 7.07"/></svg>,
    nugget:     <svg style={s} viewBox="0 0 24 24"><polygon {...p} points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
    star:       <svg style={s} viewBox="0 0 24 24"><polygon {...p} points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
    heart:      <svg style={s} viewBox="0 0 24 24"><path {...p} d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
    x:          <svg style={s} viewBox="0 0 24 24"><line {...p} x1="18" y1="6" x2="6" y2="18"/><line {...p} x1="6" y1="6" x2="18" y2="18"/></svg>,
    mapPin:     <svg style={s} viewBox="0 0 24 24"><path {...p} d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle {...p} cx="12" cy="10" r="3"/></svg>,
    verified:   <svg style={s} viewBox="0 0 24 24"><path {...p} d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline {...p} points="22 4 12 14.01 9 11.01"/></svg>,
    shield:     <svg style={s} viewBox="0 0 24 24"><path {...p} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    shieldCheck: <svg style={s} viewBox="0 0 24 24"><path {...p} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline {...p} points="9 12 12 15 16 10"/></svg>,
    activity:   <svg style={s} viewBox="0 0 24 24"><polyline {...p} points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
    award:      <svg style={s} viewBox="0 0 24 24"><circle {...p} cx="12" cy="8" r="6"/><path {...p} d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>,
    // Scale/balance icon that works
    balance:    <svg style={s} viewBox="0 0 24 24"><line {...p} x1="12" y1="2" x2="12" y2="22"/><path {...p} d="M5 12l-3 6h6L5 12z"/><path {...p} d="M19 12l-3 6h6L19 12z"/><line {...p} x1="5" y1="12" x2="12" y2="5"/><line {...p} x1="19" y1="12" x2="12" y2="5"/></svg>,
    grid:       <svg style={s} viewBox="0 0 24 24"><rect {...p} x="3" y="3" width="7" height="7"/><rect {...p} x="14" y="3" width="7" height="7"/><rect {...p} x="14" y="14" width="7" height="7"/><rect {...p} x="3" y="14" width="7" height="7"/></svg>,
    zap:        <svg style={s} viewBox="0 0 24 24"><polygon {...p} points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
    chat:       <svg style={s} viewBox="0 0 24 24"><path {...p} d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    creditCard: <svg style={s} viewBox="0 0 24 24"><rect {...p} x="1" y="4" width="22" height="16" rx="2"/><line {...p} x1="1" y1="10" x2="23" y2="10"/></svg>,
    minus:      <svg style={s} viewBox="0 0 24 24"><line {...p} x1="5" y1="12" x2="19" y2="12"/></svg>,
    plus:       <svg style={s} viewBox="0 0 24 24"><line {...p} x1="12" y1="5" x2="12" y2="19"/><line {...p} x1="5" y1="12" x2="19" y2="12"/></svg>,
    cart:       <svg style={s} viewBox="0 0 24 24"><circle {...p} cx="9" cy="21" r="1"/><circle {...p} cx="20" cy="21" r="1"/><path {...p} d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>,
    globe:      <svg style={s} viewBox="0 0 24 24"><circle {...p} cx="12" cy="12" r="10"/><line {...p} x1="2" y1="12" x2="22" y2="12"/><path {...p} d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
    info:       <svg style={s} viewBox="0 0 24 24"><circle {...p} cx="12" cy="12" r="10"/><line {...p} x1="12" y1="8" x2="12" y2="12"/><line {...p} x1="12" y1="16" x2="12.01" y2="16"/></svg>,
    layers:     <svg style={s} viewBox="0 0 24 24"><polygon {...p} points="12 2 2 7 12 12 22 7 12 2"/><polyline {...p} points="2 17 12 22 22 17"/><polyline {...p} points="2 12 12 17 22 12"/></svg>,
    home:       <svg style={s} viewBox="0 0 24 24"><path {...p} d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline {...p} points="9 22 9 12 15 12 15 22"/></svg>,
    sun:        <svg style={s} viewBox="0 0 24 24"><circle {...p} cx="12" cy="12" r="5"/><line {...p} x1="12" y1="1" x2="12" y2="3"/><line {...p} x1="12" y1="21" x2="12" y2="23"/><line {...p} x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line {...p} x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line {...p} x1="1" y1="12" x2="3" y2="12"/><line {...p} x1="21" y1="12" x2="23" y2="12"/><line {...p} x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line {...p} x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
    moon:       <svg style={s} viewBox="0 0 24 24"><path {...p} d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
    undo:       <svg style={s} viewBox="0 0 24 24"><polyline {...p} points="9 14 4 9 9 4"/><path {...p} d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>,
    rotateCw:   <svg style={s} viewBox="0 0 24 24"><polyline {...p} points="23 4 23 10 17 10"/><path {...p} d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
    rotateCcw:  <svg style={s} viewBox="0 0 24 24"><polyline {...p} points="1 4 1 10 7 10"/><path {...p} d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>,
    arrowRight: <svg style={s} viewBox="0 0 24 24"><line {...p} x1="5" y1="12" x2="19" y2="12"/><polyline {...p} points="12 5 19 12 12 19"/></svg>,
    slash:      <svg style={s} viewBox="0 0 24 24"><circle {...p} cx="12" cy="12" r="10"/><line {...p} x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>,
    move:       <svg style={s} viewBox="0 0 24 24"><polyline {...p} points="5 9 2 12 5 15"/><polyline {...p} points="9 5 12 2 15 5"/><polyline {...p} points="15 19 12 22 9 19"/><polyline {...p} points="19 9 22 12 19 15"/><line {...p} x1="2" y1="12" x2="22" y2="12"/><line {...p} x1="12" y1="2" x2="12" y2="22"/></svg>,
    edit:       <svg style={s} viewBox="0 0 24 24"><path {...p} d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path {...p} d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    trash:      <svg style={s} viewBox="0 0 24 24"><polyline {...p} points="3 6 5 6 21 6"/><path {...p} d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path {...p} d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line {...p} x1="10" y1="11" x2="10" y2="17"/><line {...p} x1="14" y1="11" x2="14" y2="17"/></svg>,
    eye:       <svg style={s} viewBox="0 0 24 24"><path {...p} d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle {...p} cx="12" cy="12" r="3"/></svg>,
  };
  return icons[name] || <svg style={s} viewBox="0 0 24 24"><circle {...p} cx="12" cy="12" r="9"/></svg>;
};
