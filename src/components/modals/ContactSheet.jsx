import React from 'react';
import { C } from '../../theme/colors';
import { useT } from '../../i18n/translations';
import { buildDisplayContacts } from '../../lib/contactPriority';
import { resolveScopedProfile, normalizeProfileScope } from '../../lib/profileScopeResolver';
import { Icon } from '../ui/Icon';
import { Modal } from '../ui/Modal';

export function ContactSheet({ match, onClose, onOpenChat }) {
  const t = useT('matches').modals;
  const shouldUseSavedProfile = !match?.id || match?.id === 999999 || match?.ownerId === 999999 || match?.id === 'preview-personal';
  let savedProfile = null;
  if (shouldUseSavedProfile) {
    try {
      const personalRaw = localStorage.getItem('personalProfile');
      const professionalRaw = localStorage.getItem('professionalProfile');
      const userRaw = localStorage.getItem('userProfile');
      const accountTypeRaw = localStorage.getItem('accountType');
      const personal = personalRaw ? JSON.parse(personalRaw) : null;
      const professional = professionalRaw ? JSON.parse(professionalRaw) : null;
      const user = userRaw ? JSON.parse(userRaw) : null;
      const identity = resolveScopedProfile(normalizeProfileScope(match?.primaryProfile || 'personal'), {
        accountType: accountTypeRaw || '',
        userProfile: user || {},
        personalProfile: personal || {},
        professionalProfile: professional || {},
      });
      savedProfile = {
        contactMethods: identity?.contactMethods || [],
        primaryPhone: identity?.primaryPhone || '',
        secondaryPhone: identity?.secondaryPhone || '',
        tertiaryPhone: identity?.tertiaryPhone || '',
        email: identity?.email || '',
      };
    } catch (e) { void e; savedProfile = null; }
  }
  const contacts = buildDisplayContacts(match, savedProfile, {
    call: t.contactPhone,
    sms: t.contactSms,
    whatsapp: t.contactWhatsApp,
    telegram: t.contactTelegram,
    email: t.contactEmail,
  }).sort((a, b) => {
    const aPriority = a.priority || 99;
    const bPriority = b.priority || 99;
    return aPriority - bPriority;
  });
  const getPriorityLabel = (priority) => {
    if (priority === 1) return '1st';
    if (priority === 2) return '2nd';
    if (priority === 3) return '3rd';
    return `${priority}th`;
  };
  return (
    <Modal onClose={onClose} maxWidth={400}>
      <div style={{ textAlign:"center" }}>
        <div style={{ display:"flex", justifyContent:"center", marginBottom:12 }}><Icon name="unlock" size={48} color={C.success} strokeWidth={1.5} /></div>
        <h3 style={{ color:C.t1, fontWeight:800, fontSize:22, marginBottom:20 }}>{match.name}</h3>
        
        <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:24 }}>
          {contacts.map(({ key, icon, label, val, priority })=>(
            <div key={key} style={{ display:"flex", alignItems:"center", gap:12, background:priority===1 ? C.alpha(C.danger, 0.08) : C.alpha(C.accent, 0.03), border:`1px solid ${priority===1 ? C.alpha(C.danger, 0.45) : C.border}`, boxShadow: priority===1 ? `0 0 0 1px ${C.alpha(C.danger, 0.12)}` : 'none', borderRadius:16, padding:"14px 16px" }}>
              <div style={{ minWidth:42, height:32, borderRadius:999, background:priority===1 ? C.alpha(C.danger, 0.16) : C.alpha(C.t1, 0.05), color:priority===1 ? C.danger : C.t2, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, letterSpacing:"0.2px" }}>
                {getPriorityLabel(priority)}
              </div>
              <div style={{ width:36, height:36, borderRadius:10, background:priority===1 ? C.alpha(C.danger, 0.08) : C.alpha(C.accent, 0.08), display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Icon name={icon} size={18} color={C.accent} />
              </div>
              <div style={{ flex:1, textAlign:"left" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2, flexWrap:"wrap" }}>
                  <div style={{ fontSize:11, color:C.t3 }}>{label}</div>
                  {priority ? (
                    <span style={{ padding:"3px 7px", borderRadius:999, background:priority===1 ? C.alpha(C.danger, 0.14) : C.alpha(C.t1, 0.06), color:priority===1 ? C.danger : C.t2, fontSize:9, fontWeight:800, letterSpacing:"0.2px" }}>
                      {priority===1 ? t.contactPriorityFirst : `${t.contactPriorityShort} ${priority}`}
                    </span>
                  ) : null}
                </div>
                <div style={{ fontWeight:700, color:C.t1, fontSize:20 }}>{val}</div>
                {priority===1 ? (
                  <div style={{ marginTop:4, fontSize:11, fontWeight:700, color:C.accentL }}>
                    {t.contactPriorityFirstHint}
                  </div>
                ) : null}
              </div>
              <button 
                onClick={() => {
                  if (typeof navigator !== 'undefined') navigator.clipboard?.writeText(val);
                }} 
                style={{ padding:"6px 12px", borderRadius:100, background:C.alpha(C.accent, 0.05), border:`1px solid ${C.alpha(C.accent, 0.15)}`, color:C.accentL, fontSize:12, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}
              >
                <Icon name="copy" size={12} color={C.accentL} /> {t.copy}
              </button>
            </div>
          ))}
        </div>
        
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <button onClick={() => { onClose(); onOpenChat(match); }} style={{ width:"100%", padding:"15px", borderRadius:14, background:C.accent, border:"none", color:"#fff", fontWeight:800, fontSize:15, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10, boxShadow: `0 4px 15px ${C.alpha(C.accent, 0.25)}` }}>
            <Icon name="chat" size={18} color="#fff" /> {t.openChat}
          </button>
          <button onClick={onClose} style={{ width:"100%", padding:"12px", borderRadius:14, background:"transparent", border:`1px solid ${C.border}`, color:C.t2, fontWeight:600, fontSize:14, cursor:"pointer" }}>{t.close}</button>
        </div>
      </div>
    </Modal>
  );
}
