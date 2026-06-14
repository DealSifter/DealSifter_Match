import React, { useMemo, useState } from 'react';
import { C } from '../../theme/colors';
import { Icon } from '../ui/Icon';
import spotlightIcon from '../../assets/spotlight-icon.png';

const SPOTLIGHT_COST = 10;

export function SpotlightModal({
  open = false,
  items = [],
  nuggets = 0,
  onClose,
  onConfirm,
  isLoading = false,
  isProcessing = false,
}) {
  const eligibleItems = useMemo(() => (items || []).filter((item) => item?.cardId && item?.cardKind), [items]);
  const [selected, setSelected] = useState(() => new Set());

  if (!open) return null;

  const selectedItems = eligibleItems.filter((item) => selected.has(item.key));
  const totalCost = selectedItems.length * SPOTLIGHT_COST;
  const hasSelection = selectedItems.length > 0;
  const hasEnoughBalance = nuggets >= totalCost;
  const canSubmit = hasSelection && !isLoading && !isProcessing;

  const toggle = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="ds-spotlight-modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 2600, display: 'grid', placeItems: 'center', padding: '82px 18px 22px', background: 'rgba(0,0,0,.62)', boxSizing: 'border-box' }}>
      <style>{`
        .ds-spotlight-modal-card {
          width: min(94vw, 980px);
          max-height: calc(100vh - 112px);
          overflow: auto;
          border-radius: 24px;
          background: ${C.card};
          border: 1px solid ${C.border};
          box-shadow: 0 24px 70px ${C.alpha('#000', 0.42)};
          padding: 22px;
          box-sizing: border-box;
        }
        .ds-spotlight-items-grid {
          display: grid;
          gap: 8px;
          margin-bottom: 14px;
        }
        .ds-spotlight-modal-icon {
          display: inline-block;
          flex-shrink: 0;
          background: currentColor;
          -webkit-mask: url(${spotlightIcon}) center / contain no-repeat;
          mask: url(${spotlightIcon}) center / contain no-repeat;
        }
        @media (min-width: 768px) {
          .ds-spotlight-items-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 767px) {
          .ds-spotlight-modal-overlay {
            padding: calc(70px + env(safe-area-inset-top, 0px)) 14px calc(20px + env(safe-area-inset-bottom, 0px)) !important;
          }
          .ds-spotlight-modal-card {
            width: 100%;
            max-height: calc(100vh - 100px);
            border-radius: 20px;
            padding: 18px;
          }
        }
      `}</style>
      <div className="ds-spotlight-modal-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: C.accent, fontSize: 12, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>
              <span className="ds-spotlight-modal-icon" style={{ width: 24, height: 24, color: C.accent }} />
              Spotlight Cards
            </div>
            <h2 style={{ margin: 0, color: C.t1, fontSize: 26, lineHeight: 1.1 }}>Boost your cards for 30 days</h2>
            <p style={{ margin: '9px 0 0', color: C.t2, fontSize: 13, lineHeight: 1.45 }}>
              Selected cards appear in the paid mini-card banner and in the Map View Spotlight Cards list. Sponsored feed cards receive a neon halo.
            </p>
          </div>
          <button type="button" onClick={onClose} style={{ border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, width: 34, height: 34, borderRadius: 12, cursor: 'pointer' }}>
            <Icon name="close" size={15} color={C.t2} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center', border: `1px solid ${C.alpha(C.gold, 0.45)}`, background: C.alpha(C.gold, 0.08), borderRadius: 16, padding: '10px 12px', marginBottom: 14 }}>
          <div style={{ color: C.t2, fontSize: 12 }}>
            Cost: <strong style={{ color: C.gold }}>{SPOTLIGHT_COST} nuggets per card</strong>
          </div>
          <div style={{ color: C.gold, fontWeight: 900, fontSize: 13 }}>
            Balance: {nuggets}
          </div>
        </div>

        {isLoading ? (
          <div style={{ border: `1px dashed ${C.border}`, borderRadius: 16, padding: 18, color: C.t2, fontSize: 13 }}>
            Loading your active published cards...
          </div>
        ) : eligibleItems.length === 0 ? (
          <div style={{ border: `1px dashed ${C.border}`, borderRadius: 16, padding: 18, color: C.t2, fontSize: 13 }}>
            No active published cards are available for spotlight yet.
          </div>
        ) : (
          <div className="ds-spotlight-items-grid">
            {eligibleItems.map((item) => {
              const active = selected.has(item.key);
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => toggle(item.key)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr auto',
                    gap: 10,
                    alignItems: 'center',
                    textAlign: 'left',
                    borderRadius: 14,
                    border: `1px solid ${active ? C.accent : C.border}`,
                    background: active ? C.alpha(C.accent, 0.1) : 'transparent',
                    padding: '10px 12px',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ width: 22, height: 22, borderRadius: 999, border: `1px solid ${active ? C.accent : C.border}`, display: 'grid', placeItems: 'center' }}>
                    {active ? <Icon name="check" size={13} color={C.accent} strokeWidth={2.4} /> : null}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', color: C.t1, fontWeight: 800, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</span>
                    <span style={{ display: 'block', color: C.t3, fontSize: 11, marginTop: 2 }}>{item.label}</span>
                  </span>
                  <span style={{ color: C.gold, fontWeight: 900, fontSize: 12 }}>10 nuggets</span>
                </button>
              );
            })}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderTop: `1px solid ${C.border}`, paddingTop: 14, flexWrap: 'wrap' }}>
          <div style={{ color: totalCost > nuggets ? C.danger : C.t2, fontSize: 13, fontWeight: 800 }}>
            Total: {totalCost} nuggets
          </div>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              if (!canSubmit) return;
              onConfirm?.(selectedItems);
            }}
            style={{
              border: `1px solid ${canSubmit ? C.accent : C.border}`,
              borderRadius: 999,
              background: canSubmit ? C.accent : C.alpha(C.t1, 0.12),
              color: canSubmit ? '#061312' : C.t3,
              minHeight: 36,
              padding: '8px 18px',
              fontWeight: 900,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              boxShadow: canSubmit ? `0 0 14px ${C.alpha(C.accent, 0.22)}` : 'none',
            }}
          >
            {isProcessing ? 'Activating...' : hasSelection && !hasEnoughBalance ? 'Get nuggets / upgrade' : 'Activate Spotlight'}
          </button>
        </div>
      </div>
    </div>
  );
}
