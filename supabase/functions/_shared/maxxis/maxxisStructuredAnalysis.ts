export const MAXXIS_STRUCTURED_ANALYSIS_VERSION = 'MAXXIS_STRUCTURED_ANALYSIS_V1' as const;

type ReportType = 'MAXXIS_ANALYSIS' | 'DEAL_INTELLIGENCE';
type AnyRecord = Record<string, any>;

const record = (value: unknown): AnyRecord => value && typeof value === 'object' && !Array.isArray(value)
  ? value as AnyRecord : {};
const list = (value: unknown): any[] => Array.isArray(value) ? value : [];
const text = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();
const finite = (value: unknown) => value !== null && value !== '' && Number.isFinite(Number(value))
  ? Number(value) : null;
const unique = (values: string[]) => [...new Set(values.map(text).filter(Boolean))];
type AnalysisLanguage = 'en' | 'pt' | 'es';
const languageOf = (value: unknown): AnalysisLanguage => {
  const language = text(value).slice(0, 2).toLowerCase();
  return language === 'pt' || language === 'es' ? language : 'en';
};
const localized = (language: AnalysisLanguage, en: string, pt: string, es: string) =>
  language === 'pt' ? pt : language === 'es' ? es : en;

const STATE_COPY: Record<string, string> = Object.freeze({
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
});
const STATE_COPY_PT: Record<string, string> = Object.freeze({
  analysis_depends_on_submitted_data: 'A análise depende parcialmente de informações cadastradas do imóvel que devem ser verificadas de forma independente.',
  property_data_not_independently_verified: 'Algumas informações do imóvel vêm de dados cadastrados e ainda precisam de verificação independente.',
  arv_not_structured: 'Não é possível calcular um ARV defensável com as evidências disponíveis.',
  ARV_EVALUATION_NOT_LOADED: 'Não é possível calcular um ARV defensável com as evidências disponíveis.',
  roi_not_calculated: 'O ROI ainda não pode ser calculado porque faltam um ou mais dados essenciais do investimento.',
  cap_rate_not_independently_verified: 'A taxa de capitalização informada ainda não foi validada de forma independente.',
  MISSING_REHAB: 'O escopo e o custo da reforma ainda não foram confirmados.',
  MISSING_REHAB_INFORMATION: 'O escopo e o custo da reforma ainda não foram confirmados.',
  rehab_not_provided: 'O escopo e o custo da reforma ainda não foram confirmados.',
  property_condition_unknown: 'A condição atual do imóvel ainda não foi verificada.',
  INSUFFICIENT_COMPS: 'Não há vendas registradas compatíveis em quantidade suficiente para sustentar um ARV defensável.',
  VALUATION_DISPERSION_WARNING: 'Os valores dos comparáveis disponíveis variam de forma relevante, o que limita a confiança da avaliação.',
});
const STATE_COPY_ES: Record<string, string> = Object.freeze({
  analysis_depends_on_submitted_data: 'El análisis depende parcialmente de información registrada de la propiedad que debe verificarse de forma independiente.',
  property_data_not_independently_verified: 'Parte de la información de la propiedad proviene de datos registrados y aún requiere verificación independiente.',
  arv_not_structured: 'No es posible calcular un ARV defendible con la evidencia disponible.',
  ARV_EVALUATION_NOT_LOADED: 'No es posible calcular un ARV defendible con la evidencia disponible.',
  roi_not_calculated: 'El ROI aún no puede calcularse porque faltan uno o más datos esenciales de la inversión.',
  cap_rate_not_independently_verified: 'La tasa de capitalización informada aún no ha sido validada de forma independiente.',
  MISSING_REHAB: 'El alcance y el costo de la reforma aún no se han confirmado.',
  MISSING_REHAB_INFORMATION: 'El alcance y el costo de la reforma aún no se han confirmado.',
  rehab_not_provided: 'El alcance y el costo de la reforma aún no se han confirmado.',
  property_condition_unknown: 'El estado actual de la propiedad aún no ha sido verificado.',
  INSUFFICIENT_COMPS: 'No hay suficientes ventas registradas compatibles para respaldar un ARV defendible.',
  VALUATION_DISPERSION_WARNING: 'Los valores de los comparables disponibles varían de manera significativa, lo que limita la confianza de la valoración.',
});

export function explainMaxxisInternalState(value: unknown, languageInput: unknown = 'en') {
  const raw = text(value);
  const language = languageOf(languageInput);
  if (!raw) return '';
  const stateCopy = language === 'pt' ? STATE_COPY_PT : language === 'es' ? STATE_COPY_ES : STATE_COPY;
  if (stateCopy[raw]) return stateCopy[raw];
  if (!/^[A-Za-z0-9]+(?:_[A-Za-z0-9]+)+$/.test(raw)) return raw;
  const readable = raw.replaceAll('_', ' ').toLowerCase();
  return `${readable.charAt(0).toUpperCase()}${readable.slice(1)}.`;
}

