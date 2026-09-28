import { describe, expect, it } from 'vitest';
import {
  classifyMaxxisConversationIntent,
  controlledIntentForConversation,
  MAXXIS_CONVERSATION_INTENTS,
  shouldPresentAnalysisGap,
} from './maxxisConversationIntent';

const pendingCondition = {
  type: 'analysis_gap_resolution',
  data: { missingUserInputs: ['target_condition'] },
};

describe('Maxxis deterministic conversation intent router', () => {
  it.each([
    ['turn key', 'GAP_RESPONSE'],
    ['full rehab', 'GAP_RESPONSE'],
    ['qual seria o mortgage para ingressar no SUB-TO?', 'CURRENT_DEAL_FOLLOWUP'],
    ['explique o AVM', 'PROPERTY_ANALYSIS_QUESTION'],
    ['gere o relatório', 'REPORT_REQUEST'],
    ['como funciona tax deed?', 'GENERAL_REAL_ESTATE_QUESTION'],
  ])('routes %s to %s while a condition gap is pending', (message, expected) => {
    expect(classifyMaxxisConversationIntent(message, { pendingGap: pendingCondition }).code).toBe(expected);
  });

  it('only consumes a pending gap when the answer plausibly resolves it', () => {
    const route = classifyMaxxisConversationIntent('qual seria o mortgage para ingressar no SUB-TO?', {
      pendingGap: pendingCondition,
    });
    expect(route.gapAnswer).toBeNull();
    expect(controlledIntentForConversation(route)).toBe('current_deal_followup');
  });

  it('keeps ordinary questions conversational instead of reopening a gap form', () => {
    const route = classifyMaxxisConversationIntent('explique o AVM', { pendingGap: pendingCondition });
    expect(route.code).toBe(MAXXIS_CONVERSATION_INTENTS.PROPERTY_ANALYSIS_QUESTION);
    expect(shouldPresentAnalysisGap(route)).toBe(false);
    expect(shouldPresentAnalysisGap(route, 'DEAL_INTELLIGENCE')).toBe(true);
  });

  it('supports a multi-topic ARV → gap → SUB-TO → missing inputs → comps sequence', () => {
    const arv = classifyMaxxisConversationIntent('por que não tem ARV?', { pendingGap: null });
    const gap = classifyMaxxisConversationIntent('turn key', { pendingGap: pendingCondition, previousIntent: arv.code });
    const subTo = classifyMaxxisConversationIntent('qual seria meu mortgage no SUB-TO?', { pendingGap: pendingCondition, previousIntent: arv.code });
    const missing = classifyMaxxisConversationIntent('o que falta?', { pendingGap: pendingCondition, previousIntent: subTo.code });
    const comps = classifyMaxxisConversationIntent('voltando aos comps, quais são os melhores?', { pendingGap: pendingCondition, previousIntent: missing.code });
    expect([arv.code, gap.code, subTo.code, missing.code, comps.code]).toEqual([
      'PROPERTY_ANALYSIS_QUESTION', 'GAP_RESPONSE', 'CURRENT_DEAL_FOLLOWUP',
      'CURRENT_DEAL_FOLLOWUP', 'PROPERTY_ANALYSIS_QUESTION',
    ]);
  });
});
