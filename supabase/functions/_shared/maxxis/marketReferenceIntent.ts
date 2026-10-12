import { propertyTypeFamily, resolveAnalysisPropertyType } from './canonicalFactSemantics.ts';

/** Topic detection is shared by chat UI and the authenticated runtime, not chosen by the LLM. */
export function detectMarketReferenceIntent(message: unknown, property?: Record<string, unknown> | null) {
  const text = String(message || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/(como|how|como).*?(cheg|calcul|estim|arriv|derive|obtain|lleg|obtu)|(?:explique|explain|explica).*?(estimativa|estimate|estimacion|avm|market|mercado)/.test(text)
    && /estim|market|mercado|avm|valor/.test(text)) return 'EXPLAIN_MARKET_ESTIMATE';
  const land = propertyTypeFamily(resolveAnalysisPropertyType(property)) === 'LAND';
  if ((land || /\b(terreno|lote|land|lot|parcela)\b/.test(text))
    && /quanto.*val|qual.*valor|(?:what|how much).*worth|(?:what|how much).*value|cuanto.*val|precio.*(?:bueno|alto)|preco.*bom|(?:esta|is it).*caro|overpriced|compare.*(?:vendid|sold)|compar.*terren/.test(text)) return 'LAND_MARKET_REFERENCE';
  if (!/\barv\b/.test(text) && /\b(comparaveis|comparables|comps|vendas comparaveis)\b/.test(text)) return land ? 'LAND_MARKET_REFERENCE' : 'EXPLAIN_MARKET_ESTIMATE';
  return null;
}