function fieldValue(context: AnyRecord, name: string) {
  return record(record(context.propertyContext).fields)[name]?.value ?? null;
}

function propertyInterpretation(snapshot: AnyRecord, context: AnyRecord, language: AnalysisLanguage) {
  const property = record(snapshot.propertyFacts);
  const facts = [
    text(property.type || fieldValue(context, 'propertyType')),
    finite(property.beds ?? fieldValue(context, 'bedrooms')) !== null
      ? localized(language, `${finite(property.beds ?? fieldValue(context, 'bedrooms'))} bedrooms`, `${finite(property.beds ?? fieldValue(context, 'bedrooms'))} quartos`, `${finite(property.beds ?? fieldValue(context, 'bedrooms'))} habitaciones`) : '',
    finite(property.baths ?? fieldValue(context, 'bathrooms')) !== null
      ? localized(language, `${finite(property.baths ?? fieldValue(context, 'bathrooms'))} bathrooms`, `${finite(property.baths ?? fieldValue(context, 'bathrooms'))} banheiros`, `${finite(property.baths ?? fieldValue(context, 'bathrooms'))} baños`) : '',
    finite(property.sqft ?? fieldValue(context, 'livingAreaSqft')) !== null
      ? `${finite(property.sqft ?? fieldValue(context, 'livingAreaSqft'))?.toLocaleString('en-US')} sqft` : '',
  ].filter(Boolean);
  const location = [property.city, property.state].map(text).filter(Boolean).join(', ');
  return facts.length
    ? localized(language,
      `The subject is recorded as ${facts.join(', ')}${location ? ` in ${location}` : ''}. These facts establish the structural context for the profile and risk review.`,
      `O imóvel está registrado como ${facts.join(', ')}${location ? ` em ${location}` : ''}. Esses dados estabelecem o contexto estrutural para a análise de perfil e riscos.`,
      `La propiedad está registrada como ${facts.join(', ')}${location ? ` en ${location}` : ''}. Estos datos establecen el contexto estructural para el análisis de perfil y riesgos.`)
    : localized(language,
      'The available property record is too limited to establish a complete structural context; core property facts should be verified.',
      'O registro disponível do imóvel é limitado para estabelecer um contexto estrutural completo; os dados essenciais devem ser verificados.',
      'El registro disponible de la propiedad es limitado para establecer un contexto estructural completo; los datos esenciales deben verificarse.');
}

function fitAnalysis(context: AnyRecord, language: AnalysisLanguage) {
  const match = record(context.matchContext);
  const reasons = list(match.reasons);
  const reasonText = (item: AnyRecord, matched: boolean) => {
    if (language === 'en') return text(item?.detail);
    const label = text(item?.label || item?.key) || localized(language, 'Criterion', 'Critério', 'Criterio');
    return matched
      ? localized(language, `${label} matches the configured profile.`, `${label} está alinhado ao perfil configurado.`, `${label} está alineado con el perfil configurado.`)
      : localized(language, `${label} is not confirmed as a profile match.`, `${label} não está confirmado como aderente ao perfil.`, `${label} no está confirmado como compatible con el perfil.`);
  };
  const strengths = unique(reasons.filter((item) => item?.status === 'matched').map((item) => reasonText(item, true)));
  const mismatches = unique(reasons.filter((item) => item?.status === 'not_matched').map((item) => reasonText(item, false)));
  const unknownCriteria = unique(reasons.filter((item) => item?.status !== 'matched' && item?.status !== 'not_matched')
    .map((item) => reasonText(item, false)));
  const score = finite(match.score);
  const overallAssessment = score === null
    ? localized(language, 'Investment Profile alignment cannot be fully evaluated from the available criteria.', 'A aderência ao Perfil de Investimento não pode ser avaliada integralmente com os critérios disponíveis.', 'La compatibilidad con el Perfil de Inversión no puede evaluarse por completo con los criterios disponibles.')
    : localized(language, `The property has ${score}% alignment with the configured Investment Profile; this is a profile-fit measure, not a deal-quality score.`, `O imóvel apresenta ${score}% de aderência ao Perfil de Investimento configurado; esta é uma medida de compatibilidade com o perfil, não uma nota de qualidade do negócio.`, `La propiedad presenta ${score}% de compatibilidad con el Perfil de Inversión configurado; esta es una medida de afinidad con el perfil, no una puntuación de calidad del negocio.`);
  const rationaleParts = [...strengths.slice(0, 2), ...mismatches.slice(0, 2), ...unknownCriteria.slice(0, 1)];
  return {
    overallAssessment,
    fitRationale: rationaleParts.length
      ? `${overallAssessment} ${rationaleParts.join(' ')}` : overallAssessment,
    strengths,
    mismatches,
    unknownCriteria,
  };
}

