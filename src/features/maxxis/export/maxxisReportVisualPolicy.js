export const REPORT_BODY_TIERS = Object.freeze({
  default: 10.5,
  tier1: 10,
  tier2: 9.5,
  minimum: 9,
});

export const REPORT_SOLID_OFFSETS = Object.freeze({ title: 2.5, card: 5.5 });
export const REPORT_LAYOUT_TOKENS = Object.freeze({ sectionGapY: 8, informationalRowDividers: false });

const policy = (sectionId, preferredCharacterBudget, hardCharacterBudget, preferredLineCount, maximumLineCount, preferredBulletCount = 3, maximumBulletCount = 4) => Object.freeze({
  sectionId,
  defaultFontSize: REPORT_BODY_TIERS.default,
  tier1FontSize: REPORT_BODY_TIERS.tier1,
  tier2FontSize: REPORT_BODY_TIERS.tier2,
  minimumFontSize: REPORT_BODY_TIERS.minimum,
  preferredCharacterBudget,
  hardCharacterBudget,
  preferredLineCount,
  maximumLineCount,
  preferredBulletCount,
  maximumBulletCount,
});

export const SECTION_TEXT_POLICIES = Object.freeze({
  propertyNotes: policy('propertyNotes', 320, 500, 4, 7, 2, 3),
  level2OpportunitySummary: policy('level2OpportunitySummary', 520, 750, 6, 9, 3, 4),
  level2ExecutiveInsight: policy('level2ExecutiveInsight', 520, 700, 4, 6, 3, 4),
  level3SmallAnalyticalCard: policy('level3SmallAnalyticalCard', 320, 500, 8, 12, 3, 4),
  level3ExecutiveInsight: policy('level3ExecutiveInsight', 580, 750, 4, 6, 3, 4),
  level3Conclusion: policy('level3Conclusion', 430, 600, 5, 8, 3, 4),
  level3ListCard: policy('level3ListCard', 350, 520, 10, 14, 3, 4),
});

export const REPORT_TEXT_POLICIES = Object.freeze({
  propertyNotes: SECTION_TEXT_POLICIES.propertyNotes,
  level2OpportunitySummary: policy('level2OpportunitySummary', 640, 700, 7, 8, 3, 4),
  level2ExecutiveInsight: policy('level2ExecutiveInsight', 580, 650, 6, 7, 3, 4),
  page5PositiveSignals: policy('page5PositiveSignals', 300, 420, 6, 8, 4, 4),
  page5Missing: policy('page5Missing', 300, 420, 6, 8, 4, 4),
  page5AttentionPoints: policy('page5AttentionPoints', 300, 420, 6, 8, 4, 4),
  page5RecommendedActions: policy('page5RecommendedActions', 300, 420, 6, 8, 4, 4),
  page5ExecutiveInsight: policy('page5ExecutiveInsight', 580, 650, 6, 7, 3, 4),
  page6ExecutiveSummary: policy('page6ExecutiveSummary', 700, 800, 6, 8, 2, 2),
  page6ProfileConclusion: policy('page6ProfileConclusion', 560, 650, 7, 8, 2, 3),
  page6MainTopics: policy('page6MainTopics', 300, 350, 5, 6, 3, 3),
  page6OpenQuestions: policy('page6OpenQuestions', 260, 300, 5, 6, 3, 3),
  page6RecommendedActions: policy('page6RecommendedActions', 260, 300, 5, 6, 3, 3),
  valuationLimitations: policy('valuationLimitations', 350, 520, 8, 10, 3, 4),
  comparableObservations: policy('comparableObservations', 350, 520, 6, 8, 3, 4),
});

export const REPORT_METRIC_BAR = Object.freeze({ height: 8, radius: 4, neutralTrack: [226, 234, 239] });

export function selectSectionTextTier({ text = '', policy: sectionPolicy, measure }) {
  const characterCount = String(text).length;
  const tiers = [
    ['default', sectionPolicy.defaultFontSize],
    ['tier1', sectionPolicy.tier1FontSize],
    ['tier2', sectionPolicy.tier2FontSize],
    ['minimum', sectionPolicy.minimumFontSize],
  ];
  const evaluate = ([tier, fontSize]) => ({ tier, fontSize, characterCount, ...measure(fontSize) });
  const defaultResult = evaluate(tiers[0]);
  if (characterCount <= sectionPolicy.preferredCharacterBudget || defaultResult.overflowHeight <= 0) return defaultResult;
  for (const tier of tiers.slice(1)) {
    const result = evaluate(tier);
    if (result.overflowHeight <= 0) return result;
  }
  return evaluate(tiers.at(-1));
}

export function deduplicateAndBudgetItems(items, sectionPolicy) {
  const seen = new Set();
  return items.filter((item) => {
    const key = String(item || '').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, sectionPolicy.maximumBulletCount);
}
