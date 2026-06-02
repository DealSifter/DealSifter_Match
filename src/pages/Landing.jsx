import React, { useEffect } from 'react';
import { C } from '../theme/colors';
import { useLang, useT } from '../i18n/translations';
import { CATEGORIES } from '../data/mockData';
import { Icon } from '../components/ui/Icon';
import { catIcon } from '../lib/catIcon';
import { DealSifterLogo } from '../components/ui/DealSifterLogo';
import { FOOTER_INFO } from '../content/footerInfoContent';

/* ─── Preview cards used inside the "Most Requested Services" section ─── */
function LandingProfCard({ onClick }) {
  const tags = ['Contract Law', 'Property Disputes', 'Closing Services'];
  return (
    <div onClick={onClick} title="Click to join and connect" style={{
      position: 'relative', borderRadius: 16, padding: 1.5, cursor: 'pointer',
      backgroundImage: `linear-gradient(#fff, #fff), linear-gradient(to bottom, #14B8A6, #28324b)`,
      backgroundOrigin: 'border-box', backgroundClip: 'padding-box, border-box',
      boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
      height: 280, display: 'flex', width: '100%', boxSizing: 'border-box',
      transition: 'box-shadow .2s',
    }}
    onMouseEnter={e => e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.16)'}
    onMouseLeave={e => e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.10)'}
    >
      <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'row', width: '100%', height: '100%' }}>
        {/* Photo */}
        <div style={{ width: '42%', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
          <img src="https://randomuser.me/api/portraits/women/45.jpg" alt="Sarah Johnson" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
        {/* Info */}
        <div style={{ flex: 1, padding: '13px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#1e2d4d', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Sarah Johnson</div>
              <div style={{ fontSize: 11, color: '#14B8A6', fontWeight: 700, marginTop: 1 }}>Real Estate Attorney</div>
            </div>
            <div style={{ flexShrink: 0, padding: '3px 8px', borderRadius: 20, background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.3)', color: C.gold, fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Icon name="nugget" size={10} color={C.gold} strokeWidth={1.8} />
              3
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#64748B' }}>
              <Icon name="mapPin" size={11} color="#64748B" />
              <span>Miami, FL</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#64748B', fontWeight: 700 }}>
              <Icon name="star" size={11} color="#64748B" />
              <span>4.9 (127)</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 5, marginBottom: 8, flexWrap: 'wrap' }}>
            <div style={{ padding: '3px 8px', borderRadius: 8, background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.15)', fontSize: 10, color: '#14B8A6', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
              <Icon name="layers" size={10} color="#14B8A6" />38 deals
            </div>
            <div style={{ padding: '3px 9px', borderRadius: 8, background: 'rgba(0,0,0,0.04)', border: '1px solid #e2e8f0', fontSize: 10, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Icon name="phone" size={10} color="#94a3b8" strokeWidth={1.6} />
              <span style={{ filter: 'blur(3px)', userSelect: 'none', letterSpacing: 1 }}>•••••••</span>
              <Icon name="lock" size={9} color="#94a3b8" strokeWidth={1.8} />
            </div>
          </div>
          <p style={{ fontSize: 11, color: '#64748B', lineHeight: 1.5, margin: '0 0 8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            Experienced real estate attorney specializing in complex transactions and property law.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {tags.map(tag => (
              <span key={tag} style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', fontSize: 10, color: '#64748B', fontWeight: 600 }}>{tag}</span>
            ))}
          </div>
          {/* Contact locked strip */}
          <div style={{ marginTop: 'auto', padding: '7px 10px', borderRadius: 10, background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.25)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="lock" size={14} color={C.gold} strokeWidth={2} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 11, color: '#1e2d4d' }}>Contact Locked</div>
              <div style={{ fontSize: 10, color: '#64748B' }}>Unlock with <span style={{ color: C.gold, fontWeight: 700 }}>3 nuggets</span></div>
            </div>
            <Icon name="star" size={14} color={C.gold} strokeWidth={2} />
          </div>
        </div>
      </div>
    </div>
  );
}

function LandingPropCard({ onClick }) {
  return (
    <div onClick={onClick} title="Click to join and connect" style={{
      position: 'relative', borderRadius: 16, padding: 1.5, cursor: 'pointer',
      backgroundImage: `linear-gradient(#fff, #fff), linear-gradient(to bottom, #4280ba, #28324b)`,
      backgroundOrigin: 'border-box', backgroundClip: 'padding-box, border-box',
      boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
      height: 280, display: 'flex', width: '100%', boxSizing: 'border-box',
      transition: 'box-shadow .2s',
    }}
    onMouseEnter={e => e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.16)'}
    onMouseLeave={e => e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.10)'}
    >
      <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'row', width: '100%', height: '100%' }}>
        {/* Photo */}
        <div style={{ width: '42%', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
          <img src="https://picsum.photos/seed/orlando-ff/300/400" alt="Fix & Flip Property" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          <div style={{ position: 'absolute', top: 8, right: 8, padding: '3px 9px', borderRadius: 20, background: 'rgba(249,115,22,0.9)', color: '#fff', fontSize: 10, fontWeight: 800 }}>Fix & Flip</div>
        </div>
        {/* Info */}
        <div style={{ flex: 1, padding: '13px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflow: 'hidden' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#1e2d4d', lineHeight: 1.3, marginBottom: 4 }}>3BR/2BA Single Family Home</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#64748B', marginBottom: 10 }}>
            <Icon name="mapPin" size={11} color="#64748B" />
            <span>Orlando, FL</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px', marginBottom: 10 }}>
            <div><div style={{ fontSize: 10, color: '#64748B' }}>Price</div><div style={{ fontSize: 13, fontWeight: 800, color: '#16a34a' }}>$180,000</div></div>
            <div><div style={{ fontSize: 10, color: '#64748B' }}>ARV</div><div style={{ fontSize: 13, fontWeight: 700, color: '#1e2d4d' }}>$280,000</div></div>
          </div>
          <p style={{ fontSize: 11, color: '#64748B', lineHeight: 1.5, margin: '0 0 8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            Great investment opportunity in growing neighborhood. Needs cosmetic updates.
          </p>
          <div style={{ display: 'flex', gap: 10, marginBottom: 8, fontSize: 11, color: '#64748B' }}>
            <span><strong>3</strong> BR</span>
            <span><strong>2</strong> BA</span>
            <span><strong>1,450</strong> sqft</span>
          </div>
          {/* Contact locked strip */}
          <div style={{ marginTop: 'auto', padding: '7px 10px', borderRadius: 10, background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.25)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="lock" size={14} color={C.gold} strokeWidth={2} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 11, color: '#1e2d4d' }}>Contact Locked</div>
              <div style={{ fontSize: 10, color: '#64748B' }}>Unlock with <span style={{ color: C.gold, fontWeight: 700 }}>3 nuggets</span></div>
            </div>
            <Icon name="star" size={14} color={C.gold} strokeWidth={2} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Animated swipe card stack for the Nuggets section ─── */
function NuggetSwipeDemo() {
  const DEMO_CARDS = [
    { img: 'https://randomuser.me/api/portraits/men/32.jpg',   name: 'Marcus Rivera',   type: 'Wholesaler',           loc: 'Phoenix, AZ',     rating: 4.8, reviews: 94,  deals: 52,  nuggets: 3,  bio: 'Connecting off-market deals with cash buyers across the Southwest for over 10 years.', tags: ['Off-Market', 'Wholesale', 'BRRRR'],             dir: 'right' },
    { img: 'https://randomuser.me/api/portraits/women/45.jpg', name: 'Sarah Johnson',   type: 'Real Estate Attorney', loc: 'Miami, FL',        rating: 4.9, reviews: 127, deals: 38,  nuggets: 3,  bio: 'Experienced real estate attorney specializing in complex transactions and property law.', tags: ['Contract Law', 'Property Disputes', 'Closing Services'], dir: 'left'  },
    { img: 'https://randomuser.me/api/portraits/men/64.jpg',   name: 'David Chen',      type: 'Hard Money Lender',    loc: 'Los Angeles, CA',  rating: 4.7, reviews: 203, deals: 89,  nuggets: 5,  bio: 'Fast closings and flexible terms for fix & flip projects in CA, NV and AZ markets.', tags: ['Bridge Loans', 'Fix & Flip', 'No Doc'],             dir: 'right' },
    { img: 'https://randomuser.me/api/portraits/women/28.jpg', name: 'Lisa Thompson',   type: 'Property Inspector',   loc: 'Dallas, TX',       rating: 4.9, reviews: 68,  deals: 134, nuggets: 2,  bio: 'Detailed pre-purchase inspection reports for smarter investment decisions.', tags: ['Pre-Purchase', 'Commercial', 'Residential'],        dir: 'right' },
  ];

  const [topIdx, setTopIdx] = React.useState(0);
  const [phase, setPhase] = React.useState('idle'); // 'idle' | 'drag' | 'fly'
  const [swipeDir, setSwipeDir] = React.useState('right');

  React.useEffect(() => {
    if (phase !== 'idle') return;
    // Vary pause slightly for a less robotic feel
    const pause = 2400 + Math.random() * 800;
    const t1 = setTimeout(() => {
      const card = DEMO_CARDS[topIdx % DEMO_CARDS.length];
      setSwipeDir(card.dir);
      setPhase('drag'); // phase 1: slow pick-up / tilt
      const t2 = setTimeout(() => {
        setPhase('fly'); // phase 2: fast fly-off
        const t3 = setTimeout(() => {
          setPhase('idle');
          setTopIdx(prev => (prev + 1) % DEMO_CARDS.length);
        }, 520);
        return () => clearTimeout(t3);
      }, 200);
      return () => clearTimeout(t2);
    }, pause);
    return () => clearTimeout(t1);
  }, [topIdx, phase]); // eslint-disable-line

  const CARD_H = 340;

  return (
    <div style={{ position: 'relative', width: '100%', height: CARD_H + 82, margin: '0 auto' }}>
      {[2, 1, 0].map(offset => {
        const cardIdx = (topIdx + offset) % DEMO_CARDS.length;
        const isTop = offset === 0;
        const card = DEMO_CARDS[cardIdx];
        const stackScale = 1 - offset * 0.038;
        const stackY = offset * 14;
        const stackOp = 1 - offset * 0.18;

        const baseTransform = `scale(${stackScale}) translateY(${stackY}px)`;
        let swipeTransform = baseTransform;
        let swipeOpacity = stackOp;
        let transition = 'transform 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.35s ease';

        if (isTop && phase === 'drag') {
          // Phase 1: slow pick-up — slight tilt toward swipe direction
          const dx = swipeDir === 'right' ? 22 : -22;
          const rot = swipeDir === 'right' ? 5 : -5;
          swipeTransform = `translate(${dx}px, 6px) rotate(${rot}deg)`;
          swipeOpacity = 1;
          transition = 'transform 0.20s cubic-bezier(0.4,0,0.6,1), opacity 0.20s ease';
        } else if (isTop && phase === 'fly') {
          // Phase 2: fast fly-off — accelerates off-screen
          const tx = swipeDir === 'right' ? 540 : -540;
          const rot = swipeDir === 'right' ? 22 : -22;
          swipeTransform = `translate(${tx}px, -28px) rotate(${rot}deg)`;
          swipeOpacity = 0;
          transition = 'transform 0.50s cubic-bezier(0.55,0,1,0.45), opacity 0.38s ease';
        }

        // Cards beneath ease up naturally as top card leaves
        const beneath = !isTop && (phase === 'drag' || phase === 'fly');
        const beneathScale = beneath ? stackScale + 0.012 : stackScale;
        const beneathY = beneath ? stackY - 5 : stackY;
        const beneathTransition = `transform ${phase === 'drag' ? '0.20s' : '0.50s'} cubic-bezier(0.4,0,0.2,1)`;
        if (!isTop) {
          swipeTransform = `scale(${beneathScale}) translateY(${beneathY}px)`;
          transition = beneathTransition;
        }

        return (
          <div key={`${cardIdx}-${offset}`} style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: CARD_H,
            zIndex: 3 - offset,
            transform: swipeTransform, opacity: swipeOpacity,
            transition, transformOrigin: 'bottom center',
            pointerEvents: isTop ? 'auto' : 'none',
          }}>
            {/* ── Outer gradient border (matches SwipeCard exactly) ── */}
            <div style={{
              position: 'relative', borderRadius: 16, padding: 1.5,
              height: '100%', display: 'flex', boxSizing: 'border-box',
              backgroundImage: 'linear-gradient(var(--ui-surface,#fff), var(--ui-surface,#fff)), linear-gradient(to bottom, #14B8A6, #28324b)',
              backgroundOrigin: 'border-box', backgroundClip: 'padding-box, border-box',
              boxShadow: isTop
                ? '0 16px 48px rgba(0,0,0,0.36), 0 4px 16px rgba(0,0,0,0.20)'
                : '0 6px 20px rgba(0,0,0,0.20)',
            }}>
              <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', display: 'flex', width: '100%', height: '100%' }}>

                {/* ── LEFT: photo ── */}
                <div style={{ width: '42%', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
                  <img src={card.img} alt={card.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </div>

                {/* ── RIGHT: info column ── */}
                <div style={{ flex: 1, padding: '13px 14px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflow: 'hidden' }}>

                  {/* Row 1: name + nugget badge */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#1e2d4d', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.name}</div>
                      <div style={{ fontSize: 11, color: '#14B8A6', fontWeight: 700, marginTop: 2 }}>{card.type}</div>
                    </div>
                    <div style={{ flexShrink: 0, padding: '3px 8px', borderRadius: 20, background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.32)', color: C.gold, fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                      <Icon name="nugget" size={10} color={C.gold} strokeWidth={1.8} />
                      {card.nuggets}
                    </div>
                  </div>

                  {/* Row 2: location + rating */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#64748B' }}>
                      <Icon name="mapPin" size={11} color="#94a3b8" />
                      <span>{card.loc}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#64748B' }}>
                      <Icon name="star" size={11} color="#94a3b8" />
                      <span style={{ fontWeight: 700, color: '#475569' }}>{card.rating}</span>
                      <span style={{ color: '#94a3b8' }}>({card.reviews})</span>
                    </div>
                  </div>

                  {/* Row 3: pills */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 9, flexWrap: 'wrap' }}>
                    <div style={{ padding: '4px 9px', borderRadius: 8, background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.18)', fontSize: 11, color: '#14B8A6', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Icon name="layers" size={11} color="#14B8A6" />
                      {card.deals} deals
                    </div>
                    <div style={{ padding: '4px 9px', borderRadius: 8, background: 'rgba(0,0,0,0.04)', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Icon name="phone" size={11} color="#94a3b8" strokeWidth={1.6} />
                      <span style={{ fontSize: 11, color: '#94a3b8', filter: 'blur(3px)', userSelect: 'none', letterSpacing: 1 }}>•••••••</span>
                      <Icon name="lock" size={10} color="#94a3b8" strokeWidth={1.8} />
                    </div>
                  </div>

                  {/* Row 4: bio */}
                  <p style={{ fontSize: 12, color: '#64748B', lineHeight: 1.55, margin: '0 0 9px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{card.bio}</p>

                  {/* Row 5: tags */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 'auto' }}>
                    {card.tags.map(tag => (
                      <span key={tag} style={{ padding: '2px 9px', borderRadius: 20, background: 'rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', fontSize: 10, color: '#64748B', fontWeight: 600 }}>{tag}</span>
                    ))}
                  </div>

                  {/* Row 6: contact locked strip */}
                  <div style={{ marginTop: 10, padding: '7px 11px', borderRadius: 10, background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.26)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon name="lock" size={15} color={C.gold} strokeWidth={2} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 11, color: '#1e2d4d' }}>Contact Locked</div>
                      <div style={{ fontSize: 10, color: '#64748B' }}>Unlock with <span style={{ color: C.gold, fontWeight: 700 }}>{card.nuggets} nuggets</span></div>
                    </div>
                    <Icon name="star" size={15} color={C.gold} strokeWidth={2} />
                  </div>

                </div>
              </div>
            </div>

            {/* MATCH / PASS stamp */}
            {isTop && (phase === 'drag' || phase === 'fly') && (
              <div style={{
                position: 'absolute', top: 16,
                ...(swipeDir === 'right' ? { left: 14 } : { right: 14 }),
                zIndex: 10, padding: '5px 14px', borderRadius: 20, fontWeight: 800, fontSize: 13, letterSpacing: '0.06em',
                color: '#fff', boxShadow: '0 3px 10px rgba(0,0,0,0.24)',
                background: swipeDir === 'right' ? 'rgba(34,197,94,0.92)' : 'rgba(239,68,68,0.92)',
                border: `2px solid ${swipeDir === 'right' ? '#22c55e' : '#ef4444'}`,
              }}>
                {swipeDir === 'right' ? 'MATCH ♥' : 'PASS ✕'}
              </div>
            )}
          </div>
        );
      })}

      {/* Action buttons */}
      <div style={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ width: 42, height: 42, borderRadius: '50%', border: '1.5px solid #ef4444', background: 'rgba(239,68,68,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="close" size={17} color="#ef4444" strokeWidth={2.2} />
        </div>
        <div style={{ width: 42, height: 42, borderRadius: '50%', border: `1.5px solid ${C.gold}`, background: `rgba(234,179,8,0.08)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="star" size={17} color={C.gold} strokeWidth={2} />
        </div>
        <div style={{ width: 42, height: 42, borderRadius: '50%', border: '1.5px solid #22c55e', background: 'rgba(34,197,94,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="check" size={17} color="#22c55e" strokeWidth={2.2} />
        </div>
      </div>
    </div>
  );
}

function ProfItem({ item }) {
  const [tilt, setTilt] = React.useState({ x: 0, y: 0 });
  const [glow, setGlow] = React.useState({ x: 50, y: 50 });
  const [hovered, setHovered] = React.useState(false);
  const ref = React.useRef(null);

  const handleMouseMove = (e) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = (e.clientX - rect.left) / rect.width;   // 0–1
    const cy = (e.clientY - rect.top) / rect.height;    // 0–1
    setTilt({ x: (cy - 0.5) * -18, y: (cx - 0.5) * 18 });
    setGlow({ x: Math.round(cx * 100), y: Math.round(cy * 100) });
  };

  const handleMouseLeave = () => {
    setHovered(false);
    setTilt({ x: 0, y: 0 });
    setGlow({ x: 50, y: 50 });
  };

  return (
    <div
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
        padding: '22px 12px 18px',
        borderRadius: 16,
        background: hovered
          ? `radial-gradient(ellipse at ${glow.x}% ${glow.y}%, rgba(20,184,166,0.09) 0%, #fff 60%)`
          : 'transparent',
        boxShadow: hovered
          ? '0 12px 36px rgba(30,45,77,0.13), 0 2px 8px rgba(20,184,166,0.08)'
          : 'none',
        border: `1.5px solid ${hovered ? 'rgba(20,184,166,0.28)' : 'transparent'}`,
        transform: hovered
          ? `perspective(600px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateZ(6px)`
          : 'perspective(600px) rotateX(0deg) rotateY(0deg) translateZ(0px)',
        transition: hovered
          ? 'box-shadow 0.18s ease, background 0.15s ease, border-color 0.15s ease'
          : 'transform 0.40s cubic-bezier(0.22,1,0.36,1), box-shadow 0.30s ease, background 0.25s ease, border-color 0.25s ease',
        willChange: 'transform',
        cursor: 'default',
      }}
    >
      <div style={{
        width: 68, height: 68, borderRadius: '50%',
        background: hovered
          ? `radial-gradient(circle at ${glow.x}% ${glow.y}%, rgba(20,184,166,0.18) 0%, rgba(20,184,166,0.06) 100%)`
          : '#EBF2FA',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 14, flexShrink: 0,
        transform: hovered ? 'scale(1.12)' : 'scale(1)',
        transition: 'transform 0.30s cubic-bezier(0.34,1.56,0.64,1), background 0.18s ease',
        boxShadow: hovered ? '0 0 0 6px rgba(20,184,166,0.08)' : '0 0 0 0px transparent',
      }}>
        <Icon name={catIcon(item.iconId)} size={28} color={hovered ? '#14B8A6' : '#1e2d4d'} strokeWidth={1.5} />
      </div>
      <div style={{
        fontWeight: 700, fontSize: 13, marginBottom: 5, lineHeight: 1.3,
        color: hovered ? '#0f766e' : '#1e2d4d',
        transition: 'color 0.18s ease',
      }}>{item.label}</div>
      <div style={{ fontSize: 11, color: '#64748B', lineHeight: 1.5 }}>{item.desc}</div>
    </div>
  );
}

export function Landing({ setPage, onOpenAuthModal = () => {} }) {
  const [activeService, setActiveService] = React.useState(null);
  const [footerInfoKey, setFooterInfoKey] = React.useState(null);
  const [isMobile, setIsMobile] = React.useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(max-width: 767px)').matches;
  });

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
    try {
      const prev = document.documentElement.getAttribute('data-theme');
      document.documentElement.setAttribute('data-theme', 'light');
      return () => {
        if (prev) document.documentElement.setAttribute('data-theme', prev);
        else document.documentElement.removeAttribute('data-theme');
      };
    } catch (e) { void e; }
  }, []);
  const t = useT('landing').landing;
  const lang = String(useLang('global') || 'en').slice(0, 2);
  const footerInfo = (FOOTER_INFO[lang] || FOOTER_INFO.en)?.[footerInfoKey] || null;
  const footerLabels = ({
    en: {
      services: 'Services',
      company: 'Company',
      legal: 'Legal',
      privacy: 'Privacy Policy',
      terms: 'Terms of Use',
      cookie: 'Cookie Policy',
    },
    pt: {
      services: 'Servicos',
      company: 'Empresa',
      legal: 'Legal',
      privacy: 'Politica de Privacidade',
      terms: 'Termos de Uso',
      cookie: 'Politica de Cookies',
    },
    es: {
      services: 'Servicios',
      company: 'Empresa',
      legal: 'Legal',
      privacy: 'Politica de Privacidad',
      terms: 'Terminos de Uso',
      cookie: 'Politica de Cookies',
    },
  })[lang] || ({
    services: 'Services',
    company: 'Company',
    legal: 'Legal',
    privacy: 'Privacy Policy',
    terms: 'Terms of Use',
    cookie: 'Cookie Policy',
  });
  const steps = [
    { icon:"grid",   t:t.steps.discover.t, d:t.steps.discover.d },
    { icon:"heart",  t:t.steps.match.t,    d:t.steps.match.d },
    { icon:"nugget", t:t.steps.nugget.t,   d:t.steps.nugget.d },
    { icon:"phone",  t:t.steps.close.t,    d:t.steps.close.d },
  ];
  const stats = [
    ["1,1K", t.members],
    ["$83M", t.deals],
    ["50",   t.states],
    ["4.9",  t.rating],
  ];
  const ROLE_COLORS = {
    wholesaler:'#4381BC', lender:'#10B981', ff:'#F97316',
    attorney:'#8B5CF6',   auction:'#EF4444', services:'#0EA5E9',
    investor:'#6366F1',   buyer:'#14B8A6',   seller:'#F59E0B', consulting:'#7C3AED',
  };
  const TAG_COLORS = {
    'Opportunity':'#4381BC','Fix Upper':'#F97316','FSBO':'#8B5CF6',
    'Motivated Seller':'#EF4444','Seller Financing':'#10B981',
    'Value Add':'#0EA5E9','Auction':'#DC2626','BRRRR':'#7C3AED','Portfolio':'#6366F1',
  };
  const HERO_MOSAIC_COLS = [
    [
      { kind:'profile',  img:'https://randomuser.me/api/portraits/men/32.jpg',    name:'Marcus Realty',      role:'Wholesaler',       cat:'wholesaler' },
      { kind:'property', img:'https://picsum.photos/seed/sfr-phoenix-1/300/200',  price:'$185K', city:'Phoenix, AZ',     type:'SFR',         tag:'Opportunity'       },
      { kind:'profile',  img:'https://randomuser.me/api/portraits/women/44.jpg',  name:'Sarah Mitchell',     role:'RE Investor',      cat:'investor'   },
      { kind:'property', img:'https://picsum.photos/seed/multi-dallas-1/300/200', price:'$890K', city:'Dallas, TX',      type:'Multifamily',  tag:'FSBO'              },
      { kind:'profile',  img:'https://randomuser.me/api/portraits/men/67.jpg',    name:'Tommy Const.',       role:'Contractor',       cat:'ff'         },
    ],
    [
      { kind:'property', img:'https://picsum.photos/seed/sfr-atlanta-1/300/200',  price:'$220K', city:'Atlanta, GA',     type:'SFR',         tag:'Fix Upper'         },
      { kind:'profile',  img:'https://randomuser.me/api/portraits/women/28.jpg',  name:'Olivia Chen',        role:'RE Attorney',      cat:'attorney'   },
      { kind:'property', img:'https://picsum.photos/seed/sfr-miami-1/300/200',    price:'$225K', city:'Miami, FL',       type:'SFR',         tag:'Fix Upper'         },
      { kind:'profile',  img:'https://randomuser.me/api/portraits/men/45.jpg',    name:'Jason Park',         role:'Cash Buyer',       cat:'buyer'      },
      { kind:'property', img:'https://picsum.photos/seed/sfr-denver-1/300/200',   price:'$280K', city:'Denver, CO',      type:'SFR',         tag:'Motivated Seller'  },
    ],
    [
      { kind:'profile',  img:'https://randomuser.me/api/portraits/women/12.jpg',  name:'SunBelt Capital',    role:'Lender',           cat:'lender'     },
      { kind:'property', img:'https://picsum.photos/seed/ind-la-1/300/200',       price:'$1.2M', city:'Los Angeles, CA', type:'Industrial',   tag:'Motivated Seller'  },
      { kind:'profile',  img:'https://randomuser.me/api/portraits/women/56.jpg',  name:'LensUp Media',       role:'Photography',      cat:'services'   },
      { kind:'property', img:'https://picsum.photos/seed/multi-nash-1/300/200',   price:'$760K', city:'Nashville, TN',   type:'Multifamily',  tag:'Value Add'         },
      { kind:'profile',  img:'https://randomuser.me/api/portraits/men/22.jpg',    name:'Cash Kings TX',      role:'Wholesaler',       cat:'wholesaler' },
    ],
    [
      { kind:'property', img:'https://picsum.photos/seed/sfr-houston-1/300/200',  price:'$165K', city:'Houston, TX',     type:'SFR',         tag:'Fix Upper'         },
      { kind:'profile',  img:'https://randomuser.me/api/portraits/women/34.jpg',  name:'Bridge Builders',    role:'Lender',           cat:'lender'     },
      { kind:'property', img:'https://picsum.photos/seed/multi-la-1/300/200',     price:'$1.29M',city:'Los Angeles, CA', type:'Multifamily',  tag:'Value Add'         },
      { kind:'profile',  img:'https://randomuser.me/api/portraits/men/78.jpg',    name:'Iron Fox Renov.',    role:'Contractor',       cat:'ff'         },
      { kind:'property', img:'https://picsum.photos/seed/sfr-seattle-1/300/200',  price:'$365K', city:'Seattle, WA',     type:'SFR',         tag:'Motivated Seller'  },
    ],
    [
      { kind:'profile',  img:'https://randomuser.me/api/portraits/men/15.jpg',    name:'Desert Ridge',       role:'Auction Buyer',    cat:'auction'    },
      { kind:'property', img:'https://picsum.photos/seed/comm-phoenix-1/300/200', price:'$450K', city:'Phoenix, AZ',     type:'Commercial',   tag:'Seller Financing'  },
      { kind:'profile',  img:'https://randomuser.me/api/portraits/men/55.jpg',    name:'Apex RE Consulting', role:'RE Consulting',    cat:'consulting' },
      { kind:'property', img:'https://picsum.photos/seed/sfr-denver-2/300/200',   price:'$245K', city:'Denver, CO',      type:'SFR',         tag:'Fix Upper'         },
      { kind:'profile',  img:'https://randomuser.me/api/portraits/women/67.jpg',  name:'Maria Rodriguez',    role:'Motivated Seller', cat:'seller'     },
    ],
  ];

  return (
    <div style={{ paddingTop:58 }}>
      <style>{`
        @keyframes arrowFlowX {
          0% { transform: translateX(-6px); opacity: 0.35; }
          100% { transform: translateX(10px); opacity: 1; }
        }
        @keyframes arrowFlowY {
          0% { transform: translateY(-4px) rotate(90deg); opacity: 0.35; }
          100% { transform: translateY(8px) rotate(90deg); opacity: 1; }
        }
        @keyframes scrollRight {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes scrollLeft {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        .carousel-row {
          display: flex;
          gap: 10px;
          width: fit-content;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        .carousel-row-right {
          animation-name: scrollRight;
        }
        .carousel-row-left {
          animation-name: scrollLeft;
        }
        .carousel-container:hover .carousel-row {
          animation-play-state: paused;
        }
        .carousel-container {
          overflow: hidden;
          margin-bottom: 10px;
          display: flex;
        }
        .steps-sequence {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0;
          flex-wrap: nowrap;
        }
        .platform-card {
          position: relative;
          overflow: hidden;
          flex-shrink: 0;
          width: 140px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06);
          transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
        }
        .platform-card:hover {
          transform: translateY(-6px) scale(1.03);
          border-color: rgba(67, 129, 188, 0.45) !important;
          box-shadow: 0 16px 32px rgba(0, 0, 0, 0.15), 0 8px 16px rgba(0, 0, 0, 0.1);
          z-index: 10;
        }
        @keyframes mosaicScrollUp {
          from { transform: translateY(0); }
          to   { transform: translateY(-50%); }
        }
        @keyframes mosaicScrollDown {
          from { transform: translateY(-50%); }
          to   { transform: translateY(0); }
        }
        .timeline-link {
          position: relative;
          width: 56px;
          height: 14px;
          margin: 0 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .timeline-link::before {
          content: "";
          position: absolute;
          left: 0;
          right: 10px;
          height: 2px;
          border-radius: 999px;
          background: rgba(245, 158, 11, 0.45);
        }
        .timeline-link::after {
          content: "➤";
          position: absolute;
          right: 0;
          color: rgba(245, 158, 11, 0.95);
          font-size: 12px;
          line-height: 1;
          animation: arrowFlowX 0.9s ease-in-out infinite alternate;
        }
        @media (max-width: 860px) {
          .steps-sequence { flex-direction: column; }
          .timeline-link { width: 14px; height: 24px; margin: 8px 0; }
          .timeline-link::before { left: 50%; right: auto; top: 0; width: 2px; height: 16px; transform: translateX(-50%); }
          .timeline-link::after { right: auto; bottom: -2px; left: 50%; transform: translateX(-50%) rotate(90deg); animation: arrowFlowY 0.9s ease-in-out infinite alternate; }
          .hero-mc-0, .hero-mc-4 { display: none; }
        }
        @media (max-width: 560px) {
          .hero-mc-3 { display: none; }
        }
      `}</style>

      <section style={{ minHeight:'92vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:isMobile ? '18px 14px 42px' : '20px 20px 50px', position:'relative', overflow:'hidden', background:'#f8fafc' }}>

        {/* ── Mosaico tipo Tinder de fundo ── */}
        <div aria-hidden="true" style={{ position:'absolute', inset:0, zIndex:0, pointerEvents:'none', display:'flex', alignItems:'stretch', gap:10, padding:'0 8px', contain:'paint' }}>
          {HERO_MOSAIC_COLS.map((col, ci) => {
            const dirs = ['mosaicScrollUp','mosaicScrollDown','mosaicScrollUp','mosaicScrollDown','mosaicScrollUp'];
            const durs = ['30s','22s','36s','26s','28s'];
            return (
              <div key={ci} className={`hero-mc hero-mc-${ci}`} style={{ flex:1, minWidth:0, overflow:'hidden' }}>
                <div style={{ display:'flex', flexDirection:'column', gap:10, animation:`${dirs[ci]} ${durs[ci]} linear infinite`, willChange:'transform' }}>
                  {[...col, ...col].map((item, idx) => (
                    <div key={idx} style={{ borderRadius:12, overflow:'hidden', background:'#fff', flexShrink:0, border: item.kind==='profile' ? '1px solid rgba(67,129,188,0.14)' : '1px solid rgba(0,0,0,0.06)', boxShadow:'0 2px 10px rgba(0,0,0,0.09)' }}>
                      {item.kind === 'property' ? (
                        <>
                          <div style={{ position:'relative' }}>
                            <img src={item.img} alt="" loading="lazy" style={{ width:'100%', height:90, objectFit:'cover', display:'block' }} />
                            <span style={{ position:'absolute', bottom:5, left:6, fontSize:8, fontWeight:700, padding:'2px 6px', borderRadius:99, background: TAG_COLORS[item.tag]||'#4381BC', color:'#fff' }}>{item.tag}</span>
                          </div>
                          <div style={{ padding:'6px 8px 8px' }}>
                            <div style={{ fontSize:11, fontWeight:800, color:'#0F172A' }}>{item.price}</div>
                            <div style={{ fontSize:9, color:'#64748B', marginTop:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.city} · {item.type}</div>
                          </div>
                        </>
                      ) : (
                        <>
                          <img src={item.img} alt="" loading="lazy" style={{ width:'100%', height:115, objectFit:'cover', display:'block' }} />
                          <div style={{ padding:'7px 8px 8px' }}>
                            <div style={{ fontSize:10, fontWeight:700, color:'#0F172A', lineHeight:1.3, marginBottom:4, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.name}</div>
                            <span style={{ display:'inline-block', fontSize:8, fontWeight:700, padding:'2px 6px', borderRadius:99, background: ROLE_COLORS[item.cat]||'#4381BC', color:'#fff' }}>{item.role}</span>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Gradiente central para legibilidade ── */}
        <div style={{ position:'absolute', inset:0, zIndex:1, pointerEvents:'none', background:'radial-gradient(ellipse 62% 74% at 50% 50%, rgba(248,250,252,0.97) 0%, rgba(248,250,252,0.92) 26%, rgba(248,250,252,0.70) 46%, rgba(248,250,252,0.22) 64%, transparent 82%)' }} />

        {/* ── Conteúdo central ── */}
        <div style={{ position:'relative', zIndex:2, width: '100%', maxWidth: 800 }}>
          <h1 style={{ fontSize:"clamp(30px,7vw,66px)", fontWeight:900, color:C.t1, lineHeight:1.1, marginBottom:20, letterSpacing:isMobile ? '-1.2px' : '-2px', maxWidth:800, marginInline: 'auto' }}>
            {t.headline1}<br /><span style={{ color:C.accent }}>{t.headline2}</span><br />{t.headline3}
          </h1>
          <p style={{ fontSize:"clamp(14px,2.5vw,18px)", color:C.t2, maxWidth:520, lineHeight:1.7, marginBottom:36, margin:"0 auto 36px", textAlign:"center" }}>
            {t.subtitle}
          </p>
          <div style={{ display:"flex", gap:22, flexWrap:"wrap", justifyContent:"center", marginBottom:10 }}>
            <button onClick={() => onOpenAuthModal('signup')} style={{ padding:"14px 32px", borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:15, border:"none", cursor:"pointer", width: isMobile ? '100%' : 'auto', maxWidth: isMobile ? 340 : 'none' }}>{t.getStarted}</button>
          </div>
          <div style={{ display:"flex", gap:"clamp(20px,5vw,48px)", marginTop:20, flexWrap:"wrap", justifyContent:"center" }}>
            {stats.map(([n,l]) => (
              <div key={l} style={{ textAlign:"center" }}>
                <div style={{ fontSize:"clamp(22px,4vw,28px)", fontWeight:800, color:C.t1 }}>{n}</div>
                <div style={{ fontSize:12, color:C.t3 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ background: '#f2f2f2' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '56px 16px 72px' : '76px 32px 96px', display: 'flex', alignItems: 'center', gap: isMobile ? '28px' : '48px 60px', flexWrap: 'wrap' }}>

          {/* ── LEFT: animated swipe card stack ── */}
          <div style={{ flex: isMobile ? '1 1 100%' : '1 1 460px', minWidth: isMobile ? 0 : 320 }}>
            <div style={{ marginBottom: 36 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.gold, marginBottom: 8 }}>Live Preview</div>
              <h3 style={{ fontSize: 'clamp(16px,2.4vw,20px)', fontWeight: 800, color: '#222c48', marginBottom: 8, margin: '0 0 8px' }}>See it in action</h3>
              <p style={{ fontSize: 13, color: '#222c48', lineHeight: 1.65, margin: 0 }}>Real professionals, real deals. Swipe free — pay only to unlock contacts.</p>
            </div>
            {/* Stack + buttons wrapper — needs extra bottom padding for buttons */}
            <div style={{ paddingBottom: 64 }}>
              <NuggetSwipeDemo />
            </div>
          </div>

          {/* ── RIGHT: nugget diagram ── */}
          <div style={{ flex: isMobile ? '1 1 100%' : '1 1 380px', minWidth: isMobile ? 0 : 300 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <Icon name="nugget" size={36} color={C.gold} strokeWidth={1.2} />
              <h2 style={{ fontSize: 'clamp(20px,4vw,30px)', fontWeight: 900, color: C.gold, margin: 0 }}>{t.howNuggetsWork}</h2>
            </div>
            <p style={{ color: '#222c48', fontSize: 'clamp(13px,2vw,15px)', marginBottom: 40, lineHeight: 1.75, maxWidth: 460 }}>{t.nuggetsSubtitle}</p>

            {/* Vertical flow diagram */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {steps.map(({ icon, t: title, d }, idx) => (
                <div key={title} style={{ display: 'flex', alignItems: 'flex-start', gap: 18 }}>
                  {/* Icon + connector line */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{
                      width: 46, height: 46, borderRadius: '50%',
                      background: 'rgba(245,158,11,0.10)',
                      border: '1.5px solid rgba(245,158,11,0.38)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Icon name={icon} size={20} color={C.gold} strokeWidth={1.6} />
                    </div>
                    {idx < steps.length - 1 && (
                      <div style={{
                        width: 1.5, minHeight: 28, flex: 1,
                        background: 'linear-gradient(to bottom, rgba(245,158,11,0.38), rgba(245,158,11,0.07))',
                        margin: '5px 0',
                      }} />
                    )}
                  </div>
                  {/* Text */}
                  <div style={{ paddingBottom: idx < steps.length - 1 ? 24 : 0 }}>
                    <div style={{ fontWeight: 700, color: '#222c48', fontSize: 14, marginBottom: 4 }}>{title}</div>
                    <div style={{ fontSize: 12, color: '#222c48', lineHeight: 1.65 }}>{d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section style={{ maxWidth:"100%", margin:"0 auto", padding:isMobile ? '56px 14px' : '72px 20px', background:"#fff" }}>
        <div style={{ maxWidth:980, margin:"0 auto" }}>
          <h2 style={{ textAlign:"center", fontSize:"clamp(22px,4vw,32px)", fontWeight:800, color:'#1e2d4d', marginBottom:10 }}>{t.onePlatform}</h2>
          <p style={{ textAlign:"center", color:"#64748B", fontSize:"clamp(13px,2vw,15px)", marginBottom:isMobile ? 34 : 52, lineHeight:1.6 }}>Connect with experts in every area of the real estate industry</p>
          {(() => {
            // 6-column grid — positions 6, 12, 18 are the new "sixth column" items
            const PROF_ITEMS = [
              // row 1
              { iconId:'wholesaler',     label:'Wholesalers',           desc:'Connect deals and opportunities' },
              { iconId:'investor',       label:'Investors',             desc:'Find investment opportunities' },
              { iconId:'lender',         label:'Lenders',               desc:'Mortgage and financing solutions' },
              { iconId:'seller',         label:'Property Owners',       desc:'List and manage your properties' },
              { iconId:'buyer',          label:'Cash Buyers',           desc:'Direct acquisition ready' },
              { iconId:'svc_d4d',        label:'Drive 4 $',             desc:'Find distressed properties by driving' },
              // row 2
              { iconId:'ff',             label:'Fix & Flip',            desc:'Rehab and resale specialists' },
              { iconId:'ff_gc',          label:'Contractors',           desc:'Construction and renovation services' },
              { iconId:'attorney',       label:'Real Estate Attorneys', desc:'Legal services for real estate' },
              { iconId:'services',       label:'Title Companies',       desc:'Title insurance and closing services' },
              { iconId:'auction',        label:'Auctions',              desc:'Consulting and Advisory Services for Auctions' },
              { iconId:'ff_rehab',       label:'Rehab Staff',           desc:'Rehabilitation project specialists' },
              // row 3
              { iconId:'tax',            label:'Tax Deed / Lien',       desc:'Tax sale investment strategies' },
              { iconId:'svc_photo',      label:'RE Photographers',      desc:'Listings and aerial photography' },
              { iconId:'svc_survey',     label:'Surveyors',             desc:'Land and boundary surveys' },
              { iconId:'svc_va',         label:'Virtual Assistants',    desc:'Remote support for RE businesses' },
              { iconId:'svc_notary',     label:'Notaries',              desc:'Notarization and document services' },
              { iconId:'svc_accountant', label:'Accountant',            desc:'Accounting and tax services for RE' },
            ];
            return (
              <div style={{ display:'grid', gridTemplateColumns:isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(6, 1fr)', gap:isMobile ? '16px 10px' : '24px 20px' }}>
                {PROF_ITEMS.map(item => (
                  <ProfItem key={item.iconId} item={item} />
                ))}
              </div>
            );
          })()}
        </div>
      </section>

      {/* ─── Most Requested Services ─── */}
      {(() => {
        const SERVICES = [
          {
            id: 'evaluation',
            img: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=460&h=220&fit=crop&crop=center',
            title: 'Property Evaluation',
            desc: 'Professional evaluations for investment',
          },
          {
            id: 'legal',
            img: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=460&h=220&fit=crop&crop=center',
            title: 'Legal Services',
            desc: 'Specialized real estate legal advisory',
          },
          {
            id: 'financing',
            img: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=460&h=220&fit=crop&crop=center',
            title: 'Financing',
            desc: 'Flexible financing solutions',
          },
        ];
        const activeSvc = SERVICES.find(s => s.id === activeService);
        return (
          <section style={{ padding: isMobile ? '56px 14px 64px' : '72px 20px 80px', background: '#f2f2f2' }}>
            <div style={{ maxWidth: 980, margin: '0 auto' }}>
              {activeService === null ? (
                /* ── Tile grid ── */
                <>
                  <h2 style={{ textAlign: 'center', fontSize: 'clamp(22px,4vw,32px)', fontWeight: 800, color: '#1e2d4d', marginBottom: 8 }}>
                    Most Requested Services
                  </h2>
                  <p style={{ textAlign: 'center', color: '#64748B', fontSize: 'clamp(13px,2vw,15px)', marginBottom: isMobile ? 28 : 48, lineHeight: 1.6 }}>
                    Discover the most popular services on our platform
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: isMobile ? 16 : 24 }}>
                    {SERVICES.map(svc => (
                      <div key={svc.id} style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column' }}>
                        <img src={svc.img} alt={svc.title} style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }} />
                        <div style={{ padding: '20px 22px 24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                          <div style={{ fontWeight: 700, color: '#1e2d4d', fontSize: 17, marginBottom: 6 }}>{svc.title}</div>
                          <div style={{ color: '#64748B', fontSize: 13, marginBottom: 16, flex: 1 }}>{svc.desc}</div>
                          <button
                            onClick={() => setActiveService(svc.id)}
                            style={{ background: 'none', border: 'none', color: C.gold, fontWeight: 700, fontSize: 13, cursor: 'pointer', padding: 0, textAlign: 'left' }}
                            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                          >
                            Request Service →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                /* ── App card preview ── */
                <>
                  {/* Back + title row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: isMobile ? 24 : 40, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                    <button
                      onClick={() => setActiveService(null)}
                      style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 14px', color: '#64748B', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.color = '#1e2d4d'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748B'; }}
                    >
                      ← Back
                    </button>
                    <h2 style={{ fontSize: 'clamp(18px,3vw,26px)', fontWeight: 800, color: '#1e2d4d', margin: 0 }}>
                      {activeSvc?.title}
                    </h2>
                  </div>

                  {/* Two-column preview */}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(340px, 1fr))', gap: isMobile ? 24 : 40 }}>
                    {/* Professionals column */}
                    <div>
                      <div style={{ fontWeight: 800, color: '#1e2d4d', fontSize: 20, marginBottom: 4 }}>Professionals</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 20 }}>
                        <div style={{ fontWeight: 600, color: '#1e2d4d', fontSize: 14 }}>Find Professionals</div>
                        <div style={{ color: '#64748B', fontSize: 13 }}>Swipe right to connect</div>
                      </div>
                      <div style={{ height: 280 }}>
                        <LandingProfCard onClick={() => onOpenAuthModal('signup')} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 18 }}>
                        <button onClick={() => onOpenAuthModal('signup')} style={{ width: 42, height: 42, borderRadius: '50%', border: '1.5px solid #ef4444', background: 'rgba(239,68,68,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <Icon name="close" size={17} color="#ef4444" strokeWidth={2.2} />
                        </button>
                        <button onClick={() => onOpenAuthModal('signup')} style={{ width: 42, height: 42, borderRadius: '50%', border: '1.5px solid rgba(234,179,8,0.9)', background: 'rgba(234,179,8,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <Icon name="star" size={17} color={C.gold} strokeWidth={2} />
                        </button>
                        <button onClick={() => onOpenAuthModal('signup')} style={{ width: 42, height: 42, borderRadius: '50%', border: '1.5px solid #22c55e', background: 'rgba(34,197,94,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <Icon name="check" size={17} color="#22c55e" strokeWidth={2.2} />
                        </button>
                      </div>
                      <div style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 10 }}>0 connections made • 6 remaining</div>
                    </div>

                    {/* Opportunities column */}
                    <div>
                      <div style={{ fontWeight: 800, color: '#1e2d4d', fontSize: 20, marginBottom: 4 }}>Opportunities</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 20 }}>
                        <div style={{ fontWeight: 600, color: '#1e2d4d', fontSize: 14 }}>Investment Opportunities</div>
                        <div style={{ color: '#64748B', fontSize: 13 }}>Swipe right to connect</div>
                      </div>
                      <div style={{ height: 280 }}>
                        <LandingPropCard onClick={() => onOpenAuthModal('signup')} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 18 }}>
                        <button onClick={() => onOpenAuthModal('signup')} style={{ width: 42, height: 42, borderRadius: '50%', border: '1.5px solid #ef4444', background: 'rgba(239,68,68,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <Icon name="close" size={17} color="#ef4444" strokeWidth={2.2} />
                        </button>
                        <button onClick={() => onOpenAuthModal('signup')} style={{ width: 42, height: 42, borderRadius: '50%', border: '1.5px solid rgba(234,179,8,0.9)', background: 'rgba(234,179,8,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <Icon name="star" size={17} color={C.gold} strokeWidth={2} />
                        </button>
                        <button onClick={() => onOpenAuthModal('signup')} style={{ width: 42, height: 42, borderRadius: '50%', border: '1.5px solid #22c55e', background: 'rgba(34,197,94,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <Icon name="check" size={17} color="#22c55e" strokeWidth={2.2} />
                        </button>
                      </div>
                      <div style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 10 }}>0 connections made • 4 remaining</div>
                    </div>
                  </div>

                  {/* CTA bottom */}
                  <div style={{ textAlign: 'center', marginTop: isMobile ? 30 : 48, padding: isMobile ? '24px 14px' : '32px 20px', background: '#fff', borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
                    <p style={{ color: '#1e2d4d', fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Ready to connect?</p>
                    <p style={{ color: '#64748B', fontSize: 13, marginBottom: 20 }}>Create your free account to start swiping and unlock contacts</p>
                    <button onClick={() => onOpenAuthModal('signup')} style={{ padding: '13px 40px', borderRadius: 12, background: C.gold, color: '#fff', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, width: isMobile ? '100%' : 'auto', justifyContent: 'center', maxWidth: isMobile ? 320 : 'none' }}>
                      <Icon name="heart" size={16} color="#fff" strokeWidth={2} />
                      Get Started Free
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>
        );
      })()}

      <section style={{ textAlign:"center", padding:isMobile ? '50px 14px 64px' : '60px 20px 80px', background:"#f2f2f2" }}>
        <h2 style={{ fontSize:"clamp(24px,5vw,36px)", fontWeight:900, color:C.gold, marginBottom:12, letterSpacing:"-1px" }}>{t.ctaHeadline}</h2>
        <p style={{ color:"#222c48", fontSize:16, marginBottom:32 }}>{t.ctaSubtitle}</p>
        <button onClick={() => onOpenAuthModal('signup')} style={{ padding:"15px 44px", borderRadius:14, background:C.gold, color:'#fff', fontWeight:700, fontSize:17, border:"none", cursor:"pointer", width: isMobile ? '100%' : 'auto', maxWidth: isMobile ? 320 : 'none' }}>{t.ctaButton}</button>
      </section>

      {footerInfo ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={footerInfo.title}
          onClick={() => setFooterInfoKey(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 10090, background: 'rgba(15,23,42,0.54)', display: 'grid', placeItems: 'center', padding: isMobile ? 14 : 24 }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{ width: 'min(92vw, 620px)', maxHeight: 'min(82vh, 680px)', overflowY: 'auto', borderRadius: 22, background: '#fff', border: '1px solid rgba(20,184,166,0.28)', boxShadow: '0 26px 80px rgba(15,23,42,0.28)', padding: isMobile ? 18 : 26 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18, marginBottom: 14 }}>
              <div>
                <div style={{ color: '#14B8A6', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>{footerInfo.kicker}</div>
                <h2 style={{ margin: 0, color: '#111827', fontSize: isMobile ? 24 : 30, lineHeight: 1.05, letterSpacing: '-0.04em' }}>{footerInfo.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setFooterInfoKey(null)}
                aria-label="Close"
                style={{ width: 36, height: 36, borderRadius: 12, border: '1px solid rgba(34,44,72,0.14)', background: '#fff', color: '#222c48', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name="close" size={16} color="#222c48" />
              </button>
            </div>
            <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
              {footerInfo.body.map((paragraph) => (
                <p key={paragraph} style={{ margin: 0, color: '#334155', fontSize: 14, lineHeight: 1.65 }}>{paragraph}</p>
              ))}
            </div>
            <div style={{ marginTop: 20, borderRadius: 16, border: '1px solid rgba(20,184,166,0.22)', background: 'rgba(20,184,166,0.07)', padding: 14, color: '#0f766e', fontSize: 13, fontWeight: 800, lineHeight: 1.5 }}>
              {footerInfo.cta}
            </div>
          </div>
        </div>
      ) : null}

      <footer style={{ background: '#f2f2f2', color: '#222c48' }}>
        {/* ── Main columns ── */}
        <div style={{
          maxWidth: 1100, margin: '0 auto',
          padding: isMobile ? '42px 16px 34px' : '56px 32px 48px',
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'minmax(200px,1.6fr) repeat(3, minmax(120px,1fr))',
          gap: isMobile ? '26px' : '40px 32px',
        }}>
          {/* Brand column */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10 }}>
              <DealSifterLogo size={42} />
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
                <span style={{
                  fontFamily: "'Eras Bold ITC', 'Eras ITC', sans-serif",
                  fontWeight: 800, fontSize: 28.71, letterSpacing: '-0.5px',
                  color: '#000',
                }}>
                  <span>Deal</span><span style={{ color: '#14B8A6' }}>Sifter</span>
                </span>
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#222c48', marginBottom: 14, fontWeight: 500 }}>Swipe. Match. Close Deals.</div>
            <p style={{ fontSize: 13, color: '#222c48', lineHeight: 1.65, maxWidth: 220, margin: 0 }}>
              Connecting real estate professionals across the United States
            </p>
          </div>

          {/* Services */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#222c48', marginBottom: 18 }}>{footerLabels.services}</div>
            {[
              { label: (FOOTER_INFO[lang] || FOOTER_INFO.en).findProfessionals.title,       action: () => setFooterInfoKey('findProfessionals') },
              { label: (FOOTER_INFO[lang] || FOOTER_INFO.en).investmentOpportunities.title, action: () => setFooterInfoKey('investmentOpportunities') },
              { label: (FOOTER_INFO[lang] || FOOTER_INFO.en).legalServices.title,           action: () => setFooterInfoKey('legalServices') },
              { label: (FOOTER_INFO[lang] || FOOTER_INFO.en).financing.title,               action: () => setFooterInfoKey('financing') },
            ].map(item => (
              <button key={item.label} onClick={item.action} style={{ display: 'block', background: 'none', border: 'none', color: '#222c48', fontSize: 13, cursor: 'pointer', padding: '0 0 12px', textAlign: 'left', lineHeight: 1.4, transition: 'color .15s' }}
                onMouseEnter={e => e.currentTarget.style.color = '#14B8A6'}
                onMouseLeave={e => e.currentTarget.style.color = '#222c48'}
              >{item.label}</button>
            ))}
          </div>

          {/* Company */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#222c48', marginBottom: 18 }}>{footerLabels.company}</div>
            {[
              { label: (FOOTER_INFO[lang] || FOOTER_INFO.en).about.title,      action: () => setFooterInfoKey('about') },
              { label: (FOOTER_INFO[lang] || FOOTER_INFO.en).howItWorks.title, action: () => setFooterInfoKey('howItWorks') },
              { label: (FOOTER_INFO[lang] || FOOTER_INFO.en).security.title,   action: () => setFooterInfoKey('security') },
              { label: (FOOTER_INFO[lang] || FOOTER_INFO.en).support.title,    action: () => setFooterInfoKey('support') },
            ].map(item => (
              <button key={item.label} onClick={item.action} style={{ display: 'block', background: 'none', border: 'none', color: '#222c48', fontSize: 13, cursor: 'pointer', padding: '0 0 12px', textAlign: 'left', lineHeight: 1.4, transition: 'color .15s' }}
                onMouseEnter={e => e.currentTarget.style.color = '#14B8A6'}
                onMouseLeave={e => e.currentTarget.style.color = '#222c48'}
              >{item.label}</button>
            ))}
          </div>

          {/* Legal */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#222c48', marginBottom: 18 }}>{footerLabels.legal}</div>
            {[
              { label: footerLabels.privacy, action: () => setPage('privacy') },
              { label: footerLabels.terms,   action: () => setPage('terms')   },
              { label: footerLabels.cookie,  action: () => setFooterInfoKey('cookiePolicy') },
            ].map(item => (
              <button key={item.label} onClick={item.action} style={{ display: 'block', background: 'none', border: 'none', color: '#222c48', fontSize: 13, cursor: 'pointer', padding: '0 0 12px', textAlign: 'left', lineHeight: 1.4, transition: 'color .15s' }}
                onMouseEnter={e => e.currentTarget.style.color = '#14B8A6'}
                onMouseLeave={e => e.currentTarget.style.color = '#222c48'}
              >{item.label}</button>
            ))}
          </div>
        </div>

        {/* ── Bottom bar ── */}
        <div style={{ borderTop: '1px solid rgba(34,44,72,0.12)', padding: isMobile ? '14px 16px' : '18px 32px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: isMobile ? 'center' : 'space-between', gap: '8px 20px', maxWidth: 1100, margin: '0 auto', textAlign: isMobile ? 'center' : 'left' }}>
          <span style={{ fontSize: 12, color: '#222c48' }}>© {new Date().getFullYear()} DealSifter. All rights reserved.</span>
          <span style={{ fontSize: 12, color: '#222c48' }}>contato.dealsifter@gmail.com</span>
        </div>
      </footer>
    </div>
  );
}
