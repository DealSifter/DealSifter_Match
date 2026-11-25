import { geminiApiKey, geminiTimeoutMs } from './config.ts';
import { GeminiQuotaError, type GeminiUsageSession } from './geminiUsageGuard.ts';

export async function callGemini(model: string, body: Record<string, unknown>, remainingBudgetMs = geminiTimeoutMs, usage?: GeminiUsageSession) {
  if (!usage) throw new GeminiQuotaError('GEMINI_CONTEXT_REQUIRED');
  const authorizationStartedAt = Date.now();
  const attempt = await usage.begin(model, body);
  const controller = new AbortController();
  const remaining = remainingBudgetMs - (Date.now() - authorizationStartedAt);
  if (remaining <= 0) { await usage.finish(attempt, null, false); throw new GeminiQuotaError(); }
  const timeoutMs = Math.max(1, Math.min(geminiTimeoutMs, remaining));
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let payload: Awaited<ReturnType<Response['json']>> = null;
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiApiKey)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal },
    );
    payload = await response.json().catch(() => ({}));
    return { response, payload };
  } finally {
    clearTimeout(timeout);
    await usage.finish(attempt, payload);
  }
}