function marketContext(context: AnyRecord, language: AnalysisLanguage) {
  const match = record(context.matchContext);
  const marketReason = list(match.reasons).find((item) => item?.key === 'market');
  const evidenceUsed = unique([
    language === 'en' ? text(marketReason?.detail) : marketReason
      ? localized(language, '', `Mercado-alvo ${marketReason.status === 'matched' ? 'alinhado' : 'não confirmado'} com o imóvel.`, `Mercado objetivo ${marketReason.status === 'matched' ? 'alineado' : 'no confirmado'} con la propiedad.`) : '',
    ...list(record(context.investorContext).targetMarkets).map((item) => localized(language, `Configured target market: ${text(item)}.`, `Mercado-alvo configurado: ${text(item)}.`, `Mercado objetivo configurado: ${text(item)}.`)),
  ]);
  const limitations = marketReason?.status === 'matched'
    ? [localized(language, 'Market alignment reflects the configured Investment Profile and does not independently establish market demand or liquidity.', 'O alinhamento de mercado reflete o Perfil de Investimento configurado e não comprova, isoladamente, demanda ou liquidez.', 'La alineación de mercado refleja el Perfil de Inversión configurado y no demuestra, por sí sola, demanda o liquidez.')]
    : [localized(language, 'The property location is not confirmed as aligned with the configured target markets.', 'A localização do imóvel não está confirmada como alinhada aos mercados-alvo configurados.', 'La ubicación de la propiedad no está confirmada como alineada con los mercados objetivo configurados.')];
  return {
    interpretation: evidenceUsed[0] || localized(language, 'Market alignment cannot be determined from the current profile and property data.', 'O alinhamento de mercado não pode ser determinado com os dados atuais do perfil e do imóvel.', 'La alineación de mercado no puede determinarse con los datos actuales del perfil y de la propiedad.'),
    evidenceUsed,
    limitations,
  };
}

function comparativeAnalysis(context: AnyRecord, language: AnalysisLanguage) {
  const comps = list(context.comparableEvidence);
  const selected = comps.filter((item) => item?.valuationRole === 'PRIMARY' || item?.valuationEligibility === 'INCLUDED');
  const supporting = comps.filter((item) => item?.valuationRole === 'SUPPORTING' || item?.valuationEligibility === 'SUPPORTING_ONLY');
  const excluded = comps.filter((item) => item?.valuationRole === 'EXCLUDED' || item?.valuationEligibility === 'EXCLUDED');
  const limitations = selected.length
    ? unique(excluded.map((item) => explainMaxxisInternalState(item?.exclusionReason, language)).filter(Boolean))
    : [localized(language, 'No condition-compatible recorded sale is currently available to support a defensible comparable conclusion.', 'Nenhuma venda registrada compatível com a condição está disponível para sustentar uma conclusão defensável por comparáveis.', 'No hay ventas registradas compatibles con la condición para respaldar una conclusión defendible mediante comparables.')];
  return {
    interpretation: selected.length
      ? localized(language, `${selected.length} recorded sale${selected.length === 1 ? '' : 's'} met the current structural and condition gates; ${supporting.length} additional sale${supporting.length === 1 ? '' : 's'} provide supporting context.`, `${selected.length} venda(s) registrada(s) atenderam aos critérios estruturais e de condição; outras ${supporting.length} venda(s) fornecem contexto de apoio.`, `${selected.length} venta(s) registrada(s) cumplieron los criterios estructurales y de condición; otras ${supporting.length} venta(s) aportan contexto de apoyo.`)
      : localized(language, 'The current evidence set does not contain a recorded sale that passed all comparable-selection gates.', 'O conjunto atual de evidências não contém uma venda registrada que tenha atendido a todos os critérios de seleção de comparáveis.', 'El conjunto actual de evidencia no contiene una venta registrada que haya cumplido todos los criterios de selección de comparables.'),
    selectedCompSummary: selected.slice(0, 5).map((item) => ({
      address: text(item.address) || localized(language, 'Address unavailable', 'Endereço indisponível', 'Dirección no disponible'),
      salePrice: finite(item.recordedSalePrice),
      similarity: finite(item.structuralComparabilityScore),
      rationale: explainMaxxisInternalState(item.inclusionReason, language) || localized(language, 'Selected by the existing comparable engine.', 'Selecionado pelo mecanismo de comparáveis existente.', 'Seleccionado por el motor de comparables existente.'),
    })),
    supportingEvidence: supporting.slice(0, 5).map((item) => explainMaxxisInternalState(item.inclusionReason || item.exclusionReason, language)),
    limitations,
  };
}

