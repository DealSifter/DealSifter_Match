const PT_VALUES = Object.freeze({
  ARV_AVAILABLE: 'ARV disponível', ARV_LIMITED: 'ARV limitado', ARV_UNAVAILABLE: 'ARV indisponível',
  AVAILABLE: 'Disponível', UNAVAILABLE: 'Indisponível', NOT_AVAILABLE: 'Indisponível', NOT_AVAILABLE_YET: 'Ainda não disponível',
  HIGH: 'Alta', MODERATE: 'Moderada', MEDIUM: 'Média', LOW: 'Baixa', LIMITED: 'Limitada', UNKNOWN: 'Desconhecido',
  PUBLISHED: 'Publicado', CLOSED: 'Encerrado', DRAFT: 'Rascunho', NOT_STARTED: 'Ainda não iniciado', IN_PROGRESS: 'Em andamento',
  USER_PROVIDED: 'Informado pelo usuário', CALCULATED: 'Calculado', VERIFIED_RECORD: 'Registro verificado', ESTIMATED: 'Estimado',
  SUPPORT: 'Evidência de apoio', SUPPORTING: 'Evidência de apoio', SELECTED: 'Comparável selecionado', USED: 'Usado',
  INCLUDED: 'Incluído na análise', EXCLUDED: 'Excluído da análise', UNREVIEWED: 'Não revisado', REVIEWED: 'Revisado',
  MATCHED: 'Aderente', PARTIAL: 'Parcialmente aderente', NOT_MATCHED: 'Não aderente',
  ALIGNED: 'Aderente', NOT_ALIGNED: 'Não aderente', NOT_EVALUATED: 'Ainda não avaliado',
  MATCHES_TARGET: 'Semelhante à condição-alvo', PARTIAL_MATCH: 'Parcialmente semelhante', SUPERIOR_TO_TARGET: 'Superior à condição-alvo',
  INFERIOR_TO_TARGET: 'Inferior à condição-alvo', DIFFERENT_PRODUCT_CLASS: 'Classe de imóvel diferente', NOT_COMPARABLE: 'Não comparável',
  AS_IS: 'No estado atual', LIGHT_REHAB: 'Reforma leve', STANDARD_RENOVATION: 'Reforma padrão', FULL_RENOVATION: 'Reforma completa',
  HIGH_END: 'Alto padrão', TURN_KEY: 'Pronto para uso', NEW_CONSTRUCTION: 'Construção nova',
  DATA_RISK: 'Risco dos dados', MARKET_RISK: 'Risco de mercado', VALUATION_RISK: 'Risco de avaliação', EXECUTION_RISK: 'Risco de execução',
  MAP_AVAILABLE: 'Mapa disponível', MAP_UNAVAILABLE: 'Mapa indisponível',
  MARKET: 'Mercado', PRICE_RANGE: 'Faixa de preço', PROPERTY_TYPE: 'Tipo de imóvel', STRATEGY: 'Estratégia', RANGE: 'Faixa',
  PROPERTY_INTELLIGENCE: 'Inteligência do imóvel', PRIMARY: 'Principal', EXPECTED: 'Esperado', WHOLESALER: 'Atacadista', FLIPPER: 'Reformador para revenda',
  BUY_AND_HOLD: 'Compra e manutenção', GENERAL_INVESTOR: 'Investidor geral', SFR: 'Residencial unifamiliar (SFR)', FSBO: 'Venda pelo proprietário (FSBO)',
  SUPPORTING_ONLY: 'Somente evidência de apoio', ARMS_LENGTH_VERIFIED: 'Transação independente verificada', NON_ARMS_LENGTH: 'Transação não independente',
  PROVIDER_ESTIMATE: 'Estimativa do provedor', PROVIDER_ESTIMATE_UNVALIDATED: 'Estimativa do provedor não validada', PROVIDER_ESTIMATE_WITHIN_RANGE: 'Estimativa do provedor dentro da faixa',
  DETERMINISTIC_PROFILE_FIT: 'Aderência determinística ao perfil', PROFILE_FIT_ONLY: 'Somente aderência ao perfil',
  DEALSIFTER_WEIGHTED_ARV_V1: 'Método ponderado de ARV DealSifter', DEALSIFTER_ARV_ENGINE_V1: 'Mecanismo de ARV DealSifter', DEALSIFTER_ARV_POLICY_V1: 'Política de ARV DealSifter',
  INTERQUARTILE_PRICE_PER_SQFT_INTERVAL: 'Intervalo interquartil de preço por pé quadrado', NOT_ACTIVE_UNCALIBRATED: 'Não ativo ou não calibrado',
  READY_FOR_ARV_EVALUATION: 'Pronto para reavaliação de ARV', INSUFFICIENT_CONDITION_EVIDENCE: 'Evidência de condição insuficiente',
});

