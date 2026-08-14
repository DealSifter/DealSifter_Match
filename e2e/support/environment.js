/* global process */
const PRODUCTION_HOSTS = new Set([
  'dealsiftermatch.vercel.app',
  'dealsifter-match.vercel.app',
  'dealsifter.com',
  'www.dealsifter.com',
]);

export function getE2ERunId() {
  const raw = String(process.env.E2E_RUN_ID || '').trim();
  if (raw) return raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 48);
  return `e2e-${Date.now().toString(36)}`;
}

export function isProductionUrl(value) {
  try {
    const parsed = new URL(String(value || ''));
    return PRODUCTION_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function assertSafeE2EEnvironment({ baseURL = process.env.E2E_BASE_URL, destructive = false } = {}) {
  if (!destructive) return;
  if (!isProductionUrl(baseURL)) return;
  throw new Error(
    `Blocked destructive E2E suite against production URL: ${baseURL}. ` +
      'Use a local or staging URL with isolated fixtures.',
  );
}