function valuationAnalysis(context: AnyRecord, language: AnalysisLanguage) {
  const valuation = record(context.valuationContext);
  const metrics = record(record(context.dealMetrics).metrics);
  const status = text(valuation.status) || 'ARV_UNAVAILABLE';
  const providerEstimate = finite(record(valuation.providerEstimate).value);
  const arvAvailable = status !== 'ARV_UNAVAILABLE' && record(valuation.range).low != null && record(valuation.range).high != null;
  const limitations = unique([
    ...list(valuation.warnings).map((item) => explainMaxxisInternalState(item, language)),
    ...(!arvAvailable ? [localized(language, 'A defensible ARV cannot be calculated with the evidence currently available.', 'Não é possível calcular um ARV defensável com as evidências disponíveis.', 'No es posible calcular un ARV defendible con la evidencia disponible.')] : []),
    ...(!record(metrics.acquisitionPlusRehab).calculable ? [localized(language, 'ROI and spread scenarios remain limited until acquisition and rehabilitation inputs are complete.', 'Os cenários de ROI e margem permanecem limitados até que os dados de aquisição e reforma estejam completos.', 'Los escenarios de ROI y margen permanecen limitados hasta completar los datos de adquisición y reforma.')] : []),
  ]);
  return {
    providerEstimate,
    providerEstimateRole: providerEstimate !== null ? 'SUPPORTING_EVIDENCE_ONLY' : 'UNAVAILABLE',
    arv: arvAvailable ? {
      rangeLow: finite(valuation.range.low), rangeHigh: finite(valuation.range.high),
      centralReference: finite(valuation.centralReference),
    } : null,
    confidence: arvAvailable ? text(valuation.confidence) : 'LOW',
    pricePositioning: record(metrics.pricePerSqft).calculable ? finite(record(metrics.pricePerSqft).value) : null,
    rehabImpact: record(metrics.acquisitionPlusRehab).calculable
      ? localized(language, 'The supplied rehabilitation budget is included in the deterministic acquisition-plus-rehab total.', 'O orçamento de reforma informado está incluído no total determinístico de aquisição mais reforma.', 'El presupuesto de reforma informado está incluido en el total determinístico de adquisición más reforma.')
      : localized(language, 'Rehabilitation impact cannot be quantified until a budget is supplied.', 'O impacto da reforma não pode ser quantificado até que um orçamento seja informado.', 'El impacto de la reforma no puede cuantificarse hasta que se informe un presupuesto.'),
    currentPositioning: record(metrics.pricePerSqft).calculable
      ? localized(language, `The stored asking price equates to ${Number(record(metrics.pricePerSqft).value).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} per square foot; this is a deterministic positioning metric, not a valuation conclusion.`, `O preço pedido registrado equivale a ${Number(record(metrics.pricePerSqft).value).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} por pé quadrado; esta é uma métrica determinística de posicionamento, não uma conclusão de valor.`, `El precio solicitado registrado equivale a ${Number(record(metrics.pricePerSqft).value).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} por pie cuadrado; esta es una métrica determinística de posicionamiento, no una conclusión de valor.`)
      : localized(language, 'Price-per-square-foot positioning cannot be calculated from the currently available facts.', 'O posicionamento por preço por pé quadrado não pode ser calculado com os dados disponíveis.', 'El posicionamiento por precio por pie cuadrado no puede calcularse con los datos disponibles.'),
    arvInterpretation: arvAvailable
      ? localized(language, `The existing deterministic engine produced an ARV range of $${Number(valuation.range.low).toLocaleString('en-US')} to $${Number(valuation.range.high).toLocaleString('en-US')} with ${text(valuation.confidence).toLowerCase()} confidence.`, `O mecanismo determinístico existente produziu uma faixa de ARV de $${Number(valuation.range.low).toLocaleString('en-US')} a $${Number(valuation.range.high).toLocaleString('en-US')}, com confiança ${text(valuation.confidence).toLowerCase()}.`, `El motor determinístico existente produjo un rango ARV de $${Number(valuation.range.low).toLocaleString('en-US')} a $${Number(valuation.range.high).toLocaleString('en-US')}, con confianza ${text(valuation.confidence).toLowerCase()}.`)
      : localized(language, 'A defensible DealSifter ARV is unavailable under the current evidence gates.', 'Um ARV DealSifter defensável está indisponível segundo os critérios atuais de evidência.', 'Un ARV DealSifter defendible no está disponible según los criterios actuales de evidencia.'),
    confidenceInterpretation: arvAvailable
      ? localized(language, `Confidence is ${text(valuation.confidence).toLowerCase()} because the result depends on ${finite(valuation.compsUsed) ?? 0} eligible comparable sale${Number(valuation.compsUsed) === 1 ? '' : 's'} and the recorded evidence quality.`, `A confiança é ${text(valuation.confidence).toLowerCase()} porque o resultado depende de ${finite(valuation.compsUsed) ?? 0} venda(s) comparável(is) elegível(is) e da qualidade das evidências registradas.`, `La confianza es ${text(valuation.confidence).toLowerCase()} porque el resultado depende de ${finite(valuation.compsUsed) ?? 0} venta(s) comparable(s) elegible(s) y de la calidad de la evidencia registrada.`)
      : localized(language, 'Valuation confidence is limited because no eligible deterministic ARV set is available.', 'A confiança da avaliação é limitada porque não há um conjunto determinístico de ARV elegível.', 'La confianza de la valoración es limitada porque no hay un conjunto determinístico de ARV elegible.'),
    scenarioInterpretation: providerEstimate !== null
      ? localized(language, `The provider AVM is ${providerEstimate.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}; it is supporting estimated evidence and is not the DealSifter ARV.`, `O AVM do provedor é ${providerEstimate.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}; trata-se de evidência estimada de apoio, não do ARV DealSifter.`, `El AVM del proveedor es ${providerEstimate.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}; es evidencia estimada de apoyo, no el ARV DealSifter.`)
      : localized(language, 'No provider AVM is available as supporting valuation evidence.', 'Não há AVM do provedor disponível como evidência de apoio à avaliação.', 'No hay un AVM del proveedor disponible como evidencia de apoyo a la valoración.'),
    limitations,
  };
}

