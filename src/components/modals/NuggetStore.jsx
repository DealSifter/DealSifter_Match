import React, { useState } from 'react';
import { C } from '../../theme/colors';
import { useT } from '../../i18n/translations';
import { NUGGET_PACKS } from '../../data/mockData';
import { Icon } from '../ui/Icon';
import { Modal } from '../ui/Modal';

export function NuggetStore({ nuggets, onBuy, onClose }) {
  const [bought, setBought] = useState(null);
  const [error, setError] = useState(null);
  const allT = useT();
  const t = allT.modals;
  const handle = async (p) => {
    setError(null);
    try {
      await onBuy(p);
      setBought(p);
      setTimeout(() => { setBought(null); onClose(); }, 1400);
    } catch (err) {
      setError(String(err?.message || 'Falha ao processar compra. Tente novamente.'));
    }
  };
  return (
    <Modal onClose={onClose} maxWidth={420}>
      <div style={{ textAlign:"center", marginBottom:18 }}>
        <div style={{ display:"flex", justifyContent:"center", marginBottom:10 }}><Icon name="nugget" size={42} color={C.gold} strokeWidth={1.2} /></div>
        <h2 style={{ fontSize:22, fontWeight:800, color:C.t1, marginBottom:6 }}>{t.storeTitle}</h2>
        <p style={{ color:C.t2, fontSize:14 }}>{t.storeSub}</p>
        <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:C.alpha(C.gold, 0.1), border: `1px solid ${C.alpha(C.gold, 0.25)}`, borderRadius:100, padding:"7px 14px", marginTop:12 }}>
          <Icon name="nugget" size={14} color={C.gold} />
          <span style={{ color:C.gold, fontWeight:700, fontSize:14 }}>{t.balance}: {nuggets} {allT.pricing.nuggetsWord}</span>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        {NUGGET_PACKS.map(p=>(
          <div key={p.id} onClick={() => handle(p)} style={{ background:p.popular?C.alpha(C.gold, 0.1):C.bg, border:`1px solid ${p.popular?C.gold:C.border}`, borderRadius:14, padding:14, cursor:"pointer", position:"relative", textAlign:"center", transition:"transform .2s" }}>
            {p.popular && <div style={{ position:"absolute", top:-10, left:"50%", transform:"translateX(-50%)", background:C.gold, color:C.bg, fontSize:10, fontWeight:800, padding:"4px 12px", borderRadius:100, whiteSpace:"nowrap" }}>{t.bestValue}</div>}
            <div style={{ display:"flex", justifyContent:"center", marginBottom:6 }}><Icon name="nugget" size={28} color={C.gold} strokeWidth={1.3} /></div>
            <div style={{ fontWeight:800, color:C.gold, fontSize:20 }}>{p.qty}{p.bonus>0&&<span style={{ fontSize:13, color:C.goldL }}> +{p.bonus}</span>}</div>
            <div style={{ color:C.t3, fontSize:11, marginBottom:8 }}>{allT.pricing.nuggetsWord}</div>
            <div style={{ fontWeight:800, color:C.t1, fontSize:18 }}>${Number(p.price || 0).toLocaleString('en-US')}</div>
            <div style={{ color:C.t3, fontSize:11 }}>${Math.round((p.price || 0)/(p.qty+p.bonus)).toLocaleString('en-US')}{allT.pricing.perEach}</div>
          </div>
        ))}
      </div>
      {error && (
        <div style={{ marginTop:16, textAlign:"center", color:C.error || '#e53e3e', fontSize:13, fontWeight:600 }}>
          {error}
        </div>
      )}
      {bought && (
        <div style={{ marginTop:20, textAlign:"center", display:"flex", alignItems:"center", justifyContent:"center", gap:10, color:C.success, fontWeight:700, fontSize:16 }}>
          <Icon name="check" size={20} color={C.success} /> +{bought.qty+bought.bonus} {t.addedNuggets}
        </div>
      )}
    </Modal>
  );
}