const ES_VALUES = Object.freeze({
  ARV_AVAILABLE: 'ARV disponible', ARV_LIMITED: 'ARV limitado', ARV_UNAVAILABLE: 'ARV no disponible',
  AVAILABLE: 'Disponible', UNAVAILABLE: 'No disponible', NOT_AVAILABLE_YET: 'Aún no disponible',
  HIGH: 'Alta', MODERATE: 'Moderada', MEDIUM: 'Media', LOW: 'Baja', LIMITED: 'Limitada', UNKNOWN: 'Desconocido',
  USER_PROVIDED: 'Informado por el usuario', CALCULATED: 'Calculado', SUPPORT: 'Evidencia de apoyo', SUPPORTING: 'Evidencia de apoyo',
  SELECTED: 'Comparable seleccionado', EXCLUDED: 'Excluido del análisis', NOT_STARTED: 'Aún no iniciado',
});

const EN_VALUES = Object.freeze({
  ARV_AVAILABLE: 'ARV available', ARV_LIMITED: 'ARV limited', ARV_UNAVAILABLE: 'ARV unavailable',
  NOT_AVAILABLE_YET: 'Not available yet', USER_PROVIDED: 'User provided', CALCULATED: 'Calculated',
  SUPPORT: 'Supporting evidence', SUPPORTING: 'Supporting evidence', SELECTED: 'Selected comparable', EXCLUDED: 'Excluded from analysis',
  NOT_STARTED: 'Not started', MATCHES_TARGET: 'Matches target', PARTIAL_MATCH: 'Partially matches target',
  WHOLESALER: 'Wholesaler', FLIPPER: 'Flipper',
});

const VALUES = Object.freeze({ en: EN_VALUES, pt: PT_VALUES, es: ES_VALUES });

export function maxxisLocale(language = 'en') {
  return ['pt', 'es'].includes(language) ? language : 'en';
}

export function localizeMaxxisValue(value, language = 'en', fallback = '') {
  if (value === null || value === undefined || value === '') return fallback;
  const raw = String(value).trim();
  const key = raw.toUpperCase().replace(/[\s-]+/g, '_');
  const translated = VALUES[maxxisLocale(language)]?.[key];
  if (translated) return translated;
  if (/^[A-Z][A-Z0-9_:-]+$/.test(raw)) {
    if (maxxisLocale(language) === 'pt') return fallback || 'Não especificado';
    if (maxxisLocale(language) === 'es') return fallback || 'No especificado';
    const normalized = raw.replaceAll('_', ' ').toLocaleLowerCase(maxxisLocale(language) === 'pt' ? 'pt-BR' : undefined);
    return normalized.replace(/^./, (letter) => letter.toLocaleUpperCase(maxxisLocale(language) === 'pt' ? 'pt-BR' : undefined));
  }
  return raw;
}

export function formatVerifiedSoldComps(count, language = 'en') {
  const amount = Number(count || 0);
  if (language === 'pt') return `${amount} ${amount === 1 ? 'comparável vendido verificado' : 'comparáveis vendidos verificados'}`;
  if (language === 'es') return `${amount} ${amount === 1 ? 'comparable vendido verificado' : 'comparables vendidos verificados'}`;
  return `${amount} verified sold ${amount === 1 ? 'comp' : 'comps'}`;
}
