import type { jsPDF } from 'jspdf';
import { comparableMapViewport } from './comparableMapGeometry';
import type { ReportViewModel, ReportSection } from './reportIntegrityTypes';
import { ReferenceReportComposition, reportCategoryAccent } from './referenceReportPdf';

type Color = [number, number, number];
type Tone = 'neutral' | 'positive' | 'warning' | 'accent';
interface Bounds { x: number; y: number; width: number; height: number; right: number; bottom: number }
interface AuditLine {
  page: number; sectionId: string; text: string; x: number; y: number; width: number; height: number; bottomY: number;
  fontSize: number; lineHeight: number; lineIndex: number; contentBounds: Bounds; cardBounds: Bounds; overflowX: number; overflowY: number;
  role: 'body' | 'caption';
}
interface AuditSection { sectionId: string; title: string; kind: string; page: number; availableHeight: number; renderedLines: number; selectedFontSize: number; clippedLines: number; overflowPixels: number; bounds: Bounds }
interface AuditContinuation { sectionId: string; title: string; kind: string; page: number }
interface AuditMap { sectionId: string; page: number; bounds: Bounds; points: { id: string; marker: string; x: number; y: number; radius: number }[] }
export interface StrictPdfAudit { lines: AuditLine[]; sections: AuditSection[]; continuations: AuditContinuation[]; maps: AuditMap[] }
export interface SafePdfMeta { product: string; subtitle: string; plan: string; tagline: string; generated: string; page: string; continuation: string; generatedAt: string; locale: string; reportType: string }
export interface SafePdfMapPoint { id: string; marker: string; latitude: number; longitude: number; markerTone?: string }
export interface SafePdfRow { label: string; value: string; source?: string }
export interface SafePdfSection {
  id: string; title: string; kind: 'narrative' | 'list' | 'facts' | 'comparables' | 'map';
  text?: string; items?: readonly string[]; rows?: readonly SafePdfRow[];
  columns?: readonly string[]; table?: readonly (readonly string[])[];
  map?: { points: readonly SafePdfMapPoint[]; caption: string };
  hero?: { label: string; value: string; qualification: string };
  range?: { low: string; high: string; estimate: string; position: number };
  tone?: Tone;
  continuationStart?: boolean;
  compact?: boolean;
  bodySize?: 9 | 10.5;
  gauge?: { value: number; label: string };
  comparison?: { label: string; value: number; text: string }[];
  gap?: boolean;
}
interface FlowPlan { forcedBreakBefore?: ReadonlySet<string>; lineCache?: Map<string, readonly string[]>; preparedMaps?: Record<string, string | null>; referenceLayout?: boolean }

const W = 595.28;
const H = 841.89;
const M = 30;
const CONTENT = W - 2 * M;
const TOP = 130;
const BOTTOM = 790;
const INK: Color = [23, 42, 58];
const MUTED: Color = [84, 105, 121];
const LINE: Color = [218, 229, 235];
const WHITE: Color = [255, 255, 255];
const GRAPHITE: Color = [21, 31, 39];
const toneColor = (tone: Tone, accent: Color): Color => tone === 'warning' ? [193, 121, 22] : tone === 'positive' ? [13, 135, 111] : tone === 'neutral' ? MUTED : accent;
const bounds = (x: number, y: number, width: number, height: number): Bounds => ({ x, y, width, height, right: x + width, bottom: y + height });
const now = () => typeof performance !== 'undefined' ? performance.now() : Date.now();

/** Drawing receives safe primitives only. There is no schema, domain entity or I/O access here. */
export class StrictPdfFlow {
  readonly audit: StrictPdfAudit = { lines: [], sections: [], continuations: [], maps: [] };
  readonly pages: Array<{ page: number; code: string; title: string; sectionKeys: string[] }> = [];
  readonly perPageMs: number[] = [];
  referenceHeader?: (title: string) => void;
  private pageStartedAt = 0;
  private readonly consumedBreaks = new Set<string>();
  y = TOP;
  readonly accent: Color;

