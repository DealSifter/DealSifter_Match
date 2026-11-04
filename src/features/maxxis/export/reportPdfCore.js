import officialDealSifterLogo from '../../../assets/maxxis/report-pdf-logo.png?inline';
import notoSansRegular from '../../../assets/maxxis/fonts/NotoSans-Regular.ttf?inline';
import notoSansBold from '../../../assets/maxxis/fonts/NotoSans-Bold.ttf?inline';
import { drawStrictReportPdf } from './strictReportPdf.ts';
import { validateRenderedReportText } from './reportTextValidation.ts';

const now = () => performance.now();
const ms = value => Math.round(value * 10) / 10;

/** Same deterministic drawing engine in a browser worker and in offline QA. No I/O. */
export async function renderPreparedReportPdf({ preparedDocument, viewModel, reportTrace, locationMapData, preparedMaps }, yieldRendering = async () => {}) {
  const startedAt = now();
  const { jsPDF } = await import('jspdf');
  const moduleMs = ms(now() - startedAt);
  const logo = officialDealSifterLogo;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true });
  if (reportTrace) doc.setProperties({ subject: `DealSifter report_id=${reportTrace.reportId}; request_id=${reportTrace.requestId}` });
  doc.addFileToVFS('NotoSans-Regular.ttf', notoSansRegular.split(',')[1]);
  doc.addFileToVFS('NotoSans-Bold.ttf', notoSansBold.split(',')[1]);
  doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
  doc.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold');
  await yieldRendering();
  const bodyStartedAt = now();
  const rendered = await drawStrictReportPdf({ doc, viewModel, logo, generatedAt: preparedDocument.cover.generatedAt,
    locationMapData, preparedMaps, yieldRendering });
  const pageRenderMs = ms(now() - bodyStartedAt);
  const outputValidation = validateRenderedReportText(rendered.layoutAudit.lines.map(line => line.text).join('\n'));
  if (!outputValidation.valid) return { state: 'VALIDATION_FAILED', document: null, validation: outputValidation };
  const assemblyStartedAt = now();
  await yieldRendering();
  const binary = new Uint8Array(doc.output('arraybuffer'));
  return { state: 'RENDERED', timings: { moduleMs, assetsMs: 0, pageRenderMs, assemblyMs: ms(now() - assemblyStartedAt), perPageMs: rendered.perPageMs, networkCalls: 0 },
    document: { ...preparedDocument,
      cover: { ...preparedDocument.cover, propertyAddress: viewModel.property.address, propertyType: viewModel.property.type,
        strategy: viewModel.property.strategy, resolvedAnalysisStrategy: viewModel.property.strategy, heroImage: viewModel.property.photos[0] || null },
      pages: rendered.pages, pageCount: rendered.pageCount, binary, mimeType: 'application/pdf', strictViewModel: viewModel,
      narrativeProjection: { notes: viewModel.property.notes.slice() },
      layoutAudit: rendered.layoutAudit, outputValidation, layoutPlan: rendered.layoutPlan,
    } };
}
