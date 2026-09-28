const EXPLANATION_RE = /(?:^|\s)(por\s+que|por\s+qual\s+motivo|qual\s+(?:foi\s+)?(?:o\s+)?motivo|why|what\s+happened|que\s+paso)(?:\s|[?!.,]|$)/i;

export function isMaxxisReportFailureExplanationQuestion(message = '') {
  const normalized = String(message || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/^[^a-z0-9]+/i, '').trim();
  return EXPLANATION_RE.test(normalized);
}

export function createMaxxisReportFailureState(result = {}, propertyId = '', reportType = '') {
  const diagnostic = result?.diagnostic && typeof result.diagnostic === 'object' ? result.diagnostic : {};
  return Object.freeze({
    propertyId: String(propertyId || '').trim(),
    reportType: String(reportType || '').trim().toUpperCase(),
    requestId: String(result?.requestId || '').trim(),
    errorCode: String(result?.degradedReason || result?.error || diagnostic.errorCode || 'REPORT_INTERPRETATION_FAILED').trim().slice(0, 80),
    stage: String(diagnostic.stage || 'report_interpretation').trim().slice(0, 80),
    occurredAt: new Date().toISOString(),
  });
}

export function composeMaxxisReportFailureExplanation(failure = {}, language = 'en') {
  const modelUnavailable = String(failure?.errorCode || '').includes('MODEL_UNAVAILABLE');
  if (language === 'pt') {
    const stage = modelUnavailable
      ? 'a etapa opcional de interpretação em linguagem natural ficou temporariamente indisponível'
      : 'a etapa de interpretação do relatório não pôde ser concluída';
    return `A tentativa anterior falhou porque ${stage}. O contexto do imóvel e a conversa foram preservados, seus dados não foram perdidos e nenhum relatório incompleto foi salvo.`;
  }
  if (language === 'es') {
    const stage = modelUnavailable
      ? 'la etapa opcional de interpretación en lenguaje natural no estuvo disponible temporalmente'
      : 'no se pudo completar la etapa de interpretación del informe';
    return `El intento anterior falló porque ${stage}. Se conservaron el contexto de la propiedad y la conversación, no se perdieron datos y no se guardó ningún informe incompleto.`;
  }
  const stage = modelUnavailable
    ? 'the optional natural-language interpretation stage was temporarily unavailable'
    : 'the report interpretation stage could not be completed';
  return `The previous attempt failed because ${stage}. The property context and conversation were preserved, no data was lost, and no incomplete report was saved.`;
}