function riskExplanation(risk: AnyRecord, language: AnalysisLanguage) {
  if (language === 'en') return text(risk?.explanation);
  const copy: Record<string, [string, string]> = {
    UNKNOWN_PROPERTY_FIELDS: ['Alguns campos do imóvel permanecem desconhecidos e precisam ser verificados.', 'Algunos campos de la propiedad siguen sin conocerse y deben verificarse.'],
    PROPERTY_EVIDENCE_CONFLICT: ['Há conflitos não resolvidos entre os dados internos e as evidências verificadas do imóvel.', 'Hay conflictos no resueltos entre los datos internos y la evidencia verificada de la propiedad.'],
    MISSING_REHAB_INFORMATION: ['As informações de reforma estão ausentes.', 'Falta la información de reforma.'],
    TARGET_MARKET_MISMATCH: ['A localização do imóvel está fora dos mercados-alvo configurados.', 'La ubicación de la propiedad está fuera de los mercados objetivo configurados.'],
    TARGET_PRICE_RANGE_MISMATCH: ['O preço pedido está fora da faixa configurada no Perfil de Investimento.', 'El precio solicitado está fuera del rango configurado en el Perfil de Inversión.'],
    ARV_EVIDENCE_UNAVAILABLE: ['As evidências comparáveis compatíveis não sustentam atualmente uma faixa de ARV.', 'La evidencia comparable compatible no respalda actualmente un rango de ARV.'],
    ARV_EVIDENCE_LIMITED: ['A avaliação de ARV existente está limitada pelas evidências ou pelo nível de confiança.', 'La valoración ARV existente está limitada por la evidencia o el nivel de confianza.'],
    COMPARABLE_DISPERSION: ['A avaliação de ARV existente apresenta dispersão relevante entre comparáveis.', 'La valoración ARV existente presenta una dispersión relevante entre comparables.'],
    UNKNOWN_CONDITION: ['A condição do imóvel-alvo ou dos comparáveis ainda não foi confirmada pelo usuário.', 'El estado de la propiedad objetivo o de los comparables aún no ha sido confirmado por el usuario.'],
    MISSING_CRITICAL_INFORMATION: ['Faltam informações essenciais do imóvel para concluir esta parte da análise.', 'Falta información esencial de la propiedad para completar esta parte del análisis.'],
  };
  return copy[text(risk?.code)]?.[language === 'pt' ? 0 : 1]
    || localized(language, '', 'Este risco requer verificação adicional com as evidências disponíveis.', 'Este riesgo requiere verificación adicional con la evidencia disponible.');
}

function riskAnalysis(context: AnyRecord, language: AnalysisLanguage) {
  const byCategory = (category: string) => list(context.risks)
    .filter((risk) => risk?.category === category).map((risk) => riskExplanation(risk, language)).filter(Boolean);
  const data = byCategory('DATA_RISK');
  const market = byCategory('MARKET_RISK');
  const valuation = byCategory('VALUATION_RISK');
  const execution = byCategory('EXECUTION_RISK');
  return {
    dataRisk: data[0] || localized(language, 'No additional data-risk signal was identified from the available evidence.', 'Nenhum sinal adicional de risco de dados foi identificado nas evidências disponíveis.', 'No se identificó ninguna señal adicional de riesgo de datos en la evidencia disponible.'),
    marketRisk: market[0] || localized(language, 'No additional market-risk signal was identified from the available profile comparison.', 'Nenhum sinal adicional de risco de mercado foi identificado na comparação de perfil disponível.', 'No se identificó ninguna señal adicional de riesgo de mercado en la comparación de perfil disponible.'),
    valuationRisk: valuation[0] || localized(language, 'No additional valuation-risk signal was identified by the existing deterministic engine.', 'Nenhum sinal adicional de risco de avaliação foi identificado pelo mecanismo determinístico existente.', 'No se identificó ninguna señal adicional de riesgo de valoración mediante el motor determinístico existente.'),
    executionRisk: execution[0] || localized(language, 'Execution risk still depends on property condition, title, scope and operating assumptions being verified.', 'O risco de execução ainda depende da verificação da condição do imóvel, titularidade, escopo e premissas operacionais.', 'El riesgo de ejecución aún depende de verificar el estado de la propiedad, la titularidad, el alcance y los supuestos operativos.'),
    rationale: unique([...data, ...market, ...valuation, ...execution]),
  };
}

