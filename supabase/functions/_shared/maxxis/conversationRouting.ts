export type MaxxisPropertyIntent =
  | 'PROPERTY_FACTS'
  | 'DEAL_OVERVIEW'
  | 'PROVIDER_HELP'
  | 'NEXT_ACTION'
  | 'NONE';

export type MaxxisToolCall = { name: string; args: Record<string, unknown> };

function normalize(value: string) {
  return ` ${String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9/$]+/g, ' ')
    .replace(/\s+/g, ' ')} `;
}

function matchesAny(value: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(value));
}

function differsFromProposed(proposedTool: MaxxisToolCall | null, tool: MaxxisToolCall) {
  return proposedTool?.name !== tool.name || JSON.stringify(proposedTool?.args || {}) !== JSON.stringify(tool.args);
}

const PROPERTY_FACT_PATTERNS = [
  /\b(detalhes?|dados?|informacoes?)\s+(publicad[oa]s?|fatuais?)\b/,
  /\b(factual|published)\s+(details?|data|facts?)\b/,
  /\b(detalles?|datos?)\s+(publicados?|factuales?)\b/,
  /\b(preco|price|precio|valor)\b.*\b(quartos?|beds?|habitaciones?|banheiros?|baths?|banos?|sqft|square feet|pies cuadrados)\b/,
  /\b(quartos?|beds?|habitaciones?|banheiros?|baths?|banos?|sqft|square feet|pies cuadrados|price per sqft|preco por sqft)\b/,
];

const DEAL_OVERVIEW_PATTERNS = [
  /\bcomo\s+(?:esta|vai|parece)\b.*\b(imovel|deal|negocio|oportunidade)\b/,
  /\b(?:o que|que)\s+(?:voce\s+)?ve\b.*\b(imovel|deal|negocio|oportunidade|aqui|neste|nesse|nesta|nessa)\b/,
  /\b(leitura|visao geral|panorama|analise)\b.*\b(imovel|deal|negocio|oportunidade)\b/,
  /\b(?:o que|que)\s+(?:esta\s+)?(?:faltando|falta)\b.*\b(imovel|deal|negocio|oportunidade|aqui)?\b/,
  /\bhow\s+(?:does|is)\b.*\b(deal|property|opportunity)\b.*\b(?:look|doing|going)?\b/,
  /\bwhat\s+do\s+you\s+see\b.*\b(deal|property|opportunity|here)\b/,
  /\b(?:overview|assessment|read|analysis)\b.*\b(deal|property|opportunity)\b/,
  /\bwhat(?:'s|\s+is)?\s+missing\b.*\b(deal|property|opportunity|here)?\b/,
  /\bcomo\s+(?:esta|se ve|parece)\b.*\b(propiedad|deal|oportunidad)\b/,
  /\bque\s+ves\b.*\b(propiedad|deal|oportunidad|aqui|esta)\b/,
  /\b(?:vision general|panorama|analisis|lectura)\b.*\b(propiedad|deal|oportunidad)\b/,
  /\bque\s+falta\b.*\b(propiedad|deal|oportunidad|aqui)?\b/,
  /\b(deal status|deal summary|overall situation|situacao atual|situacion actual|estado do deal)\b/,
];

const PROVIDER_HELP_PATTERNS = [
  /\b(quem|who|quien)\b.*\b(ajudar|help|ayudar)\b/,
  /\b(find|show|mostrar|buscar|encontrar)\b.*\b(provider|providers|professional|professionals|service|services|prestador|prestadores|profissional|profissionais|contratista|contratistas)\b/,
];

const NEXT_ACTION_PATTERNS = [
  /\b(e agora|what next|what should i do next|que hago ahora|y ahora)\b/,
  /\b(next best action|next action|proximo passo|proxima acao|siguiente paso|siguiente accion|workflow|checklist|progress|progresso|progreso)\b/,
];

export function classifyMaxxisPropertyIntent(message: string): MaxxisPropertyIntent {
  const normalized = normalize(message);
  if (matchesAny(normalized, PROPERTY_FACT_PATTERNS)) return 'PROPERTY_FACTS';
  if (matchesAny(normalized, PROVIDER_HELP_PATTERNS)) return 'PROVIDER_HELP';
  if (matchesAny(normalized, NEXT_ACTION_PATTERNS)) return 'NEXT_ACTION';
  if (matchesAny(normalized, DEAL_OVERVIEW_PATTERNS)) return 'DEAL_OVERVIEW';
  return 'NONE';
}

export function validateMaxxisToolSelection({
  message,
  propertyId,
  comparisonPropertyIds = [],
  proposedTool = null,
}: {
  message: string;
  propertyId: string;
  comparisonPropertyIds?: string[];
  proposedTool?: MaxxisToolCall | null;
}): { tool: MaxxisToolCall | null; policy: string; corrected: boolean } {
  const normalized = normalize(message);
  if (comparisonPropertyIds.length >= 2 && /\b(compare|comparar|comparison|comparacao|comparacion)\b/.test(normalized)) {
    const tool = { name: 'compareProperties', args: { propertyIds: comparisonPropertyIds.slice(0, 3) } };
    return { tool, policy: 'EXPLICIT_COMPARISON', corrected: differsFromProposed(proposedTool, tool) };
  }
  if (propertyId) {
    const intent = classifyMaxxisPropertyIntent(message);
    if (intent === 'DEAL_OVERVIEW') {
      const tool = { name: 'getDealCopilotOverview', args: { propertyId } };
      return { tool, policy: intent, corrected: differsFromProposed(proposedTool, tool) };
    }
    if (intent === 'PROPERTY_FACTS') {
      const tool = { name: 'getPropertyDetails', args: { propertyId, includeServiceMatches: false, includeOperationalContext: false } };
      return { tool, policy: intent, corrected: differsFromProposed(proposedTool, tool) };
    }
    if (intent === 'PROVIDER_HELP') {
      const tool = { name: 'getPropertyDetails', args: { propertyId, includeServiceMatches: true, includeOperationalContext: false } };
      return { tool, policy: intent, corrected: differsFromProposed(proposedTool, tool) };
    }
    if (intent === 'NEXT_ACTION') {
      const tool = { name: 'getPropertyDetails', args: { propertyId, includeServiceMatches: false, includeOperationalContext: true } };
      return { tool, policy: intent, corrected: differsFromProposed(proposedTool, tool) };
    }
  }
  if (/\b(opportunity|opportunities|oportunidade|oportunidades|properties|propriedades|dallas|texas)\b/.test(normalized)) {
    const personalized = /\b(my profile|for me|aligned|meu perfil|me encaixa|eu busco)\b/.test(normalized);
    const tool = { name: 'searchProperties', args: { personalized, limit: 5 } };
    return { tool, policy: 'EXPLICIT_INVENTORY_SEARCH', corrected: differsFromProposed(proposedTool, tool) };
  }
  return { tool: proposedTool, policy: 'GEMINI_AUTHORITY', corrected: false };
}
