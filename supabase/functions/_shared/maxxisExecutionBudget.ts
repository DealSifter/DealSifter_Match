export type MaxxisExecutionLimits = {
  maxGeminiCalls: number;
  maxToolCalls: number;
  maxToolRounds: number;
  maxDurationMs: number;
  maxRequestBytes: number;
  maxMessageChars: number;
  maxHistoryItems: number;
  maxHistoryChars: number;
  maxToolPayloadChars: number;
  maxOutputTokens: number;
};

export const MAXXIS_EXECUTION_LIMITS: Readonly<MaxxisExecutionLimits> = {
  maxGeminiCalls: 3,
  maxToolCalls: 1,
  maxToolRounds: 1,
  maxDurationMs: 25_000,
  maxRequestBytes: 64 * 1024,
  maxMessageChars: 1_800,
  maxHistoryItems: 10,
  maxHistoryChars: 12_000,
  maxToolPayloadChars: 64_000,
  maxOutputTokens: 1_400,
} as const;

export class MaxxisExecutionBudget {
  readonly startedAt = Date.now();
  geminiCalls = 0;
  toolCalls = 0;
  toolRounds = 0;

  constructor(readonly limits: Readonly<MaxxisExecutionLimits> = MAXXIS_EXECUTION_LIMITS) {}

  remainingMs() {
    return Math.max(0, this.limits.maxDurationMs - (Date.now() - this.startedAt));
  }

  consumeGeminiCall() {
    if (this.geminiCalls >= this.limits.maxGeminiCalls || this.remainingMs() <= 0) throw new Error('MAXXIS_BUDGET_EXHAUSTED');
    this.geminiCalls += 1;
  }

  consumeToolRound() {
    if (this.toolRounds >= this.limits.maxToolRounds || this.toolCalls >= this.limits.maxToolCalls || this.remainingMs() <= 0) {
      throw new Error('MAXXIS_BUDGET_EXHAUSTED');
    }
    this.toolRounds += 1;
    this.toolCalls += 1;
  }

  validateHistory(history: unknown[]) {
    if (history.length > this.limits.maxHistoryItems) throw new Error('MAXXIS_CONTEXT_TOO_LARGE');
    const chars = history.reduce((total, item) => {
      const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      return total + String(row.content || row.text || '').length;
    }, 0);
    if (chars > this.limits.maxHistoryChars) throw new Error('MAXXIS_CONTEXT_TOO_LARGE');
  }

  validateToolPayload(value: unknown) {
    if (JSON.stringify(value ?? null).length > this.limits.maxToolPayloadChars) throw new Error('MAXXIS_TOOL_PAYLOAD_TOO_LARGE');
  }
}
