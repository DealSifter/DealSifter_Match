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

export function buildCorsHeaders(requestOrigin = '', allowedOrigins: string[] = []) {
  const allowOrigin = resolveAllowedOrigin(requestOrigin, allowedOrigins);
  return {
    ...(allowOrigin ? { 'Access-Control-Allow-Origin': allowOrigin } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}