function strategyInsights(context: AnyRecord, language: AnalysisLanguage) {
  const strategies = list(record(context.investorContext).strategies).map(text).filter(Boolean);
  const capRate = record(record(context.dealMetrics).metrics).capRate;
  return unique(strategies.map((strategy) => {
    const normalized = strategy.toLowerCase();
    const displayStrategy = language === 'en'
      ? strategy
      : /buy\s*(and|&)\s*hold|hold|rental/.test(normalized)
      ? localized(language, strategy, 'comprar e manter', 'comprar y mantener')
      : /fix\s*(and|&)\s*flip|flip|rehab/.test(normalized)
      ? localized(language, strategy, 'reformar e revender', 'reformar y revender')
      : /wholesale/.test(normalized)
      ? localized(language, strategy, 'atacado imobiliário', 'venta mayorista inmobiliaria')
      : localized(language, strategy, 'objetivo de investimento configurado', 'objetivo de inversión configurado');
    if (/hold|rental|rent/.test(normalized)) {
      return capRate?.calculable
        ? localized(language, `For the ${strategy} strategy, the stored ${Number(capRate.value)}% cap rate is relevant but should be validated against current income and operating expenses.`, `Para a estratégia ${displayStrategy}, a cap rate registrada de ${Number(capRate.value)}% é relevante, mas deve ser validada com a receita e as despesas operacionais atuais.`, `Para la estrategia ${displayStrategy}, la tasa de capitalización registrada de ${Number(capRate.value)}% es relevante, pero debe validarse con los ingresos y gastos operativos actuales.`)
        : localized(language, `For the ${strategy} strategy, rent, occupancy and operating expenses must be verified before income performance can be assessed.`, `Para a estratégia ${displayStrategy}, aluguel, ocupação e despesas operacionais devem ser verificados antes da avaliação de desempenho da renda.`, `Para la estrategia ${displayStrategy}, el alquiler, la ocupación y los gastos operativos deben verificarse antes de evaluar el rendimiento de los ingresos.`);
    }
    if (/flip|rehab/.test(normalized)) return localized(language, `For the ${strategy} strategy, property condition, rehabilitation scope and exit-value evidence are the primary unresolved execution inputs.`, `Para a estratégia ${displayStrategy}, a condição do imóvel, o escopo da reforma e as evidências do valor de saída são os principais pontos de execução ainda não resolvidos.`, `Para la estrategia ${displayStrategy}, el estado de la propiedad, el alcance de la reforma y la evidencia del valor de salida son los principales puntos de ejecución pendientes.`);
    if (/wholesale/.test(normalized)) return localized(language, `For the ${strategy} strategy, disposition demand, assignability and a verified buyer margin remain essential validation points.`, `Para a estratégia ${displayStrategy}, a demanda de saída, a possibilidade de cessão e uma margem verificada para o comprador continuam sendo pontos essenciais de validação.`, `Para la estrategia ${displayStrategy}, la demanda de salida, la posibilidad de cesión y un margen verificado para el comprador siguen siendo puntos esenciales de validación.`);
    return localized(language, `For the ${strategy} strategy, confirm that the available property facts and unresolved risks remain compatible with the configured objective.`, `Para a estratégia ${displayStrategy}, confirme se os dados disponíveis do imóvel e os riscos não resolvidos permanecem compatíveis com o objetivo configurado.`, `Para la estrategia ${displayStrategy}, confirma que los datos disponibles de la propiedad y los riesgos pendientes sigan siendo compatibles con el objetivo configurado.`);
  }));
}

