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

export function isRequestOriginAllowed(requestOrigin = '', allowedOrigins: string[] = []) {
  const normalized = normalizeOrigin(requestOrigin);
  // Server-to-server calls do not carry browser Origin and remain authenticated
  // by their own bearer/signature validation.
  return !normalized || allowedOrigins.includes(normalized);
}

export function buildCorsHeaders(requestOrigin = '', allowedOrigins: string[] = []) {
  const normalized = normalizeOrigin(requestOrigin);
  const allowOrigin = normalized && allowedOrigins.includes(normalized) ? normalized : '';
  return {
    ...(allowOrigin ? { 'Access-Control-Allow-Origin': allowOrigin } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

export function resolveTrustedReturnUrl(
  candidate: unknown,
  fallbackUrl: string,
  allowedOrigins: string[] = [],
) {
  const safeFallback = String(fallbackUrl || '').trim();
  const raw = String(candidate || '').trim();
  if (!raw) return safeFallback;
  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol)) return safeFallback;
    return allowedOrigins.includes(parsed.origin) ? parsed.toString() : safeFallback;
  } catch {
    return safeFallback;
  }
}
