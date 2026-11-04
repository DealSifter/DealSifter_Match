import { getReportPublisherDisclosure } from './reportPublisherDisclosure';
import { renderMaxxisReportDocument } from './maxxisReportRenderer';
import { buildStrictReportViewModel, validateReportViewModel } from './reportIntegrityViewModel.ts';
import { getPreparedReportMaps } from './reportMapAssets';
import { renderReportPdfInWorker } from './reportPdfWorkerClient';
import { reportNarrativeCacheKey } from '../presentation/reportNarrativePresentation';
import { REPORT_BODY_TIERS, REPORT_LAYOUT_TOKENS } from './maxxisReportVisualPolicy';

// Compatibility exports are pure geometry/containment, or explicitly UI-only asset preparation.
// No legacy schema-based drawing branch remains in the PDF execution path.
export { comparableMapViewport } from './comparableMapGeometry.ts';
export { resolveComparableMap } from './reportMapAssets';
export { createCardGeometry, renderContainedText } from './reportTextContainment';
export const REPORT_SECTION_GAP_Y = REPORT_LAYOUT_TOKENS.sectionGapY;
export const MAXXIS_REPORT_TYPOGRAPHY = Object.freeze({ body: REPORT_BODY_TIERS.default, analyticalBody: REPORT_BODY_TIERS.default, sectionHeader: 11.6, caption: 6.7 });

const performanceNow = () => typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
const roundedMs = elapsed => Math.round(elapsed * 10) / 10;
const yieldReportRendering = () => {
  if (typeof window === 'undefined') return Promise.resolve();
  if (typeof globalThis.scheduler?.yield === 'function') return globalThis.scheduler.yield();
  return new Promise(resolve => setTimeout(resolve, 0));
};
function emitReportStage(stage, detail = {}) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function' || typeof CustomEvent !== 'function') return;
  window.dispatchEvent(new CustomEvent('dealsifter:maxxis-performance', { detail: { stage, ...detail } }));
}
const reportRenderCache = new WeakMap();

export function renderMaxxisReportPdfCached(options = {}) {
  const { schema, exportEntitlement, generatedAt, language = 'en', mapImageData = null, mapImages = null, includePublisher } = options;
  if (!schema || typeof schema !== 'object' || mapImageData || mapImages) return renderMaxxisReportPdf(options);
  const date = generatedAt ? new Date(generatedAt) : null;
  const dateKey = date && !Number.isNaN(date.getTime()) ? date.toISOString() : '';
  const entitlementKey = `${exportEntitlement?.reportType || ''}:${exportEntitlement?.channel || ''}:${exportEntitlement?.state || ''}:${Boolean(exportEntitlement?.allowed)}`;
  const cacheKey = `${getReportPublisherDisclosure(schema, includePublisher)}:${language}:${dateKey}:${entitlementKey}:${reportNarrativeCacheKey(schema, language)}`;
  let entries = reportRenderCache.get(schema);
  if (!entries) {
    entries = new Map();
    reportRenderCache.set(schema, entries);
  }
  if (entries.has(cacheKey)) return entries.get(cacheKey);
  const rendering = renderMaxxisReportPdf(options).then((result) => {
    if (result.state !== 'RENDERED') entries.delete(cacheKey);
    return result;
  }).catch((error) => {
    entries.delete(cacheKey);
    throw error;
  });
  entries.set(cacheKey, rendering);
  return rendering;
}

export function downloadMaxxisReportPdf(document, fileName = 'maxxis-report.pdf') {
  if (!document?.binary?.length || typeof window === 'undefined') return false;
  const blobStartedAt = performanceNow();
  const blob = new Blob([document.binary], { type: 'application/pdf' });
  emitReportStage('pdf_blob_created', { durationMs: Math.round((performanceNow() - blobStartedAt) * 10) / 10, bytes: blob.size });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 15000);
  return true;
}



export async function renderMaxxisReportPdf({ schema, exportEntitlement, generatedAt, language = 'en', mapImageData = null, mapImages = null, includePublisher } = {}) {
  const startedAt = performanceNow();
  emitReportStage('pdf_generation_start');
  await yieldReportRendering();
  const prepared = renderMaxxisReportDocument({ schema, exportEntitlement, generatedAt, language });
  if (prepared.state !== 'PREPARED') return prepared;
  const viewModel = buildStrictReportViewModel({ schema, language: prepared.document.language, includePublisher });
  const validation = validateReportViewModel(viewModel);
  if (!validation.valid) return Object.freeze({ state: 'VALIDATION_FAILED', document: null, validation });
  const preparationMs = roundedMs(performanceNow() - startedAt);
  await yieldReportRendering();
  emitReportStage('pdf_assets_ready', { durationMs: 0, networkCalls: 0 });
  const input = { preparedDocument: prepared.document, viewModel, reportTrace: schema.reportTrace,
    locationMapData: typeof mapImageData === 'string' && /^data:image\//i.test(mapImageData) ? mapImageData : getPreparedReportMaps(schema).location || null,
    preparedMaps: { ...getPreparedReportMaps(schema), ...Object.fromEntries(Object.entries(mapImages || {}).filter(([, image]) => typeof image === 'string' && /^data:image\//i.test(image))) },
  };
  // Browser PDF encoding must not occupy the UI thread. Offline QA and browsers
  // without Workers use the exact same deterministic core, with task breaks.
  const background = typeof window !== 'undefined' && typeof Worker === 'function';
  const rendered = background ? await renderReportPdfInWorker(input)
    : await (await import('./reportPdfCore')).renderPreparedReportPdf(input, yieldReportRendering);
  if (rendered.state !== 'RENDERED') return rendered;
  await yieldReportRendering();
  const timings = Object.freeze({ ...rendered.timings, totalMs: roundedMs(performanceNow() - startedAt), preparationMs,
    perPageMs: Object.freeze(rendered.timings.perPageMs), background });
  emitReportStage('pdf_assembly_complete', { durationMs: timings.assemblyMs });
  emitReportStage('pdf_generation_complete', timings);
  return Object.freeze({ ...rendered, timings, document: Object.freeze(rendered.document) });
}
