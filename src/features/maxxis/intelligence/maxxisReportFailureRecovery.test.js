import { describe, expect, it } from 'vitest';
import {
  composeMaxxisReportFailureExplanation,
  createMaxxisReportFailureState,
  isMaxxisReportFailureExplanationQuestion,
} from './maxxisReportFailureRecovery';

describe('Maxxis report failure recovery', () => {
  it.each(['por qual motivo?', 'por que falhou?', 'why?', '¿por qué?'])(
    'recognizes a follow-up explanation request: %s',
    (message) => expect(isMaxxisReportFailureExplanationQuestion(message)).toBe(true),
  );

  it('records only safe diagnostic state and explains that chat and property context were preserved', () => {
    const failure = createMaxxisReportFailureState({
      requestId: 'request-1',
      degradedReason: 'GEMINI_MODEL_UNAVAILABLE',
      diagnostic: { stage: 'gemini_tool_selection', stack: 'must-not-be-copied' },
    }, 'property-1', 'DEAL_INTELLIGENCE');
    expect(failure).toMatchObject({
      propertyId: 'property-1', reportType: 'DEAL_INTELLIGENCE',
      errorCode: 'GEMINI_MODEL_UNAVAILABLE', stage: 'gemini_tool_selection',
    });
    expect(failure).not.toHaveProperty('stack');
    const answer = composeMaxxisReportFailureExplanation(failure, 'pt');
    expect(answer).toContain('contexto do imóvel e a conversa foram preservados');
    expect(answer).toContain('nenhum relatório incompleto foi salvo');
    expect(answer).not.toContain('GEMINI_');
  });
});
