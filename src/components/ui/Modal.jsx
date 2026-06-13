import React, { useEffect } from 'react';
import { C } from '../../theme/colors';

export function Modal({
  children,
  onClose,
  maxWidth = 420,
  ariaLabel = 'Modal dialog',
  overlayStyle = {},
  contentStyle = {},
}) {
  // Prevent scrolling on body when modal is open; restore previous overflow on unmount
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev || ''; };
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="ds-modal-overlay"
      style={{
        position: "fixed", 
        inset: 0, 
        background: "rgba(0,0,0,.85)", 
        backdropFilter: "blur(4px)",
        zIndex: 10010, 
        padding: 12,
        display: "flex", 
        justifyContent: "center",
        alignItems: "center",
        ...overlayStyle,
      }} 
      onClick={onClose}
    >
      <style>{`
        @keyframes modalAppear {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @media (max-width: 1180px), (hover: none) and (pointer: coarse) {
          .ds-modal-overlay {
            --ds-modal-top-offset: calc(var(--ds-mobile-header-offset, 58px) + max(14px, env(safe-area-inset-top)));
            --ds-modal-bottom-offset: calc(var(--ds-mobile-bottom-nav-visible-height, 0px) + max(18px, env(safe-area-inset-bottom)));
            align-items: flex-start !important;
            height: calc(var(--app-vh, 1vh) * 100) !important;
            max-height: calc(var(--app-vh, 1vh) * 100) !important;
            overflow-x: hidden !important;
            overflow-y: auto !important;
            overscroll-behavior: contain;
            touch-action: pan-y;
            -webkit-overflow-scrolling: touch;
            padding-top: var(--ds-modal-top-offset) !important;
            padding-bottom: var(--ds-modal-bottom-offset) !important;
          }
          .ds-modal-content {
            width: min(100%, calc(100vw - 24px)) !important;
            max-height: calc((var(--app-vh, 1vh) * 100) - var(--ds-modal-top-offset) - var(--ds-modal-bottom-offset) - 8px) !important;
            height: auto !important;
            min-height: 0 !important;
            overflow-x: hidden !important;
            overflow-y: auto !important;
            overscroll-behavior: contain;
            touch-action: pan-y;
            -webkit-overflow-scrolling: touch;
            margin-top: 0 !important;
            padding-bottom: calc(18px + env(safe-area-inset-bottom)) !important;
          }
          .modal-close-btn {
            top: 20px !important;
            right: 11px !important;
          }
        }
      `}</style>
      <div
        className="ds-modal-content"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onClick={e => e.stopPropagation()} 
        style={{
          background: C.card, 
          border: `1px solid ${C.border}`, 
          borderRadius: 24, 
          padding: "32px 24px", 
          width: "100%", 
          maxWidth: maxWidth, 
          maxHeight: "min(92dvh, 920px)", 
          overflowY: "auto",
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: 'touch',
          position: "relative",
          boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
          animation: "modalAppear 0.3s ease-out",
          animationFillMode: "both",
          transform: "translateZ(0)",
          ...contentStyle,
        }}
      >
        {/* Close button top right */}
        <button 
          onClick={onClose}
          className="modal-close-btn"
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "transparent",
            border: "none",
            color: C.t3,
            cursor: "pointer",
            fontSize: 20,
            padding: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          ×
        </button>

        {children}
      </div>
    </div>
  );
}