  constructor(readonly doc: jsPDF, readonly meta: SafePdfMeta, readonly logo: string, private readonly plan: FlowPlan = {}) {
    this.accent = reportCategoryAccent(meta.reportType);
  }

  panel(x: number, y: number, width: number, height: number, tone: Tone = 'neutral') {
    this.doc.setFillColor(...WHITE);
    this.doc.setDrawColor(...LINE);
    this.doc.setLineWidth(.6);
    this.doc.roundedRect(x, y, width, height, 7, 7, 'FD');
    if (tone !== 'neutral') {
      this.doc.setFillColor(...toneColor(tone, this.accent));
      this.doc.roundedRect(x, y + 7, 3, Math.max(1, height - 14), 1.5, 1.5, 'F');
    }
  }

  // Reuses the vector warning/chart/check vocabulary of the previous report.
  icon(x: number, y: number, tone: Tone = 'accent') {
    const d = this.doc;
    d.setFillColor(...toneColor(tone, this.accent)); d.circle(x, y, 9, 'F');
    d.setDrawColor(...WHITE); d.setLineWidth(1);
    if (tone === 'warning') {
      d.triangle(x, y - 5, x - 5, y + 4, x + 5, y + 4, 'S'); d.line(x, y - 2, x, y + 1);
    } else if (tone === 'positive') {
      d.line(x - 4, y, x - 1, y + 3); d.line(x - 1, y + 3, x + 4, y - 3);
    } else {
      d.rect(x - 5, y + 1, 2, 4, 'S'); d.rect(x - 1, y - 2, 2, 7, 'S'); d.rect(x + 3, y - 5, 2, 10, 'S');
    }
  }

  lines(content: string, width: number, size = 10.5, bold = false): string[] {
    if (typeof content !== 'string') throw new Error('REPORT_SAFE_TEXT_REQUIRED');
    this.doc.setFont('NotoSans', bold ? 'bold' : 'normal');
    this.doc.setFontSize(size);
    const cacheKey = `${size}|${bold}|${width}|${content}`;
    const cached = this.plan.lineCache?.get(cacheKey);
    if (cached) return [...cached];
    const wrapped: string[] = this.doc.splitTextToSize(content, width);
    const output: string[] = [];
    for (const line of wrapped) {
      if (this.doc.getTextWidth(line) <= width) { output.push(line); continue; }
      let chunk = '';
      for (const char of line) {
        if (chunk && this.doc.getTextWidth(chunk + char) > width) { output.push(chunk); chunk = ''; }
        chunk += char;
      }
      if (chunk) output.push(chunk);
    }
    this.plan.lineCache?.set(cacheKey, output);
    return output;
  }

  drawText(content: string, x: number, y: number, width: number, sectionId: string, size = 10.5, bold = false, color: Color = INK, maxBottom = BOTTOM): number {
    const lines = this.lines(content, width, size, bold);
    return this.drawLines(lines, x, y, width, sectionId, size, bold, color, maxBottom);
  }

  drawLines(lines: readonly string[], x: number, y: number, width: number, sectionId: string, size = 10.5, bold = false, color: Color = INK, maxBottom = BOTTOM): number {
    const lineHeight = size + 4;
    this.doc.setFont('NotoSans', bold ? 'bold' : 'normal'); this.doc.setFontSize(size); this.doc.setTextColor(...color);
    const contentBounds = bounds(x, y, width, Math.max(0, maxBottom - y));
    for (const [lineIndex, line] of lines.entries()) {
      const yy = y + lineIndex * lineHeight;
      const lineWidth = this.doc.getTextWidth(line);
      const bottomY = yy + lineHeight;
      const overflowX = Math.max(0, lineWidth - width, M - x, x + lineWidth - (W - M));
      const overflowY = Math.max(0, bottomY - maxBottom);
      if (overflowX > .05 || overflowY > .05) throw new Error(`REPORT_TEXT_OUTSIDE_BOUNDS:${sectionId}`);
      this.audit.lines.push({ page: this.doc.getCurrentPageInfo().pageNumber, sectionId, text: line, x, y: yy, width: lineWidth, height: lineHeight, bottomY,
        fontSize: size, lineHeight, lineIndex, contentBounds, cardBounds: contentBounds, overflowX, overflowY, role: size < 9 ? 'caption' : 'body' });
      this.doc.text(line, x, yy + size * .86);
    }
    return y + lines.length * lineHeight;
  }

