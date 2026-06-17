import React from 'react';
import { C } from '../../theme/colors';
import { Icon } from './Icon';
import { ExclusiveLockIcon } from './ExclusivityBadge';

export const CARD_STATUS = {
  exclusive: 'exclusive',
  partialExclusive: 'partialExclusive',
  verified: 'verified',
  pending: 'pending',
  hot: 'hot',
  trending: 'trending',
};

const STATUS_STYLE = {
  [CARD_STATUS.exclusive]: {
    label: 'Exclusivity',
    background: 'linear-gradient(135deg, rgba(5,70,45,0.98), rgba(20,184,166,0.95))',
    border: C.alpha(C.accent, 0.75),
    color: '#fff',
  },
  [CARD_STATUS.partialExclusive]: {
    label: 'Partial',
    background: 'linear-gradient(135deg, rgba(126,45,0,0.96), rgba(245,158,11,0.94))',
    border: 'rgba(255, 218, 112, 0.9)',
    color: '#fff',
  },
  [CARD_STATUS.verified]: {
    label: 'Verified',
    background: '#fff',
    border: C.alpha(C.accent, 0.72),
    color: C.accent,
  },
  [CARD_STATUS.pending]: {
    label: 'Pending',
    background: 'linear-gradient(135deg, rgba(55,65,81,0.96), rgba(156,163,175,0.94))',
    border: 'rgba(209,213,219,0.88)',
    color: '#fff',
  },
  [CARD_STATUS.hot]: {
    label: 'HOT',
    background: 'linear-gradient(135deg, rgba(213,38,20,0.94), rgba(230,110,0,0.92))',
    border: 'rgba(255, 198, 138, 0.82)',
    color: '#fff',
  },
  [CARD_STATUS.trending]: {
    label: 'Trending',
    background: 'rgba(255,255,255,0.94)',
    border: 'rgba(255,255,255,0.88)',
    color: '#111827',
  },
};

export function getCardStatusStyle(type) {
  return STATUS_STYLE[type] || STATUS_STYLE[CARD_STATUS.trending];
}

export function CardStatusIcon({ type, title, size = 20, iconSize = 12, style = null }) {
  const cfg = getCardStatusStyle(type);
  const renderIcon = () => {
    if (type === CARD_STATUS.exclusive || type === CARD_STATUS.partialExclusive) {
      return <ExclusiveLockIcon size={Math.max(14, iconSize + 2)} />;
    }
    if (type === CARD_STATUS.verified) {
      return <Icon name="shieldCheck" size={iconSize} color={C.accent} strokeWidth={2.55} />;
    }
    if (type === CARD_STATUS.pending) {
      return <Icon name="hourglass" size={iconSize} color={cfg.color} strokeWidth={2.45} />;
    }
    if (type === CARD_STATUS.hot) {
      return <Icon name="zap" size={iconSize} color={cfg.color} strokeWidth={2.45} />;
    }
    return <Icon name="activity" size={iconSize} color={cfg.color} strokeWidth={2.35} />;
  };

  return (
    <span
      title={title || cfg.label}
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: 999,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: cfg.background,
        border: `1px solid ${cfg.border}`,
        boxShadow: `0 0 10px ${C.alpha(type === CARD_STATUS.hot ? C.gold : C.accent, 0.24)}`,
        lineHeight: 1,
        pointerEvents: 'none',
        ...style,
      }}
    >
      {renderIcon()}
    </span>
  );
}

export function CardStatusBadge({ type, children, title, compact = false, pulse = false, style = null }) {
  const cfg = getCardStatusStyle(type);
  return (
    <span
      title={title || cfg.label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: cfg.background,
        border: `1px solid ${cfg.border}`,
        color: cfg.color,
        borderRadius: 999,
        padding: compact ? '1px 6px' : '2px 8px',
        fontSize: compact ? 8 : 9,
        fontWeight: 950,
        letterSpacing: '0.45px',
        lineHeight: 1.2,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        animation: pulse ? 'dsPropertyExclusivePulse 1.2s ease-in-out infinite' : undefined,
        ...style,
      }}
    >
      {children || cfg.label}
    </span>
  );
}

export function pickPriorityStatus(statuses = []) {
  const order = [
    CARD_STATUS.exclusive,
    CARD_STATUS.partialExclusive,
    CARD_STATUS.pending,
    CARD_STATUS.hot,
    CARD_STATUS.trending,
    CARD_STATUS.verified,
  ];
  return order.find((status) => statuses.includes(status)) || null;
}
