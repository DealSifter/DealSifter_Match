type GeminiContent = { role: 'user' | 'model'; parts: Array<{ text: string }> };

export const MAXXIS_CONTEXT_BUDGET = Object.freeze({
  maxGeminiRequestChars: 48_000,
  maxSecondPassChars: 24_000,
  maxToolProjectionChars: 12_000,
  recentHistoryItems: 6,
  recentHistoryChars: 3_600,
  conversationSummaryChars: 900,
  approximateCharsPerToken: 4,
});

const DECISION_RE = /\b(condition|condi[cç][aã]o|estado|rehab|reforma|renova[cç][aã]o|budget|or[cç]amento|strategy|estrat[eé]gia|assumption|premissa|as[- ]is|turn[- ]key|full renovation|light rehab|standard renovation|new construction)\b/i;
const clean = (value: unknown, max: number) => String(value || '')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
  .replace(/\s+/g, ' ').trim().slice(0, max);
const size = (value: unknown) => JSON.stringify(value ?? null).length;

export function compactMaxxisConversationHistory(historyInput: unknown): {
  contents: GeminiContent[];
  summary: string;
  originalItems: number;
  originalChars: number;
  compactedChars: number;
} {
  const rows = (Array.isArray(historyInput) ? historyInput : []).slice(-20).map((item) => {
    const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    return { role: row.role === 'assistant' ? 'model' as const : 'user' as const,
      text: clean(row.content || row.text, 4_000) };
  }).filter((item) => item.text);
  const originalChars = rows.reduce((total, item) => total + item.text.length, 0);
  const recent = rows.slice(-MAXXIS_CONTEXT_BUDGET.recentHistoryItems);
  const older = rows.slice(0, -MAXXIS_CONTEXT_BUDGET.recentHistoryItems);
  const decisions = older.filter((item) => item.role === 'user' && DECISION_RE.test(item.text))
    .slice(-4).map((item) => clean(item.text, 220));
  const summary = clean(decisions.length
    ? `Preserved user decisions from earlier turns: ${decisions.join(' | ')}`
    : '', MAXXIS_CONTEXT_BUDGET.conversationSummaryChars);
  let recentBudget = MAXXIS_CONTEXT_BUDGET.recentHistoryChars;
  const compactRecent = [...recent].reverse().map((item) => {
    const text = clean(item.text, Math.min(600, Math.max(0, recentBudget)));
    recentBudget -= text.length;
    return { ...item, text };
  }).filter((item) => item.text).reverse();
  const contents: GeminiContent[] = [
    ...(summary ? [{ role: 'user' as const, parts: [{ text: summary }] }] : []),
    ...compactRecent.map((item) => ({ role: item.role, parts: [{ text: item.text }] })),
  ];
  return { contents, summary, originalItems: rows.length, originalChars,
    compactedChars: contents.reduce((total, item) => total + item.parts[0].text.length, 0) };
}

export type MaxxisContextSize = {
  totalChars: number;
  approximateTokens: number;
  sections: Record<string, number>;
  withinBudget: boolean;
};

export function measureMaxxisContext(
  sectionsInput: Record<string, unknown>,
  limit: number = MAXXIS_CONTEXT_BUDGET.maxGeminiRequestChars,
): MaxxisContextSize {
  const sections = Object.fromEntries(Object.entries(sectionsInput).map(([key, value]) => [key,
    typeof value === 'string' ? value.length : size(value)]));
  const totalChars = Object.values(sections).reduce((total, value) => total + value, 0);
  return { totalChars, approximateTokens: Math.ceil(totalChars / MAXXIS_CONTEXT_BUDGET.approximateCharsPerToken),
    sections, withinBudget: totalChars <= limit };
}

export function assertMaxxisContextBudget(
  sections: Record<string, unknown>,
  limit: number = MAXXIS_CONTEXT_BUDGET.maxGeminiRequestChars,
) {
  const measurement = measureMaxxisContext(sections, limit);
  if (!measurement.withinBudget) throw new Error('MAXXIS_CONTEXT_COMPACTION_FAILED');
  return measurement;
}

function compactValue(value: unknown, arrayLimit: number, stringLimit: number): unknown {
  if (typeof value === 'string') return clean(value, stringLimit);
  if (Array.isArray(value)) return value.slice(0, arrayLimit).map((item) => compactValue(item, arrayLimit, stringLimit));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => [key, compactValue(item, arrayLimit, stringLimit)]));
}

export function fitToolProjectionToBudget(value: Record<string, unknown>) {
  if (size(value) <= MAXXIS_CONTEXT_BUDGET.maxToolProjectionChars) return value;
  const medium = compactValue(value, 6, 360) as Record<string, unknown>;
  if (size(medium) <= MAXXIS_CONTEXT_BUDGET.maxToolProjectionChars) return medium;
  const small = compactValue(value, 4, 220) as Record<string, unknown>;
  if (size(small) <= MAXXIS_CONTEXT_BUDGET.maxToolProjectionChars) return small;
  throw new Error('MAXXIS_CONTEXT_COMPACTION_FAILED');
}
