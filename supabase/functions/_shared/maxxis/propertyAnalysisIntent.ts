/** A selected-property question must not be mistaken for a platform-wide inventory search. */
export function asksForSelectedPropertyAnalysis(message: string): boolean {
  const normalized = String(message || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /\b(analy[sz]e|analysis|analisar|analise|analizar|analisis|opportunit(?:y|ies)|oportunidade|oportunidades|risks?|riscos?|uncertaint(?:y|ies)|incertezas?|investment fit|profile fit|aderencia)\b/.test(normalized)
    && /\b(property|deal|home|asset|selected|imovel|propriedade|inmueble|propiedad|selecionado|seleccionado)\b/.test(normalized);
}
