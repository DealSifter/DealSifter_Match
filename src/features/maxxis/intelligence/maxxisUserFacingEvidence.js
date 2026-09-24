const COPY = Object.freeze({ en: Object.freeze({
  analysis_depends_on_submitted_data: 'The analysis depends partly on submitted property information that should be independently verified.',
  property_data_not_independently_verified: 'Some property information comes from submitted records and should still be independently verified.',
  arv_not_structured: 'A defensible ARV cannot be calculated with the evidence currently available.',
  ARV_EVALUATION_NOT_LOADED: 'A defensible ARV cannot be calculated with the evidence currently available.',
  roi_not_calculated: 'ROI cannot yet be calculated because one or more required investment inputs are unavailable.',
  cap_rate_not_independently_verified: 'The reported capitalization rate has not yet been independently validated.',
  MISSING_REHAB: 'Rehabilitation scope and cost have not yet been confirmed.',
  MISSING_REHAB_INFORMATION: 'Rehabilitation scope and cost have not yet been confirmed.',
  rehab_not_provided: 'Rehabilitation scope and cost have not yet been confirmed.',
  property_condition_unknown: 'The current property condition has not yet been verified.',
  INSUFFICIENT_COMPS: 'There are not enough condition-compatible recorded sales to support a defensible ARV.',
  VALUATION_DISPERSION_WARNING: 'The available comparable values vary materially, which limits valuation confidence.',
}), pt: Object.freeze({
  analysis_depends_on_submitted_data: 'A análise depende parcialmente de informações cadastradas do imóvel que devem ser verificadas de forma independente.',
  property_data_not_independently_verified: 'Algumas informações do imóvel vêm de dados cadastrados e ainda precisam de verificação independente.',
  arv_not_structured: 'Não é possível calcular um ARV defensável com as evidências disponíveis.',
  ARV_EVALUATION_NOT_LOADED: 'Não é possível calcular um ARV defensável com as evidências disponíveis.',
  roi_not_calculated: 'O ROI ainda não pode ser calculado porque faltam dados essenciais do investimento.',
  cap_rate_not_independently_verified: 'A taxa de capitalização informada ainda não foi validada de forma independente.',
  MISSING_REHAB: 'O escopo e o custo da reforma ainda não foram confirmados.',
  MISSING_REHAB_INFORMATION: 'O escopo e o custo da reforma ainda não foram confirmados.',
  rehab_not_provided: 'O escopo e o custo da reforma ainda não foram confirmados.',
  property_condition_unknown: 'A condição atual do imóvel ainda não foi verificada.',
  INSUFFICIENT_COMPS: 'Não há vendas registradas compatíveis em quantidade suficiente para sustentar um ARV defensável.',
  VALUATION_DISPERSION_WARNING: 'Os valores dos comparáveis disponíveis variam de forma relevante, limitando a confiança da avaliação.',
}), es: Object.freeze({
  analysis_depends_on_submitted_data: 'El análisis depende parcialmente de información registrada de la propiedad que debe verificarse de forma independiente.',
  property_data_not_independently_verified: 'Parte de la información de la propiedad proviene de datos registrados y aún requiere verificación independiente.',
  arv_not_structured: 'No es posible calcular un ARV defendible con la evidencia disponible.',
  ARV_EVALUATION_NOT_LOADED: 'No es posible calcular un ARV defendible con la evidencia disponible.',
  roi_not_calculated: 'El ROI aún no puede calcularse porque faltan datos esenciales de la inversión.',
  cap_rate_not_independently_verified: 'La tasa de capitalización informada aún no ha sido validada de forma independiente.',
  MISSING_REHAB: 'El alcance y el costo de la reforma aún no se han confirmado.',
  MISSING_REHAB_INFORMATION: 'El alcance y el costo de la reforma aún no se han confirmado.',
  rehab_not_provided: 'El alcance y el costo de la reforma aún no se han confirmado.',
  property_condition_unknown: 'El estado actual de la propiedad aún no ha sido verificado.',
  INSUFFICIENT_COMPS: 'No hay suficientes ventas registradas compatibles para respaldar un ARV defendible.',
  VALUATION_DISPERSION_WARNING: 'Los valores de los comparables disponibles varían significativamente, lo que limita la confianza de la valoración.',
}) });

export function explainMaxxisEvidenceState(value, language = 'en') {
  const raw = String(value ?? '').replace(/\s+/g, ' ').trim();
  const selected = ['pt', 'es'].includes(String(language).slice(0, 2)) ? String(language).slice(0, 2) : 'en';
  if (!raw) return '';
  if (COPY[selected][raw]) return COPY[selected][raw];
  const canonicalKey = Object.keys(COPY.en).find((key) => COPY.en[key] === raw);
  if (canonicalKey && COPY[selected][canonicalKey]) return COPY[selected][canonicalKey];
  if (!/^[A-Za-z0-9]+(?:_[A-Za-z0-9]+)+$/.test(raw)) return raw;
  const readable = raw.replaceAll('_', ' ').toLowerCase();
  return `${readable.charAt(0).toUpperCase()}${readable.slice(1)}.`;
}

export function explainMaxxisEvidenceList(values, limit = 12, language = 'en') {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => explainMaxxisEvidenceState(value, language)).filter(Boolean))].slice(0, limit);
}
