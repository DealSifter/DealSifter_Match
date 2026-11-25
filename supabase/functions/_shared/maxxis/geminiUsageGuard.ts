import { geminiModels } from './config.ts';
import { MAXXIS_EXECUTION_LIMITS } from '../maxxisExecutionBudget.ts';
import { MAXXIS_CONTEXT_BUDGET } from './maxxisContextBudget.ts';

type Rpc = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };
export type GeminiConsumer = 'maxxis_chat' | 'presentation_translate';
export class GeminiQuotaError extends Error {
  constructor(readonly reason = 'GEMINI_GUARD_UNAVAILABLE') { super(reason); this.name = 'GeminiQuotaError'; }
}
const allowedErrors = ['GEMINI_INDIVIDUAL_LIMIT','GEMINI_FREE_POOL_LIMIT','GEMINI_PAID_POOL_LIMIT','GEMINI_CAPACITY_LIMIT','GEMINI_MODEL_LIMIT','GEMINI_CONFIGURATION_REQUIRED'];
const integer = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 1e12 ? value : null;
export function normalizeGeminiUsage(payload: Record<string, unknown> | null) {
  const usage = payload?.usageMetadata as Record<string, unknown> | undefined;
  return { p_prompt: integer(usage?.promptTokenCount), p_output: integer(usage?.candidatesTokenCount),
    p_thinking: integer(usage?.thoughtsTokenCount), p_cached: integer(usage?.cachedContentTokenCount),
    p_tool: integer(usage?.toolUsePromptTokenCount), p_total: integer(usage?.totalTokenCount) };
}
// UTF-8 bytes are a conservative input bound, not exact/faturable token counts.
export function estimateGeminiReservation(body: Record<string, unknown>) {
  const generation = body.generationConfig as Record<string, unknown> | undefined;
  const output = integer(generation?.maxOutputTokens);
  if (!output || output > 8192) throw new GeminiQuotaError('GEMINI_INVALID_TOKEN_BOUND');
  return new TextEncoder().encode(JSON.stringify(body)).byteLength + output;
}
export class GeminiUsageSession {
  private readonly id = crypto.randomUUID();
  private hasReservation = false;
  private tokenBound = 0;
  constructor(private readonly client: Rpc, private readonly userId: string, private readonly consumer: GeminiConsumer,
    private readonly models: readonly string[] = geminiModels, private readonly requestId?: string) {}
  private async rpc(name: string, args: Record<string, unknown>) {
    let result;
    try { result = await this.client.rpc(name, args); } catch { throw new GeminiQuotaError(); }
    if (result.error) {
      const message = typeof result.error === 'object' && result.error ? String((result.error as {message?: unknown}).message || '') : '';
      throw new GeminiQuotaError(allowedErrors.find(code => message.includes(code)));
    }
    return result.data as { enforced?: boolean } | null;
  }
  async begin(model: string, body: Record<string, unknown>) {
    const tokens = estimateGeminiReservation(body);
    // Reserve the complete existing chat execution, including fallback/interpretation.
    // Translation has one attempt; no commercial chat interaction is charged for it.
    this.tokenBound ||= this.consumer === 'maxxis_chat'
      ? MAXXIS_EXECUTION_LIMITS.maxRequestBytes + MAXXIS_CONTEXT_BUDGET.maxGeminiRequestChars * 4
        + MAXXIS_EXECUTION_LIMITS.maxToolPayloadChars * 4 + MAXXIS_EXECUTION_LIMITS.maxOutputTokens
      : tokens;
    const reservation = await this.rpc('ds_gemini_reserve_execution', { p_id: this.id, p_user: this.userId,
      p_consumer: this.consumer, p_calls: this.consumer === 'maxxis_chat' ? MAXXIS_EXECUTION_LIMITS.maxGeminiCalls : 1,
      p_tokens: this.tokenBound, p_models: [...this.models],
      p_request_id: /^[0-9a-f-]{36}$/i.test(this.requestId || '') ? this.requestId : null });
    if (reservation?.enforced === false) return null;
    if (reservation?.enforced !== true) throw new GeminiQuotaError();
    this.hasReservation = true;
    const attempt = crypto.randomUUID();
    const started = await this.rpc('ds_gemini_begin_attempt', { p_execution: this.id, p_attempt: attempt, p_model: model, p_tokens: tokens });
    if (started?.enforced === false) return null;
    if (started?.enforced !== true) throw new GeminiQuotaError();
    return attempt;
  }
  async finish(attempt: string | null, payload: Record<string, unknown> | null, dispatched = true) {
    if (!attempt) return;
    await this.rpc('ds_gemini_finalize_attempt', { p_attempt: attempt, p_dispatched: dispatched, ...normalizeGeminiUsage(payload) });
  }
  async close() {
    if (!this.hasReservation) return;
    try { await this.rpc('ds_gemini_close_execution', { p_id: this.id }); }
    catch { /* Held capacity expires; started attempts remain conservatively charged. */ }
  }
}
export function createGeminiUsageSession(userId: string, consumer: GeminiConsumer, makeClient: () => Rpc, requestId?: string) {
  let client: Rpc | undefined;
  return new GeminiUsageSession({ rpc(name, args) {
    if (!userId) throw new GeminiQuotaError();
    client ||= makeClient();
    return client.rpc(name, args);
  } }, userId, consumer, geminiModels, requestId);
}
export function geminiQuotaMessage(reason: string, language: string) {
  const lang = language.startsWith('pt') ? 'pt' : language.startsWith('es') ? 'es' : 'en';
  const kind = reason === 'GEMINI_INDIVIDUAL_LIMIT' ? 0 : reason === 'GEMINI_FREE_POOL_LIMIT' ? 1 : 2;
  return {
    en: ['Your generative usage limit has been reached. Local features remain available.', 'The free generative capacity is temporarily unavailable. Local features remain available.', 'Generative capacity is temporarily unavailable. Local features remain available. Please try again later.'],
    pt: ['Seu limite de uso generativo foi atingido. Os recursos locais continuam disponíveis.', 'A capacidade generativa gratuita está temporariamente indisponível. Os recursos locais continuam disponíveis.', 'A capacidade generativa está temporariamente indisponível. Os recursos locais continuam disponíveis. Tente novamente mais tarde.'],
    es: ['Se alcanzó tu límite de uso generativo. Las funciones locales siguen disponibles.', 'La capacidad generativa gratuita no está disponible temporalmente. Las funciones locales siguen disponibles.', 'La capacidad generativa no está disponible temporalmente. Las funciones locales siguen disponibles. Inténtalo más tarde.'],
  }[lang][kind];
}
