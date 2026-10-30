import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
export const REPORT_PREVIEW_RENDERER_SOURCES = Object.freeze([
  'src/features/maxxis/export/maxxisReportPdf.js',
  'src/features/maxxis/export/strictReportPdf.ts',
  'src/features/maxxis/export/referenceReportPdf.ts',
  'src/features/maxxis/export/reportIntegrityViewModel.ts',
  'src/features/maxxis/export/maxxisReportVisualPolicy.js',
  'src/features/maxxis/export/reportTextContainment.js',
  'src/domain/maxxis/maxxisReportSchema.js',
  'src/assets/maxxis/report-official-logo.png',
  'scripts/generate-report-template-qa.mjs',
]);
export async function reportPreviewRendererFingerprint(root) {
  const hash=createHash('sha256');
  for(const source of REPORT_PREVIEW_RENDERER_SOURCES){hash.update(source);const bytes=await readFile(new URL(source,root));hash.update(/\.(?:png|ttf|jpg)$/.test(source)?bytes:bytes.toString().replace(/\r\n/g,'\n'));}
  return hash.digest('hex');
}
