import { localizePresentationText, getCachedPresentationText } from '../../../services/chatTranslation';
export async function prepareReportNarrativePresentation(schema, language) {
  const property = schema?.sections?.propertySummary?.data;
  if (!property) return;
  const texts = [...new Set([property.propertyUserNotes, property.notes, property.description, property.owner?.notes, property.owner?.description].filter(value => typeof value === 'string' && value.trim()))];
  const protectedNames = [property.title, property.address, property.owner?.name, 'Poggenpohl', 'Sub Zero'].filter(Boolean);
  await Promise.all(texts.map(text => localizePresentationText({ text, targetLocale: language, protectedNames }).catch(() => null)));
}
export function reportNarrativeCacheKey(schema, language) {
  const property = schema?.sections?.propertySummary?.data || {};
  return JSON.stringify([property.propertyUserNotes, property.notes, property.description, property.owner?.notes].map(value => getCachedPresentationText(value, language)));
}
