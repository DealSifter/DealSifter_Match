import { geminiApiKey, geminiTimeoutMs } from './config.ts';

export async function callGemini(model: string, body: Record<string, unknown>, remainingBudgetMs = geminiTimeoutMs) {
  const controller = new AbortController();
  const timeoutMs = Math.max(1, Math.min(geminiTimeoutMs, remainingBudgetMs));
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiApiKey)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal },
    );
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  } finally {
    clearTimeout(timeout);
  }
}
