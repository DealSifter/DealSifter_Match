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
