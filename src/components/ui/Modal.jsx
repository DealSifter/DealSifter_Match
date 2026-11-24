import React, { useEffect, useRef } from 'react';
import { C } from '../../theme/colors';
import './Modal.css';
import { useT } from '../../i18n/translations';

export function Modal({
  children,
  onClose,
  maxWidth = 420,
  ariaLabel,
  overlayStyle = {},
  contentStyle = {},
  contentClassName = '',
  scrollable = true,
  showCloseButton = true,
}) {
  const modalCopy = useT('global').nav;
  const dialogRef = useRef(null);

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

  useEffect(() => {
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    const focusableSelector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';
    const focusFirst = () => dialog?.querySelector(focusableSelector)?.focus();
    const focusTimer = window.setTimeout(focusFirst, 0);
    const trapFocus = (event) => {
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = [...dialog.querySelectorAll(focusableSelector)];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', trapFocus);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', trapFocus);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);

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
        @media (max-width: 767px) {
          .ds-modal-overlay {
            --ds-modal-top-offset: max(12px, env(safe-area-inset-top));
            --ds-modal-bottom-offset: max(12px, env(safe-area-inset-bottom));
            align-items: flex-start !important;
            height: calc(var(--app-vh, 1vh) * 100) !important;
            max-height: calc(var(--app-vh, 1vh) * 100) !important;
            overflow-x: hidden !important;
            overflow-y: hidden !important;
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
            top: 10px !important;
            right: 11px !important;
          }
        }
        .ds-modal-content.ds-modal-no-scroll {
          overflow: hidden !important;
          overscroll-behavior: none !important;
        }
      `}</style>
      <div
        ref={dialogRef}
        className={`ds-modal-content ${scrollable ? '' : 'ds-modal-no-scroll'} ${contentClassName}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || modalCopy.dialogLabel}
        onClick={e => e.stopPropagation()} 
        style={{
          background: C.card, 
          border: `1px solid ${C.border}`, 
          borderRadius: 24, 
          padding: "24px",
          width: "100%", 
          maxWidth: typeof maxWidth === 'number' && maxWidth <= 520 ? 560 : maxWidth,
          maxHeight: "calc(100dvh - 32px)",
          overflowY: scrollable ? "auto" : "hidden",
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
        {showCloseButton ? (
          <button
            onClick={onClose}
            type="button"
            aria-label={modalCopy.closeDialog}
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
        ) : null}

        {children}
      </div>
    </div>
  );
}