function localizedAction(value: unknown, language: AnalysisLanguage) {
  const raw = text(value);
  if (language === 'en') return explainMaxxisInternalState(raw, language);
  const actions: Record<string, [string, string]> = {
    'Confirm target condition and review comparable condition evidence.': ['Confirme a condição-alvo e revise as evidências de condição dos comparáveis.', 'Confirma la condición objetivo y revisa la evidencia de condición de los comparables.'],
    'Review additional condition-compatible recorded sales.': ['Revise outras vendas registradas compatíveis com a condição.', 'Revisa otras ventas registradas compatibles con la condición.'],
    'Resolve property evidence conflicts before relying on the analysis.': ['Resolva os conflitos das evidências do imóvel antes de utilizar a análise.', 'Resuelve los conflictos de evidencia de la propiedad antes de utilizar el análisis.'],
    'Compare the property with the configured target market and price preferences.': ['Compare o imóvel com o mercado-alvo e as preferências de preço configuradas.', 'Compara la propiedad con el mercado objetivo y las preferencias de precio configuradas.'],
    'Complete or verify the missing property fields.': ['Complete ou verifique os campos ausentes do imóvel.', 'Completa o verifica los campos faltantes de la propiedad.'],
    'Confirm property condition.': ['Confirme a condição do imóvel.', 'Confirma el estado de la propiedad.'],
  };
  const translated = actions[raw]?.[language === 'pt' ? 0 : 1] || explainMaxxisInternalState(raw, language);
  if (translated !== raw) return translated;
  return localized(language, raw, 'Revise esta ação de verificação antes de tomar uma decisão.', 'Revisa esta acción de verificación antes de tomar una decisión.');
}

function localizedLimitation(value: unknown, language: AnalysisLanguage) {
  const raw = text(value);
  const explained = explainMaxxisInternalState(raw, language);
  if (language === 'en' || explained !== raw) return explained;
  const normalized = raw.toLowerCase();
  if (/rehab|renov|repair|condition/.test(normalized)) return localized(language, raw, 'A condição do imóvel e o escopo da reforma ainda precisam ser verificados.', 'El estado de la propiedad y el alcance de la reforma aún deben verificarse.');
  if (/title|ownership|owner|legal/.test(normalized)) return localized(language, raw, 'A titularidade e a situação jurídica do imóvel ainda precisam ser verificadas.', 'La titularidad y la situación jurídica de la propiedad aún deben verificarse.');
  if (/rent|income|operating|expense|occupancy/.test(normalized)) return localized(language, raw, 'A renda, a ocupação e as despesas operacionais ainda precisam ser verificadas.', 'Los ingresos, la ocupación y los gastos operativos aún deben verificarse.');
  if (/market|comparable|comp|valuation|value|arv/.test(normalized)) return localized(language, raw, 'As evidências de mercado e avaliação disponíveis ainda são limitadas.', 'La evidencia disponible de mercado y valoración aún es limitada.');
  return localized(language, raw, 'Há uma limitação adicional que precisa ser verificada antes da decisão.', 'Existe una limitación adicional que debe verificarse antes de tomar una decisión.');
}

function localizedOpportunity(value: AnyRecord, language: AnalysisLanguage) {
  if (language === 'en') return text(value?.explanation);
  const code = text(value?.code);
  if (code === 'VERIFIED_PROPERTY_EVIDENCE_AVAILABLE') return localized(language, '', 'Há evidências verificadas do imóvel disponíveis para revisão.', 'Hay evidencia verificada de la propiedad disponible para revisión.');
  if (code === 'COMPARABLE_VALUATION_EVIDENCE_AVAILABLE') return localized(language, '', 'Há vendas registradas compatíveis com a condição que sustentam uma referência de valor.', 'Hay ventas registradas compatibles con la condición que respaldan una referencia de valor.');
  if (code.startsWith('PROFILE_')) return localized(language, '', 'Um dos critérios do imóvel está alinhado ao Perfil de Investimento configurado.', 'Uno de los criterios de la propiedad está alineado con el Perfil de Inversión configurado.');
  return localized(language, '', 'As evidências disponíveis apresentam um sinal positivo que deve ser confirmado.', 'La evidencia disponible presenta una señal positiva que debe confirmarse.');
}