  newPage(title: string, code: string) {
    if (this.pages.length) {
      this.perPageMs.push(Math.round((now() - this.pageStartedAt) * 10) / 10);
      this.doc.addPage('a4', 'portrait');
    }
    this.pageStartedAt = now();
    const number = this.doc.getCurrentPageInfo().pageNumber;
    this.pages.push({ page: number, code, title, sectionKeys: [] });
    this.y = TOP;
    if (this.plan.referenceLayout) { this.referenceHeader?.(title); return; }
    this.doc.setFillColor(...GRAPHITE); this.doc.rect(0, 0, W, 86, 'F');
    const props = this.doc.getImageProperties(this.logo);
    this.doc.addImage(this.logo, props.fileType || 'PNG', M, 10, 198, 198 * props.height / props.width, 'official-dealsifter-logo');
    this.drawText(this.meta.tagline, M + 55, 64, 230, 'headerBrand', 7.5, false, this.accent, 83);
    const planX = W - M - 62;
    this.drawText(this.meta.product, 282, 22, planX - 291, 'headerProduct', 7.2, true, WHITE, 45);
    this.drawText(this.meta.subtitle, 282, 46, planX - 291, 'headerProductSubtitle', 6.8, false, WHITE, 79);
    this.doc.setFillColor(...this.accent); this.doc.roundedRect(planX, 22, 62, 29, 5, 5, 'F');
    const planWidth = this.doc.getTextWidth(this.meta.plan);
    this.drawText(this.meta.plan, planX + (62 - planWidth) / 2, 31, 62 - 10, 'headerPlan', 8, true, INK, 55);
    this.drawText(title, M, 102, CONTENT, 'headerPageTitle', 13, true, INK, 128);
  }

  drawMap(points: readonly SafePdfMapPoint[], x: number, y: number, width: number, height: number, sectionId: string, background?: string | null) {
    // Same framing as existing ARV/rental maps; this is an explicitly labeled coordinate diagram, not invented geography.
    const view = comparableMapViewport(points, 900, 330, 65);
    if (background) this.mapImage(background, x, y, width, height);
    else { this.doc.setFillColor(241, 247, 248); this.doc.setDrawColor(...LINE); this.doc.roundedRect(x, y, width, height, 6, 6, 'FD'); }
    this.doc.setDrawColor(222, 232, 235); this.doc.setLineWidth(.5);
    if (!background) for (let i = 1; i < 5; i += 1) { this.doc.line(x + width * i / 5, y + 8, x + width * i / 5, y + height - 8); this.doc.line(x + 8, y + height * i / 5, x + width - 8, y + height * i / 5); }
    const plotted: AuditMap['points'] = [];
    for (const { x: worldX, y: worldY, item } of view.world) {
      const px = x + (worldX - view.left) / view.width * width;
      const py = y + (worldY - view.top) / view.height * height;
      const radius = item.marker === 'S' ? 10 : 8;
      if (px - radius < x || px + radius > x + width || py - radius < y || py + radius > y + height) throw new Error('REPORT_MAP_MARKER_OUTSIDE_BOUNDS');
      plotted.push({ id: item.id, marker: item.marker, x: px, y: py, radius });
      if (background) continue;
      const color: Color = item.marker === 'S' ? INK : item.markerTone === 'sold' ? [230, 164, 22] : item.markerTone === 'for-sale' ? [220, 53, 69] : item.markerTone === 'complementary' ? [139, 92, 246] : [13, 135, 111];
      this.doc.setFillColor(...color); this.doc.setDrawColor(...WHITE); this.doc.setLineWidth(2); this.doc.circle(px, py, radius, 'FD');
      this.doc.setFont('NotoSans', 'bold'); this.doc.setFontSize(8);
      const markerWidth = this.doc.getTextWidth(item.marker);
      this.drawText(item.marker, px - markerWidth / 2, py - 5, radius * 2, sectionId, 8, true, WHITE, y + height);
    }
    this.audit.maps.push({ sectionId, page: this.doc.getCurrentPageInfo().pageNumber, bounds: bounds(x, y, width, height), points: plotted });
  }

