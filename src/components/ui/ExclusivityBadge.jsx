import React from 'react';
import { C } from '../../theme/colors';

const MS_SECOND = 1000;
const MS_MINUTE = 60 * MS_SECOND;
const MS_HOUR = 60 * MS_MINUTE;
const MS_DAY = 24 * MS_HOUR;

export function toEpochMs(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && asNumber > 0) return asNumber;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatExclusiveCountdown(expiresAt, now = Date.now()) {
  const target = toEpochMs(expiresAt);
  if (!target) return '';
  const remaining = Math.max(0, target - now);
  const days = Math.floor(remaining / MS_DAY);
  const hours = Math.floor((remaining % MS_DAY) / MS_HOUR);
  const minutes = Math.floor((remaining % MS_HOUR) / MS_MINUTE);
  const seconds = Math.floor((remaining % MS_MINUTE) / MS_SECOND);
  if (days > 0) return `${days}d ${String(hours).padStart(2, '0')}h`;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function ExclusiveLockIcon({ size = 18, color = '#ffffff', boltColor = '#facc15' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M7.4 10.2V8.1a4.6 4.6 0 0 1 9.2 0v2.1" stroke={color} strokeWidth="2.35" strokeLinecap="round" />
      <rect x="5" y="10" width="14" height="10" rx="2.6" stroke={color} strokeWidth="2.35" />
      <path d="M12.8 11.5 9.8 16h2.5l-1.1 4 3.4-5h-2.5l.7-3.5Z" fill={boltColor} />
    </svg>
  );
}

export function ExclusivityBadge({
  expiresAt,
  compact = false,
  label = 'Exclusivity',
  title = 'Exclusive access active',
}) {
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (!expiresAt) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  const countdown = formatExclusiveCountdown(expiresAt, now);

  if (compact) {
    return (
      <span
        title={[title, countdown].filter(Boolean).join(' - ')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 20,
          height: 20,
          borderRadius: 999,
          background: 'linear-gradient(135deg, rgba(5,70,45,0.98), rgba(20,184,166,0.95))',
          border: `1px solid ${C.alpha(C.accent, 0.72)}`,
          boxShadow: `0 0 12px ${C.alpha(C.accent, 0.28)}`,
          flexShrink: 0,
        }}
      >
        <ExclusiveLockIcon size={14} />
      </span>
    );
  }

  return (
    <span
      title={[title, countdown].filter(Boolean).join(' - ')}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        maxWidth: '100%',
        padding: '4px 9px',
        borderRadius: 999,
        background: 'linear-gradient(90deg, rgba(5,70,45,0.98) 0%, rgba(20,184,166,0.95) 100%)',
        border: `1px solid ${C.alpha(C.accent, 0.75)}`,
        color: '#fff',
        fontSize: 10,
        fontWeight: 950,
        letterSpacing: '0.25px',
        textTransform: 'uppercase',
        boxShadow: `0 0 16px ${C.alpha(C.accent, 0.28)}`,
        whiteSpace: 'nowrap',
      }}
    >
      <ExclusiveLockIcon size={16} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      {countdown ? (
        <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.95 }}>{countdown}</span>
      ) : null}
    </span>
  );
}
