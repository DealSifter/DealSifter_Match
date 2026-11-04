import { evidenceAbsenceCopy } from '../../../../supabase/functions/_shared/maxxis/evidenceAbsence';
import type { StrictPdfFlow, SafePdfSection } from './strictReportPdf';
import type { ReportViewModel, ReportSection, ReportRow } from './reportIntegrityTypes';
import { REFERENCE_DESIGN } from './reportReferenceDesign';
type Color = [number, number, number];
type Box = {
  x: number;
  y: number;
  w: number;
  h: number;
};
const INK: Color = [12, 28, 65],
  BODY: Color = [44, 70, 108],
  LINE: Color = [219, 233, 240];
const WHITE: Color = [255, 255, 255],
  DARK: Color = [39, 49, 57],
  GOLD: Color = [231, 167, 0];
const X = 26,
  GAP = 7,
  WIDTH = 543.28,
  HALF = (WIDTH - GAP) / 2;
const CONTENT_TOP = 86,
  ANALYSIS_TOP = CONTENT_TOP;
export function reportCategoryAccent(reportType: string): Color {
  return reportType === 'DEAL_INTELLIGENCE' ? [...GOLD] : reportType === 'MAXXIS_ANALYSIS' ? [0, 145, 95] : [25, 179, 184];
}

