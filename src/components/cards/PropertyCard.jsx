import React from 'react';
import { C } from '../../theme/colors';
import { useT } from '../../i18n/translations';
import { Icon } from '../ui/Icon';
import { SmartImage } from '../ui/SmartImage';

export function PropertyCard({ property, action, statusAction, onInterest, owner, isSkipped = false, onUndo, previewOnly = false, matchPressure = 0, onAvatarClick, showActions = true }) {
  const t = useT('dashboard').cards;
  const isMobileLayout = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(max-width: 767px)').matches;
  // Card do perfil está em stand by (esmaecido)?
  const isDimmed = owner?._isDimmed;
  const [currentIdx, setCurrentIdx] = React.useState(0);
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

  const effectiveAction = action || statusAction;
  const borderColor = effectiveAction === 'interest' ? C.gold : effectiveAction === 'pass' ? C.danger : C.border;
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
  const showMatchPressure = matchPressure > 0 && !previewOnly;
  const ownerBadgeBottom = images.length > 1 ? 24 : 8;
  const ownerBadgeHeight = 38;
  const swipeBadgeKind = action === 'pass' ? 'pass' : (action === 'interest' ? 'match' : null);

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
    opacity: isDimmed ? 0.62 : 1,
    pointerEvents: isDimmed ? 'none' : undefined,
  }), [glowShadow, topGradient, bottomGradient, borderWidth, isDimmed, isMobileLayout]);

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
    >
      {/* Ícone de visualização removido */}
      <div style={innerStyle}>

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

        {showMatchPressure && (
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
          }}>
            PENDING
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
        {showMatchPressure && (
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
          }}>
            <span style={{ fontSize: 12 }}>🔥</span>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {matchPressure}% dos usuários ativos já acessaram este imóvel
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
            {property.address}, {property.city}{property.zip ? ` ${property.zip}` : ''}
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

              <button onClick={() => onInterest('interest')} title={t.interested} style={{
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
