import React from 'react';
import { C } from '../../theme/colors';
import { Icon } from './Icon';

export function NuggetBadge({ count, onClick }) {
  return (
    <button onClick={onClick} style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 12px", borderRadius:100, background:"transparent", border:"none", cursor:"pointer", transition:"opacity .15s" }} onMouseEnter={(e) => e.currentTarget.style.opacity = "0.8"} onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}>
      <Icon name="nugget" size={14} color={C.gold} />
      <span style={{ fontWeight:700, color:C.gold, fontSize:13 }}>{count}</span>
    </button>
  );
}
