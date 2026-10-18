import type { jsPDF } from 'jspdf';
import { comparableMapViewport } from './comparableMapGeometry';
import type { ReportViewModel, ReportSection } from './reportIntegrityTypes';
import { ReferenceReportComposition } from './referenceReportPdf';

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
export interface SafePdfMapPoint { id: string; marker: string; latitude: number; longitude: number }
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
    this.accent = meta.reportType === 'DEAL_INTELLIGENCE' ? [222, 170, 38] : meta.reportType === 'MAXXIS_ANALYSIS' ? [17, 153, 125] : [25, 179, 184];
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

  ensure(height: number, section: SafePdfSection, isContinuation = true) {
    if (this.y + height <= BOTTOM) return;
    this.newPage(isContinuation ? `${section.title} — ${this.meta.continuation}` : section.title, section.id);
    if (isContinuation) this.audit.continuations.push({ sectionId: section.id, title: section.title, kind: section.kind, page: this.doc.getCurrentPageInfo().pageNumber });
  }

  section(section: SafePdfSection) {
    const before = this.audit.lines.length;
    if (this.plan.forcedBreakBefore?.has(section.id) && !this.consumedBreaks.has(section.id)) {
      this.consumedBreaks.add(section.id);
      if (this.y > TOP) this.newPage(section.title, section.id);
    }
    const sourceCounts = new Map<string, number>();
    for (const row of section.rows || []) if (row.source) sourceCounts.set(row.source, (sourceCounts.get(row.source) || 0) + 1);
    const sharedSources = [...sourceCounts].filter(([, count]) => count > 1).map(([source]) => source);
    const estimatedFactsHeight = section.kind === 'facts' && section.rows?.length ? 46 + section.rows.reduce((height, row) => height + Math.max(this.lines(row.label, 150, 9).length * 13,
      this.lines(row.value, CONTENT - 188, 10.2, true).length * 14.2 + (row.source && !sharedSources.includes(row.source) ? this.lines(row.source, CONTENT - 188, 7.4).length * 11.4 : 0)) + 9, 0)
      + sharedSources.reduce((height, source) => height + this.lines(source, CONTENT - 26, 7.5).length * 11.5 + 5, 0) : 90;
    const bodySize = section.bodySize || 10.5;
    const compactHeight = 17 + (section.text ? this.lines(section.text, CONTENT - 26, bodySize).length * (bodySize + 4) : 0);
    this.ensure(section.compact ? compactHeight : Math.min(260, Math.max(90, estimatedFactsHeight)), section, section.continuationStart === true);
    this.pages[this.pages.length - 1].sectionKeys.push(section.id);
    const heading = () => {
      if (section.compact) { this.y += 8; return; }
      this.doc.setFillColor(242, 246, 247); this.doc.roundedRect(M, this.y, CONTENT, 30, 5, 5, 'F');
      this.icon(M + 16, this.y + 15, section.tone);
      this.drawText(section.title, M + 32, this.y + 8, CONTENT - 44, section.id, 11.5, true, toneColor(section.tone || 'accent', this.accent));
      this.y += 32;
    };
    heading();
    const continued = (height: number) => {
      if (this.y + height <= BOTTOM) return;
      this.ensure(height, section);
      this.pages[this.pages.length - 1].sectionKeys.push(section.id);
      heading();
    };
    const paragraph = (text: string, bullet = false) => {
      const indent = bullet ? 14 : 0;
      const lines = this.lines(text, CONTENT - 26 - indent, bodySize);
      let offset = 0;
      while (offset < lines.length) {
        continued(35);
        const available = Math.max(1, Math.floor((BOTTOM - this.y - 8) / (bodySize + 4)));
        const chunk = lines.slice(offset, offset + available);
        if (bullet && offset === 0) this.drawText('•', M + 12, this.y, 12, section.id, bodySize);
        this.y = this.drawLines(chunk, M + 13 + indent, this.y, CONTENT - 26 - indent, section.id, bodySize);
        offset += chunk.length;
      }
      this.y += 7;
    };
    if (section.gap) {
      continued(55);
      this.panel(M + 12, this.y + 3, CONTENT - 24, 45, 'warning');
      this.drawText(this.meta.locale === 'pt' ? 'Análise condicionada à verificação' : this.meta.locale === 'es' ? 'Análisis sujeto a verificación' : 'Analysis pending verification',
        M + 25, this.y + 15, CONTENT - 50, section.id, 13, true, toneColor('warning', this.accent));
      this.y += 60;
    }
    if (section.hero) {
      continued(103);
      this.panel(M + 12, this.y, CONTENT - 24, 90, 'accent');
      this.drawText(section.hero.label, M + 25, this.y + 10, CONTENT - 50, section.id, 9, true, MUTED);
      this.drawText(section.hero.value, M + 25, this.y + 29, CONTENT - 50, section.id, 22, true, INK);
      this.drawText(section.hero.qualification, M + 25, this.y + 62, CONTENT - 50, section.id, 8, false, MUTED);
      this.y += 103;
    }
    if (section.range) {
      continued(67);
      const range = section.range;
      this.doc.setDrawColor(...LINE); this.doc.setLineWidth(5); this.doc.line(M + 95, this.y + 14, W - M - 95, this.y + 14);
      this.doc.setFillColor(...this.accent); this.doc.circle(M + 95 + Math.max(0, Math.min(1, range.position)) * (CONTENT - 190), this.y + 14, 5, 'F');
      this.drawText(range.low, M + 12, this.y + 28, 160, section.id, 9);
      this.drawText(range.high, W - M - 155, this.y + 28, 143, section.id, 9);
      this.y += 61;
    }
    if (section.gauge) {
      continued(75);
      const n = Math.max(0, Math.min(100, section.gauge.value));
      this.drawText(`${section.gauge.label} · ${n}%`, M + 14, this.y + 6, CONTENT - 28, section.id, 18, true);
      this.doc.setFillColor(...LINE); this.doc.roundedRect(M + 14, this.y + 39, CONTENT - 28, 10, 5, 5, 'F');
      if (n > 0) { this.doc.setFillColor(...this.accent); this.doc.rect(M + 14, this.y + 39, (CONTENT - 28) * n / 100, 10, 'F'); }
      this.y += 65;
    }
    if (section.comparison?.length) {
      const maximum = Math.max(...section.comparison.map(item => item.value));
      continued(section.comparison.length * 56 + 12);
      for (const item of section.comparison) {
        this.drawText(`${item.label} · ${item.text}`, M + 14, this.y + 5, CONTENT - 28, section.id, 10.5, true);
        this.doc.setFillColor(...LINE); this.doc.roundedRect(M + 14, this.y + 28, CONTENT - 28, 9, 4, 4, 'F');
        if (maximum > 0 && item.value > 0) { this.doc.setFillColor(...this.accent); this.doc.rect(M + 14, this.y + 28, (CONTENT - 28) * item.value / maximum, 9, 'F'); }
        this.y += 56;
      }
    }
    if (section.text) paragraph(section.text);
    for (const [index, item] of (section.items || []).entries()) {
      if (this.meta.reportType === 'DEAL_INTELLIGENCE' && section.id !== 'publisherNotesAppendix' && section.id !== 'publisher-notes') {
        const height = this.lines(item, CONTENT - 70, bodySize).length * (bodySize + 4) + 30;
        if (height < 350) {
          continued(height + 10); this.panel(M + 12, this.y, CONTENT - 24, height, section.tone);
          this.icon(M + 30, this.y + 22, section.tone);
          this.y = this.drawText(section.id === 'next-actions' ? `${index + 1}. ${item}` : item, M + 48, this.y + 14, CONTENT - 70, section.id, bodySize) + 23;
          continue;
        }
      }
      paragraph(item, true);
    }
    for (const row of section.rows || []) {
      const sharedSource = row.source ? sharedSources.indexOf(row.source) : -1;
      const labelLines = this.lines(row.label, 150, 9, false);
      const valueLines = this.lines(sharedSource >= 0 ? `${row.value} [${sharedSource + 1}]` : row.value, CONTENT - 188, 10.2, true);
      const sourceLines = row.source && sharedSource < 0 ? this.lines(row.source, CONTENT - 188, 7.4) : [];
      let valueOffset = 0, sourceOffset = 0;
      do {
        continued(64);
        const availableLines = Math.max(1, Math.floor((BOTTOM - this.y - 20) / 14.2));
        const valueChunk = valueLines.slice(valueOffset, valueOffset + availableLines);
        const remainingForSource = availableLines - valueChunk.length;
        const sourceChunk = sourceLines.slice(sourceOffset, sourceOffset + remainingForSource);
        this.drawLines(labelLines, M + 13, this.y, 150, section.id, 9, false, MUTED);
        const valueBottom = this.drawLines(valueChunk, M + 175, this.y, CONTENT - 188, section.id, 10.2, true);
        if (sourceChunk.length) this.drawLines(sourceChunk, M + 175, valueBottom + 2, CONTENT - 188, section.id, 7.4, false, MUTED);
        this.y += Math.max(labelLines.length * 13, valueChunk.length * 14.2 + sourceChunk.length * 11.4) + 9;
        valueOffset += valueChunk.length;
        sourceOffset += sourceChunk.length;
        if (valueOffset < valueLines.length || sourceOffset < sourceLines.length) this.y = BOTTOM;
      } while (valueOffset < valueLines.length || sourceOffset < sourceLines.length);
    }
    for (const [index, source] of sharedSources.entries()) {
      const lines = this.lines(`[${index + 1}] ${source}`, CONTENT - 26, 7.5);
      let offset = 0;
      while (offset < lines.length) {
        continued(27);
        const capacity = Math.max(1, Math.floor((BOTTOM - this.y - 8) / 11.5));
        const chunk = lines.slice(offset, offset + capacity);
        this.y = this.drawLines(chunk, M + 13, this.y, CONTENT - 26, section.id, 7.5, false, MUTED) + 5;
        offset += chunk.length;
      }
    }
    if (section.map && section.map.points.length) {
      if (section.table?.length && section.columns?.length) {
        const height = 218 + 36 + section.table.reduce((sum, row) => sum + Math.max(...row.map((cell, i) => this.lines(cell, i === 1 ? 220 : 65, 9).length)) * 13 + 15, 0);
        if (height < BOTTOM - TOP - 40) continued(height);
      }
      continued(218);
      const preparedMap = this.plan.preparedMaps?.[section.id];
      if (!preparedMap || !this.image(preparedMap, M + 12, this.y, CONTENT - 24, 170)) this.drawMap(section.map.points, M + 12, this.y, CONTENT - 24, 170, section.id);
      this.y += 179;
      this.y = this.drawText(`${preparedMap ? '© OpenStreetMap contributors · ' : ''}${section.map.caption}`, M + 13, this.y, CONTENT - 26, section.id, 7.5, false, MUTED) + 12;
    }
    if (section.table?.length && section.columns?.length) {
      const count = section.columns.length;
      const widths = count === 5 ? [22, 235, 86, 78, 88] : section.columns.map(() => (CONTENT - 26) / count);
      const totalWidth = widths.reduce((sum, n) => sum + n, 0);
      const normalizedWidths = widths.map(n => n / totalWidth * (CONTENT - 26));
      const tableHeading = () => {
        const headingHeight = Math.max(...section.columns!.map((label, i) => this.lines(label, normalizedWidths[i] - 8, 7.3, true).length)) * 11.3 + 15;
        continued(headingHeight + 35);
        let x = M + 13;
        section.columns!.forEach((label, i) => {
          this.drawText(label, x, this.y, normalizedWidths[i] - 8, section.id, 7.3, true, MUTED);
          x += normalizedWidths[i];
        });
        this.y += headingHeight;
      };
      tableHeading();
      for (const row of section.table) {
        const cellLines = row.map((cell, i) => this.lines(cell, normalizedWidths[i] - 8, 9));
        const maximumLines = Math.max(...cellLines.map(lines => lines.length));
        let offset = 0;
        do {
          if (this.y + 43 > BOTTOM) { continued(80); tableHeading(); }
          const capacity = Math.max(1, Math.floor((BOTTOM - this.y - 16) / 13));
          const chunkCount = Math.min(capacity, maximumLines - offset);
          let x = M + 13;
          cellLines.forEach((lines, i) => {
            const chunk = lines.slice(offset, offset + chunkCount);
            this.drawLines(chunk, x, this.y, normalizedWidths[i] - 8, section.id, 9);
            x += normalizedWidths[i];
          });
          this.y += chunkCount * 13 + 15;
          this.doc.setDrawColor(...LINE); this.doc.line(M + 12, this.y - 7, W - M - 12, this.y - 7);
          offset += chunkCount;
          if (offset < maximumLines) this.y = BOTTOM;
        } while (offset < maximumLines);
      }
    }
    this.y += 9;
    const sectionLines = this.audit.lines.slice(before).filter(line => line.sectionId === section.id);
    for (const page of new Set(sectionLines.map(line => line.page))) {
      const lines = sectionLines.filter(line => line.page === page);
      const top = Math.min(...lines.map(line => line.y));
      const bottom = Math.max(...lines.map(line => line.bottomY));
      this.audit.sections.push({ sectionId: section.id, title: section.title, kind: section.kind, page,
        availableHeight: BOTTOM - TOP, renderedLines: lines.length, selectedFontSize: 10.5, clippedLines: 0, overflowPixels: 0, bounds: bounds(M, top, CONTENT, bottom - top) });
    }
  }

  drawMap(points: readonly SafePdfMapPoint[], x: number, y: number, width: number, height: number, sectionId: string) {
    // Same framing as existing ARV/rental maps; this is an explicitly labeled coordinate diagram, not invented geography.
    const view = comparableMapViewport(points, 900, 330, 65);
    this.doc.setFillColor(241, 247, 248); this.doc.setDrawColor(...LINE); this.doc.roundedRect(x, y, width, height, 6, 6, 'FD');
    this.doc.setDrawColor(222, 232, 235); this.doc.setLineWidth(.5);
    for (let i = 1; i < 5; i += 1) { this.doc.line(x + width * i / 5, y + 8, x + width * i / 5, y + height - 8); this.doc.line(x + 8, y + height * i / 5, x + width - 8, y + height * i / 5); }
    const plotted: AuditMap['points'] = [];
    for (const { x: worldX, y: worldY, item } of view.world) {
      const px = x + (worldX - view.left) / view.width * width;
      const py = y + (worldY - view.top) / view.height * height;
      const radius = item.marker === 'S' ? 10 : 8;
      if (px - radius < x || px + radius > x + width || py - radius < y || py + radius > y + height) throw new Error('REPORT_MAP_MARKER_OUTSIDE_BOUNDS');
      plotted.push({ id: item.id, marker: item.marker, x: px, y: py, radius });
      this.doc.setFillColor(...(item.marker === 'S' ? INK : [13, 135, 111] as Color)); this.doc.setDrawColor(...WHITE); this.doc.setLineWidth(2); this.doc.circle(px, py, radius, 'FD');
      this.doc.setFont('NotoSans', 'bold'); this.doc.setFontSize(8);
      const markerWidth = this.doc.getTextWidth(item.marker);
      this.drawText(item.marker, px - markerWidth / 2, py - 5, radius * 2, sectionId, 8, true, WHITE, y + height);
    }
    this.audit.maps.push({ sectionId, page: this.doc.getCurrentPageInfo().pageNumber, bounds: bounds(x, y, width, height), points: plotted });
  }

  image(data: string, x: number, y: number, width: number, height: number) {
    if (!/^data:image\/(?:png|jpeg|jpg|webp);base64,/i.test(data)) return false;
    try {
      const properties = this.doc.getImageProperties(data);
      const scale = Math.max(width / properties.width, height / properties.height);
      const imageWidth = properties.width * scale, imageHeight = properties.height * scale;
      this.doc.saveGraphicsState(); this.doc.roundedRect(x, y, width, height, 6, 6, null); this.doc.clip(); this.doc.discardPath();
      this.doc.addImage(data, properties.fileType || 'JPEG', x + (width - imageWidth) / 2, y + (height - imageHeight) / 2, imageWidth, imageHeight); this.doc.restoreGraphicsState();
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

const COPY = {
  en: { overview: 'Property overview', executive: 'Executive deal snapshot', facts: 'Property facts', notes: 'Property notes', location: 'Location', photos: 'Property photos', noPhoto: 'Property image unavailable', noMap: 'Coordinate location diagram · not a parcel survey', generated: 'Generated', page: 'Page', continuation: 'continued', status: 'Analysis status', opportunity: 'Primary opportunity', risk: 'Primary risk', blocker: 'Decision blocker', coverage: 'Evidence coverage', disclaimer: 'Important qualification' },
  pt: { overview: 'Visão geral do imóvel', executive: 'Visão executiva do negócio', facts: 'Dados do imóvel', notes: 'Notas do imóvel', location: 'Localização', photos: 'Fotos do imóvel', noPhoto: 'Imagem do imóvel indisponível', noMap: 'Diagrama de coordenadas · não é levantamento parcelário', generated: 'Gerado em', page: 'Página', continuation: 'continuação', status: 'Situação da análise', opportunity: 'Principal oportunidade', risk: 'Principal risco', blocker: 'Bloqueio decisório', coverage: 'Cobertura das evidências', disclaimer: 'Ressalva importante' },
  es: { overview: 'Resumen del inmueble', executive: 'Resumen ejecutivo del negocio', facts: 'Datos del inmueble', notes: 'Notas del inmueble', location: 'Ubicación', photos: 'Fotos del inmueble', noPhoto: 'Imagen del inmueble no disponible', noMap: 'Diagrama de coordenadas · no es una medición parcelaria', generated: 'Generado', page: 'Página', continuation: 'continuación', status: 'Estado del análisis', opportunity: 'Principal oportunidad', risk: 'Principal riesgo', blocker: 'Bloqueo de decisión', coverage: 'Cobertura de evidencias', disclaimer: 'Salvedad importante' },
} as const;

function safeSection(section: ReportSection): SafePdfSection {
  return { id: section.id, title: section.title,
    kind: section.kind === 'notes' ? 'narrative' : section.kind === 'market' ? 'comparables' : section.kind,
    text: section.text, items: section.items?.map(claim => claim.text), rows: section.rows,
    columns: section.table?.columns, table: section.table?.rows, map: section.map, hero: section.hero, range: section.range, gauge: section.gauge, comparison: section.comparison, gap: section.status === 'blocked',
    tone: section.status === 'blocked' || /risk|blocker|limitation|conflict/.test(section.id) ? 'warning' : /opportunity|positive/.test(section.id) ? 'positive' : 'accent' };
}

function propertyHero(flow: StrictPdfFlow, vm: ReportViewModel) {
  const { property } = vm;
  const copy = COPY[vm.locale];
  const top = flow.y;
  const hasImage = Boolean(property.photos[0]);
  const hasPrice = vm.values.price?.state === 'VALUE' || vm.values.price?.state === 'EXPLICIT_ZERO' || vm.values.price?.state === 'PROVISIONAL';
  const height = hasImage ? 185 : property.metrics.length ? 146 : hasPrice ? 115 : 76;
  const identityWidth = hasImage ? 235 : CONTENT - 26;
  flow.panel(M, top, CONTENT, height);
  flow.drawText(property.address || property.title, M + 13, top + 15, identityWidth, 'propertyIdentity', 14, true);
  flow.drawText(property.location, M + 13, top + 54, identityWidth, 'propertyLocation', 9, false, MUTED);
  if (hasPrice) flow.drawText(property.price, M + 13, top + (hasImage ? 80 : 73), identityWidth, 'propertyPrice', 22, true, flow.accent);
  if (hasImage && !flow.image(property.photos[0], M + 265, top + 9, CONTENT - 274, 167)) {
    flow.doc.setFillColor(239, 247, 248); flow.doc.roundedRect(M + 265, top + 9, CONTENT - 274, 167, 6, 6, 'F');
    flow.drawText(copy.noPhoto, M + 280, top + 80, CONTENT - 304, 'propertyImageStatus', 9, false, MUTED);
  }
  property.metrics.slice(0, 4).forEach((metric, index) => {
    const width = hasImage ? 112 : (CONTENT - 26 - 5 * (Math.min(4, property.metrics.length) - 1)) / Math.min(4, property.metrics.length);
    const x = M + 13 + (hasImage ? index % 2 * 118 : index * (width + 5));
    const y = top + (hasImage ? 116 + Math.floor(index / 2) * 31 : 108);
    flow.panel(x, y, width, 27);
    flow.drawText(metric.label, x + 7, y + 4, width - 14, 'propertyMetrics', 6.5, false, MUTED);
    flow.drawText(metric.value, x + 7, y + 14, width - 14, 'propertyMetrics', 7.4, true);
  });
  flow.y = top + height + 13;
}

function propertyRelease(flow: StrictPdfFlow, vm: ReportViewModel, locationMapData: string | null) {
  const copy = COPY[vm.locale];
  const groups = vm.property.facts.filter(group => group.rows.length);
  const width = (CONTENT - 12) / Math.max(1, groups.length);
  const start = flow.y;
  const heights = groups.map(group => 40 + group.rows.reduce((sum, row) => {
    const label = flow.lines(row.label, 56, 6.8).length * 10.8;
    const value = flow.lines(row.value, width - 82, 7, true).length * 11;
    return sum + Math.max(label, value) + 5;
  }, 0));
  const height = Math.max(125, ...heights);
  if (start + height > 620) {
    for (const [index, group] of groups.entries()) flow.section({ id: `propertyFacts${index}`, title: group.title, kind: 'facts', rows: group.rows });
  } else {
    groups.forEach((group, index) => {
      const x = M + index * (width + 6);
      flow.panel(x, start, width, height);
      flow.drawText(group.title, x + 9, start + 12, width - 18, `propertyFacts${index}`, 9, true, flow.accent);
      let y = start + 37;
      group.rows.forEach(row => {
        const labelLines = flow.lines(row.label, 56, 6.8);
        const valueLines = flow.lines(row.value, width - 82, 7, true);
        flow.drawLines(labelLines, x + 9, y, 56, `propertyFacts${index}`, 6.8, false, MUTED);
        flow.drawLines(valueLines, x + 70, y, width - 82, `propertyFacts${index}`, 7, true);
        y += Math.max(labelLines.length * 10.8, valueLines.length * 11) + 5;
      });
    });
    flow.y = start + height + 13;
  }
  const inlinePhotos = vm.property.photos.slice(0, 5);
  if (inlinePhotos.length && flow.y + 93 < BOTTOM) {
    flow.drawText(copy.photos, M + 12, flow.y, CONTENT - 24, 'propertyPhotos', 10.5, true, flow.accent);
    const y = flow.y + 24, photoWidth = (CONTENT - 20) / 5;
    inlinePhotos.forEach((image, index) => flow.image(image, M + index * (photoWidth + 5), y, photoWidth, 50));
    flow.y += 86;
  }
  const bottom = flow.y;
  const heightLeft = BOTTOM - bottom;
  if (heightLeft >= 95) {
    const locationWidth = vm.property.notes.length ? CONTENT * .59 : CONTENT;
    flow.panel(M, bottom, locationWidth, heightLeft);
    flow.drawText(copy.location, M + 10, bottom + 11, locationWidth - 20, 'propertyLocation', 10.5, true, flow.accent);
    flow.drawText(vm.property.location, M + 10, bottom + 34, locationWidth - 20, 'propertyLocation', 9, true);
    if (vm.property.locationPoint && heightLeft >= 130) {
      if (!locationMapData || !flow.image(locationMapData, M + 8, bottom + 55, locationWidth - 16, heightLeft - 78)) flow.drawMap([vm.property.locationPoint], M + 8, bottom + 55, locationWidth - 16, heightLeft - 78, 'propertyLocationMap');
      flow.drawText(copy.noMap, M + 10, BOTTOM - 16, locationWidth - 20, 'propertyLocationMap', 6.5, false, MUTED, BOTTOM);
    }
    if (vm.property.notes.length) {
      const notesX = M + locationWidth + 6, notesWidth = CONTENT - locationWidth - 6;
      flow.panel(notesX, bottom, notesWidth, heightLeft);
      flow.drawText(copy.notes, notesX + 10, bottom + 11, notesWidth - 20, 'propertyNotes', 10.5, true, flow.accent);
      const lines = flow.lines(vm.property.notes.join('\n'), notesWidth - 20, 9);
      const capacity = Math.max(0, Math.floor((heightLeft - 48) / 13));
      flow.drawLines(lines.slice(0, capacity), notesX + 10, bottom + 35, notesWidth - 20, 'propertyNotes', 9);
      flow.y = BOTTOM;
      if (capacity < lines.length) flow.section({ id: 'propertyNotes', title: copy.notes, kind: 'narrative', text: lines.slice(capacity).join(' '), continuationStart: true });
    }
  } else {
    if (vm.property.locationPoint) flow.section({ id: 'propertyLocationMap', title: copy.location, kind: 'map', map: { points: [vm.property.locationPoint], caption: copy.noMap } });
    if (vm.property.notes.length) flow.section({ id: 'propertyNotes', title: copy.notes, kind: 'narrative', text: vm.property.notes.join('\n') });
  }
}

interface StrictDrawOptions {
  preparedMaps?: Record<string, string | null>;
  doc: jsPDF; viewModel: ReportViewModel; logo: string; generatedAt: string; locationMapData?: string | null; yieldRendering?: () => Promise<void>;
}

async function enterprisePages(flow: StrictPdfFlow, vm: ReportViewModel, map: string | null, yieldRendering: () => Promise<void>) {
  const t = (pt: string, en: string, es: string) => vm.locale === 'pt' ? pt : vm.locale === 'es' ? es : en;
  const groups = [
    { title: t('Imóvel e parcela', 'Property and parcel', 'Inmueble y parcela'), ids: (id: string) => id.startsWith('property-facts-') },
    { title: t('Inteligência de mercado', 'Market intelligence', 'Inteligencia de mercado'), ids: (id: string) => /^(arv-market|sold-reference|market-rent|provider-reference|value-readiness|price-positioning|rent-readiness|land-market-readiness|parcel-area-comparison)$/.test(id) },
    { title: t('Estratégia e prontidão financeira', 'Strategy and financial readiness', 'Estrategia y preparación financiera'), ids: (id: string) => /^(land|scenario|saved|operating|condition|financial|strategy|property-tax)/.test(id) },
    { title: t('Riscos, oportunidades e perfil', 'Risks, opportunities and profile', 'Riesgos, oportunidades y perfil'), ids: (id: string) => /^(positive-signals|decision-blockers|profile-fit|profile-readiness|opportunity-readiness)$/.test(id) },
    { title: t('Plano de decisão e evidências', 'Decision plan and evidence', 'Plan de decisión y evidencia'), ids: () => true },
  ];
  const remaining = new Map(vm.sections.map(s => [s.id, s]));
  const note = remaining.get('publisher-notes'); remaining.delete('publisher-notes');
  // Contacts belong with evidence, not among the analytical property tables.
  const contacts = [...remaining.values()].filter(s => s.rows?.some(row => /contact|contato|publicador|publisher|email/i.test(row.label)));
  contacts.forEach(s => remaining.delete(s.id));
  for (const [index, group] of groups.entries()) {
    const selected = [...remaining.values()].filter(s => group.ids(s.id));
    flow.newPage(group.title, `ANALYSIS_${index + 2}`);
    if (index === 0 && vm.property.locationPoint) {
      flow.drawText(vm.property.address, M + 12, flow.y + 2, CONTENT - 24, 'parcelLocation', 12, true);
      flow.y += 28;
      if (!map || !flow.image(map, M + 12, flow.y, CONTENT - 24, 180)) flow.drawMap([vm.property.locationPoint], M + 12, flow.y, CONTENT - 24, 180, 'parcelLocation');
      flow.y += 188;
      flow.y = flow.drawText(`${map ? '© OpenStreetMap contributors · ' : ''}${COPY[vm.locale].noMap}`, M + 12, flow.y, CONTENT - 24, 'parcelLocation', 7.5, false, MUTED) + 14;
    }
    for (const section of selected) { flow.section(safeSection(section)); remaining.delete(section.id); }
    if (!selected.length) flow.section({ id: `gap${index}`, title: group.title, kind: 'narrative', tone: 'warning',
      text: t('Evidências insuficientes para concluir este tema. Confirme os dados do imóvel e as fontes aplicáveis antes de decidir.', 'Insufficient evidence to conclude this topic. Confirm property inputs and applicable sources before deciding.', 'Evidencia insuficiente para concluir este tema. Confirme los datos y las fuentes aplicables antes de decidir.') });
    if (index === 4) {
      if (vm.executive) flow.section({ id: 'finalEvidence', title: COPY[vm.locale].coverage, kind: 'facts', rows: vm.executive.coverage });
      contacts.forEach(section => flow.section(safeSection(section)));
      if (note) {
        const excerpt = (note.items || []).map(item => item.text.length > 420 ? `${item.text.slice(0, 417)}…` : item.text);
        flow.section({ id: note.id, title: note.title, kind: 'narrative', items: excerpt, bodySize: 9 });
      }
    }
    await yieldRendering();
  }
  const longNotes = note?.items?.filter(item => item.text.length > 420) || [];
  if (longNotes.length && note) {
    flow.newPage(note.title, 'PUBLISHER_NOTES');
    flow.section({ id: 'publisherNotesAppendix', title: note.title, kind: 'narrative', items: longNotes.map(item => item.text), bodySize: 9 });
  }
}

async function drawReportBody({ doc, viewModel, logo, generatedAt, locationMapData = null, preparedMaps, yieldRendering = async () => {} }: StrictDrawOptions, plan: FlowPlan = {}) {
  const copy = COPY[viewModel.locale];
  const flow = new StrictPdfFlow(doc, { ...viewModel.header, reportType: viewModel.reportType, locale: viewModel.locale,
    generatedAt, generated: copy.generated, page: copy.page, continuation: copy.continuation }, logo, { ...plan, preparedMaps });
  flow.newPage(viewModel.reportType === 'PROPERTY_RELEASE' ? copy.overview : copy.executive, 'PROPERTY_OVERVIEW');
  propertyHero(flow, viewModel);
  if (viewModel.reportType === 'PROPERTY_RELEASE') {
    propertyRelease(flow, viewModel, locationMapData);
  } else {
    const snapshotClaims = new Set<string>();
    if (viewModel.executive) {
      const executive = viewModel.executive;
      flow.section({ id: 'executiveSnapshot', title: copy.executive, kind: 'narrative', text: executive.thesis.text,
        rows: [{ label: copy.status, value: executive.status }], tone: 'accent', compact: true });
      if (executive.coverage.length) {
        const descriptor: SafePdfSection = { id: 'evidenceCoverage', title: copy.coverage, kind: 'facts' };
        const width = (CONTENT - (executive.coverage.length - 1) * 6) / executive.coverage.length;
        const tileHeight = Math.max(44, ...executive.coverage.map(row => 31 + flow.lines(row.label, width - 18, 6.9).length * 10.9));
        flow.ensure(tileHeight + 17, descriptor, false);
        executive.coverage.forEach((row, index) => {
          const x = M + index * (width + 6);
          flow.panel(x, flow.y, width, tileHeight);
          flow.drawText(row.value, x + 9, flow.y + 7, width - 18, descriptor.id, 13, true, flow.accent);
          flow.drawText(row.label, x + 9, flow.y + 25, width - 18, descriptor.id, 6.9, false, MUTED, flow.y + tileHeight);
        });
        flow.y += tileHeight + 13;
      }
      const decisions = [
        executive.opportunity ? { label: copy.opportunity, value: executive.opportunity.text } : null,
        executive.risk ? { label: copy.risk, value: executive.risk.text } : null,
        executive.blocker ? { label: copy.blocker, value: executive.blocker.text } : null,
      ].filter(row => row !== null);
      decisions.forEach(row => snapshotClaims.add(row.value));
      if (decisions.length) flow.section({ id: 'executiveDecisions', title: copy.blocker, kind: 'facts', rows: decisions, tone: 'warning' });
    }
    if (viewModel.reportType === 'DEAL_INTELLIGENCE') {
      await enterprisePages(flow, viewModel, locationMapData, yieldRendering);
    } else for (const section of viewModel.sections) {
      const projected = safeSection(section);
      if (projected.items) projected.items = projected.items.filter(text => !snapshotClaims.has(text));
      const useful = projected.text || projected.items?.length || projected.rows?.length || projected.table?.length || projected.map?.points.length || projected.hero;
      if (useful) flow.section(projected);
      await yieldRendering();
    }
    if (viewModel.disclaimer) flow.section({ id: 'reportDisclaimer', title: copy.disclaimer, kind: 'narrative', text: viewModel.disclaimer, tone: 'neutral', compact: true, bodySize: 9 });
  }
  return flow.finish();
}

/** Font metrics and layout only: no drawing operators, media, binary, page allocation or network. */
function measurementDocument(doc: jsPDF): jsPDF {
  let currentPage = 1, pageCount = 1;
  const silent = new Set<PropertyKey>(['addImage', 'text', 'rect', 'roundedRect', 'line', 'circle', 'triangle', 'setDrawColor', 'setFillColor', 'setTextColor', 'setLineWidth', 'saveGraphicsState', 'restoreGraphicsState', 'clip', 'discardPath']);
  const proxy = new Proxy(doc, {
    get(target, key) {
      if (key === 'addPage') return () => { currentPage = ++pageCount; return proxy; };
      if (key === 'setPage') return (page: number) => { currentPage = page; return proxy; };
      if (key === 'getCurrentPageInfo') return () => ({ ...target.getCurrentPageInfo(), pageNumber: currentPage });
      if (key === 'getNumberOfPages') return () => pageCount;
      if (silent.has(key)) return () => proxy;
      const value = Reflect.get(target, key);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return proxy;
}

function contentDensity(layout: Awaited<ReturnType<typeof drawReportBody>>) {
  const body = layout.layoutAudit.lines.filter(line => !/^(?:header|footer)/.test(line.sectionId));
  const pages = Array.from({ length: layout.pageCount }, (_, index) => {
    const page = index + 1, own = body.filter(line => line.page === page);
    const maps = layout.layoutAudit.maps.filter(map => map.page === page);
    const bottom = Math.max(110, ...own.map(line => line.bottomY), ...maps.map(map => map.bounds.bottom));
    return { page, depth: bottom - 110, hasMap: maps.length > 0 };
  });
  const sparse = pages.filter(page => page.page > 1 && !page.hasMap && page.depth < 344);
  const mean = pages.reduce((sum, page) => sum + page.depth, 0) / pages.length;
  const variance = pages.reduce((sum, page) => sum + (page.depth - mean) ** 2, 0);
  return { sparse, score: sparse.length * 1_000_000_000 + layout.pageCount * 1_000_000 + variance };
}

/** The only production PDF body entrypoint accepts the strict display model. */
export async function drawStrictReportPdf(options: StrictDrawOptions) {
  if (options.viewModel.reportType !== 'PROPERTY_RELEASE') {
    const copy = COPY[options.viewModel.locale];
    const flow = new StrictPdfFlow(options.doc, { ...options.viewModel.header, reportType: options.viewModel.reportType, locale: options.viewModel.locale,
      generatedAt: options.generatedAt, generated: copy.generated, page: copy.page, continuation: copy.continuation }, options.logo, { referenceLayout: true });
    const composition = new ReferenceReportComposition(flow, options.viewModel, options.preparedMaps || {}, options.locationMapData || null);
    const drawn = await composition.draw(options.yieldRendering || (async () => {}));
    return { ...drawn, layoutPlan: { preflightPasses: 0, forcedBreakBefore: [], mediaRequests: 0, fontSizeReduction: false, composition: 'APPROVED_REFERENCE_PAGES' } };
  }
  const drawn = await drawReportBody(options);
  return { ...drawn, layoutPlan: { preflightPasses: 0, forcedBreakBefore: [], mediaRequests: 0, fontSizeReduction: false } };
}
