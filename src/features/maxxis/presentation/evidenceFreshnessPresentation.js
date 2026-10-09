import { getSafeLang } from '../../../services/chatTranslation';
export function describeEvidenceFreshness(freshness, language = 'en') {
  const entries = Object.values(freshness || {}).filter(entry => entry?.state === 'STALE_USABLE');
  if (!entries.length) return '';
  const lang = getSafeLang(language);
  const dates = entries.map(entry => Date.parse(entry.retrievedAt)).filter(Number.isFinite);
  const date = dates.length ? new Date(Math.min(...dates)).toLocaleDateString(lang === 'pt' ? 'pt-BR' : lang === 'es' ? 'es-ES' : 'en-US') : '';
  return lang === 'pt' ? `Estou usando dados externos anteriores${date ? `, atualizados em ${date}` : ''}, sem uma nova atualização externa.`
    : lang === 'es' ? `Estoy usando datos externos anteriores${date ? `, actualizados el ${date}` : ''}, sin una nueva actualización externa.`
      : `I am using earlier external evidence${date ? `, updated on ${date}` : ''}, without a new external update.`;
}

export function describeStoredMarketReference(reference, language = 'en') {
  if (reference?.referenceState !== 'STALE_CALCULATED_REFERENCE' || !(Number(reference.centralEstimate) > 0)) return '';
  const lang = getSafeLang(language), locale = lang === 'pt' ? 'pt-BR' : lang === 'es' ? 'es-ES' : 'en-US';
  const amount = new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(reference.centralEstimate);
  const date = Number.isFinite(Date.parse(reference.calculatedAt)) ? new Date(reference.calculatedAt).toLocaleDateString(locale) : '';
  return lang === 'pt' ? `Estimativa baseada nas vendas anteriormente registradas: ${amount}${date ? ` (calculada em ${date})` : ''}. É uma referência histórica, não uma avaliação atual nem um ARV.`
    : lang === 'es' ? `Estimación basada en ventas registradas anteriormente: ${amount}${date ? ` (calculada el ${date})` : ''}. Es una referencia histórica, no una valoración actual ni ARV.`
      : `Estimate based on previously recorded sales: ${amount}${date ? ` (calculated on ${date})` : ''}. This is a historical reference, not a current valuation or ARV.`;
}
