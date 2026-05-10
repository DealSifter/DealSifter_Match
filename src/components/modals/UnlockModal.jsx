import React from 'react';
import { C } from '../../theme/colors';
import { useT } from '../../i18n/translations';
import { Icon } from '../ui/Icon';
import { Modal } from '../ui/Modal';

export function UnlockModal({ match, nuggets, unlockCost = 1, onUnlock, onBuyMore, onClose }) {
  const t = useT().modals;
  const can = nuggets >= unlockCost;
  const nuggetUnit = unlockCost === 1 ? t.nuggetOne : t.nuggetOther;
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
        <p style={{ color:C.t2, fontSize:14, lineHeight:1.6, marginBottom:24, padding: "0 10px" }}>
          {unlockDesc}
        </p>
        
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
          {can
            ? <button onClick={() => onUnlock(match)} style={{ width:"100%", padding:"15px", borderRadius:14, background:C.gold, border:"none", color:C.bg, fontWeight:800, fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10, boxShadow: `0 4px 15px ${C.alpha(C.gold, 0.3)}` }}>
                <Icon name="unlock" size={18} color={C.bg} /> {unlockForLabel}
              </button>
            : <button onClick={onBuyMore} style={{ width:"100%", padding:"15px", borderRadius:14, background:C.accent, border:"none", color:"#fff", fontWeight:800, fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
                <Icon name="cart" size={18} color="#fff" /> {t.buyMore}
              </button>
          }
          <button onClick={onClose} style={{ width:"100%", padding:"12px", borderRadius:14, background:"transparent", border:`1px solid ${C.border}`, color:C.t2, fontWeight:600, fontSize:14, cursor:"pointer" }}>{t.cancel}</button>
        </div>
      </div>
    </Modal>
  );
}
