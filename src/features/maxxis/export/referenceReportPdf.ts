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
export class ReferenceReportComposition {
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
    // Fixed grids never squeeze type or silently discard long evidence. Continuations are explicit.
    const lines = this.flow.lines(value, b.w, size, bold), capacity = Math.max(0, Math.floor(b.h / (size + 4)));
    const clipped = lines.length > capacity;
    if (clipped) this.deferred.push({ id, title: this.section(id)?.title || this.t('Detalhamento', 'Detail', 'Detalle'), text: value });
    const visible = lines.slice(0, capacity);
    if (clipped && visible.length) visible[visible.length - 1] = '…';
    this.flow.drawLines(visible, b.x, b.y, b.w, id, size, bold, color, b.y + b.h);
    return b.y + visible.length * (size + 4);
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
    this.text(title, { x: X + 35, y: 84, w: WIDTH - 35, h: 24 }, 'headerPageTitle', 16, true, INK);
    this.text(subtitle, { x: X + 35, y: 107, w: WIDTH - 35, h: 18 }, 'headerPageSubtitle', 9, false, BODY);
    this.flow.y = CONTENT_TOP;
  }
  panel(b: Box, title: string, icon = 'document', tone: 'neutral' | 'warning' | 'positive' = 'neutral', id = title, padding = 10) {
    const fill: Color = tone === 'warning' ? [255, 251, 239] : tone === 'positive' ? [242, 251, 248] : [249, 252, 254];
    this.d.setFillColor(...fill); this.d.setDrawColor(...(tone === 'warning' ? [248, 225, 166] as Color : LINE)); this.d.setLineWidth(.65);
    this.d.roundedRect(b.x, b.y, b.w, b.h, 7, 7, 'FD');
    const headingHeight = 16 + Math.min(2, this.flow.lines(title, b.w - 41, 10, true).length) * 14;
    this.icon(icon, b.x + 9, b.y + 10, 16, tone === 'warning' ? GOLD : this.accent);
    this.text(title, { x: b.x + 32, y: b.y + 10, w: b.w - 41, h: headingHeight - 12 }, id, 10, true, tone === 'warning' ? [144, 98, 0] : INK);
    this.flow.audit.sections.push({ sectionId: id, title, kind: 'reference-panel', page: this.d.getCurrentPageInfo().pageNumber, availableHeight: b.h, renderedLines: 0, selectedFontSize: 10, clippedLines: 0, overflowPixels: 0,
      bounds: { x: b.x, y: b.y, width: b.w, height: b.h, right: b.x + b.w, bottom: b.y + b.h } });
    return { x: b.x + padding, y: b.y + headingHeight, w: b.w - padding * 2, h: b.h - headingHeight - 8 };
  }
  list(items: string[], b: Box, id: string, mode: 'check' | 'warning' | 'number' | 'info' = 'check', size = 10) {
    let y = b.y;
    items.forEach((item, index) => {
      const height = this.flow.lines(item, b.w - 20, size).length * (size + 4);
      if (y + height > b.y + b.h) { this.deferred.push({ id, title: this.section(id)?.title || id, text: item }); return; }
      this.icon(mode, b.x, y + 1, 12, mode === 'warning' ? GOLD : mode === 'info' ? BODY : this.accent);
      if (mode === 'number') this.text(String(index + 1), { x: b.x + 3, y: y + 1, w: 10, h: 12 }, id, 7, true, WHITE);
      this.text(item, { x: b.x + 20, y, w: b.w - 20, h: height }, id, size);
      y += height + 9;
    });
  }
  compactLabel(row: Pick<ReportRow, 'label' | 'evidenceRefs'>) {
    const names: Record<string, string> = {
      lotSizeAcres: this.t('Terreno (acres)', 'Lot (acres)', 'Terreno (acres)'), assessorId: 'APN', annualPropertyTax: this.t('Imposto / ano', 'Annual tax', 'Impuesto / año'),
      propertyTaxYear: this.t('Ano do imposto', 'Tax year', 'Año fiscal'), assessmentYear: this.t('Ano de avaliação', 'Assessment year', 'Año de valoración'),
      ownerOccupied: this.t('Ocupação própria', 'Owner occupied', 'Ocupado por dueño'), ownershipRecordPresent: this.t('Titularidade', 'Ownership record', 'Titularidad'),
      latestSalePrice: this.t('Última venda', 'Last sale', 'Última venta'), latestSaleDate: this.t('Data da venda', 'Sale date', 'Fecha de venta'),
    };
    return names[row.evidenceRefs.find(ref => ref.startsWith('fact:'))?.slice(5) || ''] || row.label;
  }
  rows(rows: readonly { label: string; value: string; source?: string; state?: string; evidenceRefs?: string[] }[], b: Box, id: string, size = 9, sources = true, compact = false) {
    let y = b.y;
    const shared = sources ? [...new Set(rows.map(row => row.source).filter((s): s is string => !!s))] : [];
    rows.forEach(row => {
      const label = compact ? this.compactLabel({ ...row, evidenceRefs: row.evidenceRefs || [] }) : row.label;
      const lw = b.w * (compact && label === 'APN' ? .2 : .44), flagged = row.state === 'CONFLICTED', rw = b.w - lw - 8 - (flagged ? 13 : 0);
      const height = Math.max(this.flow.lines(label, lw, size).length, this.flow.lines(row.value, rw, size, true).length) * (size + 4) + (compact ? 3 : 5);
      if (y + height > b.y + b.h) { this.deferred.push({ id, title: this.section(id)?.title || this.t('Dados do imóvel', 'Property facts', 'Datos del inmueble'), text: `${row.label}: ${row.value}${row.source ? ` · ${row.source}` : ''}`, covered: [`${row.label}: ${row.value}`] }); return; }
      this.text(label, { x: b.x, y, w: lw, h: height }, id, size);
      if (flagged) this.icon('warning', b.x + lw + 7, y + 1, 8, GOLD);
      this.text(row.value, { x: b.x + lw + 8 + (flagged ? 13 : 0), y, w: rw, h: height }, id, size, true, INK);
      y += height;
    });
    if (shared.length) this.text(shared.join(' · '), { x: b.x, y: y + 4, w: b.w, h: Math.max(0, b.y + b.h - y - 4) }, id, 7);
  }
  module(s: ReportSection | undefined, b: Box, fallbackTitle: string, icon = 'document') {
    const title = s?.title && this.flow.lines(s.title, b.w - 41, 10, true).length <= 2 ? s.title : fallbackTitle;
    const body = this.panel(b, title, icon, s?.status === 'blocked' ? 'warning' : 'neutral', s?.id || fallbackTitle);
    if (!s) { this.text(this.missing, body, fallbackTitle, 13, true, BODY); return; }
    this.seen.add(s.id);
    let y = body.y;
    if (s.hero) {
      this.text(s.hero.value, { ...body, y, h: s.range ? 50 : 44 }, s.id, s.range ? 19 : 21, true, this.accent); y += s.range ? 54 : 47;
      y = this.text(s.hero.qualification, { ...body, y, h: 53 }, s.id, 8) + 8;
    }
    if (s.range) {
      const barY = y + 5;
      this.d.setFillColor(224, 232, 237); this.d.roundedRect(body.x, barY, body.w, 9, 4, 4, 'F');
      this.d.setFillColor(...this.accent); this.d.circle(body.x + body.w * s.range.position, barY + 4.5, 5, 'F');
      this.text(s.range.low, { x: body.x, y: barY + 17, w: body.w / 2, h: 25 }, s.id, 8, true);
      this.text(s.range.high, { x: body.x + body.w / 2, y: barY + 17, w: body.w / 2, h: 25 }, s.id, 8, true); y += 50;
      this.text(s.range.estimate, { ...body, y, h: 24 }, s.id, 11, true, this.accent); y += 30;
    }
    if (s.comparison?.length) {
      const max = Math.max(...s.comparison.map(item => item.value), 1);
      const step = Math.min(48, body.h / s.comparison.length);
      s.comparison.forEach(item => {
        if (step < 30 || y + step > body.y + body.h + .1) { this.deferred.push({ id: s.id, title: s.title, text: `${item.label}: ${item.text}`, covered: [item.text] }); return; }
        this.text(`${item.label}: ${item.text}`, { ...body, y, h: step - 10 }, s.id, 9, true);
        this.d.setFillColor(225, 231, 235); this.d.rect(body.x, y + step - 9, body.w, 7, 'F'); this.d.setFillColor(...this.accent); this.d.rect(body.x, y + step - 9, body.w * item.value / max, 7, 'F'); y += step;
      });
    }
    if (s.text) y = this.text(s.text, { ...body, y, h: Math.max(0, body.y + body.h - y) }, s.id, 8.5) + 5;
    if (s.rows?.length && s.status === 'blocked') {
      this.text(s.rows.map(row => row.value).join('\n'), { ...body, y, h: Math.max(0, body.y + body.h - y) }, s.id, 8.5);
    } else if (s.rows?.length) this.rows(s.rows, { ...body, y, h: Math.max(0, body.y + body.h - y) }, s.id, 8);
    if (s.items?.length) this.list(s.items.map(i => i.text), { ...body, y, h: Math.max(0, body.y + body.h - y) }, s.id, s.status === 'blocked' ? 'warning' : 'check', 8.5);
  }
  hero(y: number, height: number) {
    const p = this.vm.property, left = { x: X + 6, y, w: 248, h: height };
    this.text(p.address, { ...left, h: 65 }, 'propertyIdentity', 23, true, INK);
    const addressHeight = this.flow.lines(p.address, left.w, 23, true).length * 27;
    this.text(p.location, { ...left, y: y + addressHeight + 5, h: 38 }, 'propertyLocation', 13, true);
    this.d.setFillColor(...this.accent); this.d.roundedRect(left.x, y + 77, 237, 23, 4, 4, 'F');
    this.text(`${p.type} · ${p.strategy}`, { x: left.x + 7, y: y + 82, w: 223, h: 17 }, 'propertyStrategy', 9, true, this.enterprise ? INK : WHITE);
    this.text(p.price, { ...left, y: y + 111, h: 40 }, 'propertyPrice', 27, true, this.accent);
    const photo = { x: X + 263, y, w: WIDTH - 263, h: height };
    if (!p.photos[0] || !this.flow.image(p.photos[0], photo.x, photo.y, photo.w, photo.h)) {
      this.d.setFillColor(237, 245, 248); this.d.roundedRect(photo.x, photo.y, photo.w, photo.h, 8, 8, 'F');
      this.icon('home', photo.x + photo.w / 2 - 30, y + height / 2 - 30, 60, this.accent);
    }
    p.metrics.slice(0, 3).forEach((metric, i) => {
      const mx = left.x + i * 82;
      this.icon(['bed', 'bath', 'area'][i], mx, y + height - 27, 16, this.accent);
      if (metric.state === 'CONFLICTED') this.icon('warning', mx + 21, y + height - 25, 9, GOLD);
      this.text(String(metric.value), { x: mx + (metric.state === 'CONFLICTED' ? 34 : 22), y: y + height - 26, w: metric.state === 'CONFLICTED' ? 47 : 59, h: 31 }, 'propertyMetrics', 7.5, true, INK);
    });
  }
  locationCard(b: Box) {
    const title = this.t('Mapa de localização', 'Location map', 'Mapa de ubicación'), id = 'propertyLocationMap';
    if (!this.vm.property.locationPoint || b.h < 55) {
      this.text(this.missing, this.panel(b, title, 'pin', 'neutral', id), id);
      return;
    }
    // Only the location card is full-bleed. Keep comparable-map framing unchanged.
    this.d.saveGraphicsState();
    this.d.roundedRect(b.x, b.y, b.w, b.h, 7, 7, null); this.d.clip(); this.d.discardPath();
    const raster = !!this.location && this.flow.image(this.location, b.x, b.y, b.w, b.h, 'cover');
    if (!raster) this.flow.drawMap([this.vm.property.locationPoint], b.x, b.y, b.w, b.h, id);
    this.d.setFont('NotoSans', 'bold'); this.d.setFontSize(10);
    const headingWidth = Math.min(b.w - 14, this.d.getTextWidth(title) + 36);
    const headingHeight = this.flow.lines(title, headingWidth - 32, 10, true).length * 14 + 12;
    this.d.setFillColor(...WHITE);
    this.d.roundedRect(b.x + 7, b.y + 7, headingWidth, headingHeight, 4, 4, 'F');
    this.icon('pin', b.x + 12, b.y + 12, 16, this.accent);
    this.text(title, { x: b.x + 34, y: b.y + 12, w: headingWidth - 32, h: headingHeight - 10 }, id, 10, true, INK);
    const caption = raster ? '© OpenStreetMap contributors' : this.t('Diagrama de coordenadas; não é levantamento.', 'Coordinate diagram; not a survey.', 'Diagrama de coordenadas; no es un levantamiento.');
    const captionHeight = this.flow.lines(caption, b.w - 20, 6.5).length * 10.5 + 6;
    this.d.setFillColor(...WHITE); this.d.rect(b.x, b.y + b.h - captionHeight, b.w, captionHeight, 'F');
    this.text(caption, { x: b.x + 10, y: b.y + b.h - captionHeight + 3, w: b.w - 20, h: captionHeight - 3 }, id, 6.5);
    this.d.restoreGraphicsState();
    this.d.setDrawColor(...LINE); this.d.setLineWidth(.65); this.d.roundedRect(b.x, b.y, b.w, b.h, 7, 7, 'S');
    this.flow.audit.sections.push({ sectionId: id, title, kind: 'reference-panel', page: this.d.getCurrentPageInfo().pageNumber,
      availableHeight: b.h, renderedLines: 0, selectedFontSize: 10, clippedLines: 0, overflowPixels: 0,
      bounds: { x: b.x, y: b.y, width: b.w, height: b.h, right: b.x + b.w, bottom: b.y + b.h } });
  }
  landCells(rows: readonly ReportRow[], b: Box, draw = false) {
    const wide = rows.filter(row => row.evidenceRefs.includes('fact:legalDescription'));
    const short = rows.filter(row => !wide.includes(row)), gap = 8, width = (b.w - gap) / 2;
    let y = b.y;
    const height = (row: ReportRow, w: number) => this.flow.lines(this.compactLabel(row), w, 7.5).length * 11.5
      + this.flow.lines(row.value, w - (row.state === 'CONFLICTED' ? 12 : 0), 8, true).length * 12 + 2;
    const cell = (row: ReportRow, x: number, w: number, h: number) => {
      if (!draw) return;
      if (y + h > b.y + b.h) {
        this.deferred.push({ id: 'property-facts-land', title: this.t('Terreno e dados fiscais', 'Land and tax information', 'Terreno y datos fiscales'), text: `${row.label}: ${row.value}`, covered: [row.value] }); return;
      }
      const labelHeight = this.flow.lines(this.compactLabel(row), w, 7.5).length * 11.5;
      this.text(this.compactLabel(row), { x, y, w, h: labelHeight }, 'overviewFacts2', 7.5);
      const flagged = row.state === 'CONFLICTED';
      if (flagged) this.icon('warning', x, y + labelHeight + 1, 8, GOLD);
      this.text(row.value, { x: x + (flagged ? 12 : 0), y: y + labelHeight, w: w - (flagged ? 12 : 0), h: h - labelHeight }, 'overviewFacts2', 8, true, INK);
    };
    for (let i = 0; i < short.length; i += 2) {
      const pair = short.slice(i, i + 2), h = Math.max(...pair.map(row => height(row, width)));
      pair.forEach((row, column) => cell(row, b.x + column * (width + gap), width, h)); y += h;
    }
    for (const row of wide) { const h = height(row, b.w); cell(row, b.x, b.w, h); y += h; }
    return y - b.y;
  }
  overview() {
    this.page('Property Overview', this.t('Informações gerais do imóvel', 'Property overview and context', 'Información general del inmueble'));
    this.hero(CONTENT_TOP, 174);
    {
      const groups = this.vm.property.facts, available = WIDTH - 2 * GAP;
      const widths = [available * .31, available * .29, available * .40], padding = 7;
      const owner = groups.find(g => /publicador|publisher/i.test(g.title));
      const physical = groups.find(g => /dados do imóvel|property facts|datos del inmueble/i.test(g.title));
      const parcel = groups.filter(g => g !== owner && g !== physical);
      const cards = [owner, physical, { title: this.t('Terreno e dados fiscais', 'Land and tax information', 'Terreno y datos fiscales'), rows: parcel.flatMap(g => g.rows) }];
      const top = CONTENT_TOP + 174 + 8;
      const heights = cards.slice(0, 2).map((group, i) => 52 + (group?.rows || []).reduce((sum, row) => {
        const contentWidth = widths[i] - padding * 2;
        const labelWidth = contentWidth * (this.compactLabel(row) === 'APN' ? .2 : .44);
        return sum + Math.max(this.flow.lines(this.compactLabel(row), labelWidth, 7.5).length,
          this.flow.lines(row.value, contentWidth - labelWidth - 8 - (row.state === 'CONFLICTED' ? 13 : 0), 7.5, true).length) * 11.5 + 3;
      }, 0));
      heights.push(38 + this.landCells(cards[2]!.rows, { x: 0, y: 0, w: widths[2] - padding * 2, h: 0 }));
      const factsHeight = Math.min(250, Math.max(108, Math.max(...heights)));
      cards.forEach((group, i) => {
        const heading = i === 0 ? this.t('Publicador', 'Publisher', 'Publicador') : i === 1 ? this.t('Dados do imóvel', 'Property details', 'Datos del inmueble') : this.t('Dados do terreno', 'Land information', 'Datos del terreno');
        const x = X + widths.slice(0, i).reduce((sum, width) => sum + width + GAP, 0);
        const body = this.panel({ x, y: top, w: widths[i], h: factsHeight }, heading, ['user', 'home', 'pin'][i], 'neutral', `overviewFacts${i}`, padding);
        if (group?.rows.length) {
          if (i === 2) this.landCells(group.rows, body, true);
          else this.rows(group.rows, body, `overviewFacts${i}`, 7.5, false, true);
          for (const s of this.vm.sections.filter(s => s.rows?.some(row => group.rows.includes(row)))) {
            const parent = this.flow.audit.sections[this.flow.audit.sections.length - 1];
            this.flow.audit.sections.push({ ...parent, sectionId: s.id, title: s.title, kind: 'reference-facts' });
          }
        }
        else this.text(evidenceAbsenceCopy(this.vm.indicatorReasons?.propertyRecord || 'USER_INPUT_REQUIRED', this.vm.locale), body, `overviewFacts${i}`, 8);
      });
      this.vm.sections.filter(s => /^(property-facts-|property-tax|property-contacts)/.test(s.id)).forEach(s => this.seen.add(s.id));
      let next = top + factsHeight + 7;
      const notice = this.section('data-discrepancies');
      if (notice?.text) {
        this.icon('warning', X + 3, next + 2, 9, GOLD);
        this.text(`${notice.title}: ${notice.text}`, { x: X + 17, y: next, w: WIDTH - 21, h: 25 }, notice.id, 7.5);
        this.seen.add(notice.id); next += 29;
      }
      const photos = this.vm.property.photos.slice(0, 5), photoHeight = photos.length > 1 ? 120 : 100;
      if (791 - next - photoHeight - 7 < 100) {
        this.page(this.t('Fotos, mapa e notas', 'Photos, map and notes', 'Fotos, mapa y notas'), this.t('Detalhes visuais do imóvel', 'Property visual detail', 'Detalle visual del inmueble'));
        next = CONTENT_TOP;
      }
      const photoBody = this.panel({ x: X, y: next, w: WIDTH, h: photoHeight }, this.t(`Fotos do imóvel · ${photos.length} disponível(is)`, `Property photos · ${photos.length} available`, `Fotos del inmueble · ${photos.length} disponible(s)`), 'document', 'neutral', 'propertyPhotos');
      const unit = (photoBody.w - Math.max(0, photos.length - 1) * 5) / (photos.length + 1);
      let photoX = photoBody.x;
      photos.forEach((photo, i) => {
        const w = unit * (i === 0 ? 2 : 1);
        this.flow.image(photo, photoX, photoBody.y, w, photoBody.h, 'contain');
        this.flow.audit.sections.push({ sectionId: `propertyPhoto${i + 1}`, title: 'Property photo', kind: 'reference-photo', page: this.d.getCurrentPageInfo().pageNumber,
          availableHeight: photoBody.h, renderedLines: 0, selectedFontSize: 0, clippedLines: 0, overflowPixels: 0,
          bounds: { x: photoX, y: photoBody.y, width: w, height: photoBody.h, right: photoX + w, bottom: photoBody.y + photoBody.h } });
        photoX += w + 5;
      });
      if (!photos.length) this.text(this.missing, photoBody, 'propertyPhotos', 8);
      next += photoHeight + 7;
      this.locationCard({ x: X, y: next, w: WIDTH * .57, h: Math.max(55, 791 - next) });
      const notes = this.panel({ x: X + WIDTH * .57 + GAP, y: next, w: WIDTH * .43 - GAP, h: Math.max(55, 791 - next) }, this.t('Notas', 'Notes', 'Notas'), 'document', 'neutral', 'publisher-notes');
      this.text(this.vm.property.notes.join('\n') || this.missing, notes, 'publisher-notes', 8);
      if (this.section('publisher-notes')) this.seen.add('publisher-notes');
    }
  }
  market() {
    this.page('Comparative Market Analysis', this.t('Imóveis comparáveis e análise de mercado', 'Comparable properties and market analysis', 'Comparables y análisis de mercado'));
    const sections = this.vm.sections.filter(s => s.table?.rows.length), main = sections[0];
    let tableEnd = 604;
    if (main) tableEnd = this.marketTable(main, ANALYSIS_TOP);
    else {
      this.locationCard({ x: X, y: ANALYSIS_TOP, w: WIDTH, h: 275 });
      this.module(this.section('price-positioning') || this.section('land-market-readiness'), { x: X, y: 413, w: WIDTH, h: 191 }, this.t('Imóveis comparáveis', 'Comparable properties', 'Inmuebles comparables'), 'chart');
    }
    const pending = this.section('rent-pending');
    const delivery = this.section('sold-delivery');
    const caption = [main?.map?.caption || this.vm.executive?.blocker?.text || this.missing, delivery?.text].filter(Boolean).join('\n');
    const captionHeight = this.flow.lines(caption, WIDTH - 20, 7.5).length * 11.5;
    const pendingText = pending?.text ? `${pending.title}: ${pending.text}` : '';
    const pendingHeight = pendingText ? this.flow.lines(pendingText, WIDTH - 20, 7.5).length * 11.5 + 4 : 0;
    const notesTop = tableEnd + 8;
    const notes = this.panel({ x: X, y: notesTop, w: WIDTH, h: Math.min(791 - notesTop, Math.max(65, 38 + captionHeight + pendingHeight)) }, this.t('Observações da análise', 'Analysis notes', 'Observaciones del análisis'), 'document', 'neutral', 'marketObservations');
    this.text(caption, { ...notes, h: Math.min(notes.h, captionHeight) }, 'marketObservations', 7.5);
    if (delivery) this.seen.add(delivery.id);
    if (pending?.text) {
      this.text(pendingText, { ...notes, y: notes.y + captionHeight + 4, h: Math.max(0, notes.h - captionHeight - 4) }, pending.id, 7.5);
      this.seen.add(pending.id);
    }
    for (const s of sections.slice(1)) { this.page(s.title, this.t('Referências complementares de mercado', 'Additional market references', 'Referencias adicionales de mercado')); this.marketTable(s, ANALYSIS_TOP); }
  }
  marketTable(s: ReportSection, top: number) {
    this.seen.add(s.id);
    const dense = (s.table?.rows.length || 0) > 5 || (s.table?.columns.length || 0) > 5, mapHeight = dense ? 205 : 250;
    const mapBody = this.panel({ x: X, y: top, w: WIDTH, h: mapHeight }, this.t('Localização dos comparáveis', 'Comparable locations', 'Ubicación de comparables'), 'pin', 'neutral', `${s.id}Map`);
    if (s.map?.points.length) {
      if (!this.maps[s.id] || !this.flow.mapImage(this.maps[s.id]!, mapBody.x, top + 43, mapBody.w, mapHeight - 63)) this.flow.drawMap(s.map.points, mapBody.x, top + 43, mapBody.w, mapHeight - 63, s.id);
      this.text(this.maps[s.id] ? '© OpenStreetMap contributors' : this.t('Diagrama de coordenadas; não é mapa cadastral.', 'Coordinate diagram; not a cadastral map.', 'Diagrama de coordenadas; no es mapa catastral.'), { x: mapBody.x, y: top + mapHeight - 18, w: mapBody.w, h: 14 }, s.id, 6.5);
      const tones = [['sold', 'SOLD', [230, 164, 22]], ['for-sale', 'FOR SALE', [220, 53, 69]], ['complementary', this.t('Complementares', 'Complementary', 'Complementarios'), [139, 92, 246]]] as const;
      const legend = tones.filter(([tone]) => s.map!.points.some(p => p.markerTone === tone));
      if (legend.length) {
        const x = mapBody.x, y = top + 28;
        legend.forEach(([, label, color], index) => { this.d.setFillColor(color[0], color[1], color[2]); this.d.circle(x + 7 + index * 124, y + 6, 3, 'F'); this.text(label, { x: x + 16 + index * 124, y: y + 1, w: 106, h: 14 }, `${s.id}Legend`, 7); });
      }
    } else this.text(this.missing, mapBody, s.id);
    const cols = s.table?.columns || [], rows = s.table?.rows || [];
    const weights = cols.map((_, i) => i === 0 ? .045 : i === 1 ? .36 : (1 - .405) / Math.max(1, cols.length - 2));
    let table = { x: X + 10, y: top + mapHeight + 10, w: WIDTH - 20, h: 0 }, y = 0;
    const tableBottom = 690;
    const heightOf = (cells: readonly string[], size: number, bold: boolean) => Math.max(...cells.map((cell, i) => this.flow.lines(cell, table.w * weights[i] - 6, size, bold).length)) * (size + 4) + 3;
    const header = (tableTop: number, continuation = false, startIndex = 0) => {
      const title = continuation ? `${s.title} — ${this.t('continuação', 'continued', 'continuación')}` : s.title;
      const headingHeight = 16 + Math.min(2, this.flow.lines(title, WIDTH - 41, 10, true).length) * 14;
      const neededHeight = headingHeight + 2 + heightOf(cols, 7, true) + rows.slice(startIndex).reduce((sum, row) => sum + heightOf(row, 7.2, false), 0) + 8;
      table = this.panel({ x: X, y: tableTop, w: WIDTH, h: Math.min(tableBottom - tableTop, neededHeight) }, title, 'chart', 'neutral', s.id);
      y = table.y + 2;
      this.d.setFillColor(230, 237, 241); this.d.roundedRect(table.x - 5, y, table.w + 10, 30, 4, 4, 'F');
    };
    header(top + mapHeight + 10);
    const line = (cells: readonly string[], bold: boolean, size: number) => {
      let x = table.x;
      const height = heightOf(cells, size, bold);
      cells.forEach((cell, i) => { this.text(cell, { x: x + 2, y: y + 3, w: table.w * weights[i] - 6, h: height }, s.id, size, bold, INK); x += table.w * weights[i]; });
      y += height;
    };
    line(cols, true, 7);
    for (const [index, row] of rows.entries()) {
      if (y + heightOf(row, 7.2, false) > tableBottom - 7) {
        this.page(s.title, this.t('Relação de comparáveis — continuação', 'Comparable list — continued', 'Relación de comparables — continuación'), 'chart');
        header(ANALYSIS_TOP, true, index); line(cols, true, 7);
      }
      line(row, false, 7.2); this.d.setDrawColor(...LINE); this.d.line(table.x, y - 2, table.x + table.w, y - 2);
    }
    return y + 8;
  }
  valuation() {
    this.page('Valuation Intelligence / ARV / KPIs', this.t('Análise de valor, métricas e potencial de retorno', 'Valuation, metrics and return potential', 'Valoración, métricas y potencial de rentabilidad'), 'chart');
    const main = this.section('arv-market') || this.section('market-rent') || this.section('value-readiness') || this.section('land-market-readiness');
    this.module(main, { x: X, y: ANALYSIS_TOP, w: HALF, h: 249 }, this.t('Faixa estimada de valor', 'Estimated value range', 'Rango de valor estimado'), 'target');
    const costs = this.section('operating-evidence') || this.section('strategy-cost-basis') || this.section('landKnownBasis') || this.section('land-development-readiness') || {
      id: 'analysis-inputs', title: this.t('Principais inputs da análise', 'Main analysis inputs', 'Datos principales del análisis'), kind: 'facts' as const, priority: 0,
      rows: [{ label: this.t('Preço pedido', 'Asking price', 'Precio solicitado'), value: this.vm.property.price },
        { label: this.t('Tipo', 'Type', 'Tipo'), value: this.vm.property.type }, { label: this.t('Estratégia', 'Strategy', 'Estrategia'), value: this.vm.property.strategy }].map(row => ({ ...row, evidenceRefs: ['property:identity'] })), evidenceRefs: ['property:identity'], continuationPolicy: 'SAME_SECTION' as const,
    };
    this.module(costs, { x: X + HALF + GAP, y: ANALYSIS_TOP, w: HALF, h: 249 }, this.t('Principais inputs da análise', 'Main analysis inputs', 'Datos principales del análisis'), 'document');
    const dashboard = this.panel({ x: X, y: 387, w: WIDTH, h: 89 }, 'Investment Scenario Dashboard', 'chart', 'neutral', 'scenarioDashboard');
    const available = this.vm.sections.filter(s => /^(scenario|saved)/.test(s.id));
    const tiles = [
      { label: this.t('Preço pedido', 'Asking price', 'Precio solicitado'), value: this.vm.property.price },
      { label: this.t('Reforma informada', 'Reported rehab', 'Reforma declarada'), value: this.vm.values.rehab?.text || this.missing },
      { label: this.t('Aluguel estimado', 'Estimated rent', 'Alquiler estimado'), value: this.section('market-rent')?.hero?.value || this.missing },
      { label: 'Cap rate', value: this.vm.values.capRate?.text || this.missing },
    ];
    tiles.slice(0, 4).forEach((item, i) => {
      const w = (dashboard.w - 18) / Math.max(1, Math.min(4, tiles.length));
      this.text(item.value, { x: dashboard.x + i * (w + 6), y: dashboard.y + 1, w, h: 25 }, 'scenarioDashboard', 14, true, this.accent);
      this.text(item.label, { x: dashboard.x + i * (w + 6), y: dashboard.y + 28, w, h: 17 }, 'scenarioDashboard', 7);
    });
    const lower = [this.section('provider-reference') || this.section('parcel-area-comparison') || this.section('price-positioning'), this.section('property-tax'), this.section('financial-readiness') || this.section('condition-readiness') || this.section('land-benchmark-readiness')];
    lower.forEach((s, i) => {
      const width = (WIDTH - 2 * GAP) / 3;
      const content = [s?.text, ...(s?.rows || []).map(row => `${row.label}: ${row.value}`)].filter(Boolean).join('\n');
      const height = i === 1 && main?.range ? 145 : Math.max(90, Math.min(191, 48 + this.flow.lines(content || this.missing, width - 20, 8.5).length * 12.5));
      const box = { x: X + i * ((WIDTH + GAP) / 3), y: 484, w: width, h: height };
      if (i === 1 && main?.range) {
        const body = this.panel(box, main.id === 'arv-market' ? this.t('Cenários de valor (ARV)', 'ARV scenarios', 'Escenarios de valor (ARV)') : this.t('Faixa de aluguel', 'Rent range', 'Rango de alquiler'), 'pie', 'neutral', 'valuationScenarios');
        const cx = body.x + 30, cy = body.y + 35, radius = 24;
        const colors: Color[] = [this.accent, [168, 185, 199], [217, 225, 232]];
        for (let segment = 0; segment < 3; segment++) for (let angle = segment * 120; angle < (segment + 1) * 120; angle += 4) {
          const a = (angle - 90) * Math.PI / 180, b = (angle - 86) * Math.PI / 180;
          this.d.setFillColor(...colors[segment]); this.d.triangle(cx, cy, cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, cx + Math.cos(b) * radius, cy + Math.sin(b) * radius, 'F');
        }
        this.d.setFillColor(...WHITE); this.d.circle(cx, cy, 15, 'F');
        [main.range.high, main.range.estimate, main.range.low].forEach((value, index) => this.text(value, { x: body.x + 66, y: body.y + index * 21, w: body.w - 66, h: 20 }, 'valuationScenarios', 8, true));
        this.text(this.t('Referências de cenário, não probabilidades.', 'Scenario references, not probabilities.', 'Referencias de escenario, no probabilidades.'), { ...body, y: body.y + 67, h: 18 }, 'valuationScenarios', 6.5);
      } else this.module(s, box, [this.t('Análise de preço', 'Price analysis', 'Análisis de precio'), this.t('Registros e custos', 'Records and costs', 'Registros y costos'), this.t('Notas da avaliação', 'Valuation notes', 'Notas de valoración')][i], ['target', 'pie', 'document'][i]);
    });
    this.text(this.vm.disclaimer, { x: X + 12, y: 689, w: WIDTH - 24, h: 40 }, 'reportDisclaimer', 7.5);
    available.forEach(s => this.sectionAppendix(s));
  }
  profile() {
    this.page('Investment Fit & Risk Analysis', this.t('Perfil do investidor, análise de adequação e riscos', 'Investor profile, fit and risk analysis', 'Perfil del inversor, compatibilidad y riesgos'));
    const top = CONTENT_TOP;
    const profile = this.section('investor-profile'), fit = this.section('profile-fit');
    this.module(profile, { x: X, y: top, w: HALF, h: 226 }, this.t('Perfil do investidor', 'Investor profile', 'Perfil del inversor'), 'user');
    const gauge = this.panel({ x: X + HALF + GAP, y: top, w: HALF, h: 226 }, this.t('Match Score / Compatibilidade', 'Match Score / Compatibility', 'Match Score / Compatibilidad'), 'target', 'neutral', 'profile-fit');
    const score = fit?.gauge?.value;
    if (fit) this.seen.add(fit.id);
    if (score !== undefined) {
      const cx = gauge.x + gauge.w / 2, cy = gauge.y + 70, radius = 58;
      this.d.setDrawColor(224, 231, 235); this.d.setLineWidth(15); this.d.circle(cx, cy, radius, 'S');
      this.d.setDrawColor(...this.accent); this.d.setLineWidth(15);
      for (let i = 0; i < Math.ceil(score * 2); i++) { const a = (-90 + i * 1.8) * Math.PI / 180, b = (-90 + Math.min(score * 3.6, (i + 1) * 1.8)) * Math.PI / 180; this.d.line(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, cx + Math.cos(b) * radius, cy + Math.sin(b) * radius); }
      this.text(`${score}%`, { x: cx - 45, y: cy - 19, w: 90, h: 44 }, 'profile-fit', 31, true, INK);
      this.text(fit!.rows?.[0]?.source || '', { x: gauge.x, y: gauge.y + 145, w: gauge.w, h: 29 }, 'profile-fit', 7);
    } else { this.text(this.missing, { ...gauge, y: gauge.y + 35, h: 40 }, 'profile-fit', 19, true); this.text(this.t('Confirme os critérios do investidor.', 'Confirm investor criteria.', 'Confirme los criterios del inversor.'), { ...gauge, y: gauge.y + 100, h: 50 }, 'profile-fit', 11); }
    const criteria = this.section('profile-criteria');
    this.module(criteria || this.section('profile-readiness'), { x: X, y: top + 234, w: HALF, h: 198 }, this.t('Fit por critério', 'Fit by criterion', 'Compatibilidad por criterio'), 'chart');
    const riskBody = this.panel({ x: X + HALF + GAP, y: top + 234, w: HALF, h: 198 }, this.t('Análise de risco', 'Risk analysis', 'Análisis de riesgo'), 'warning', 'neutral', 'riskAnalysis');
    const riskId = this.section('decision-blockers') ? 'decision-blockers' : 'risk-considerations';
    this.list(this.texts(riskId), riskBody, riskId, 'warning', 8.5); this.seen.add(riskId);
    if (this.enterprise) {
      const thesis = this.vm.executive?.thesis.text || this.missing;
      const height = Math.min(791 - top - 440, Math.max(76, 38 + this.flow.lines(thesis, WIDTH - 20, 8.5).length * 12.5));
      const bottom = this.panel({ x: X, y: top + 440, w: WIDTH, h: height }, this.t('Resumo de evidências', 'Evidence summary', 'Resumen de evidencia'), 'document', 'neutral', 'profileInsights');
      this.text(thesis, bottom, 'profileInsights', 8.5);
    } else {
      const rent = this.section('market-rent') || this.section('rent-pending');
      const height = rent?.hero ? 791 - top - 440 : Math.max(76, 38 + this.flow.lines(rent?.text || this.missing, WIDTH - 20, 8.5).length * 12.5);
      this.module(rent, { x: X, y: top + 440, w: WIDTH, h: Math.min(791 - top - 440, height) }, this.t('Evidências de aluguel', 'Rent evidence', 'Evidencia de alquiler'), 'chart');
    }
  }
  verification() {
    this.page(this.enterprise ? 'Key Insights & Verification' : 'Key Insights & Next Steps', this.t('Principais conclusões e orientações de verificação', 'Key findings and verification guidance', 'Conclusiones y orientación de verificación'));
    const blocks = [
      { id: 'positive-signals', title: this.t('Sinais positivos', 'Positive signals', 'Señales positivas'), icon: 'check', tone: 'positive' as const, mode: 'check' as const },
      { id: this.section('decision-blockers') ? 'decision-blockers' : 'risk-considerations', title: this.section('decision-blockers') ? this.t('O que ainda falta', 'What’s missing', 'Qué falta') : this.t('Considerações de risco', 'Risk considerations', 'Consideraciones de riesgo'), icon: 'warning', tone: 'warning' as const, mode: 'warning' as const },
      { id: 'next-actions', title: this.t('Próximos passos', 'Next steps', 'Próximos pasos'), icon: 'target', tone: 'neutral' as const, mode: 'number' as const },
      { id: 'verificationSteps', title: this.t('Resumo de evidências', 'Evidence summary', 'Resumen de evidencia'), icon: 'document', tone: 'neutral' as const, mode: 'info' as const },
    ];
    const secondHeight = Math.min(310, Math.max(150, 43 + this.texts('next-actions').reduce((height, text) => height + this.flow.lines(text, HALF - 40, 8.5).length * 12.5 + 9, 0)));
    blocks.forEach((block, i) => {
      let texts = this.texts(block.id);
      const gap = block.id === 'positive-signals' ? this.section('opportunity-readiness') : undefined;
      if (!texts.length && gap) { this.module(gap, { x: X, y: CONTENT_TOP, w: HALF, h: 210 }, block.title, 'info'); return; }
      const insufficient = block.id === 'positive-signals' && !texts.length;
      const body = this.panel({ x: X + i % 2 * (HALF + GAP), y: CONTENT_TOP + Math.floor(i / 2) * 218, w: HALF, h: i < 2 ? 210 : secondHeight }, insufficient ? this.t('Cobertura dos sinais', 'Signal coverage', 'Cobertura de señales') : block.title, insufficient ? 'info' : block.icon, insufficient ? 'neutral' : block.tone, block.id);
      if (block.id === 'verificationSteps') {
        texts = [...this.texts('evidence-availability'), ...(this.vm.executive?.coverage.map(row => `${row.label}: ${row.value}`) || [])];
        this.seen.add('evidence-availability');
      }
      if (!texts.length) texts = [block.id === 'positive-signals' ? this.t('Evidências insuficientes para qualificar sinais positivos.', 'Insufficient evidence to qualify positive signals.', 'Evidencia insuficiente para calificar señales positivas.') : this.missing];
      this.list(texts, body, block.id, insufficient ? 'info' : block.mode, 8.5);
      this.seen.add(block.id);
    });
    const conclusion = this.vm.executive?.thesis.text || this.missing;
    const needed = 46 + this.flow.lines(conclusion, WIDTH - 20, 9).length * 13, quoteTop = CONTENT_TOP + 218 + secondHeight + 8;
    const quote = this.panel({ x: X, y: quoteTop, w: WIDTH, h: Math.min(791 - quoteTop, Math.max(80, needed)) }, this.t('Conclusão apoiada nas evidências', 'Evidence-based conclusion', 'Conclusión basada en evidencia'), 'document', 'neutral', 'verificationConclusion');
    this.text(conclusion, quote, 'verificationConclusion', 9, false, INK);
  }
  conclusion() {
    this.page('Maxxis AI Analysis', this.t('Conclusão adaptada ao perfil', 'Profile-aware conclusion', 'Conclusión adaptada al perfil'), 'target');
    const cards = [
      { title: this.t('Síntese da oferta', 'Opportunity summary', 'Síntesis de la oferta'), text: this.vm.executive?.thesis.text || this.missing, icon: 'chart' },
      { title: this.t('Implicação para a estratégia', 'Strategy implications', 'Implicación para la estrategia'), text: this.section('value-readiness')?.rows?.[0]?.value || this.vm.executive?.status || this.missing, icon: 'target' },
      { title: this.t('Evidências principais', 'Main evidence', 'Evidencia principal'), text: '', icon: 'document' },
      { title: this.t('Incertezas em aberto', 'Open questions', 'Incertidumbres abiertas'), text: '', icon: 'warning' },
    ];
    cards.forEach((card, i) => {
      const body = this.panel({ x: X + i % 2 * (HALF + GAP), y: ANALYSIS_TOP + Math.floor(i / 2) * 188, w: HALF, h: i < 2 ? 180 : 210 }, card.title, card.icon, 'neutral', `conclusion${i}`);
      if (card.text) {
        this.text(card.text, body, `conclusion${i}`, 8.5);
      }
      else if (i === 2) {
        this.list(this.vm.executive?.coverage.map(row => `${row.label}: ${row.value}`) || [this.missing], body, 'conclusionTopics', 'info', 9);
      }
      else this.list(this.texts(this.section('decision-blockers') ? 'decision-blockers' : 'risk-considerations'), body, 'conclusionQuestions', 'warning', 8.5);
    });
    const actions = this.panel({ x: X, y: 536, w: WIDTH, h: 115 }, this.t('Próxima decisão', 'Next decision', 'Próxima decisión'), 'target', 'neutral', 'finalActions');
    const texts = [this.t('A oferta pode ser analisada com os dados identificados, mas não há base para afirmar margem ou retorno enquanto persistirem os bloqueios acima. As verificações prioritárias estão na página anterior.', 'The offer can be reviewed with the identified evidence, but margin or return cannot be established while these blockers remain. Prioritized checks appear on the preceding page.', 'La oferta puede analizarse con la evidencia identificada, pero no permite afirmar margen o rentabilidad mientras persistan los bloqueos. Las verificaciones prioritarias están en la página anterior.')], w = (actions.w - GAP * Math.max(0, texts.length - 1)) / Math.max(1, texts.length);
    texts.forEach((text, i) => this.text(text, { x: actions.x + i * (w + GAP), y: actions.y, w, h: actions.h }, 'finalActions', 8));
    this.d.setFillColor(255, 251, 239); this.d.setDrawColor(248, 225, 166); this.d.roundedRect(X, 663, WIDTH, 66, 6, 6, 'FD');
    this.icon('warning', X + 10, 678, 17, GOLD);
    this.text(this.t('Aviso importante', 'Disclaimer', 'Aviso importante'), { x: X + 37, y: 672, w: WIDTH - 47, h: 14 }, 'reportDisclaimer', 8, true, INK);
    this.text(this.vm.disclaimer, { x: X + 37, y: 688, w: WIDTH - 47, h: 33 }, 'reportDisclaimer', 7.5);
  }
  sectionAppendix(s: ReportSection) {
    if (this.seen.has(s.id)) return;
    this.seen.add(s.id);
    this.deferred.push({ id: s.id, title: s.title, text: [s.hero?.label, s.hero?.value, s.hero?.qualification, s.text, ...(s.items || []).map(i => i.text), ...(s.rows || []).map(r => `${r.label}: ${r.value}${r.source ? ` · ${r.source}` : ''}`)].filter(Boolean).join('\n') });
  }
  pendingDetails() {
    const normalize = (text: string) => text.normalize('NFKC').replace(/\s+/g, ' ').trim();
    const visible = normalize(this.flow.audit.lines.map(line => line.text).join(' '));
    return this.deferred.filter((item, i, all) => item.text && all.findIndex(other => other.text === item.text) === i
      && !(item.covered || item.text.split('\n')).filter(Boolean).every(part => visible.includes(normalize(part))));
  }
  async draw(yieldRendering: () => Promise<void>) {
    this.overview(); await yieldRendering();
    if (this.enterprise) { this.market(); await yieldRendering(); this.valuation(); await yieldRendering(); }
    if (this.vm.reportType !== 'PROPERTY_RELEASE') { this.profile(); await yieldRendering(); this.verification(); await yieldRendering(); }
    for (const s of this.vm.sections) this.sectionAppendix(s);
    if (this.enterprise) { this.conclusion(); await yieldRendering(); }
    // Preserve longer sources/notes and additional scenarios in meaningful native sections.
    for (const s of this.vm.sections) this.sectionAppendix(s);
    const unique = this.pendingDetails();
    if (unique.length) {
      this.page(this.t('Evidências e fontes', 'Evidence and sources', 'Evidencia y fuentes'), this.t('Detalhamento das informações do relatório', 'Report evidence detail', 'Detalle de la evidencia del informe'), 'document');
      this.flow.y = CONTENT_TOP;
      const grouped = new Map<string, { title: string; text: string[] }>();
      for (const item of unique) {
        const group = grouped.get(item.id) || { title: item.title, text: [] }; group.text.push(item.text); grouped.set(item.id, group);
      }
      for (const [id, item] of grouped) {
        this.flow.section({ id, title: item.title, kind: 'narrative', text: item.text.join('\n'), bodySize: 9 } satisfies SafePdfSection);
        await yieldRendering();
      }
    }
    const result = this.flow.finish(), total = this.d.getNumberOfPages();
    for (let page = 1; page <= total; page++) {
      this.d.setPage(page); this.d.setFillColor(...WHITE); this.d.rect(0, 799, 595.28, 43, 'F');
      const pageText = `${this.t('Página', 'Page', 'Página')} ${page} ${this.t('de', 'of', 'de')} ${total}`;
      this.text(pageText, { x: 440, y: 816, w: 130, h: 20 }, 'footerPage', 10, true, INK);
    }
    return result;
  }
}
