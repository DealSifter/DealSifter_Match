import React from 'react';
import { C } from '../../theme/colors';
import { useT } from '../../i18n/translations';
import { Icon } from '../ui/Icon';
import { SmartImage } from '../ui/SmartImage';
import { ExclusivityBadge } from '../ui/ExclusivityBadge';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { formatPropertyLocation } from '../../lib/formatPropertyLocation';
import { getPendingDealRemainingDays, isPendingDealActive } from '../../lib/pendingDeal';

export function PropertyCard({ property, action, statusAction, onInterest, owner, isSkipped = false, previewOnly = false, hotMetrics = null, exclusivityStatus = null, onAvatarClick, onUnlock = null, showActions = true }) {
  const t = useT('dashboard').cards;
  const isMobileLayout = useMediaQuery('(max-width: 767px)');
  // Card do perfil está em stand by (esmaecido)?
  const isDimmed = owner?._isDimmed;
  const [currentIdx, setCurrentIdx] = React.useState(0);
  const dragRef = React.useRef({ active: false, pointerId: null, startX: 0, startY: 0 });
  const dragFrameRef = React.useRef(null);
  const queuedDragRef = React.useRef({ x: 0, y: 0 });
  const [dragX, setDragX] = React.useState(0);
  const [dragY, setDragY] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const images = property.images || [property.image];
  const rawCapRate = Number(property.capRate);
  const displayCapRate = Number.isFinite(rawCapRate) && rawCapRate > 0 && rawCapRate < 100
    ? rawCapRate.toLocaleString('en-US', { minimumFractionDigits: rawCapRate % 1 ? 1 : 0, maximumFractionDigits: 1 })
    : null;
  const ownerLooksFsbo = String(owner?.type || '').toLowerCase().includes('fsbo');
  const displayDealTag = property.dealTag === 'FSBO'
    ? ((property.ownerAccountType === 'fsbo_owner' || property.source === 'fsbo' || ownerLooksFsbo) ? 'FSBO' : null)
    : property.dealTag;
  const displayDealTagLabel = displayDealTag === 'FSBO' ? (t.fsbo || 'FSBO') : displayDealTag;
  const propertyLocation = formatPropertyLocation(property);

  const effectiveAction = action || statusAction;
  // In pop-up previews, add a stronger theme-aware glow to emphasize card boundaries.
  const glowShadow = previewOnly
    ? `
      0 0 0 1px ${C.alpha('#4381bc', 0.28)},
      0 14px 28px ${C.alpha(C.t1, 0.22)},
      0 0 22px ${C.alpha('#4381bc', 0.26)}
    `
    : C.shadow;

  const fmtPrice = (p) => `$${Number(p || 0).toLocaleString('en-US')}`;

  // strategyColor mapping omitted (not currently used)

  const borderWidth = 1.5;
  const topGradient = isSkipped ? C.danger : '#4280ba';
  const bottomGradient = '#28324b';
  const hotUnlockPct = Number(hotMetrics?.unlockPct || 0);
  const hotFavoritePct = Number(hotMetrics?.favoritePct || 0);
  const hotMatchPct = Number(hotMetrics?.matchPct || 0);
  const hotUnlockCount = Number(hotMetrics?.unlockCount || 0);
  const hotFavoriteCount = Number(hotMetrics?.favoriteCount || 0);
  const showPendingDealAlert = isPendingDealActive(property) && !previewOnly;
  const pendingDealDaysLeft = getPendingDealRemainingDays(property);
  const showHotAlert = hotUnlockCount > 0 && !previewOnly && !showPendingDealAlert;
  const showTrendingAlert = !showHotAlert && hotFavoriteCount >= 10 && !previewOnly && !showPendingDealAlert;
  const hotStripText = t.hotStrip
    ? t.hotStrip
        .replace('{unlockCount}', String(hotUnlockCount))
        .replace('{unlockPct}', String(hotUnlockPct))
        .replace('{favoritePct}', String(hotFavoritePct))
        .replace('{matchPct}', String(hotMatchPct))
    : `${hotUnlockCount} unlock${hotUnlockCount === 1 ? '' : 's'} · U ${hotUnlockPct}% / F ${hotFavoritePct}% / M ${hotMatchPct}%`;
  const trendingBadgeText = t.trendingBadge || 'Trending';
  const trendingStripText = t.trendingStrip || 'Several users want to know more... worth checking out!';
  const pendingDealBadgeText = t.pendingDealBadge || 'Pending';
  const pendingDealStripText = (t.pendingDealStrip || 'Advanced conversation reported by owner · {days}d left before feed block')
    .replace('{days}', String(pendingDealDaysLeft || 0));
  const showExclusivityAlert = !previewOnly && (exclusivityStatus?.kind === 'new' || exclusivityStatus?.kind === 'partial');
  const showActiveExclusivityLock = !previewOnly
    && (exclusivityStatus?.kind === 'blocked' || exclusivityStatus?.kind === 'owned')
    && Boolean(exclusivityStatus?.expiresAt);
  const isPartialExclusivity = exclusivityStatus?.kind === 'partial';
  const activeExclusivityLabel = t.exclusivityActiveBadge || 'Exclusivity';
  const activeExclusivityStripText = t.exclusivityActiveStrip || 'Exclusive lock active. This card is blocked until the timer ends.';
  const exclusivityBadge = isPartialExclusivity ? String(exclusivityStatus?.badge || 'Only 2 unlocks') : 'New';
  const exclusivityStripText = isPartialExclusivity
    ? (t.exclusivityPartialStrip || 'Be the first to unlock with partial exclusivity! Be quick and enjoy...')
    : (t.exclusivityNewStrip || 'Be the first to unlock with exclusivity! Be quick and enjoy...');
  const exclusivityStripGradient = isPartialExclusivity
    ? 'linear-gradient(90deg, rgba(126,45,0,0.96) 0%, rgba(245,158,11,0.94) 100%)'
    : 'linear-gradient(90deg, rgba(5,70,45,0.96) 0%, rgba(20,184,166,0.94) 100%)';
  const exclusivityBadgeBorder = isPartialExclusivity ? 'rgba(255, 218, 112, 0.9)' : 'rgba(124, 255, 226, 0.86)';
  const exclusivityIconColor = isPartialExclusivity ? '#ef4444' : '#facc15';
  const ownerBadgeBottom = images.length > 1 ? 24 : 8;
  const ownerBadgeHeight = 38;
  const swipeBadgeKind = action === 'pass' ? 'pass' : (action === 'interest' ? 'match' : null);
  const dragAbs = Math.abs(dragX);
  const dragProgress = Math.min(1, dragAbs / 130);
  const dragTilt = Math.max(-10, Math.min(10, dragX * 0.04));
  const dragDirection = dragX > 0 ? 'interest' : (dragX < 0 ? 'pass' : null);
  const matchOverlayOpacity = (dragDirection === 'interest' ? dragProgress : 0) * 0.34;
  const passOverlayOpacity = (dragDirection === 'pass' ? dragProgress : 0) * 0.34;

  const outerStyle = React.useMemo(() => ({
    position: 'relative',
    borderRadius: 16,
    padding: borderWidth,
    backgroundImage: `linear-gradient(var(--ui-surface), var(--ui-surface)), linear-gradient(to bottom, var(--map-top, ${topGradient}), var(--map-bottom, ${bottomGradient}))`,
    backgroundOrigin: 'border-box',
    backgroundClip: 'padding-box, border-box',
    boxShadow: glowShadow,
    transition: 'border-color .2s, filter .2s, opacity .2s',
    display: 'flex',
    flexDirection: isMobileLayout ? 'column' : 'row',
    width: '100%',
    height: '100%',
    willChange: 'transform, opacity',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    filter: isDimmed ? 'grayscale(0.7) brightness(0.82)' : undefined,
    pointerEvents: isDimmed ? 'none' : undefined,
    touchAction: previewOnly ? 'auto' : 'none',
    cursor: previewOnly ? 'default' : (isDragging ? 'grabbing' : 'grab'),
    transform: `translate3d(${dragX}px, ${dragY}px, 0) rotate(${dragTilt}deg)`,
    opacity: isDragging ? (1 - dragProgress * 0.06) : (isDimmed ? 0.62 : 1),
  }), [glowShadow, topGradient, bottomGradient, borderWidth, isDimmed, isMobileLayout, previewOnly, isDragging, dragX, dragY, dragTilt, dragProgress]);

  const flushQueuedDrag = React.useCallback(() => {
    dragFrameRef.current = null;
    const { x, y } = queuedDragRef.current;
    setDragX((prev) => (prev === x ? prev : x));
    setDragY((prev) => (prev === y ? prev : y));
  }, []);

  const scheduleDragFrame = React.useCallback((x, y) => {
    queuedDragRef.current = { x, y };
    if (dragFrameRef.current !== null) return;
    dragFrameRef.current = window.requestAnimationFrame(flushQueuedDrag);
  }, [flushQueuedDrag]);

  const resetDrag = React.useCallback(() => {
    dragRef.current.active = false;
    dragRef.current.pointerId = null;
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    queuedDragRef.current = { x: 0, y: 0 };
    setIsDragging(false);
    setDragX(0);
    setDragY(0);
  }, []);

  React.useEffect(() => () => {
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
  }, []);

  const handlePointerDown = React.useCallback((e) => {
    if (previewOnly) return;
    if (e.button !== 0) return;
    if (e.target.closest('button, a, input, select, textarea, [role="button"]')) return;
    dragRef.current.active = true;
    dragRef.current.pointerId = e.pointerId;
    dragRef.current.startX = e.clientX;
    dragRef.current.startY = e.clientY;
    setIsDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }, [previewOnly]);

  const handlePointerMove = React.useCallback((e) => {
    if (!dragRef.current.active) return;
    if (dragRef.current.pointerId !== null && e.pointerId !== dragRef.current.pointerId) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const nextX = Math.max(-180, Math.min(180, dx));
    const nextY = Math.max(-40, Math.min(40, dy * 0.25));
    scheduleDragFrame(nextX, nextY);
  }, [scheduleDragFrame]);

  const handlePointerEnd = React.useCallback((e) => {
    if (!dragRef.current.active) return;
    if (dragRef.current.pointerId !== null && e.pointerId !== dragRef.current.pointerId) return;
    const dx = e.clientX - dragRef.current.startX;
    const threshold = 90;
    if (Math.abs(dx) >= threshold) {
      const dir = dx > 0 ? 'interest' : 'pass';
      resetDrag();
      onInterest(dir);
      return;
    }
    resetDrag();
  }, [onInterest, resetDrag]);

  const innerStyle = React.useMemo(() => ({
    position: 'relative',
    background: C.card,
    borderRadius: `${16 - borderWidth}px`,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: isMobileLayout ? 'column' : 'row',
    width: '100%',
    height: '100%'
  }), [borderWidth, isMobileLayout]);

  return (
    <div
      style={outerStyle}
      onDragStart={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={resetDrag}
      onPointerLeave={(e) => {
        if (dragRef.current.active && (e.buttons & 1) === 0) resetDrag();
      }}
    >
      {/* Ícone de visualização removido */}
      <div style={innerStyle}>
      {showExclusivityAlert || showActiveExclusivityLock ? (
        <style>{`
          @keyframes dsPropertyExclusivePulse {
            0%, 100% { opacity: 1; transform: translateZ(0) scale(1); }
            50% { opacity: .84; transform: translateZ(0) scale(1.015); }
          }
        `}</style>
      ) : null}
      {!previewOnly ? (
        <>
          <div style={{
            pointerEvents: 'none',
            position: 'absolute',
            inset: 0,
            zIndex: 6,
            borderRadius: 14,
            opacity: matchOverlayOpacity,
            background: `linear-gradient(90deg, ${C.alpha(C.success, 0)} 0%, ${C.alpha(C.success, 0.1)} 35%, ${C.alpha(C.success, 0.28)} 100%)`,
            transition: isDragging ? 'none' : 'opacity .18s ease-out',
          }} />
          <div style={{
            pointerEvents: 'none',
            position: 'absolute',
            inset: 0,
            zIndex: 6,
            borderRadius: 14,
            opacity: passOverlayOpacity,
            background: `linear-gradient(270deg, ${C.alpha(C.danger, 0)} 0%, ${C.alpha(C.danger, 0.1)} 35%, ${C.alpha(C.danger, 0.28)} 100%)`,
            transition: isDragging ? 'none' : 'opacity .18s ease-out',
          }} />
        </>
      ) : null}

      {/* ── LEFT: photo carousel ── */}
      <div style={{ position: 'relative', width: isMobileLayout ? '100%' : '42%', flexShrink: 0, height: isMobileLayout ? '38%' : '100%' }}>
        <SmartImage
          src={images[currentIdx]}
          alt={property.address}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />

        {swipeBadgeKind === 'pass' ? (
          <span
            style={{
              position: 'absolute',
              top: 10,
              left: 10,
              zIndex: 13,
              pointerEvents: 'none',
              padding: '4px 9px',
              borderRadius: 8,
              border: `1px solid ${C.alpha(C.danger, 0.85)}`,
              background: C.alpha(C.danger, 0.18),
              color: C.danger,
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: '0.8px',
              textTransform: 'uppercase',
              transform: 'rotate(-10deg)',
            }}
          >
            PASS
          </span>
        ) : null}
        {swipeBadgeKind === 'match' ? (
          <span
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              zIndex: 13,
              pointerEvents: 'none',
              padding: '4px 9px',
              borderRadius: 8,
              border: `1px solid ${C.alpha(C.success, 0.85)}`,
              background: C.alpha(C.success, 0.18),
              color: C.success,
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: '0.8px',
              textTransform: 'uppercase',
              transform: 'rotate(10deg)',
            }}
          >
            MATCH
          </span>
        ) : null}

        {showActiveExclusivityLock ? (
          <div style={{
            position: 'absolute',
            top: 8,
            left: 8,
            zIndex: 15,
            pointerEvents: 'none',
            animation: 'dsPropertyExclusivePulse 1.35s ease-in-out infinite',
            maxWidth: 'calc(100% - 16px)',
          }}>
            <ExclusivityBadge expiresAt={exclusivityStatus.expiresAt} label={activeExclusivityLabel} />
          </div>
        ) : null}

        {showExclusivityAlert ? (
          <span style={{
            position: 'absolute',
            top: 8,
            left: 8,
            zIndex: 14,
            background: exclusivityStripGradient,
            border: `1px solid ${exclusivityBadgeBorder}`,
            color: '#fff',
            padding: '2px 8px',
            borderRadius: 999,
            fontSize: 9,
            fontWeight: 950,
            letterSpacing: '0.5px',
            pointerEvents: 'none',
            textTransform: 'uppercase',
            animation: 'dsPropertyExclusivePulse 1.05s ease-in-out infinite',
          }}>
            {exclusivityBadge}
          </span>
        ) : null}

        {showPendingDealAlert && !showExclusivityAlert && !showActiveExclusivityLock ? (
          <span style={{
            position: 'absolute',
            top: 8,
            left: 8,
            zIndex: 13,
            background: 'linear-gradient(90deg, rgba(55,65,81,0.95) 0%, rgba(156,163,175,0.92) 100%)',
            border: '1px solid rgba(209,213,219,0.88)',
            color: '#fff',
            padding: '2px 8px',
            borderRadius: 999,
            fontSize: 9,
            fontWeight: 950,
            letterSpacing: '0.5px',
            pointerEvents: 'none',
            textTransform: 'uppercase',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}>
            <Icon name="hourglass" size={10} color="#fff" strokeWidth={2.4} />
            {pendingDealBadgeText}
          </span>
        ) : null}

        {showHotAlert && !showExclusivityAlert && !showActiveExclusivityLock && (
          <span style={{
            position: 'absolute',
            top: 8,
            left: 8,
            zIndex: 12,
            background: 'linear-gradient(90deg, rgba(213,38,20,0.93) 0%, rgba(230,110,0,0.92) 100%)',
            border: '1px solid rgba(255, 198, 138, 0.82)',
            color: '#fff',
            padding: '2px 7px',
            borderRadius: 999,
            fontSize: 9,
            fontWeight: 900,
            letterSpacing: '0.5px',
            pointerEvents: 'none',
            animation: 'dsPropertyExclusivePulse 1.05s ease-in-out infinite',
          }}>
            HOT
          </span>
        )}

        {showTrendingAlert && !showExclusivityAlert && !showActiveExclusivityLock && !showPendingDealAlert && (
          <span style={{
            position: 'absolute',
            top: 8,
            left: 8,
            zIndex: 12,
            background: 'rgba(255,255,255,0.94)',
            border: '1px solid rgba(255,255,255,0.88)',
            color: '#111827',
            padding: '2px 8px',
            borderRadius: 999,
            fontSize: 9,
            fontWeight: 950,
            letterSpacing: '0.5px',
            pointerEvents: 'none',
            textTransform: 'uppercase',
          }}>
            {trendingBadgeText}
          </span>
        )}

        {/* removed image overlay for skipped status; follows existing pattern next to price */}

        {/* status now lives beside price (no image stamp overlay) */}

        {/* carousel dots */}
        {images.length > 1 && (
          <>
            <div style={{
              position: 'absolute', bottom: 8, left: 0, right: 0,
              display: 'flex', justifyContent: 'center', gap: 3,
              pointerEvents: 'none',
            }}>
              {images.map((_, i) => (
                <div 
                  key={i}
                  style={{
                    width: i === currentIdx ? 14 : 5, height: 5, borderRadius: 3,
                    background: i === currentIdx ? '#fff' : 'rgba(255,255,255,0.45)',
                    transition: 'all 0.2s',
                  }} 
                />
              ))}
            </div>
            <div onClick={() => setCurrentIdx(p => p > 0 ? p-1 : images.length-1)}
              style={{ position: 'absolute', top:0, left:0, bottom:0, width:'50%', cursor:'pointer', zIndex: 5 }} />
            <div onClick={() => setCurrentIdx(p => p < images.length-1 ? p+1 : 0)}
              style={{ position: 'absolute', top:0, right:0, bottom:0, width:'50%', cursor:'pointer', zIndex: 5 }} />
          </>
        )}

        {/* ── Match-pressure urgency strip (image bottom, above owner badge) ── */}
        {showActiveExclusivityLock ? (
          <div style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: ownerBadgeBottom + ownerBadgeHeight + 4,
            zIndex: 10,
            background: 'linear-gradient(90deg, rgba(5,70,45,0.96) 0%, rgba(20,184,166,0.94) 100%)',
            padding: '5px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: '#fff',
            fontSize: 10,
            fontWeight: 850,
            letterSpacing: '0.12px',
            pointerEvents: 'none',
            animation: 'dsPropertyExclusivePulse 1.35s ease-in-out infinite',
          }}>
            <ExclusivityBadge expiresAt={exclusivityStatus.expiresAt} compact />
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeExclusivityStripText}
            </span>
          </div>
        ) : null}

        {showExclusivityAlert ? (
          <div style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: ownerBadgeBottom + ownerBadgeHeight + 4,
            zIndex: 9,
            background: exclusivityStripGradient,
            padding: '5px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: '#fff',
            fontSize: 10,
            fontWeight: 850,
            letterSpacing: '0.12px',
            pointerEvents: 'none',
            animation: 'dsPropertyExclusivePulse 1.05s ease-in-out infinite',
          }}>
            <span style={{ fontSize: 13, color: exclusivityIconColor, lineHeight: 1 }}>⚡</span>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {exclusivityStripText}
            </span>
          </div>
        ) : null}

        {showPendingDealAlert && !showExclusivityAlert && !showActiveExclusivityLock ? (
          <div style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: ownerBadgeBottom + ownerBadgeHeight + 4,
            zIndex: 8,
            background: 'linear-gradient(90deg, rgba(55,65,81,0.94) 0%, rgba(156,163,175,0.9) 100%)',
            borderTop: '1px solid rgba(209,213,219,0.45)',
            borderBottom: '1px solid rgba(209,213,219,0.45)',
            padding: '4px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            color: '#fff',
            fontSize: 10,
            fontWeight: 850,
            letterSpacing: '0.12px',
            pointerEvents: 'none',
          }}>
            <Icon name="hourglass" size={12} color="#fff" strokeWidth={2.4} />
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {pendingDealStripText}
            </span>
          </div>
        ) : null}

        {showHotAlert && !showExclusivityAlert && !showActiveExclusivityLock && (
          <div style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: ownerBadgeBottom + ownerBadgeHeight + 4,
            zIndex: 8,
            background: 'linear-gradient(90deg, rgba(213,38,20,0.93) 0%, rgba(230,110,0,0.92) 100%)',
            padding: '4px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            color: '#fff',
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.15px',
            pointerEvents: 'none',
            animation: 'dsPropertyExclusivePulse 1.05s ease-in-out infinite',
          }}>
            <span style={{ fontSize: 12 }}>🔥</span>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {hotStripText}
            </span>
          </div>
        )}

        {showTrendingAlert && !showExclusivityAlert && !showActiveExclusivityLock && !showPendingDealAlert && (
          <div style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: ownerBadgeBottom + ownerBadgeHeight + 4,
            zIndex: 8,
            background: 'rgba(255,255,255,0.92)',
            borderTop: '1px solid rgba(255,255,255,0.78)',
            borderBottom: '1px solid rgba(255,255,255,0.78)',
            padding: '4px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            color: '#111827',
            fontSize: 10,
            fontWeight: 850,
            letterSpacing: '0.12px',
            pointerEvents: 'none',
          }}>
            <span style={{ fontSize: 12 }}>★</span>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {trendingStripText}
            </span>
          </div>
        )}

        {/* owner mini badge bottom */}
        <div style={{
          position: 'absolute', bottom: ownerBadgeBottom, left: 0, right: 0,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
          padding: '14px 8px 6px',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {owner?.photo ? (
            <SmartImage
              src={owner.photo}
              alt={owner?.name || 'Owner'}
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                objectFit: 'cover',
                border: '1.5px solid rgba(255,255,255,0.6)',
                cursor: onAvatarClick ? 'pointer' : undefined,
              }}
              onClick={onAvatarClick ? (e) => { e.stopPropagation(); onAvatarClick(owner?.type || 'personal'); } : undefined}
            />
          ) : (
            <div
              style={{
                width: 22, height: 22, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.18)', border: '1.5px solid rgba(255,255,255,0.6)',
                color: '#fff', fontSize: 10, fontWeight: 800,
                cursor: onAvatarClick ? 'pointer' : undefined,
              }}
              onClick={onAvatarClick ? (e) => { e.stopPropagation(); onAvatarClick(owner?.type || 'personal'); } : undefined}
            >
              {(owner?.name || 'U').charAt(0).toUpperCase()}
            </div>
          )}
          <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{owner?.name || 'Owner'}</span>
        </div>
      </div>

      {/* ── RIGHT: info panel ── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        padding: isMobileLayout ? '11px 11px 12px' : '13px 13px 11px 13px', minWidth: 0,
      }}>

        {/* price + type + action status */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6, marginBottom: 3 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.t1, lineHeight: 1 }}>
                {fmtPrice(property.price)}
              </div>
              {(effectiveAction === 'pass' || isSkipped) && (
                <Icon name="slash" size={18} color={C.danger} strokeWidth={2.5} />
              )}
              {effectiveAction === 'interest' && (
                <span style={{ fontSize: 12, fontWeight: 800, color: C.gold, lineHeight: 1 }}>
                  {t.selected}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 10, color: '#4381bc', fontWeight: 700, textTransform: 'uppercase' }}>
                {property.type}
              </div>
            </div>
          </div>
          {/* cap rate */}
          {displayCapRate && (
            <div style={{
              textAlign: 'center',
              padding: '5px 9px', borderRadius: 10,
              background: C.alpha(C.success, 0.1), border: `1px solid ${C.alpha(C.success, 0.25)}`,
            }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: C.success, lineHeight: 1 }}>
                {displayCapRate}%
              </div>
              <div style={{ fontSize: 9, color: C.success, fontWeight: 600, marginTop: 1 }}>Cap Rate</div>
            </div>
          )}
        </div>

        {/* address */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: C.t2, marginBottom: 6 }}>
          <Icon name="mapPin" size={12} color={C.t3} />
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {[property.address, propertyLocation].filter(Boolean).join(', ')}
          </span>
        </div>

        {/* objective + deal tag badges */}
        {(property.objective || displayDealTag) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'nowrap' }}>
            {property.objective ? (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                minWidth: 0,
                flex: 1,
                padding: '4px 8px',
                borderRadius: 20,
                background: 'rgba(67, 129, 188, 0.1)',
                border: '1px solid rgba(67, 129, 188, 0.3)',
              }}>
                <Icon name="zap" size={11} color="#4381bc" strokeWidth={2} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#4381bc', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {property.objective}
                </span>
              </div>
            ) : null}
            {displayDealTag ? (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                minWidth: 0,
                flex: 1,
                padding: '4px 8px',
                borderRadius: 20,
                background: C.alpha('#e74c3c', 0.08),
                border: '1px solid rgba(231, 76, 60, 0.35)',
              }}>
                <Icon name="tag" size={11} color="#e74c3c" strokeWidth={2} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#e74c3c', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {displayDealTagLabel}
                </span>
              </div>
            ) : null}
          </div>
        )}

        {/* specs grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: isMobileLayout ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 4, marginBottom: 8,
        }}>
          {[
            { icon: 'home',     label: property.beds > 0 || property.baths > 0 ? `${property.beds || 0} bd / ${property.baths || 0} ba` : '—',      sub: t.bdba  },
            { icon: 'maximize', label: property.sqft || 'N/A',                                   sub: 'SQFT'  },
            { icon: 'maximize', label: property.lot || 'N/A',                                    sub: t.lot  },
            { icon: 'tool',     label: property.rehab > 0 ? fmtPrice(property.rehab) : '$0',    sub: t.estimatedRehab },
          ].map(({ label, sub }) => (
            <div key={sub} style={{
              padding: '3px 4px', borderRadius: 8, textAlign: 'center',
              background: C.alpha(C.t1, 0.04), border: `1px solid ${C.border}`,
            }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.t1, wordBreak: 'keep-all', whiteSpace: 'normal', lineHeight: 1.2 }}>
                {sub === t.bdba && label !== '—' 
                  ? label.split(' / ').map((part, idx, arr) => (
                      <span key={idx}>{part}{idx < arr.length - 1 ? <> / <wbr /></> : ''}</span>
                    ))
                  : label
                }
              </div>
              <div style={{ fontSize: 9, color: C.t3, fontWeight: 600, textTransform: 'uppercase', marginTop: 1 }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* property description */}
        {property.description && (
          <div style={{
            padding: '8px 10px',
            borderRadius: 8,
            background: C.alpha(C.t1, 0.02),
            border: `1px solid ${C.border}`,
            marginBottom: 6,
          }}>
            <div style={{ 
              fontSize: 11, 
              lineHeight: 1.5, 
              color: C.t2,
              display: '-webkit-box',
              WebkitLineClamp: isMobileLayout ? 3 : 4,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {property.description}
            </div>
          </div>
        )}

        {/* owner info row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '6px 8px', borderRadius: 9,
          background: C.alpha(C.t1, 0.04), border: `1px solid ${C.border}`,
          marginBottom: 6,
        }}>
          {owner?.photo ? (
            <SmartImage
              src={owner.photo}
              alt={owner?.name || 'Owner'}
              style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, cursor: onAvatarClick ? 'pointer' : undefined }}
              onClick={onAvatarClick ? (e) => { e.stopPropagation(); onAvatarClick(owner?.type || 'personal'); } : undefined}
            />
          ) : (
            <div
              style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.alpha(C.t1, 0.1), color: C.t2, fontSize: 12, fontWeight: 800, cursor: onAvatarClick ? 'pointer' : undefined }}
              onClick={onAvatarClick ? (e) => { e.stopPropagation(); onAvatarClick(owner?.type || 'personal'); } : undefined}
            >
              {(owner?.name || 'U').charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.t1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{owner?.name || 'Owner'}</div>
            <div style={{ fontSize: 10, color: C.t2 }}>{owner?.type || owner?.badge || 'Profile'}{owner?.deals ? ` · ${owner.deals} deals` : ''}</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
            <Icon name="star" size={10} color={C.t2} />
            <span style={{ fontSize: 11, fontWeight: 700, color: C.t2 }}>{owner?.rating || '5.0'}</span>
          </div>
        </div>

        {/* action buttons — bottom */}
        {!previewOnly && showActions ? <>
          <div style={{ marginTop: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
            {/* Next — Neutral rotate (LEFT) */}
            <button onClick={() => onInterest('next')} style={{
              width: 36, height: 36, borderRadius: '50%',
              border: 'none', background: 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              flexShrink: 0,
              transition: 'background 0.2s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = C.alpha(C.t1, 0.05)}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              <Icon name="rotateCw" size={16} color={C.t2} strokeWidth={2} />
            </button>

            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 10 }}>
              <button onClick={() => onInterest('pass')} title={t.skip} style={{
                width: 38, height: 38, borderRadius: '50%',
                border: `1.5px solid ${C.danger}`,
                background: C.alpha(C.danger, 0.06),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0,
              }}>
                <Icon name="close" size={16} color={C.danger} strokeWidth={2.2} />
              </button>

              <button onClick={(e) => {
                  e.stopPropagation();
                  // If property is currently under an active exclusivity lock, open unlock flow instead
                  if (showActiveExclusivityLock || (exclusivityStatus && ['blocked','owned'].includes(exclusivityStatus.kind))) {
                    if (typeof onUnlock === 'function') onUnlock(property);
                    return;
                  }
                  if (typeof onInterest === 'function') onInterest('interest');
                }} title={t.interested} style={{
                width: 38, height: 38, borderRadius: '50%',
                border: `1.5px solid ${C.gold}`,
                background: C.alpha(C.gold, 0.08),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0,
              }}>
                <Icon name="star" size={16} color={C.gold} strokeWidth={2} />
              </button>

              <button onClick={() => onInterest('interest')} title={t.interested} style={{
                width: 38, height: 38, borderRadius: '50%',
                border: `1.5px solid ${C.success}`,
                background: C.alpha(C.success, 0.08),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0,
              }}>
                <Icon name="check" size={16} color={C.success} strokeWidth={2.2} />
              </button>
            </div>

          </div>
        </> : null}
      </div>
      </div>
    </div>
  );
}

export default React.memo(PropertyCard);

