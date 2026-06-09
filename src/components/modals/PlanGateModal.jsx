import React from 'react';
import { C } from '../../theme/colors';
import { Modal } from '../ui/Modal';
import { Icon } from '../ui/Icon';

export function PlanGateModal({ gate, onClose, onUpgrade }) {
  if (!gate) return null;

  return (
    <Modal onClose={onClose} maxWidth={440} ariaLabel={gate.title || 'Plan upgrade required'}>
      <div style={{ display: 'grid', gap: 14, paddingTop: 6 }}>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: 16,
          display: 'grid',
          placeItems: 'center',
          background: C.alpha(C.accent, 0.12),
          border: `1px solid ${C.alpha(C.accent, 0.45)}`,
        }}>
          <Icon name="lock" size={22} color={C.accent} />
        </div>
        <div>
          <div style={{ fontSize: 22, lineHeight: 1.15, fontWeight: 900, color: C.t1, marginBottom: 8 }}>
            {gate.title}
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.5, color: C.t2 }}>
            {gate.message}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: `1px solid ${C.border}`,
              background: 'transparent',
              color: C.t2,
              borderRadius: 10,
              padding: '10px 14px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            {gate.dismiss}
          </button>
          <button
            type="button"
            onClick={onUpgrade}
            style={{
              border: 'none',
              background: C.accent,
              color: '#061412',
              borderRadius: 10,
              padding: '10px 16px',
              fontWeight: 900,
              cursor: 'pointer',
              boxShadow: `0 0 18px ${C.alpha(C.accent, 0.28)}`,
            }}
          >
            {gate.cta}
          </button>
        </div>
      </div>
    </Modal>
  );
}
