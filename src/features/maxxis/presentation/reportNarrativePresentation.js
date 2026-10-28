import { localizePresentationText, getCachedPresentationText } from '../../../services/chatTranslation';
import { prepareReportAssets, preparedReportAssetsCacheKey } from '../export/reportPreparedAssets.ts';
import { prepareReportMaps, preparedReportMapCacheKey } from '../export/reportMapAssets';
export async function prepareReportNarrativePresentation(schema, language, { media = true, timeoutMs = 5000 } = {}) {
  const property = schema?.sections?.propertySummary?.data;
  if (!property) return;
  const texts = [...new Set([property.propertyUserNotes, property.notes, property.description, property.owner?.notes, property.owner?.description].filter(value => typeof value === 'string' && value.trim()))];
  const protectedNames = [property.title, property.address, property.owner?.name, 'Poggenpohl', 'Sub Zero'].filter(Boolean);
  const work = Promise.all([
    ...(media ? [prepareReportAssets(schema).catch(() => []), prepareReportMaps(schema, language).catch(() => ({}))] : []),
    ...texts.map(text => localizePresentationText({ text, targetLocale: language, protectedNames }).catch(() => null)),
  ]);
  // Translation/media are presentation enhancements, not a prerequisite for
  // returning the analysis. The safe original and coordinate-map fallback remain
  // available while existing single-flight preparations finish in the background.
  let timer;
  try {
    await Promise.race([work, new Promise(resolve => { timer = setTimeout(resolve, timeoutMs); })]);
  } finally { clearTimeout(timer); }
}
export function reportNarrativeCacheKey(schema, language) {
  const property = schema?.sections?.propertySummary?.data || {};
  return `${preparedReportAssetsCacheKey(schema)}:${preparedReportMapCacheKey(schema)}:${JSON.stringify([property.propertyUserNotes, property.notes, property.description, property.owner?.notes].map(value => getCachedPresentationText(value, language)))}`;
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
