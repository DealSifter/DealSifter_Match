import React, { useEffect, useState } from 'react';
import { C } from '../../theme/colors';
import { Icon } from './Icon';

const TOAST_ICONS = { success: 'check', error: 'alertTriangle', info: 'info', warning: 'alertTriangle' };
const TOAST_COLORS = { success: '#22c55e', error: '#ef4444', info: '#3b82f6', warning: '#f59e0b' };

function ToastItem({ toast, onDismiss }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(toast.id), 300);
    }, toast.duration || 4000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  const color = TOAST_COLORS[toast.type] || TOAST_COLORS.info;
  const icon = TOAST_ICONS[toast.type] || 'info';

  return (
    <div
      role="alert"
      onClick={() => { setVisible(false); setTimeout(() => onDismiss(toast.id), 300); }}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '12px 16px',
        borderRadius: 12,
        background: C.card || '#1e1e2e',
        border: `1px solid ${C.alpha ? C.alpha(color, 0.3) : color}`,
        boxShadow: `0 4px 16px rgba(0,0,0,0.25)`,
        cursor: 'pointer',
        minWidth: 260,
        maxWidth: 380,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-12px)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
      }}
    >
      <Icon name={icon} size={16} color={color} />
      <div style={{ flex: 1, fontSize: 13, color: C.t1, lineHeight: '1.4' }}>
        {toast.title ? <div style={{ fontWeight: 700, marginBottom: 2 }}>{toast.title}</div> : null}
        <div style={{ color: C.t2 }}>{toast.message}</div>
      </div>
    </div>
  );
}

export function ToastContainer({ toasts, onDismiss }) {
  if (!toasts?.length) return null;
  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <div key={t.id} style={{ pointerEvents: 'auto' }}>
          <ToastItem toast={t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}
