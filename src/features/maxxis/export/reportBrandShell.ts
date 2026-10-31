import { evidenceAbsenceCopy } from '../../../../supabase/functions/_shared/maxxis/evidenceAbsence';
import type { StrictPdfFlow, SafePdfSection } from './strictReportPdf';
import type { ReportViewModel, ReportSection, ReportRow } from './reportIntegrityTypes';

type Color = [number, number, number];
type Box = { x: number; y: number; w: number; h: number };
const INK: Color = [12, 28, 65], BODY: Color = [44, 70, 108], LINE: Color = [219, 233, 240];
const WHITE: Color = [255, 255, 255], DARK: Color = [39, 49, 57], GOLD: Color = [231, 167, 0];
const X = 26, GAP = 7, WIDTH = 543.28, HALF = (WIDTH - GAP) / 2;
const CONTENT_TOP = 130, ANALYSIS_TOP = CONTENT_TOP;

export function reportCategoryAccent(reportType: string): Color {
  return reportType === 'DEAL_INTELLIGENCE' ? [...GOLD] : reportType === 'MAXXIS_ANALYSIS' ? [0, 145, 95] : [25, 179, 184];
}

/** Page composition follows the approved nine reference pages. Inputs remain display-only. */
export class ReportBrandShell {
  readonly enterprise: boolean;
  readonly accent: Color;
  readonly seen = new Set<string>();
  readonly deferred: { id: string; title: string; text: string; covered?: string[] }[] = [];
  private nextHeading?: { subtitle: string; icon: string };
  constructor(readonly flow: StrictPdfFlow, readonly vm: ReportViewModel, readonly maps: Record<string, string | null>, readonly location: string | null) {
    this.enterprise = vm.reportType === 'DEAL_INTELLIGENCE';
    this.accent = reportCategoryAccent(vm.reportType);
    this.flow.referenceHeader = title => this.shell(title === '…' ? this.t('Evidências · continuação', 'Evidence · continued', 'Evidencia · continuación') : title, this.nextHeading?.subtitle || this.t('Detalhamento das evidências', 'Evidence detail', 'Detalle de evidencia'), this.nextHeading?.icon || 'document');
  }
  t(pt: string, en: string, es: string) { return this.vm.locale === 'pt' ? pt : this.vm.locale === 'es' ? es : en; }
  get d() { return this.flow.doc; }
  get missing() { return this.t('Não disponível', 'Unavailable', 'No disponible'); }
  section(id: string) { return this.vm.sections.find(s => s.id === id); }
  texts(id: string) {
    const s = this.section(id);
    return s?.items?.map(item => item.text) || (s?.text ? [s.text] : []);
  }
  text(value: string, b: Box, id: string, size = 10, bold = false, color: Color = BODY) {
    const height = this.flow.lines(value, b.w, size, bold).length * (size + 4);
    if (height > b.h + .1) throw Error('REPORT_HEADER_TEXT_EXCEEDS_BOUNDS:' + id);
    return this.flow.drawText(value, b.x, b.y, b.w, id, size, bold, color, b.y + b.h);
  }

