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
  const showBackButton = prevPage === "landing";
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
        await onRequestCheckoutIntent({ kind: 'subscription', planId: p.id, source: 'pricing' });
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
      <p style={{ color:C.t2, fontSize:"clamp(13px,2vw,15px)", marginBottom:44 }}>{t.subtitle}</p>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))", gap:16, marginBottom:52 }}>
        {PLANS.map(p=>(
          <div key={p.name} style={{ background:p.popular?C.alpha(C.accent, 0.05):C.card, border:`1px solid ${p.popular?C.accent:C.border}`, borderRadius:20, padding:24, position:"relative", textAlign:"left" }}>
            {p.popular&&<div style={{ position:"absolute", top:-12, left:"50%", transform:"translateX(-50%)", background:C.accent, color:"#fff", fontSize:10, fontWeight:700, padding:"3px 12px", borderRadius:100, whiteSpace:"nowrap" }}>{t.mostPopular}</div>}
            <div style={{ fontWeight:800, color:p.color, fontSize:15, marginBottom:4 }}>{planName(p.id, p.name)}</div>
            <div style={{ marginBottom:12 }}>
              <span style={{ fontSize:36, fontWeight:900, color:C.t1 }}>${Number(p.price || 0).toLocaleString('en-US')}</span>
              {p.price>0&&<span style={{ color:C.t3, fontSize:13 }}>{t.month}</span>}
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
        ))}
      </div>
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

