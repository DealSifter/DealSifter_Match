import React, { useEffect } from 'react';
import { C } from '../../theme/colors';

export function Modal({ children, onClose, maxWidth = 420 }) {
  // Prevent scrolling on body when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'auto'; };
  }, []);

  return (
    <div 
      style={{ 
        position: "fixed", 
        inset: 0, 
        background: "rgba(0,0,0,.85)", 
        backdropFilter: "blur(4px)",
        zIndex: 1000, 
        padding: 20,
        display: "flex", 
        justifyContent: "center",
        alignItems: "flex-start", // Mudado de center para flex-start
        paddingTop: "10vh" // Adicionado padding para subir o modal
      }} 
      onClick={onClose}
    >
      <div 
        onClick={e => e.stopPropagation()} 
        style={{ 
          background: C.card, 
          border: `1px solid ${C.border}`, 
          borderRadius: 24, 
          padding: "32px 24px", 
          width: "100%", 
          maxWidth: maxWidth, 
          maxHeight: "90vh", 
          overflowY: "auto",
          position: "relative",
          boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
          animation: "modalAppear 0.3s ease-out"
        }}
      >
        <style>{`
          @keyframes modalAppear {
            from { opacity: 0; transform: scale(0.95) translateY(10px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}</style>
        
        {/* Close button top right */}
        <button 
          onClick={onClose}
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
