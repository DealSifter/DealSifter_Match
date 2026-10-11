export const REPORT_CONTENT_PRIORITIES = Object.freeze([
  'P0_FACT', 'P0_FINANCIAL', 'P0_CONFLICT', 'P1_DECISION', 'P1_RISK', 'P2_CONTEXT', 'P3_REPETITION',
]);

export function reportItemText(item) {
  return String(typeof item === 'string' ? item : item?.explanation || item?.reason || item?.label || item?.text || item?.status || '').trim();
}
export function classifyReportContent(item) {
  if (REPORT_CONTENT_PRIORITIES.includes(item?.priority)) return item.priority;
  const text = reportItemText(item);
  if (/conflict|conflito|divergen|MATERIAL_TYPE_CONFLICT/i.test(text)) return 'P0_CONFLICT';
  if (/[$€£]|\b(?:NOI|ROI|ARV|AVM|cap rate|balloon|principal|profit|lucro|cash flow|fluxo de caixa)\b|\d[\d.,]*\s*%/i.test(text)) return 'P0_FINANCIAL';
  if (/\b(?:APN|zoning|zoneamento|county|condado|subdivision|loteamento|assess|tax|imposto|sale|venda|HOA|acre|sqft|LAND|SFR|year built)\b|\d{4}-\d{2}-\d{2}/i.test(text)) return 'P0_FACT';
  if (/risk|risco|hazard|flood|inunda|lien|encumbrance|gravame|unverified|nao verificad|não verificad/i.test(text)) return 'P1_RISK';
  if (/assum|premiss|confirm|verif|requir|necess|decision|decis|input|entrada/i.test(text)) return 'P1_DECISION';
  return 'P2_CONTEXT';
}
export function rankReportContent(items) {
  const seen = new Set();
  return items.map((item, index) => ({ item, index, text: reportItemText(item), priority: classifyReportContent(item) }))
    .filter(({ text }) => {
      const key = text.toLocaleLowerCase().replace(/\s+/g, ' ');
      if (!key || seen.has(key)) return false;
      seen.add(key); return true;
    }).sort((a, b) => REPORT_CONTENT_PRIORITIES.indexOf(a.priority) - REPORT_CONTENT_PRIORITIES.indexOf(b.priority) || a.index - b.index);
}
export function reportSemanticUnits(text) {
  // Only split at punctuation followed by whitespace: preserve prices, decimals, dates and APNs.
  return String(text || '').split(/\n+/).flatMap(line => line.trim().replace(/^[-•*]\s+/, '').split(/(?<=[.!?])\s+(?=[A-ZÀ-Ú])/)).filter(Boolean);
}
export function reduceReportContent(text, policy = {}) {
  const ranked = rankReportContent(reportSemanticUnits(text));
  const budget = policy.hardCharacterBudget || 500;
  const retained = []; let count = 0;
  for (const unit of ranked) {
    const protectedContent = unit.priority.startsWith('P0_') || unit.priority.startsWith('P1_');
    if (protectedContent || count + unit.text.length <= budget) {
      retained.push(unit); count += unit.text.length + 1;
    }
  }
  return retained.sort((a, b) => a.index - b.index).map(unit => unit.text).join('\n');
}
export function selectReportBullets(items, limit) {
  const ranked = rankReportContent(items);
  const selected = ranked.filter((unit, index) => index < limit || unit.priority.startsWith('P0_') || unit.priority.startsWith('P1_'));
  return selected.map(unit => unit.item);
}
