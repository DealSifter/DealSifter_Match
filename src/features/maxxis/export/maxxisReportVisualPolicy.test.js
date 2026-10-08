import { describe, expect, it } from 'vitest';
import {
  REPORT_BODY_TIERS, REPORT_LAYOUT_TOKENS, REPORT_METRIC_BAR, REPORT_SOLID_OFFSETS, REPORT_TEXT_POLICIES, SECTION_TEXT_POLICIES,
  deduplicateAndBudgetItems, selectSectionTextTier,
} from './maxxisReportVisualPolicy';

const select = (length, availableHeight) => selectSectionTextTier({
  text: 'x'.repeat(length),
  policy: SECTION_TEXT_POLICIES.level2ExecutiveInsight,
  measure: (fontSize) => {
    const lineCount = Math.ceil(length / (58 * (10.5 / fontSize)));
    const renderedHeight = lineCount * (fontSize + 3);
    return { lineCount, renderedHeight, availableHeight, overflowHeight: Math.max(0, renderedHeight - availableHeight) };
  },
});

describe('Maxxis fixed report visual policy', () => {
  it('defines seven section-specific policies and discrete readable tiers', () => {
    expect(Object.keys(SECTION_TEXT_POLICIES)).toHaveLength(7);
    expect(Object.keys(REPORT_TEXT_POLICIES).length).toBeGreaterThanOrEqual(14);
    expect(REPORT_BODY_TIERS).toEqual({ default: 10.5, tier1: 10, tier2: 9.5, minimum: 9 });
  });
  it('keeps short text at the default size despite unused space', () => expect(select(80, 180).tier).toBe('default'));
  it('keeps medium text at default when measured content fits', () => expect(select(560, 140).tier).toBe('default'));
  it('selects tier 1 only after the preferred budget and measured overflow', () => expect(select(580, 132).tier).toBe('tier1'));
  it('selects tier 2 deterministically near the limit', () => expect(select(640, 128).tier).toBe('tier2'));
  it('never selects a body size below nine points', () => expect(select(900, 40).fontSize).toBeGreaterThanOrEqual(9));
  it('deduplicates system bullets before applying the fixed item budget', () => {
    const result = deduplicateAndBudgetItems(['A', ' a ', 'B', 'C', 'D', 'E'], SECTION_TEXT_POLICIES.level3ListCard);
    expect(result).toEqual(['A', 'B', 'C', 'D']);
  });
  it('keeps clean pill geometry and a deeper card than title solid offset', () => {
    expect(REPORT_METRIC_BAR).toMatchObject({ height: 8, radius: 4 });
    expect(REPORT_SOLID_OFFSETS.card).toBeGreaterThan(REPORT_SOLID_OFFSETS.title);
  });
  it('defines explicit Level 1 section spacing and forbids informational row dividers', () => {
    expect(REPORT_LAYOUT_TOKENS.sectionGapY).toBeGreaterThanOrEqual(8);
    expect(REPORT_LAYOUT_TOKENS.informationalRowDividers).toBe(false);
  });
});
