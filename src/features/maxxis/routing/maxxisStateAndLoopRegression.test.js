/* global process */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Maxxis comp-state, routing and report-loop regressions', () => {
  it('keeps both structural cache partitions in the visual review response', () => {
    const endpoint = source('supabase/functions/arv-visual-comp-review/index.ts');
    expect(endpoint).toContain('primaryStructuralCandidates');
    expect(endpoint).toContain('supportingStructuralCandidates');
    expect(endpoint).toContain('candidates: structuralCandidates');
  });

  it('publishes one canonical comp classification state beside the ARV evaluation', () => {
    const domain = source('supabase/functions/_shared/property-data/arvVisualCompReview.ts');
    expect(domain).toContain('const compAnalysisState =');
    expect(domain).toContain('candidatesConsidered: input.candidates.length');
    expect(domain).toContain('supporting,');
    expect(domain).toContain('arvEligible: selected');
  });

  it('does not replace the old UI with an intermediate empty recalculation state', () => {
    const assistant = source('src/components/maxxis/MaxxisAssistant.jsx');
    expect(assistant).toContain("setActiveArvReviewKey('target')");
    expect(assistant.indexOf('persistArvTargetCondition(propertyId, targetCondition)'))
      .toBeLessThan(assistant.indexOf("setActiveArvReviewKey('')", assistant.indexOf('persistArvTargetCondition')));
    expect(assistant).not.toMatch(/replaceArvReviewMessage\([^\n]+(?:\{\}|\[\])\)/);
  });

  it('only opens the blocking gap surface for a real gap response or report request', () => {
    const assistant = source('src/components/maxxis/MaxxisAssistant.jsx');
    expect(assistant).toContain('shouldPresentAnalysisGap(conversationRoute, requestedReportType)');
    expect(assistant).toContain('controlledIntent: effectiveControlledIntent');
  });

  it('does not append a report CTA to an intent-changed deal response', () => {
    const assistant = source('src/components/maxxis/MaxxisAssistant.jsx');
    expect(assistant).toContain('conversationRoute.code === MAXXIS_CONVERSATION_INTENTS.REPORT_REQUEST');
    expect(assistant).not.toContain("responseType === 'deal_insight' && !requestedReportType\n        ? (() =>");
  });

  it('routes SUB-TO to focused property facts and explicitly prohibits invented financing inputs', () => {
    const chat = source('supabase/functions/maxxis-chat/index.ts');
    const prompts = source('supabase/functions/_shared/maxxis/prompts.ts');
    expect(chat).toContain("controlledIntent === 'current_deal_followup'");
    expect(chat).toContain("name: 'getPropertyDetails'");
    expect(chat).toContain('subToFinancingMessage(language, result.found)');
    expect(chat).toContain("focusedIntent: 'CURRENT_DEAL_FOLLOWUP'");
    expect(prompts).toContain('For a focused SUB-TO or existing-mortgage question');
    expect(prompts).toContain('never invent them');
  });

  it('keeps report PDF implementation untouched by this correction', () => {
    const changedPaths = [
      'src/features/maxxis/routing/maxxisConversationIntent.js',
      'src/features/maxxis/arvReview/MaxxisArvVisualCompReview.jsx',
      'src/features/maxxis/intelligence/MaxxisAnalysisGapResolution.jsx',
    ];
    expect(changedPaths).not.toContain('src/features/maxxis/export/maxxisReportPdf.js');
  });

  it('uses normal chat typography and inline actions for Gap Resolver and Alter', () => {
    const gap = source('src/features/maxxis/intelligence/MaxxisAnalysisGapResolution.jsx');
    const css = source('src/components/maxxis/MaxxisAssistant.css');
    expect(gap).toContain('maxxis-gap-inline');
    expect(gap).toContain('maxxis-inline-link maxxis-gap-choice');
    expect(gap).toContain('className="maxxis-inline-link" onClick={() => onEdit');
    expect(css).toMatch(/\.maxxis-gap-inline,[\s\S]*?font:\s*inherit/);
    expect(css).toContain('.maxxis-gap-resolved > button.maxxis-inline-link');
  });

  it('renders ARV and supporting comps as compact text instead of metric dashboards', () => {
    const result = source('src/features/maxxis/arvReview/MaxxisArvResultExperience.jsx');
    const review = source('src/features/maxxis/arvReview/MaxxisArvVisualCompReview.jsx');
    expect(result).toContain('maxxis-arv-inline-metrics');
    expect(result).not.toContain('maxxis-arv-primary-result');
    expect(result).not.toContain('maxxis-arv-result-metrics');
    expect(review).toContain('maxxis-inline-link');
    expect(review).toContain('supportingCandidates.map');
  });
});
