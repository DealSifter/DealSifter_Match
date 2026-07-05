import React from 'react';
import { C } from '../../theme/colors';
import { useT } from '../../i18n/translations';
import { Icon } from '../ui/Icon';
import { SmartImage } from '../ui/SmartImage';
import { useMediaQuery } from '../../hooks/useMediaQuery';

function SwipeCard({ card, action, isUnlocked, isSkipped, onSwipe, onUndo, onUnlock, previewOnly = false, showActions = true }) {
  const t = useT('dashboard').cards;
  const mt = useT('dashboard').matches;
  const isMobileLayout = useMediaQuery('(max-width: 767px)');
  const dragRef = React.useRef({ active: false, pointerId: null, startX: 0, startY: 0 });
  const dragFrameRef = React.useRef(null);
  const queuedDragRef = React.useRef({ x: 0, y: 0 });
  const [dragX, setDragX] = React.useState(0);
  const [dragY, setDragY] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const phoneValue = String(card?.phone || card?.primaryPhone || '').trim();
  const emailValue = String(card?.email || '').trim();
  const revealPhone = Boolean(isUnlocked && phoneValue);
  const revealEmail = Boolean(isUnlocked && emailValue);

  const dragAbs = Math.abs(dragX);
  const dragProgress = Math.min(1, dragAbs / 130);
  const dragTilt = Math.max(-10, Math.min(10, dragX * 0.04));
  const dragDirection = dragX > 0 ? 'match' : (dragX < 0 ? 'pass' : null);
  const matchOverlayOpacity = (dragDirection === 'match' ? dragProgress : 0) * 0.34;
  const passOverlayOpacity = (dragDirection === 'pass' ? dragProgress : 0) * 0.34;
  const actionDirection = action === 'match' ? 'match' : (action === 'pass' ? 'pass' : null);
  const showMatchBadge = !previewOnly && ((isDragging && dragDirection === 'match' && dragProgress > 0.08) || actionDirection === 'match');
  const showPassBadge = !previewOnly && ((isDragging && dragDirection === 'pass' && dragProgress > 0.08) || actionDirection === 'pass');
  const matchBadgeOpacity = actionDirection === 'match' ? 1 : Math.min(1, dragProgress * 1.2);
  const passBadgeOpacity = actionDirection === 'pass' ? 1 : Math.min(1, dragProgress * 1.2);

  const borderWidth = 1.5;
  const topGradient = C.accent; // turquoise / accent for person cards
  const bottomGradient = '#28324b';
  // In pop-up previews, add a stronger theme-aware glow to emphasize card boundaries.
  const glowShadow = previewOnly
    ? `
      0 0 0 1px ${C.alpha(C.accent, 0.2)},
      0 14px 28px ${C.alpha(C.t1, 0.22)},
      0 0 22px ${C.alpha(C.accent, 0.26)}
    `
    : C.shadow;

  const outerStyle = React.useMemo(() => ({
    position: 'relative',
    borderRadius: 16,
    padding: borderWidth,
    backgroundImage: `linear-gradient(var(--ui-surface), var(--ui-surface)), linear-gradient(to bottom, var(--map-top, ${topGradient}), var(--map-bottom, ${bottomGradient}))`,
    backgroundOrigin: 'border-box',
    backgroundClip: 'padding-box, border-box',
    boxShadow: glowShadow,
    transition: isDragging ? 'none' : 'border-color .18s, transform .18s cubic-bezier(0.22, 0.61, 0.36, 1)',
    display: 'flex',
    flexDirection: isMobileLayout ? 'column' : 'row',
    width: '100%',
    height: '100%',
    willChange: 'transform, opacity',
    touchAction: previewOnly ? 'auto' : 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    cursor: previewOnly ? 'default' : (isDragging ? 'grabbing' : 'grab'),
    transform: `translate3d(${dragX}px, ${dragY}px, 0) rotate(${dragTilt}deg)`,
    opacity: isDragging ? (1 - dragProgress * 0.06) : 1,
  }), [glowShadow, topGradient, bottomGradient, borderWidth, dragX, dragY, dragTilt, dragProgress, isDragging, previewOnly, isMobileLayout]);

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
      const dir = dx > 0 ? 'match' : 'pass';
      resetDrag();
      onSwipe(dir);
      return;
    }
    resetDrag();
  }, [onSwipe, resetDrag]);

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
      <div style={innerStyle}>

      {/* Feedback de arraste: leve wash de cor para indicar direção match/pass */}
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

      {/* ── LEFT: photo column ── */}
      <div style={{ position: 'relative', width: isMobileLayout ? '100%' : '42%', flexShrink: 0, height: isMobileLayout ? '44%' : '100%' }}>
        <SmartImage
          src={card.photo}
          alt={card.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />

        {showPassBadge ? (
          <span
            style={{
              position: 'absolute',
              top: 10,
              left: 10,
              zIndex: 12,
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
              opacity: passBadgeOpacity,
              transition: isDragging ? 'none' : 'opacity .16s ease-out',
            }}
          >
            PASS
          </span>
        ) : null}
        {showMatchBadge ? (
          <span
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              zIndex: 12,
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
              opacity: matchBadgeOpacity,
              transition: isDragging ? 'none' : 'opacity .16s ease-out',
            }}
          >
            MATCH
          </span>
        ) : null}
        {card?.isVerified ? (
          <span style={{
            position: 'absolute',
            top: 10,
            right: showMatchBadge ? 44 : 10,
            zIndex: 13,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            background: 'rgba(255,255,255,0.92)',
            borderRadius: 999,
            boxShadow: '0 3px 8px rgba(0,0,0,0.12)',
            pointerEvents: 'none',
          }}>
            <Icon name="shieldCheck" size={12} color={C.accent} strokeWidth={2.35} />
          </span>
        ) : null}
      </div>
      {/* ── RIGHT: info column ── */}
      <div style={{ position: 'relative', padding: isMobileLayout ? '11px 11px 12px' : '13px', flex: 1, display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
        {/* ...existing code... */}

        {/* Row 1: name + badge */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 16, fontWeight: 800, color: C.t1, lineHeight: 1.2 }}>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.name}</span>
              {isSkipped && <Icon name="slash" size={18} color={C.danger} strokeWidth={2.5} />}
            </div>
            {/* If a description is available (e.g. from a published preview/service), show a short description here; otherwise fall back to type */}
            <div style={{ fontSize: 12, color: C.accent, fontWeight: 700, marginTop: 1 }}>
              {(() => {
                try {
                  const d = card?.desc && String(card.desc).trim();
                  if (d && d.length > 0) {
                    // keep it concise to fit the small label area
                    return d.length > 56 ? d.slice(0, 56) + '…' : d;
                  }
                } catch (e) { void e; }
                return card.type;
              })()}
            </div>
          </div>
          {card.badge && (
            <div style={{
              flexShrink: 0,
              padding: '3px 8px', borderRadius: 20,
              background: C.alpha(C.gold, 0.12), border: `1px solid ${C.alpha(C.gold, 0.3)}`,
              color: C.gold, fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <Icon name="nugget" size={10} color={C.gold} strokeWidth={1.8} />
              {card.badge}
            </div>
          )}
        </div>

        {/* Row 2: location + rating */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: C.t3 }}>
            <Icon name="mapPin" size={11} color={C.t3} />
            <span>{card.loc}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: C.t2, fontWeight: 700 }}>
            <Icon name="star" size={11} color={C.t2} />
            <span>{card.rating > 0 ? card.rating : '–'}</span>
            <span style={{ color: C.t3, fontWeight: 400 }}>({card.reviews > 0 ? card.reviews : '–'})</span>
          </div>
        </div>

        {card.portfolioCount > 0 && (
          <div style={{ marginTop: -3, marginBottom: 8, fontSize: 10, color: C.t3, fontWeight: 600 }}>
            {mt.portfolioCountLabel
              .replace('{count}', String(card.portfolioCount))
              .replace('{item}', card.portfolioCount === 1 ? mt.portfolioItemOne : mt.portfolioItemOther)}
          </div>
        )}

        {/* Row 3: stats pills */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: isMobileLayout ? 'wrap' : 'nowrap' }}>
          {/* deals pill */}
          <div style={{
            padding: '4px 8px', borderRadius: 8,
            background: C.alpha(C.accent, 0.08), border: `1px solid ${C.alpha(C.accent, 0.15)}`,
            fontSize: 11, color: C.accent, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <Icon name="layers" size={11} color={C.accent} />
            {card.deals > 0 ? card.deals : '–'} {t.deals}
          </div>

          {/* phone pill — locked here; unlock only in Matches flow */}
          <div
            style={{
              padding: '4px 9px', borderRadius: 8,
              background: revealPhone
                ? C.alpha(C.success, 0.08)
                : C.alpha(C.t1, 0.04),
              border: `1px solid ${revealPhone ? C.alpha(C.success, 0.2) : C.border}`,
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <Icon name="phone" size={11} color={revealPhone ? C.success : C.t2} strokeWidth={1.6} />
            {revealPhone ? (
              <span style={{ fontSize: 11, color: C.success, fontWeight: 700 }}>
                {phoneValue}
              </span>
            ) : (
              <>
                <span style={{
                  fontSize: 11, color: C.t2, fontWeight: 600,
                  filter: 'blur(3.5px)', userSelect: 'none',
                  letterSpacing: 1,
                }}>
                  ••• •••••••
                </span>
                <Icon name="lock" size={10} color={C.success} strokeWidth={1.8} secondaryColor={C.gold} />
              </>
            )}
          </div>

          {/* email pill — locked here; unlock only in Matches flow */}
          <div
            style={{
              padding: '4px 9px', borderRadius: 8,
              background: revealEmail
                ? C.alpha(C.success, 0.08)
                : C.alpha(C.t1, 0.04),
              border: `1px solid ${revealEmail ? C.alpha(C.success, 0.2) : C.border}`,
              display: 'flex', alignItems: 'center', gap: 5,
              flex: 1,
              minWidth: 0,
            }}
          >
            <Icon name="email" size={11} color={revealEmail ? C.success : C.t2} strokeWidth={1.6} />
            {revealEmail ? (
              <span style={{ fontSize: 11, color: C.success, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {emailValue}
              </span>
            ) : (
              <>
                <span style={{
                  fontSize: 11, color: C.t2, fontWeight: 600,
                  filter: 'blur(3.5px)', userSelect: 'none',
                  letterSpacing: 1,
                }}>
                  ••• •••••••
                </span>
                <Icon name="lock" size={10} color={C.success} strokeWidth={1.8} secondaryColor={C.gold} />
              </>
            )}
          </div>
        </div>

        {/* Row 4: bio */}
        <p style={{
          fontSize: 12, color: C.t2, lineHeight: 1.5, margin: '0 0 8px 0',
          display: '-webkit-box', WebkitLineClamp: isMobileLayout ? 3 : 9,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {card.desc}
        </p>

        {/* Row 5: tags */}
        {card.tags?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
            {card.tags.map(tag => (
              <span key={tag} style={{
                padding: '2px 8px', borderRadius: 20,
                background: C.alpha(C.t1, 0.06), border: `1px solid ${C.border}`,
                fontSize: 10, color: C.t2, fontWeight: 600,
              }}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Row 6: actions — pushed to bottom */}
        {!previewOnly && showActions ? <div style={{ marginTop: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>

          {/* Next — Neutral rotate (LEFT) */}
          <button onClick={() => onSwipe('next')} style={{
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
            <button onClick={() => onSwipe('pass')} title={t.skip} style={{
              width: 38, height: 38, borderRadius: '50%',
              border: `1.5px solid ${C.danger}`,
              background: C.alpha(C.danger, 0.06),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}>
              <Icon name="close" size={16} color={C.danger} strokeWidth={2.2} />
            </button>

            <button
              onPointerDown={(e) => {
                try { e.preventDefault(); e.stopPropagation(); } catch { /* best-effort */ }
                if (isUnlocked) return;
                if (typeof onUnlock === 'function') onUnlock(card);
                else onSwipe('unlock');
              }}
              title={isUnlocked ? mt.unlocked : mt.unlock}
              style={{
                width: 38, height: 38, borderRadius: '50%',
                border: `1.5px solid ${C.gold}`,
                background: C.alpha(C.gold, isUnlocked ? 0.18 : 0.08),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: isUnlocked ? 'default' : 'pointer',
                opacity: isUnlocked ? 0.7 : 1,
                flexShrink: 0,
              }}
            >
              <Icon name="star" size={16} color={C.gold} strokeWidth={2} />
            </button>

            <button onClick={() => onSwipe('match')} title={t.match} style={{
              width: 38, height: 38, borderRadius: '50%',
              border: `1.5px solid ${C.success}`,
              background: C.alpha(C.success, 0.08),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}>
              <Icon name="check" size={16} color={C.success} strokeWidth={2.2} />
            </button>
          </div>

          {onUndo ? (
            <button
              onClick={(e) => { e.stopPropagation(); onUndo(); }}
              title={t.undo || 'Undo'}
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                border: 'none',
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'background 0.2s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = C.alpha(C.t1, 0.05); }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <Icon name="rotateCcw" size={16} color={C.t2} strokeWidth={2} />
            </button>
          ) : null}

        </div> : null}
      </div>
      </div>
    </div>
  );
}

export default React.memo(SwipeCard);
export { SwipeCard };
