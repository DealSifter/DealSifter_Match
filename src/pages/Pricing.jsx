import React, { useState } from 'react';
import { C } from '../theme/colors';
import { useT } from '../i18n/translations';
import {
  EXCLUSIVE_CONTACT_RULE,
  FEATURED_PROFILE_RULE,
  NUGGET_PACKS,
  PLANS,
  VERIFIED_PROFILE_RULE,
} from '../data/mockData';
import { Icon } from '../components/ui/Icon';

export function Pricing({ setPage, setModal, prevPage, addToast, onRequestCheckoutIntent }) {
  const allT = useT('pricing');
  const t = allT.pricing;
  const [checkoutLoading, setCheckoutLoading] = useState(null);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const annualDiscountPct = 15;
  const isAnnualBilling = billingCycle === 'annual';

  const planName = (id, fallback) => t.planNames?.[id] || fallback;
  const featureMap = {
    free: ['f1', 'f2', 'f3', 'f4', 'f5'],
    pro: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'],
    enterprise: ['e1', 'e2', 'e3', 'e4', 'e5'],
  };
  const planFeatures = (id, fallbackFeatures) => {
    const keys = featureMap[id] || [];
    if (!keys.length) return fallbackFeatures;
    return keys.map((k, i) => t.planFeatures?.[k] || fallbackFeatures[i]).filter(Boolean);
  };
  const displayPlanPrice = (plan) => {
    const price = Number(plan.price || 0);
    if (!price || !isAnnualBilling) return price;
    return Math.round(price * (1 - annualDiscountPct / 100));
  };
  const displayAnnualTotal = (plan) => {
    const price = Number(plan.price || 0);
    if (!price) return 0;
    return Math.round(price * 12 * (1 - annualDiscountPct / 100));
  };
  const yes = <Icon name="check" size={14} color={C.accent} strokeWidth={2.3} />;
  const dash = <span style={{ color: C.t3 }}>—</span>;
  const comparisonSections = [
    {
      title: t.compareSectionAccess || 'Access & Usage',
      rows: [
        [t.compareMonthlyNuggets || 'Gold Nuggets/month', '3', '20 + 3', '60 + 20'],
        [t.compareDailySwipes || 'Daily feed swipes', '10', t.compareUnlimited || 'Unlimited', t.compareUnlimited || 'Unlimited'],
        [t.compareDailyFavorites || 'Favorited matches/day', '5', t.compareUnlimited || 'Unlimited', t.compareUnlimited || 'Unlimited'],
        [t.compareActiveMatches || 'Active unlocked matches', '3', '10', t.compareUnlimited || 'Unlimited'],
        [t.compareMonthlyUnlocks || 'Monthly unlocks', '3', '10', t.compareUnlimited || 'Unlimited'],
      ],
    },
    {
      title: t.compareDealTools || 'Deal Tools',
      rows: [
        [t.compareUnlockCost || 'Unlock cost rule', t.comparePortfolioCost || 'By portfolio size', t.comparePortfolioCost || 'By portfolio size', t.comparePortfolioCost || 'By portfolio size'],
        [t.comparePdfExport || 'Unlocked property PDF export', dash, yes, yes],
        [t.compareDealSifterChat || 'DealSifter chat', t.compareViewOnly || 'View only', yes, yes],
        [t.compareExclusiveContacts || 'Exclusive contacts included', dash, dash, '2/mo'],
        [t.compareSpotlight || 'Featured Profile / Spotlight', t.compareOptional10 || 'Optional · 10 nuggets', t.compareDiscount20 || '20% discount', t.compareIncluded || 'Included'],
      ],
    },
    {
      title: t.compareTrust || 'Trust & Visibility',
      rows: [
        [t.compareProfileType || 'Profile visibility', t.compareStandard || 'Standard', t.compareBoosted || 'Boosted', t.comparePriority || 'Priority'],
        [t.compareVerification || 'Verified profile badge', t.compareOptional || 'Optional', t.compareOptional || 'Optional', t.compareOptional || 'Optional'],
        [t.compareSupport || 'Support channel', t.compareStandardSupport || 'Standard', t.compareChatSupport || 'Chat support', t.comparePrioritySupport || 'Priority support'],
      ],
    },
  ];
  const faqItems = [
    {
      q: t.faqPlanChangeQ || 'Can I change my subscription plan later?',
      a: t.faqPlanChangeA || 'Yes. You can upgrade when you need more unlocks, matches, chat access or visibility. Downgrades return the account to the limits of the selected plan at the next billing cycle.',
    },
    {
      q: t.faqNuggetsQ || 'How do Gold Nuggets work?',
      a: t.faqNuggetsA || 'Nuggets are platform credits used for unlocks, exclusivity and spotlight visibility. Contact unlock cost follows the active portfolio size of the card owner.',
    },
    {
      q: t.faqFreeQ || 'What happens when I reach Basic plan limits?',
      a: t.faqFreeA || 'The app keeps your account active, but restricted actions show an upgrade notice. Basic includes 10 swipes/day, 5 favorited matches/day and 3 active unlocked matches.',
    },
    {
      q: t.faqExclusivityQ || 'What is exclusive contact access?',
      a: t.faqExclusivityA || 'If you are the first to unlock an eligible property contact, you may spend nuggets to block new unlocks for 7 days. Partial exclusivity may apply if up to two normal unlocks already happened.',
    },
    {
      q: t.faqSpotlightQ || 'What is Featured Profile / Spotlight?',
      a: t.faqSpotlightA || 'Spotlight promotes selected active cards in the feed minicard bar, MapView spotlight list and card styling for one month.',
    },
  ];
  const showBackButton = prevPage === "landing";
  const showMobileBackToApp = prevPage !== "landing";
  const topPadding = showBackButton ? "40px" : "58px";
  const addOns = [
    {
      id: 'exclusive-contact',
      title: t.exclusiveContactTitle,
      cost: t.exclusiveContactCost
        ?.replace('{cost}', EXCLUSIVE_CONTACT_RULE.cost)
        ?.replace('{days}', EXCLUSIVE_CONTACT_RULE.durationDays),
      body: t.exclusiveContactDesc,
      note: t.exclusiveContactPartial
        ?.replace('{discount}', EXCLUSIVE_CONTACT_RULE.partialDiscountPct),
      icon: 'lock',
      color: C.gold,
    },
    {
      id: 'featured-profile',
      title: t.featuredProfileTitle,
      cost: t.featuredProfileCost
        ?.replace('{cost}', FEATURED_PROFILE_RULE.cost)
        ?.replace('{days}', FEATURED_PROFILE_RULE.durationDays),
      body: t.featuredProfileDesc,
      icon: 'star',
      color: C.accent,
    },
    {
      id: 'verified-profile',
      title: t.verifiedProfileTitle,
      cost: t.verifiedProfileCost?.replace('{cost}', VERIFIED_PROFILE_RULE.cost),
      body: t.verifiedProfileDesc,
      icon: 'shieldCheck',
      color: C.success,
    },
  ];

  const handlePlanCta = async (p) => {
    if (p.price === 0) {
      setPage('dashboard');
      return;
    }
    setCheckoutLoading(`plan-${p.id}`);
    try {
      if (typeof onRequestCheckoutIntent === 'function') {
        await onRequestCheckoutIntent({ kind: 'subscription', planId: p.id, billingCycle, source: 'pricing' });
        return;
      }
      addToast?.({ type: 'warning', message: 'Fluxo de checkout indisponível no momento.' });
    } catch (err) {
      addToast?.({ type: 'error', message: String(err?.message || 'Falha ao iniciar assinatura.') });
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleNuggetPackCta = async (pack) => {
    setCheckoutLoading(`pack-${pack.id}`);
    try {
      if (typeof onRequestCheckoutIntent === 'function') {
        await onRequestCheckoutIntent({ kind: 'nuggets', packId: pack.id, source: 'pricing' });
        return;
      }
      if (typeof setModal === 'function') {
        setModal('store');
        return;
      }
      addToast?.({ type: 'warning', message: 'Fluxo de checkout indisponível no momento.' });
    } catch (err) {
      addToast?.({ type: 'error', message: String(err?.message || 'Falha ao iniciar compra de nuggets.') });
    } finally {
      setCheckoutLoading(null);
    }
  };

  return (
    <div style={{ maxWidth:1000, margin:"0 auto", padding:`${topPadding} 20px 60px`, textAlign:"center" }}>
      <style>{`
        .pricing-mobile-back-app { display: none; }
        @media (max-width: 900px), (hover: none) and (pointer: coarse) {
          .pricing-mobile-back-spacer {
            display: block !important;
            height: 44px;
          }
          .pricing-mobile-back-app {
            display: inline-flex !important;
            position: fixed;
            top: calc(64px + env(safe-area-inset-top, 0px));
            left: 14px;
            z-index: 20;
            align-items: center;
            gap: 6px;
            padding: 8px 12px;
            border-radius: 999px;
            box-shadow: 0 10px 24px rgba(0,0,0,.16);
          }
        }
      `}</style>
      {showMobileBackToApp && (
        <button
          type="button"
          className="pricing-mobile-back-app"
          onClick={() => setPage(prevPage && prevPage !== 'pricing' ? prevPage : 'dashboard')}
          style={{
            display: 'none',
            background: C.card,
            border: `1px solid ${C.border}`,
            color: C.t2,
            fontSize: 12,
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          <Icon name="back" size={13} color={C.t2} />
          {t.backToApp || 'Back to app'}
        </button>
      )}
      {showMobileBackToApp && <div className="pricing-mobile-back-spacer" style={{ display: 'none' }} />}
      {showBackButton && (
        <button
          onClick={() => setPage("landing")}
          style={{
            position: "fixed",
            top: 20,
            left: 20,
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 16px",
            borderRadius: 8,
            background: C.card,
            border: `1px solid ${C.border}`,
            color: C.t2,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            zIndex: 10,
          }}
        >
          <Icon name="back" size={14} color={C.t2} />
          {t.backHome}
        </button>
      )}
      <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:C.alpha(C.accent, 0.08), border:`1px solid ${C.alpha(C.accent, 0.2)}`, borderRadius:100, padding:"5px 14px", marginTop:24, marginBottom:20 }}>
        <Icon name="shield" size={13} color={C.accentL} />
        <span style={{ color:C.accentL, fontSize:12, fontWeight:500 }}>{t.trialBadge}</span>
      </div>
      <h2 style={{ fontSize:"clamp(24px,5vw,36px)", fontWeight:900, color:C.t1, marginBottom:10, letterSpacing:"-1px" }}>{t.title}</h2>
      <p style={{ color:C.t2, fontSize:"clamp(13px,2vw,15px)", marginBottom:22 }}>{t.subtitle}</p>
      <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:5, border:`1px solid ${C.border}`, borderRadius:999, background:C.card, marginBottom:38, boxShadow:`0 12px 28px ${C.alpha(C.shadow, 0.05)}` }}>
        {[
          { id: 'monthly', label: t.billingMonthly || 'Monthly' },
          { id: 'annual', label: (t.billingAnnual || 'Annual · save {discount}%').replace('{discount}', annualDiscountPct) },
        ].map((option) => {
          const active = billingCycle === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setBillingCycle(option.id)}
              style={{
                border:'none',
                borderRadius:999,
                padding:'8px 15px',
                background:active ? C.accent : 'transparent',
                color:active ? '#fff' : C.t2,
                fontSize:12,
                fontWeight:900,
                cursor:'pointer',
                boxShadow:active ? `0 8px 20px ${C.alpha(C.accent, 0.22)}` : 'none',
                transition:'all .18s ease',
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))", gap:16, marginBottom:52 }}>
        {PLANS.map(p=>{
          const shownPrice = displayPlanPrice(p);
          const annualTotal = displayAnnualTotal(p);
          return (
          <div key={p.name} style={{ background:p.popular?C.alpha(C.accent, 0.05):C.card, border:`1px solid ${p.popular?C.accent:C.border}`, borderRadius:20, padding:24, position:"relative", textAlign:"left" }}>
            {p.popular&&<div style={{ position:"absolute", top:-12, left:"50%", transform:"translateX(-50%)", background:C.accent, color:"#fff", fontSize:10, fontWeight:700, padding:"3px 12px", borderRadius:100, whiteSpace:"nowrap" }}>{t.mostPopular}</div>}
            <div style={{ fontWeight:800, color:p.color, fontSize:15, marginBottom:4 }}>{planName(p.id, p.name)}</div>
            <div style={{ marginBottom:12 }}>
              {isAnnualBilling && p.price > 0 ? (
                <div style={{ color:C.t3, fontSize:12, fontWeight:800, textDecoration:'line-through', marginBottom:2 }}>${Number(p.price || 0).toLocaleString('en-US')}{t.month}</div>
              ) : null}
              <span style={{ fontSize:36, fontWeight:900, color:C.t1 }}>${Number(shownPrice || 0).toLocaleString('en-US')}</span>
              {p.price>0&&<span style={{ color:C.t3, fontSize:13 }}>{t.month}</span>}
              {isAnnualBilling && p.price > 0 ? (
                <div style={{ color:C.accent, fontSize:11, fontWeight:900, marginTop:4 }}>
                  {(t.billingAnnualTotal || 'Billed annually: ${total}/year').replace('{total}', Number(annualTotal || 0).toLocaleString('en-US'))}
                </div>
              ) : null}
            </div>
            <div style={{ background:C.alpha(C.gold, 0.08), border:`1px solid ${C.alpha(C.gold, 0.15)}`, borderRadius:10, padding:"10px 12px", marginBottom:16, display:"flex", alignItems:"center", gap:10 }}>
              <Icon name="nugget" size={18} color={C.gold} strokeWidth={1.3} />
              <div>
                <div style={{ fontWeight:700, color:C.gold, fontSize:13 }}>
                  {p.nuggets} {t.nuggetsPerMonth}
                  {p.firstMonthBonus > 0 ? ` + ${p.firstMonthBonus} ${t.firstMonthBonus}` : ''}
                </div>
                <div style={{ fontSize:11, color:C.t3 }}>{p.nuggets} {t.connections}</div>
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:20 }}>
              {planFeatures(p.id, p.features).map(f=>(
                <div key={f} style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <Icon name="check" size={13} color={C.success} />
                  <span style={{ color:C.t2, fontSize:12 }}>{f}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => handlePlanCta(p)}
              disabled={checkoutLoading === `plan-${p.id}`}
              style={{ width:"100%", padding:11, borderRadius:10, background:p.popular?C.accent:"transparent", border:p.popular?"none":`1px solid ${C.border}`, color:p.popular?"#fff":C.t2, fontWeight:700, fontSize:13, cursor: checkoutLoading === `plan-${p.id}` ? "wait" : "pointer", opacity: checkoutLoading === `plan-${p.id}` ? 0.7 : 1 }}
            >
              {checkoutLoading === `plan-${p.id}` ? '...' : (p.price===0 ? t.getStartedFree : t.startTrial)}
            </button>
          </div>
        );})}
      </div>
      <section style={{ borderTop:`1px solid ${C.border}`, paddingTop:40, marginBottom:46, textAlign:'left' }}>
        <div style={{ textAlign:'center', marginBottom:20 }}>
          <div style={{ color:C.t3, fontSize:11, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase', marginBottom:7 }}>{t.compareEyebrow || 'Compare plans'}</div>
          <h3 style={{ fontSize:"clamp(18px,4vw,24px)", fontWeight:900, color:C.t1, margin:0 }}>{t.compareTitle || 'Compare the plans and their features'}</h3>
        </div>
        <div style={{ overflowX:'auto', WebkitOverflowScrolling:'touch', border:`1px solid ${C.border}`, borderRadius:18, background:C.card, boxShadow:`0 18px 42px ${C.alpha(C.shadow, 0.06)}` }}>
          <table style={{ width:'100%', minWidth:760, borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr style={{ background:C.alpha(C.t1, 0.08) }}>
                <th style={{ width:'34%', textAlign:'left', padding:'15px 18px', color:C.t1, fontWeight:900 }}>{t.compareFeature || 'Feature'}</th>
                {PLANS.map((plan) => (
                  <th key={plan.id} style={{ textAlign:'center', padding:'15px 14px', color:C.t1, fontWeight:900 }}>{planName(plan.id, plan.name)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisonSections.map((section) => (
                <React.Fragment key={section.title}>
                  <tr>
                    <td colSpan={4} style={{ padding:'14px 18px 8px', color:C.accent, fontSize:10, fontWeight:900, letterSpacing:'.08em', textTransform:'uppercase', borderTop:`1px solid ${C.border}` }}>
                      {section.title}
                    </td>
                  </tr>
                  {section.rows.map((row) => (
                    <tr key={`${section.title}-${row[0]}`}>
                      <td style={{ padding:'12px 18px', color:C.t2, fontWeight:700, borderTop:`1px solid ${C.alpha(C.border, 0.72)}` }}>{row[0]}</td>
                      {row.slice(1).map((value, index) => (
                        <td key={`${row[0]}-${index}`} style={{ padding:'12px 14px', color:C.t2, textAlign:'center', borderTop:`1px solid ${C.alpha(C.border, 0.72)}`, fontWeight:700 }}>
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:36, marginBottom:46 }}>
        <h3 style={{ fontSize:"clamp(18px,4vw,24px)", fontWeight:800, color:C.t1, marginBottom:6 }}>{t.addonsTitle}</h3>
        <p style={{ color:C.t2, marginBottom:22, fontSize:13 }}>{t.addonsSubtitle}</p>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:12, textAlign:"left" }}>
          {addOns.map((item) => (
            <div key={item.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:18 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                <span style={{ width:34, height:34, borderRadius:999, display:"inline-flex", alignItems:"center", justifyContent:"center", background:C.alpha(item.color, 0.1), border:`1px solid ${C.alpha(item.color, 0.25)}` }}>
                  <Icon name={item.icon} size={17} color={item.color} strokeWidth={1.7} />
                </span>
                <div>
                  <div style={{ fontWeight:800, color:C.t1, fontSize:14 }}>{item.title}</div>
                  <div style={{ fontWeight:800, color:item.color, fontSize:12 }}>{item.cost}</div>
                </div>
              </div>
              <p style={{ margin:0, color:C.t2, fontSize:12, lineHeight:1.5 }}>{item.body}</p>
              {item.note ? <p style={{ margin:"10px 0 0", color:C.t3, fontSize:11, lineHeight:1.45 }}>{item.note}</p> : null}
            </div>
          ))}
        </div>
      </div>
      <section style={{ borderTop:`1px solid ${C.border}`, paddingTop:40, marginBottom:46, textAlign:'left' }}>
        <div style={{ textAlign:'center', marginBottom:20 }}>
          <h3 style={{ fontSize:"clamp(18px,4vw,24px)", fontWeight:900, color:C.t1, margin:0 }}>{t.faqTitle || 'Frequently Asked Questions'}</h3>
        </div>
        <div style={{ maxWidth:720, margin:'0 auto', display:'grid', gap:10 }}>
          {faqItems.map((item) => (
            <details key={item.q} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:'0 16px', boxShadow:`0 10px 24px ${C.alpha(C.shadow, 0.04)}` }}>
              <summary style={{ listStyle:'none', minHeight:54, display:'flex', alignItems:'center', justifyContent:'space-between', gap:14, cursor:'pointer', color:C.t1, fontSize:13, fontWeight:900 }}>
                <span>{item.q}</span>
                <Icon name="chevDown" size={14} color={C.t3} />
              </summary>
              <p style={{ margin:'0 0 16px', color:C.t2, fontSize:12, lineHeight:1.6 }}>{item.a}</p>
            </details>
          ))}
        </div>
      </section>
      <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:44 }}>
        <div style={{ display:"flex", justifyContent:"center", marginBottom:8 }}><Icon name="nugget" size={32} color={C.gold} strokeWidth={1.2} /></div>
        <h3 style={{ fontSize:"clamp(18px,4vw,24px)", fontWeight:800, color:C.t1, marginBottom:6 }}>{t.needMore}</h3>
        <p style={{ color:C.t2, marginBottom:28, fontSize:13 }}>{t.needMoreSub}</p>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12 }}>
          {NUGGET_PACKS.map(p=>{
            const isPackLoading = checkoutLoading === `pack-${p.id}`;
            return (
            <div key={p.id} onClick={() => handleNuggetPackCta(p)} style={{ background:p.popular?C.alpha(C.gold, 0.06):C.card, border:`1px solid ${p.popular?C.gold:C.border}`, borderRadius:16, padding:18, cursor:isPackLoading?"wait":"pointer", position:"relative", textAlign:"center", opacity:isPackLoading?0.72:1 }}>
              {p.popular&&<div style={{ position:"absolute", top:-10, left:"50%", transform:"translateX(-50%)", background:C.gold, color:C.bg, fontSize:9, fontWeight:800, padding:"3px 10px", borderRadius:100, whiteSpace:"nowrap" }}>{allT.modals.bestValue}</div>}
              <div style={{ display:"flex", justifyContent:"center", marginBottom:6 }}><Icon name="nugget" size={26} color={C.gold} strokeWidth={1.3} /></div>
              <div style={{ fontWeight:800, color:C.gold, fontSize:20 }}>{p.qty}{p.bonus>0&&<span style={{ fontSize:11, color:C.goldL }}> +{p.bonus}</span>}</div>
              <div style={{ color:C.t3, fontSize:10, marginBottom:6 }}>{t.nuggetsWord}</div>
              <div style={{ fontWeight:800, color:C.t1, fontSize:18 }}>${Number(p.price || 0).toLocaleString('en-US')}</div>
              <div style={{ color:C.t3, fontSize:10 }}>${Math.round((p.price || 0)/(p.qty+p.bonus)).toLocaleString('en-US')}{t.perEach}</div>
            </div>
          );})}
        </div>
      </div>
    </div>
  );
}