  icon(name: string, x: number, y: number, size = 22, color: Color = DARK) {
    const d = this.d, k = size / 24;
    d.saveGraphicsState(); d.setFillColor(...color); d.setDrawColor(...color); d.setLineWidth(2 * k);
    const line = (a: number, b: number, c: number, e: number) => d.line(x + a * k, y + b * k, x + c * k, y + e * k);
    if (name === 'home') {
      d.triangle(x + 12 * k, y, x, y + 11 * k, x + 24 * k, y + 11 * k, 'F');
      d.rect(x + 4 * k, y + 10 * k, 16 * k, 13 * k, 'F'); d.setFillColor(...WHITE); d.rect(x + 10 * k, y + 15 * k, 5 * k, 8 * k, 'F');
    } else if (name === 'pin') {
      d.circle(x + 12 * k, y + 8 * k, 7 * k, 'F'); d.triangle(x + 5 * k, y + 9 * k, x + 19 * k, y + 9 * k, x + 12 * k, y + 23 * k, 'F');
      d.setFillColor(...WHITE); d.circle(x + 12 * k, y + 8 * k, 2.5 * k, 'F');
    } else if (name === 'user') {
      d.circle(x + 12 * k, y + 6 * k, 5 * k, 'F'); d.ellipse(x + 12 * k, y + 19 * k, 9 * k, 6 * k, 'F');
    } else if (name === 'check' || name === 'warning' || name === 'number' || name === 'info') {
      if (name === 'warning') d.triangle(x + 12 * k, y, x, y + 23 * k, x + 24 * k, y + 23 * k, 'F');
      else d.circle(x + 12 * k, y + 12 * k, 11 * k, 'F');
      d.setDrawColor(...WHITE); d.setLineWidth(2 * k);
      if (name === 'check') { line(6, 12, 10, 16); line(10, 16, 18, 7); }
      else if (name === 'warning') { line(12, 7, 12, 14); d.setFillColor(...WHITE); d.circle(x + 12 * k, y + 18 * k, k, 'F'); }
      else if (name === 'info') { line(12, 10, 12, 18); d.setFillColor(...WHITE); d.circle(x + 12 * k, y + 6 * k, k, 'F'); }
    } else if (name === 'chart') {
      d.rect(x + 2 * k, y + 14 * k, 5 * k, 9 * k, 'F'); d.rect(x + 10 * k, y + 7 * k, 5 * k, 16 * k, 'F'); d.rect(x + 18 * k, y, 5 * k, 23 * k, 'F');
    } else if (name === 'target' || name === 'pie') {
      d.circle(x + 12 * k, y + 12 * k, 10 * k, 'S'); d.circle(x + 12 * k, y + 12 * k, 5 * k, 'S');
      if (name === 'target') { line(12, 0, 12, 5); line(12, 19, 12, 24); line(0, 12, 5, 12); line(19, 12, 24, 12); }
      else { line(12, 2, 12, 12); line(12, 12, 22, 12); }
    } else if (name === 'bed') {
      line(1, 5, 1, 22); line(23, 10, 23, 22); line(1, 17, 23, 17); d.roundedRect(x + 4 * k, y + 10 * k, 18 * k, 5 * k, k, k, 'F'); d.circle(x + 6 * k, y + 6 * k, 3 * k, 'F');
    } else if (name === 'bath') {
      d.roundedRect(x + 2 * k, y + 11 * k, 20 * k, 9 * k, 3 * k, 3 * k, 'F'); line(6, 20, 5, 24); line(18, 20, 19, 24); line(17, 11, 17, 3); line(17, 3, 12, 3);
    } else if (name === 'area') {
      d.rect(x + 2 * k, y + 2 * k, 20 * k, 20 * k, 'S'); line(6, 18, 18, 6); line(6, 12, 6, 18); line(6, 18, 12, 18); line(12, 6, 18, 6); line(18, 6, 18, 12);
    } else {
      d.roundedRect(x + 3 * k, y + k, 18 * k, 22 * k, 2 * k, 2 * k, 'F'); d.setDrawColor(...WHITE);
      line(7, 8, 17, 8); line(7, 12, 17, 12); line(7, 16, 15, 16);
    }
    d.restoreGraphicsState();
  }
  brand(x: number, centerY: number) {
    const properties = this.d.getImageProperties(this.flow.logo);
    const width = 205 * .7, height = width * properties.height / properties.width;
    this.d.addImage(this.flow.logo, properties.fileType || 'PNG', x, centerY - height / 2, width, height, 'official-dealsifter-logo');
  }
  page(title: string, subtitle: string, icon = 'home') {
    const f = this.flow;
    this.nextHeading = { subtitle, icon };
    f.newPage(title, `REFERENCE_${f.pages.length + 1}`);
    this.nextHeading = undefined;
  }
  shell(title: string, subtitle: string, icon = 'home') {
    // Keep the approved identity; recover space from chrome, not maps or charts.
    this.d.setFillColor(...WHITE); this.d.rect(0, 0, 595.28, 841.89, 'F');
    this.d.setFillColor(...DARK);
    this.d.roundedRect(14, 9, 567.28, 66, 10, 10, 'F');
    this.brand(34, 9 + 66 / 2);
    this.text(this.enterprise ? 'Maxxis Deal Intelligence Report' : this.vm.reportType === 'MAXXIS_ANALYSIS' ? 'Maxxis Analysis Report' : this.vm.header.product, { x: 220, y: 24, w: 264, h: 20 }, 'headerProduct', 9, true, WHITE);
    this.text(this.t('Análise inteligente do imóvel', 'Intelligent property analysis', 'Análisis inteligente del inmueble'), { x: 220, y: 47, w: 264, h: 16 }, 'headerSubtitle', 7.5, false, WHITE);
    this.d.setFillColor(...this.accent);
    this.d.roundedRect(494, 23, 70, 25, 4, 4, 'F');
    this.text(this.enterprise ? 'ENTERPRISE' : this.vm.reportType === 'MAXXIS_ANALYSIS' ? 'PRO' : 'Basic', { x: 500, y: 29, w: 60, h: 16 }, 'headerPlan', this.enterprise ? 8 : 9, true, this.enterprise ? INK : WHITE);
    this.d.setFillColor(...WHITE); this.d.roundedRect(14, 70, 567.28, 54, 10, 10, 'F');
    this.icon(icon, X + 3, 85, 23, this.accent);
    this.text(title, { x: X + 35, y: 84, w: WIDTH - 158, h: 24 }, 'headerPageTitle', 16, true, INK);
    this.text(subtitle, { x: X + 35, y: 107, w: WIDTH - 35, h: 18 }, 'headerPageSubtitle', 9, false, BODY);
    const state = this.vm.completion || 'PARTIAL';
    const label = state === 'COMPLETE' ? this.t('Completo', 'Complete', 'Completo') : state === 'PRELIMINARY' ? this.t('Preliminar', 'Preliminary', 'Preliminar') : this.t('Parcial', 'Partial', 'Parcial');
    this.d.setFillColor(255, 247, 224); this.d.roundedRect(456, 84, 108, 23, 5, 5, 'F');
    this.text(label, { x: 466, y: 90, w: 90, h: 16 }, 'headerCompleteness', 9, true, INK);
    this.flow.y = CONTENT_TOP;
  }
}
