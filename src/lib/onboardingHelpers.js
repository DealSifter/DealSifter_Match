import { CARD_PRIORITY_VALUES, PROFILE_PRIORITY_KEYS } from './onboardingConstants';

export function normalizeUniqueCardPriorities(priorities, preferredKey = 'A') {
  const next = { ...priorities };
  const order = [preferredKey, ...PROFILE_PRIORITY_KEYS.filter((key) => key !== preferredKey)];
  const used = new Set();

  for (const key of order) {
    const raw = String(next[key] || '').toLowerCase();
    if (!raw) {
      next[key] = '';
      continue;
    }
    if (CARD_PRIORITY_VALUES.includes(raw) && !used.has(raw)) {
      next[key] = raw;
      used.add(raw);
      continue;
    }
    const fallback = CARD_PRIORITY_VALUES.find((value) => !used.has(value));
    next[key] = fallback || '';
    if (fallback) used.add(fallback);
  }

  return next;
}

export function hasDuplicateCardPriorities(priorities) {
  const values = PROFILE_PRIORITY_KEYS
    .map((key) => String(priorities?.[key] || '').toLowerCase())
    .filter((value) => value && CARD_PRIORITY_VALUES.includes(value));
  return new Set(values).size !== values.length;
}

export function normalizeUsStateCode(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  const match = raw.match(/(?:,\s*|\b)([A-Za-z]{2})(?:\s+\d{5}(?:-\d{4})?)?\s*$/);
  return match ? match[1].toUpperCase() : '';
}

export function isTruthyFlag(value, defaultValue = true) {
  if (value == null) return defaultValue;
  if (typeof value === 'boolean') return value;
  const raw = String(value).trim().toLowerCase();
  if (!raw) return defaultValue;
  if (raw === 'false' || raw === '0' || raw === 'off' || raw === 'no') return false;
  if (raw === 'true' || raw === '1' || raw === 'on' || raw === 'yes') return true;
  return Boolean(value);
}

export function normalizeMarkets(markets) {
  return Array.from(new Set((Array.isArray(markets) ? markets : [])
    .map((code) => String(code || '').trim().toUpperCase())
    .filter((code) => /^[A-Z]{2}$/.test(code))));
}
