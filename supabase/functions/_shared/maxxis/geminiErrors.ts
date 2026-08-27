export type GeminiFailureCode =
  | 'GEMINI_AUTH_ERROR'
  | 'GEMINI_QUOTA_EXCEEDED'
  | 'GEMINI_MODEL_UNAVAILABLE'
  | 'GEMINI_TIMEOUT'
  | 'GEMINI_BLOCKED_RESPONSE'
  | 'GEMINI_EMPTY_RESPONSE'
  | 'GEMINI_TOOL_ERROR'
  | 'GEMINI_NETWORK_ERROR'
  | 'GEMINI_INTERNAL_ERROR';

function providerStatus(payload: unknown) {
  if (!payload || typeof payload !== 'object') return '';
  const error = (payload as Record<string, unknown>).error;
  if (!error || typeof error !== 'object') return '';
  return String((error as Record<string, unknown>).status || '').toUpperCase();
}

function providerMessage(payload: unknown) {
  if (!payload || typeof payload !== 'object') return '';
  const error = (payload as Record<string, unknown>).error;
  if (!error || typeof error !== 'object') return '';
  return String((error as Record<string, unknown>).message || '').toUpperCase();
}

export function classifyGeminiHttpFailure(status: number, payload?: unknown): GeminiFailureCode {
  const upstreamStatus = providerStatus(payload);
  const upstreamMessage = providerMessage(payload);
  if (
    status === 401
    || status === 403
    || upstreamStatus === 'PERMISSION_DENIED'
    || upstreamStatus === 'UNAUTHENTICATED'
    || /API.KEY.*(INVALID|NOT VALID|EXPIRED|REVOKED)/.test(upstreamMessage)
  ) return 'GEMINI_AUTH_ERROR';
  if (status === 429 || upstreamStatus === 'RESOURCE_EXHAUSTED') return 'GEMINI_QUOTA_EXCEEDED';
  if (status === 404 || upstreamStatus === 'NOT_FOUND' || upstreamStatus === 'UNAVAILABLE') return 'GEMINI_MODEL_UNAVAILABLE';
  return 'GEMINI_INTERNAL_ERROR';
}

export function classifyGeminiThrownFailure(error: unknown): GeminiFailureCode {
  if (error instanceof DOMException && error.name === 'AbortError') return 'GEMINI_TIMEOUT';
  if (error instanceof TypeError) return 'GEMINI_NETWORK_ERROR';
  const code = String((error as { code?: string } | null)?.code || '').toUpperCase();
  if (code === 'GEMINI_TOOL_ERROR') return 'GEMINI_TOOL_ERROR';
  return 'GEMINI_INTERNAL_ERROR';
}

export function classifyGeminiCandidateFailure(candidate: unknown): GeminiFailureCode {
  if (candidate && typeof candidate === 'object') {
    const finishReason = String((candidate as Record<string, unknown>).finishReason || '').toUpperCase();
    if (['SAFETY', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'RECITATION'].includes(finishReason)) {
      return 'GEMINI_BLOCKED_RESPONSE';
    }
  }
  return 'GEMINI_EMPTY_RESPONSE';
}

export function selectGeminiFailure(codes: GeminiFailureCode[]): GeminiFailureCode {
  const priority: GeminiFailureCode[] = [
    'GEMINI_AUTH_ERROR',
    'GEMINI_QUOTA_EXCEEDED',
    'GEMINI_MODEL_UNAVAILABLE',
    'GEMINI_TIMEOUT',
    'GEMINI_NETWORK_ERROR',
    'GEMINI_BLOCKED_RESPONSE',
    'GEMINI_EMPTY_RESPONSE',
    'GEMINI_TOOL_ERROR',
    'GEMINI_INTERNAL_ERROR',
  ];
  return priority.find((code) => codes.includes(code)) || 'GEMINI_INTERNAL_ERROR';
}
