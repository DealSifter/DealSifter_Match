import { localizePresentationText, getCachedPresentationText } from '../../../services/chatTranslation';
import { prepareReportAssets, preparedReportAssetsCacheKey } from '../export/reportPreparedAssets.ts';
export async function prepareReportNarrativePresentation(schema, language) {
  const property = schema?.sections?.propertySummary?.data;
  if (!property) return;
  const texts = [...new Set([property.propertyUserNotes, property.notes, property.description, property.owner?.notes, property.owner?.description].filter(value => typeof value === 'string' && value.trim()))];
  const protectedNames = [property.title, property.address, property.owner?.name, 'Poggenpohl', 'Sub Zero'].filter(Boolean);
  await Promise.all([prepareReportAssets(schema), ...texts.map(text => localizePresentationText({ text, targetLocale: language, protectedNames }).catch(() => null))]);
}
export function reportNarrativeCacheKey(schema, language) {
  const property = schema?.sections?.propertySummary?.data || {};
  return `${preparedReportAssetsCacheKey(schema)}:${JSON.stringify([property.propertyUserNotes, property.notes, property.description, property.owner?.notes].map(value => getCachedPresentationText(value, language)))}`;
}

// Original source and presentation translation are separate; never mutate the frozen fact schema.
export function reportNarrativeProjection(schema, language) {
  const property = schema?.sections?.propertySummary?.data || {};
  const project = (original, localized) => Object.freeze({ original: original || null,
    localized: localized || getCachedPresentationText(original, language) || original || null, locale: language });
  return Object.freeze({
    userNotes: project(property.propertyUserNotesOriginal || property.propertyUserNotes || property.notes, property.localizedPropertyUserNotes),
    description: project(property.description, property.localizedDescription),
    ownerNotes: project(property.owner?.notesOriginal || property.owner?.notes, property.owner?.localizedNotes || property.localizedOwnerNotes),
  });
}
