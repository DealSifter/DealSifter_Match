import React from 'react';
import { C } from '../../theme/colors';
import { useT } from '../../i18n/translations';
import { Icon } from '../ui/Icon';
import { Modal } from '../ui/Modal';

export function UnlockModal({ match, nuggets, unlockCost = 1, exclusivityStatus = null, onUnlock, onBuyMore, onClose }) {
  const t = useT().modals;
  const isPropertyUnlock = match?.unlockScope === 'property';
  const isBlockedByExclusive = isPropertyUnlock && exclusivityStatus?.kind === 'blocked';
  const canBuyExclusive = isPropertyUnlock && exclusivityStatus?.canBuyExclusivity && Number(exclusivityStatus?.exclusiveCost || 0) > 0;
  const exclusiveExtraCost = Number(exclusivityStatus?.exclusiveCost || 0);
  const exclusiveCost = unlockCost + exclusiveExtraCost;
  const can = nuggets >= unlockCost;
  const canExclusive = nuggets >= exclusiveCost;
  const nuggetUnit = unlockCost === 1 ? t.nuggetOne : t.nuggetOther;
  const exclusiveUnit = exclusiveCost === 1 ? t.nuggetOne : t.nuggetOther;
  const unlockDesc = t.unlockCostByPortfolio
    .replace('{count}', String(unlockCost))
    .replace('{unit}', nuggetUnit);
  const unlockForLabel = t.unlockForCount
    .replace('{count}', String(unlockCost))
    .replace('{unit}', nuggetUnit);
  return (
    <Modal onClose={onClose} maxWidth={400}>
      <div style={{ textAlign:"center" }}>
        <div style={{ display:"flex", justifyContent:"center", marginBottom:16 }}><Icon name="lock" size={48} color={C.gold} strokeWidth={1.5} /></div>
        <h3 style={{ color:C.t1, fontWeight:800, fontSize:22, marginBottom:8 }}>{t.unlockTitle} {match.name}</h3>
        <p style={{ color:C.t2, fontSize:14, lineHeight:1.6, marginBottom: canBuyExclusive || isBlockedByExclusive ? 12 : 24, padding: "0 10px" }}>
          {isBlockedByExclusive
            ? (t.exclusivityBlockedDesc || 'This property is under temporary exclusivity. You can favorite it, but contact unlock is blocked until the exclusivity window ends.')
            : unlockDesc}
        </p>

        {canBuyExclusive ? (
          <div style={{
            margin: '0 0 18px',
            padding: 13,
            borderRadius: 14,
            border: `1px solid ${exclusivityStatus.kind === 'partial' ? C.gold : C.accent}`,
            background: exclusivityStatus.kind === 'partial'
              ? C.alpha(C.gold, 0.10)
              : C.alpha(C.accent, 0.10),
            textAlign: 'left',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.t1, fontSize: 13, fontWeight: 900, marginBottom: 6 }}>
              <span style={{ color: exclusivityStatus.kind === 'partial' ? C.danger : C.gold, fontSize: 15 }}>⚡</span>
              {exclusivityStatus.kind === 'partial' ? (t.exclusivityPartialTitle || 'Partial exclusivity available') : (t.exclusivityTotalTitle || 'Full exclusivity available')}
            </div>
            <div style={{ color: C.t2, fontSize: 12, lineHeight: 1.45 }}>
              {exclusivityStatus.kind === 'partial'
                ? (t.exclusivityPartialDesc || 'Lock future unlocks for 7 days and compete only with the first normal unlocks already made. Includes 10% discount.')
                : (t.exclusivityTotalDesc || 'Be the first to lock this property for 7 days. Other users can favorite it, but cannot unlock the contact during this window.')}
            </div>
          </div>
        ) : null}
        
        <div style={{ background:C.alpha(C.gold, 0.08), border:`1px solid ${C.alpha(C.gold, 0.25)}`, borderRadius:16, padding:18, marginBottom:24 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
            <span style={{ color:C.t2, fontSize:14 }}>{t.cost}</span>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}><Icon name="nugget" size={14} color={C.gold} /><span style={{ color:C.gold, fontWeight:700 }}>{unlockCost} {nuggetUnit}</span></div>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between" }}>
            <span style={{ color:C.t2, fontSize:14 }}>{t.yourBalance}</span>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}><Icon name="nugget" size={14} color={can?C.gold:C.danger} /><span style={{ color:can?C.gold:C.danger, fontWeight:700 }}>{nuggets}</span></div>
          </div>
          {!can && <div style={{ marginTop:12, color:C.danger, fontSize:13, fontWeight:600, display:"flex", alignItems:"center", gap:6, justifyContent:"center" }}><Icon name="info" size={14} color={C.danger} /> {t.notEnough}</div>}
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {isBlockedByExclusive ? (
            <button onClick={onClose} style={{ width:"100%", padding:"15px", borderRadius:14, background:C.alpha(C.gold, 0.14), border:`1px solid ${C.alpha(C.gold, 0.35)}`, color:C.gold, fontWeight:800, fontSize:16, cursor:"pointer" }}>
              {t.exclusivityCheckLater || 'Favorite and check later'}
            </button>
          ) : can
            ? <button onClick={() => onUnlock(match)} style={{ width:"100%", padding:"15px", borderRadius:14, background:C.gold, border:"none", color:C.bg, fontWeight:800, fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10, boxShadow: `0 4px 15px ${C.alpha(C.gold, 0.3)}` }}>
                <Icon name="unlock" size={18} color={C.bg} /> {unlockForLabel}
              </button>
            : <button onClick={onBuyMore} style={{ width:"100%", padding:"15px", borderRadius:14, background:C.accent, border:"none", color:"#fff", fontWeight:800, fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
                <Icon name="cart" size={18} color="#fff" /> {t.buyMore}
              </button>
          }
          {canBuyExclusive ? (
            canExclusive ? (
              <button onClick={() => onUnlock(match, { mode: exclusivityStatus.exclusivityMode || 'total', cost: exclusiveCost })} style={{ width:"100%", padding:"15px", borderRadius:14, background: exclusivityStatus.kind === 'partial' ? 'linear-gradient(90deg, #7e2d00, #f59e0b)' : 'linear-gradient(90deg, #05462d, #14b8a6)', border:"none", color:"#fff", fontWeight:900, fontSize:15, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10, boxShadow: `0 4px 18px ${C.alpha(exclusivityStatus.kind === 'partial' ? C.gold : C.accent, 0.28)}` }}>
                <span style={{ color: exclusivityStatus.kind === 'partial' ? C.danger : C.gold }}>⚡</span>
                {(t.unlockExclusiveForCount || 'Unlock with exclusivity for {count} {unit}')
                  .replace('{count}', String(exclusiveCost))
                  .replace('{unit}', exclusiveUnit)}
              </button>
            ) : (
              <button onClick={onBuyMore} style={{ width:"100%", padding:"15px", borderRadius:14, background:C.accent, border:"none", color:"#fff", fontWeight:800, fontSize:15, cursor:"pointer" }}>
                {t.buyMore} ({exclusiveCost} {exclusiveUnit})
              </button>
            )
          ) : null}
          <button onClick={onClose} style={{ width:"100%", padding:"12px", borderRadius:14, background:"transparent", border:`1px solid ${C.border}`, color:C.t2, fontWeight:600, fontSize:14, cursor:"pointer" }}>{t.cancel}</button>
        </div>
      </div>
    </Modal>
  );
}