  image(data: string, x: number, y: number, width: number, height: number, fit: 'cover' | 'contain' = 'cover') {
    if (!/^data:image\/(?:png|jpeg|jpg|webp);base64,/i.test(data)) return false;
    try {
      const properties = this.doc.getImageProperties(data);
      const scale = (fit === 'contain' ? Math.min : Math.max)(width / properties.width, height / properties.height);
      const imageWidth = properties.width * scale, imageHeight = properties.height * scale;
      this.doc.saveGraphicsState(); this.doc.roundedRect(x, y, width, height, 6, 6, null); this.doc.clip(); this.doc.discardPath();
      this.doc.addImage(data, properties.fileType || 'JPEG', x + (width - imageWidth) / 2, y + (height - imageHeight) / 2, imageWidth, imageHeight); this.doc.restoreGraphicsState();
      return true;
    } catch { return false; }
  }

  mapImage(data: string, x: number, y: number, width: number, height: number) {
    if (!/^data:image\/(?:png|jpeg|jpg|webp);base64,/i.test(data)) return false;
    try {
      const properties = this.doc.getImageProperties(data), scale = Math.min(width / properties.width, height / properties.height);
      const w = properties.width * scale, h = properties.height * scale;
      this.doc.addImage(data, properties.fileType || 'PNG', x + (width - w) / 2, y + (height - h) / 2, w, h);
      return true;
    } catch { return false; }
  }

  finish() {
    const total = this.doc.getNumberOfPages();
    this.perPageMs.push(Math.round((now() - this.pageStartedAt) * 10) / 10);
    const stamp = new Intl.DateTimeFormat(this.meta.locale === 'pt' ? 'pt-BR' : this.meta.locale === 'es' ? 'es-ES' : 'en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(this.meta.generatedAt));
    for (let page = 1; page <= total; page += 1) {
      if (this.plan.referenceLayout) continue;
      this.doc.setPage(page); this.doc.setLineWidth(.6); this.doc.setDrawColor(...LINE); this.doc.line(M, 810, W - M, 810);
      this.drawText(`${this.meta.generated}: ${stamp} UTC`, M, 822, CONTENT - 95, 'footer', 7.4, false, MUTED, H - 4);
      this.drawText(`${this.meta.page} ${page} / ${total}`, W - M - 85, 822, 85, 'footer', 7.4, false, MUTED, H - 4);
    }
    return { pages: this.pages, pageCount: total, layoutAudit: this.audit, perPageMs: this.perPageMs };
  }
}

const COPY = { en: { generated: 'Generated', page: 'Page', continuation: 'continued' }, pt: { generated: 'Gerado em', page: 'Pagina', continuation: 'continuacao' }, es: { generated: 'Generado', page: 'Pagina', continuation: 'continuacion' } };
interface StrictDrawOptions { doc: jsPDF; viewModel: ReportViewModel; logo: string; generatedAt: string; locationMapData?: string | null; preparedMaps?: Record<string, string | null>; yieldRendering?: () => Promise<void> }
/** The only production PDF body entrypoint accepts the strict display model. */
export async function drawStrictReportPdf(options: StrictDrawOptions) {
  {
    const copy = COPY[options.viewModel.locale];
    const flow = new StrictPdfFlow(options.doc, { ...options.viewModel.header, reportType: options.viewModel.reportType, locale: options.viewModel.locale,
      generatedAt: options.generatedAt, generated: copy.generated, page: copy.page, continuation: copy.continuation }, options.logo, { referenceLayout: true });
    const composition = new ReferenceReportComposition(flow, options.viewModel, options.preparedMaps || {}, options.locationMapData || null);
    const drawn = await composition.draw(options.yieldRendering || (async () => {}));
    return { ...drawn, layoutPlan: { preflightPasses: 0, forcedBreakBefore: [], mediaRequests: 0, fontSizeReduction: false, composition: 'CONTENT_FLOW_R4' } };
  }
}