/** Page composition follows the approved nine reference pages. Inputs remain display-only. */
export class ReportBrandShell {
  readonly enterprise: boolean;
  readonly accent: Color;
  readonly seen = new Set<string>();
  readonly deferred: {
    id: string;
    title: string;
    text: string;
    covered?: string[];
  }[] = [];
  private nextHeading?: {
    subtitle: string;
    icon: string;
  };
  private brandImage?: {
    width: number;
    height: number;
    fileType: string;
  };
  constructor(readonly flow: StrictPdfFlow, readonly vm: ReportViewModel, readonly maps: Record<string, string | null>, readonly location: string | null) {
    this.enterprise = vm.reportType === 'DEAL_INTELLIGENCE';
    this.accent = reportCategoryAccent(vm.reportType);
    this.flow.referenceHeader = title => this.shell(title === '…' ? this.t('Evidências · continuação', 'Evidence · continued', 'Evidencia · continuación') : title, this.nextHeading?.subtitle || this.t('Detalhamento das evidências', 'Evidence detail', 'Detalle de evidencia'), this.nextHeading?.icon || 'document');
  }
  t(pt: string, en: string, es: string) {
    return this.vm.locale === 'pt' ? pt : this.vm.locale === 'es' ? es : en;
  }
  get d() {
    return this.flow.doc;
  }
  get missing() {
    return this.t('Não disponível', 'Unavailable', 'No disponible');
  }
  section(id: string) {
    return this.vm.sections.find(s => s.id === id);
  }
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
    const d = this.d,
      k = size / 24;
    d.saveGraphicsState();
    d.setFillColor(...color);
    d.setDrawColor(...color);
    d.setLineWidth(2 * k);
    const line = (a: number, b: number, c: number, e: number) => d.line(x + a * k, y + b * k, x + c * k, y + e * k);
    if (name === 'home') {
      d.triangle(x + 12 * k, y, x, y + 11 * k, x + 24 * k, y + 11 * k, 'F');
      d.rect(x + 4 * k, y + 10 * k, 16 * k, 13 * k, 'F');
      d.setFillColor(...WHITE);
      d.rect(x + 10 * k, y + 15 * k, 5 * k, 8 * k, 'F');
    } else if (name === 'pin') {
      d.circle(x + 12 * k, y + 8 * k, 7 * k, 'F');
      d.triangle(x + 5 * k, y + 9 * k, x + 19 * k, y + 9 * k, x + 12 * k, y + 23 * k, 'F');
      d.setFillColor(...WHITE);
      d.circle(x + 12 * k, y + 8 * k, 2.5 * k, 'F');
    } else if (name === 'user') {
      d.circle(x + 12 * k, y + 6 * k, 5 * k, 'F');
      d.ellipse(x + 12 * k, y + 19 * k, 9 * k, 6 * k, 'F');
    } else if (name === 'check' || name === 'warning' || name === 'number' || name === 'info') {
      if (name === 'warning') d.triangle(x + 12 * k, y, x, y + 23 * k, x + 24 * k, y + 23 * k, 'F');else d.circle(x + 12 * k, y + 12 * k, 11 * k, 'F');
      d.setDrawColor(...WHITE);
      d.setLineWidth(2 * k);
      if (name === 'check') {
        line(6, 12, 10, 16);
        line(10, 16, 18, 7);
      } else if (name === 'warning') {
        line(12, 7, 12, 14);
        d.setFillColor(...WHITE);
        d.circle(x + 12 * k, y + 18 * k, k, 'F');
      } else if (name === 'info') {
        line(12, 10, 12, 18);
        d.setFillColor(...WHITE);
        d.circle(x + 12 * k, y + 6 * k, k, 'F');
      }
    } else if (name === 'question') {
      d.circle(x + 12 * k, y + 12 * k, 11 * k, 'F');
      d.setDrawColor(...WHITE);
      d.setLineWidth(1.7 * k);
      line(7, 7, 9, 4);
      line(9, 4, 15, 4);
      line(15, 4, 17, 7);
      line(17, 7, 16, 10);
      line(16, 10, 12, 13);
      line(12, 13, 12, 15);
      d.setFillColor(...WHITE);
      d.circle(x + 12 * k, y + 19 * k, k, 'F');
    } else if (name === 'tag') {
      d.lines([[10 * k, 0], [10 * k, 11 * k], [-10 * k, 10 * k], [-11 * k, -11 * k], [0, -9 * k]], x + 3 * k, y + 2 * k, [1, 1], 'F', true);
      d.setFillColor(...WHITE);
      d.circle(x + 7 * k, y + 7 * k, 2 * k, 'F');
    } else if (name === 'list') {
      for (let row = 0; row < 3; row++) {
        d.circle(x + 3 * k, y + (4 + 8 * row) * k, 2.3 * k, 'F');
        d.roundedRect(x + 8 * k, y + (2 + 8 * row) * k, 16 * k, 4 * k, k, k, 'F');
      }
    } else if (name === 'brain') {
      // Scalloped cerebral lobes and curved folds, drawn as native PDF vectors.
      // A clear central fissure separates the hemispheres at small print sizes.
      const lobe = [[11.2, 3.6], [11.2, .4, 6.5, .1, 5.7, 3.4], [2.8, 3.2, 1.4, 6.1, 2.8, 8.3], [.2, 9.5, .2, 13.3, 2.4, 14.8], [.7, 17.4, 2.2, 20.2, 4.8, 20.5], [5.5, 24, 11.2, 23.6, 11.2, 20.1]];
      const folds = [[[5.7, 3.4], [5.1, 5.4, 6.5, 7.2, 8.5, 7.3]], [[2.8, 8.3], [5.3, 7.9, 6.8, 9.5, 6.6, 11.6]], [[2.4, 14.8], [4.4, 13.6, 5.8, 14.7, 6.1, 16.3]], [[4.8, 20.5], [4.4, 18.5, 5.8, 17.2, 7.7, 17.6]]];
      for (const mirror of [false, true]) {
        const point = (values: number[]) => values.map((value, index) => index % 2 ? y + value * k : x + (mirror ? 24 - value : value) * k);
        d.path([{
          op: 'm',
          c: point(lobe[0])
        }, ...lobe.slice(1).map(c => ({
          op: 'c',
          c: point(c)
        })), {
          op: 'h',
          c: []
        }]).fill();
        d.setDrawColor(...WHITE);
        d.setLineWidth(1.15 * k);
        d.setLineCap('round');
        for (const [start, curve] of folds) d.path([{
          op: 'm',
          c: point(start)
        }, {
          op: 'c',
          c: point(curve)
        }]).stroke();
      }
    } else if (name === 'calculator') {
      d.roundedRect(x + 3 * k, y, 18 * k, 24 * k, 2 * k, 2 * k, 'F');
      d.setFillColor(...WHITE);
      d.rect(x + 6 * k, y + 4 * k, 12 * k, 4 * k, 'F');
      for (let row = 0; row < 3; row++) for (let column = 0; column < 3; column++) d.rect(x + (6 + 4 * column) * k, y + (11 + 4 * row) * k, 2 * k, 2 * k, 'F');
    } else if (name === 'chart') {
      d.rect(x + 2 * k, y + 14 * k, 5 * k, 9 * k, 'F');
      d.rect(x + 10 * k, y + 7 * k, 5 * k, 16 * k, 'F');
      d.rect(x + 18 * k, y, 5 * k, 23 * k, 'F');
    } else if (name === 'gear') {
      const points: [number, number][] = [];
      for (let i = 0; i < 40; i++) {
        const angle = i * Math.PI / 20,
          radius = i % 5 === 0 || i % 5 === 4 ? 12 : 9.5;
        points.push([12 + Math.cos(angle) * radius, 12 + Math.sin(angle) * radius]);
      }
      d.lines(points.slice(1).map((point, index) => [(point[0] - points[index][0]) * k, (point[1] - points[index][1]) * k]), x + points[0][0] * k, y + points[0][1] * k, [1, 1], 'F', true);
      d.setFillColor(...WHITE);
      d.circle(x + 12 * k, y + 12 * k, 5 * k, 'F');
    } else if (name === 'scales') {
      line(12, 1, 12, 22);
      line(3, 5, 21, 5);
      line(5, 22, 19, 22);
      line(5, 5, 1, 15);
      line(5, 5, 9, 15);
      line(19, 5, 15, 15);
      line(19, 5, 23, 15);
      d.ellipse(x + 5 * k, y + 15 * k, 4 * k, 2 * k, 'F');
      d.ellipse(x + 19 * k, y + 15 * k, 4 * k, 2 * k, 'F');
    } else if (name === 'photos') {
      d.roundedRect(x, y, 24 * k, 22 * k, 2 * k, 2 * k, 'F');
      d.setFillColor(...WHITE);
      d.circle(x + 7 * k, y + 6 * k, 2.5 * k, 'F');
      d.triangle(x + 2 * k, y + 19 * k, x + 10 * k, y + 10 * k, x + 16 * k, y + 19 * k, 'F');
      d.triangle(x + 10 * k, y + 19 * k, x + 17 * k, y + 8 * k, x + 23 * k, y + 19 * k, 'F');
    } else if (name === 'target' || name === 'pie') {
      d.circle(x + 12 * k, y + 12 * k, 10 * k, 'S');
      d.circle(x + 12 * k, y + 12 * k, 5 * k, 'S');
      if (name === 'target') {
        line(12, 0, 12, 5);
        line(12, 19, 12, 24);
        line(0, 12, 5, 12);
        line(19, 12, 24, 12);
      } else {
        line(12, 2, 12, 12);
        line(12, 12, 22, 12);
      }
    } else if (name === 'bed') {
      line(1, 5, 1, 22);
      line(23, 10, 23, 22);
      line(1, 17, 23, 17);
      d.roundedRect(x + 4 * k, y + 10 * k, 18 * k, 5 * k, k, k, 'F');
      d.circle(x + 6 * k, y + 6 * k, 3 * k, 'F');
    } else if (name === 'bath') {
      d.roundedRect(x + 2 * k, y + 11 * k, 20 * k, 9 * k, 3 * k, 3 * k, 'F');
      line(6, 20, 5, 24);
      line(18, 20, 19, 24);
      line(17, 11, 17, 3);
      line(17, 3, 12, 3);
    } else if (name === 'area') {
      d.rect(x + 2 * k, y + 2 * k, 20 * k, 20 * k, 'S');
      line(6, 18, 18, 6);
      line(6, 12, 6, 18);
      line(6, 18, 12, 18);
      line(12, 6, 18, 6);
      line(18, 6, 18, 12);
    } else {
      d.roundedRect(x + 3 * k, y + k, 18 * k, 22 * k, 2 * k, 2 * k, 'F');
      d.setDrawColor(...WHITE);
      line(7, 8, 17, 8);
      line(7, 12, 17, 12);
      line(7, 16, 15, 16);
    }
    d.restoreGraphicsState();
  }
  brand(x: number, centerY: number, width = REFERENCE_DESIGN.brand.width) {
    const properties = this.brandImage ||= this.flow.images.properties(this.flow.logo),
      original = REFERENCE_DESIGN.brand.source,
      source = { x: original.x * properties.width / 4791, y: original.y * properties.height / 1193,
        width: original.width * properties.width / 4791, height: original.height * properties.height / 1193 },
      scale = width / source.width,
      top = centerY - source.height * scale / 2;
    // Preserve the original brand's visible crop and proportions at any raster density.
    this.flow.images.add(this.flow.logo, x - source.x * scale, top - source.y * scale, properties.width * scale, properties.height * scale, 'official-dealsifter-logo');
  }
  page(title: string, subtitle: string, icon = 'home') {
    const f = this.flow;
    this.nextHeading = {
      subtitle,
      icon
    };
    f.newPage(title, `REFERENCE_${f.pages.length + 1}`);
    this.nextHeading = undefined;
  }
  shell(title: string, subtitle: string, icon = 'home') {
    const masthead = REFERENCE_DESIGN.masthead;
    this.d.setFillColor(...WHITE);
    this.d.rect(0, 0, 595.28, 841.89, 'F');
    this.d.setFillColor(...DARK);
    this.d.rect(masthead.x, masthead.y, masthead.width, masthead.height, 'F');
    const brand = REFERENCE_DESIGN.brand,
      brandHeight = brand.width * brand.source.height / brand.source.width;
    this.brand(brand.x, brand.y + brandHeight / 2, brand.width);
    const centered = (value: string, x: number, y: number, width: number, id: string, size: number, bold: boolean, color: Color) => {
      this.d.setFont('NotoSans', bold ? 'bold' : 'normal');
      this.d.setFontSize(size);
      const actual = Math.min(width, this.d.getTextWidth(value));
      this.flow.drawDisplayLine(value, x + (width - actual) / 2, y, actual + .01, id, size, bold, color, 80);
    };
    centered('Real Data. Smarter Decisions.', brand.x, brand.taglineY, brand.width, 'headerTagline', brand.taglineSize, false, this.accent);
    const product = this.vm.header.product.toLowerCase().replace(/(^|\s)\p{L}/gu, letter => letter.toUpperCase());
    centered(product, 185, 25, 299, 'headerProduct', 12, true, WHITE);
    centered(this.t('Análise inteligente do imóvel', 'Intelligent property analysis', 'Análisis inteligente del inmueble'), 185, 49, 299, 'headerSubtitle', 9, false, WHITE);
    this.d.setFillColor(...this.accent);
    this.d.roundedRect(502, 17, 64, 26, 4, 4, 'F');
    centered(this.enterprise ? 'ENTERPRISE' : this.vm.reportType === 'MAXXIS_ANALYSIS' ? 'PRO' : 'Basic', 506, 25, 56, 'headerPlan', 8, true, this.enterprise ? INK : WHITE);
    const state = this.vm.completion || 'PARTIAL',
      label = state === 'COMPLETE' ? this.t('Completo', 'Complete', 'Completo') : state === 'PRELIMINARY' ? this.t('Preliminar', 'Preliminary', 'Preliminar') : this.t('Parcial', 'Partial', 'Parcial');
    this.d.setFillColor(...(this.accent.map(channel => Math.round(255 * .9 + channel * .1)) as Color));
    this.d.roundedRect(502, 52, 64, 14, 3, 3, 'F');
    centered(label, 506, 54, 56, 'headerCompleteness', 7, true, INK);
    this.flow.y = 140;
  }
}
