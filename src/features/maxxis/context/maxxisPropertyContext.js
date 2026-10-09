const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const propertyId = (value) => {
  const candidate = String(value?.propertyId || value?.property_id || value?.id || value || '').trim();
  return UUID_RE.test(candidate) ? candidate : '';
};

const propertyLabel = (property = {}) => String(
  property.address
  || property.fullAddress
  || property.full_address
  || property.streetAddress
  || property.street
  || property.title
  || '',
).trim();

function explicitPropertyFromMessage(message, candidates = []) {
  const raw = String(message || '');
  const explicitId = raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)?.[0] || '';
  if (explicitId) {
    const property = candidates.find((item) => propertyId(item).toLowerCase() === explicitId.toLowerCase()) || null;
    return { propertyId: explicitId, property };
  }
  const normalizedMessage = normalizeText(raw);
  if (!normalizedMessage) return null;
  const matches = candidates.map((property) => {
    const label = normalizeText(propertyLabel(property));
    return { property, id: propertyId(property), label };
  }).filter((item) => item.id && item.label.length >= 6 && normalizedMessage.includes(item.label));
  if (matches.length !== 1) return null;
  return { propertyId: matches[0].id, property: matches[0].property };
}

/**
 * Canonical Maxxis property authority. This function is intentionally UI- and
 * viewport-agnostic so desktop, tablet, and mobile use identical precedence.
 */
export function resolveMaxxisPropertyContext(input = {}) {
  const explicit = explicitPropertyFromMessage(input.userMessage, input.propertyCandidates);
  const ordered = [
    explicit && { ...explicit, source: 'USER_MESSAGE' },
    { propertyId: propertyId(input.chatSelectedProperty), property: input.chatSelectedProperty || null, source: 'MAXXIS_SELECTION' },
    { propertyId: propertyId(input.screenProperty), property: input.screenProperty || null, source: 'APP_SCREEN' },
    { propertyId: propertyId(input.activeConversationProperty), property: input.activeConversationProperty || null, source: 'ACTIVE_CONVERSATION' },
    ...(Array.isArray(input.recentProperties) ? input.recentProperties : []).map((property) => ({
      propertyId: propertyId(property), property: typeof property === 'object' ? property : null, source: 'RECENT_CONTEXT',
    })),
  ];
  const resolved = ordered.find((candidate) => candidate?.propertyId);
  // Selection/screen state commonly stores a UUID, not the card object. Resolve
  // that authoritative ID back to its canonical app facts; never use a name or
  // an unrelated card as fallback.
  const canonicalProperty = resolved && (Array.isArray(input.propertyCandidates) ? input.propertyCandidates : [])
    .find(candidate => propertyId(candidate).toLowerCase() === resolved.propertyId.toLowerCase());
  return resolved
    ? Object.freeze({ status: 'RESOLVED', ...resolved, property: canonicalProperty || resolved.property })
    : Object.freeze({ status: 'SELECTION_REQUIRED', propertyId: '', property: null, source: 'NONE' });
}

const EXPLICIT_GENERAL_SEARCH_RE = /\b(other|another|multiple|search|find|show|list|outr[ao]s?|varias?|procure|buscar?|mostre|listar?|quais\s+(?:imoveis|propriedades)|otras?|busca|muestra)\b/i;
const OPPORTUNITY_RE = /\b(opportunit(?:y|ies)|oportunidades?|potential|potencial|worth|vale\s+a\s+pena|o\s+que\s+(?:voce|vc)\s+acha|what\s+do\s+you\s+think|analy[sz]e\s+(?:this|it)|analise\s+(?:isso|este|esse)|(?:imoveis|propriedades).*(?:combin[a-z]*|perfil)|(?:properties|homes).*(?:match(?:es)?|profile))\b/i;

export function resolveMaxxisOpportunityIntent(message = '', hasPropertyContext = false) {
  const text = normalizeText(message);
  if (!OPPORTUNITY_RE.test(text)) return '';
  if (EXPLICIT_GENERAL_SEARCH_RE.test(text)) return 'GENERAL_OPPORTUNITY_SEARCH';
  return hasPropertyContext ? 'CURRENT_PROPERTY_ANALYSIS' : 'GENERAL_OPPORTUNITY_SEARCH';
}

export function maxxisPropertyDisplayLabel(property = {}) {
  return propertyLabel(property);
}
