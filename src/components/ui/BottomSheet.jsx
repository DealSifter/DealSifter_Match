import React, { useEffect } from 'react';
import { C } from '../../theme/colors';

export function BottomSheet({ children, onClose, ariaLabel = 'Bottom sheet dialog' }) {
  // Close on Escape key
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.82)", zIndex:999, display:"flex", alignItems:"flex-end", justifyContent:"center" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onClick={e=>e.stopPropagation()}
        style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:"22px 22px 0 0", padding:"24px 24px 36px", width:"100%", maxWidth:520, maxHeight:"90vh", overflowY:"auto", overscrollBehavior:"contain" }}
      >
        <div style={{ width:36, height:3, borderRadius:3, background:C.border, margin:"0 auto 20px" }} />
        {children}
      </div>
    </div>
  );
}
