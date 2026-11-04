import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
export const REPORT_PREVIEW_RENDERER_SOURCES = Object.freeze([
  'supabase/functions/_shared/maxxis/evidenceAbsence.ts',
  'supabase/functions/_shared/maxxis/financialEvidenceAnswer.ts',
  'supabase/functions/_shared/maxxis/reportMarketReferences.ts',
  'src/features/maxxis/export/maxxisReportPdf.js',
  'src/features/maxxis/export/reportPdfCore.js',
  'src/features/maxxis/export/reportPdfImages.ts',
  'src/features/maxxis/export/reportPdfFailures.js',
  'src/features/maxxis/export/reportFactLayout.ts',
  'src/features/maxxis/export/reportTextValidation.ts',
  'src/features/maxxis/export/strictReportPdf.ts',
  'src/features/maxxis/export/referenceReportPdf.ts',
  'src/features/maxxis/export/referenceCloneComposition.ts',
  'src/features/maxxis/export/reportReferenceDesign.ts',
  'src/features/maxxis/export/reportBrandShell.ts',
  'src/features/maxxis/export/contentReportComposition.ts',
  'src/features/maxxis/export/reportContentPlan.ts',
  'src/features/maxxis/export/comparableMapGeometry.ts',
  'src/features/maxxis/export/reportMapPin.js',
  'src/features/maxxis/export/reportMapAssets.js',
  'src/features/maxxis/export/reportReadingPlan.ts',
  'src/features/maxxis/export/reportPublisherDisclosure.ts',
  'src/features/maxxis/export/reportIntegrityViewModel.ts',
  'src/features/maxxis/export/maxxisReportVisualPolicy.js',
  'src/features/maxxis/export/reportTextContainment.js',
  'src/domain/maxxis/maxxisReportSchema.js',
  'src/features/maxxis/intelligence/maxxisDealIntelligenceReport.js',
  'src/assets/maxxis/report-official-logo.png',
  'src/assets/maxxis/report-pdf-logo.png',
  'scripts/generate-report-template-qa.mjs',
  'scripts/sample-report-maps.mjs',
  'scripts/render-report-template-pages.mjs',
  'qa/report-template/sample-location-basemap.png',
  'qa/report-template/sample-location-basemap.json',
  'qa/report-template/sample-photos/gallery-1.jpg',
  'qa/report-template/sample-photos/gallery-2.jpg',
  'qa/report-template/sample-photos/gallery-3.jpg',
  'qa/report-template/sample-photos/gallery-4.jpg',
]);
export async function reportPreviewRendererFingerprint(root) {
  const hash=createHash('sha256');
  for(const source of REPORT_PREVIEW_RENDERER_SOURCES){hash.update(source);const bytes=await readFile(new URL(source,root));hash.update(/\.(?:png|ttf|jpg)$/.test(source)?bytes:bytes.toString().replace(/\r\n/g,'\n'));}
  return hash.digest('hex');
}
