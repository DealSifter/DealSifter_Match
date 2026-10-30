import { localizePresentationText, getCachedPresentationText } from '../../../services/chatTranslation';
import { prepareReportAssets, preparedReportAssetsCacheKey } from '../export/reportPreparedAssets.ts';
import { prepareReportMaps, preparedReportMapCacheKey } from '../export/reportMapAssets';
export async function prepareReportNarrativePresentation(schema, language, { media = true, timeoutMs = media ? 30000 : 5000 } = {}) {
  const property = schema?.sections?.propertySummary?.data;
  if (!property) return;
  const texts = [...new Set([property.propertyUserNotes, property.notes, property.description, property.owner?.notes, property.owner?.description].filter(value => typeof value === 'string' && value.trim()))];
  const protectedNames = [property.title, property.address, property.owner?.name, 'Poggenpohl', 'Sub Zero'].filter(Boolean);
  const bounded = async (work, deadline) => {
    let timer;
    try { await Promise.race([work, new Promise(resolve => { timer = setTimeout(resolve, deadline); })]); }
    finally { clearTimeout(timer); }
  };
  // Inline analysis stays fast (media:false). Explicit PDF workflows wait for
  // bounded, retried media loads instead of racing the old five-second deadline.
  await Promise.all([
    ...(media ? [bounded(Promise.allSettled([prepareReportAssets(schema), prepareReportMaps(schema, language)]), timeoutMs)] : []),
    bounded(Promise.all(texts.map(text => localizePresentationText({ text, targetLocale: language, protectedNames }).catch(() => null))), Math.min(timeoutMs, 5000)),
  ]);
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