export function buildMaxxisStructuredAnalysis(snapshotInput: unknown, reportTypeInput: unknown, languageInput: unknown = 'en') {
  const snapshot = record(snapshotInput);
  const context = record(snapshot.dealIntelligence);
  const language = languageOf(languageInput);
  const reportType: ReportType = reportTypeInput === 'DEAL_INTELLIGENCE' ? 'DEAL_INTELLIGENCE' : 'MAXXIS_ANALYSIS';
  const fit = fitAnalysis(context, language);
  const market = marketContext(context, language);
  const comparative = comparativeAnalysis(context, language);
  const valuation = valuationAnalysis(context, language);
  const risks = riskAnalysis(context, language);
  const positiveSignals = unique([
    ...list(context.opportunities).map((item) => localizedOpportunity(item, language)),
    ...fit.strengths,
  ]);
  const concerns = unique([...risks.rationale, ...fit.mismatches]);
  const missingEvidence = unique([
    ...list(context.limitations).map((item) => localizedLimitation(item, language)),
    ...valuation.limitations,
  ]);
  const recommendedVerificationSteps = unique([
    ...list(context.recommendedActions).map((item) => localizedAction(item, language)),
    ...missingEvidence.slice(0, 3).map((item) => localized(language, `Verify the evidence behind this limitation: ${item}`, `Verifique as evidências relacionadas a esta limitação: ${item}`, `Verifica la evidencia relacionada con esta limitación: ${item}`)),
  ]).slice(0, 8);
  const strategySpecificInsights = strategyInsights(context, language);
  const propertyContext = propertyInterpretation(snapshot, context, language);
  const executiveSummary = `${fit.overallAssessment} ${propertyContext}`;
  const opportunityAssessment = positiveSignals.length
    ? `${positiveSignals.slice(0, 2).join(' ')} ${localized(language, 'The unresolved evidence should be verified before relying on this analysis for an investment decision.', 'As evidências ainda não resolvidas devem ser verificadas antes de utilizar esta análise em uma decisão de investimento.', 'La evidencia pendiente debe verificarse antes de utilizar este análisis en una decisión de inversión.')}`
    : localized(language, 'The current record supports a structured review, but it does not yet provide enough verified evidence for a positive investment conclusion.', 'O registro atual permite uma revisão estruturada, mas ainda não apresenta evidências verificadas suficientes para uma conclusão positiva de investimento.', 'El registro actual permite una revisión estructurada, pero aún no presenta suficiente evidencia verificada para una conclusión positiva de inversión.');
  const priority = missingEvidence[0] ? localized(language, `Priority limitation: ${missingEvidence[0]}`, `Limitação prioritária: ${missingEvidence[0]}`, `Limitación prioritaria: ${missingEvidence[0]}`) : '';
  const profileAdaptedConclusion = `${fit.fitRationale}${strategySpecificInsights[0] ? ` ${strategySpecificInsights[0]}` : ''} ${priority}`.trim();
  const investmentThesis = `${opportunityAssessment} ${profileAdaptedConclusion}`.trim();
  return Object.freeze({
    type: 'maxxis_structured_analysis',
    version: MAXXIS_STRUCTURED_ANALYSIS_VERSION,
    reportType,
    language,
    executiveSummary,
    investmentThesis,
    opportunityAssessment,
    propertyContextInterpretation: propertyContext,
    investorFit: Object.freeze(fit),
    profileFit: Object.freeze({
      score: finite(record(context.matchContext).score),
      strengths: Object.freeze(fit.strengths),
      mismatches: Object.freeze(fit.mismatches),
      unknownCriteria: Object.freeze(fit.unknownCriteria),
      rationale: fit.fitRationale,
    }),
    marketContext: Object.freeze(market),
    marketAnalysis: Object.freeze({
      interpretation: market.interpretation,
      evidence: Object.freeze(market.evidenceUsed),
      limitations: Object.freeze(market.limitations),
    }),
    comparativeAnalysis: Object.freeze(comparative),
    comparablesAnalysis: Object.freeze({
      candidatesConsidered: list(context.comparableEvidence).length,
      selected: Object.freeze(comparative.selectedCompSummary),
      supporting: Object.freeze(comparative.supportingEvidence),
      excluded: list(context.comparableEvidence).filter((item) => item?.valuationRole === 'EXCLUDED').length,
      interpretation: comparative.interpretation,
      limitations: Object.freeze(comparative.limitations),
    }),
    valuationAnalysis: Object.freeze(valuation),
    riskAnalysis: Object.freeze(risks),
    positiveSignals: Object.freeze(positiveSignals.slice(0, 8)),
    concerns: Object.freeze(concerns.slice(0, 8)),
    missingEvidence: Object.freeze(missingEvidence.slice(0, 12)),
    recommendedVerificationSteps: Object.freeze(recommendedVerificationSteps),
    recommendedActions: Object.freeze(unique(list(context.recommendedActions).map((item) => localizedAction(item, language))).slice(0, 8)),
    strategySpecificInsights: Object.freeze(strategySpecificInsights.slice(0, 6)),
    profileAdaptedConclusion,
    userFacingDisclaimers: Object.freeze([
      localized(language, 'This analysis is evidence-based decision support, not an appraisal, offer recommendation or return guarantee.', 'Esta análise oferece apoio à decisão baseado em evidências; não é uma avaliação imobiliária, recomendação de oferta ou garantia de retorno.', 'Este análisis ofrece apoyo a la decisión basado en evidencia; no es una tasación, recomendación de oferta ni garantía de retorno.'),
      localized(language, 'Provider AVM evidence, when present, is not a DealSifter ARV.', 'A evidência AVM do provedor, quando presente, não é um ARV DealSifter.', 'La evidencia AVM del proveedor, cuando está presente, no es un ARV DealSifter.'),
    ]),
  });
}
