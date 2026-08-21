const normalizeOrigin = (value: string) => {
  const raw = String(value || '').trim();
  if (!raw || raw === '*') return '';
  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    return parsed.origin;
  } catch {
    return '';
  }
};

export function parseAllowedOrigins(configured = '', fallbacks: string[] = []) {
  return Array.from(new Set([
    ...String(configured || '').split(','),
    ...fallbacks,
  ].map(normalizeOrigin).filter(Boolean)));
}

export function resolveAllowedOrigin(requestOrigin = '', allowedOrigins: string[] = []) {
  const origin = normalizeOrigin(requestOrigin);
  if (!origin) return '';
  return allowedOrigins.includes(origin) ? origin : '';
}
