import { ReportBrandShell } from './reportBrandShell';
import { composeReportContent, readableReportDate, type ContentBlock } from './reportContentPlan';
import { REFERENCE_DESIGN as DESIGN } from './reportReferenceDesign';
import type { ReportRow } from './reportIntegrityTypes';
import { layoutReportFacts } from './reportFactLayout';
type Box = {
  x: number;
  y: number;
  w: number;
  h: number;
};
type Color = [number, number, number];
const X = 26,
  W = 543.28,
  G = 7,
  BOTTOM = 790,
  INK: Color = [12, 24, 56],
  BODY: Color = [43, 65, 99],
  DARK: Color = [43, 49, 53];

/** Reference-specific page compositions. Receives the existing display model only. */
export class ReferenceCloneComposition extends ReportBrandShell {
  private cursor = 151;
  private activeTitle = '';
  private activeSubtitle = '';
  private activeIcon = 'home';
  private identityFirst = false;
  private readonly used = new Set<string>();
  private readonly details: ContentBlock[] = [];
  private brief = false;
  private get small() {
    return this.vm.reportType !== 'DEAL_INTELLIGENCE';
  }
  private get font() {
    return this.vm.reportType === 'PROPERTY_RELEASE' ? 7 : this.small || this.brief ? 8 : 9;
  }
  private h(text: string, width: number, size = this.font, bold = false) {
    return this.flow.lines(text, width, size, bold).length * (size + this.flow.lineGap);
  }
  private write(text: string, x: number, y: number, width: number, id: string, size = this.font, bold = false, color: Color = BODY, bottom = BOTTOM) {
    return this.flow.drawText(text, x, y, width, id, size, bold, color, bottom);
  }
  private audit(id: string, title: string, kind: string, b: Box, section?: number) {
    this.flow.audit.sections.push({
      sectionId: id,
      title,
      kind,
      page: this.d.getCurrentPageInfo().pageNumber,
      availableHeight: b.h,
      renderedLines: 0,
      selectedFontSize: this.font,
      clippedLines: 0,
      overflowPixels: 0,
      readingSection: section,
      bounds: {
        x: b.x,
        y: b.y,
        width: b.w,
        height: b.h,
        right: b.x + b.w,
        bottom: b.y + b.h
      }
    });
    this.flow.pages.find(page => page.page === this.d.getCurrentPageInfo().pageNumber)!.sectionKeys.push(id);
  }
  private chapter(title: string, subtitle: string, icon = 'home', identityFirst = false, overviewHeight?: number) {
    if (this.flow.pages.length >= (this.vm.reportType === 'PROPERTY_RELEASE' ? 1 : this.vm.reportType === 'MAXXIS_ANALYSIS' ? 3 : Infinity)) throw Error('REPORT_PAGE_LIMIT_EXCEEDED:' + this.flow.pages.length);
    this.activeTitle = title;
    this.activeSubtitle = subtitle;
    this.activeIcon = icon;
    this.identityFirst = identityFirst;
    this.page(title, subtitle, icon);
    const continued = this.flow.pages.length > 1,
      headingY = continued ? DESIGN.heading.continuedY : DESIGN.heading.y;
    if (continued) this.context();else if (overviewHeight !== undefined) this.propertyFrame({
      x: X,
      y: DESIGN.overview.cardY,
      w: W,
      h: headingY + DESIGN.heading.height + DESIGN.heading.bottomPadding + overviewHeight + DESIGN.overview.paddingBottom - DESIGN.overview.cardY
    });
    this.icon(icon, X + 4, headingY, 25, DARK);
    this.flow.drawDisplayLine(title, 66, headingY, W - 44, 'referenceChapter', 17, true, INK, headingY + 24);
    this.flow.drawDisplayLine(subtitle, 66, headingY + 21, W - 44, 'referenceChapterSubtitle', 9, false, BODY, headingY + 34);
    this.audit('reference-chapter-' + this.flow.pages.length, title, 'heading', {
      x: X,
      y: headingY,
      w: W,
      h: 34
    });
    this.cursor = headingY + DESIGN.heading.height + DESIGN.heading.bottomPadding;
  }
  private next() {
    this.chapter(this.activeTitle, this.activeSubtitle, this.activeIcon, this.identityFirst);
  }
  private frame(b: Box, title: string, icon: string, id: string, warning = false) {
    this.d.setFillColor(...((warning ? [255, 251, 240] : [251, 253, 254]) as Color));
    this.d.setDrawColor(...((warning ? [248, 224, 163] : [224, 234, 241]) as Color));
    this.d.setLineWidth(.45);
    this.d.roundedRect(b.x, b.y, b.w, b.h, 6, 6, 'FD');
    this.icon(icon, b.x + 8, b.y + 7, 19, warning ? this.accent : DARK);
    this.flow.drawDisplayLine(title, b.x + 33, b.y + 9, b.w - 41, id, this.small ? 10 : 11, true, INK, b.y + b.h);
    return {
      x: b.x + 8,
      y: b.y + 29,
      w: b.w - 16,
      h: b.h - 37
    };
  }
  private keyLabel(row: ReportRow) {
    const field = row.evidenceRefs.find(ref => ref.startsWith('fact:'))?.slice(5);
    const labels: Record<string, [string, string, string]> = {
      assessorId: ['APN', 'APN', 'APN'],
      zoning: ['Zoneamento', 'Zoning', 'Zonificación'],
      lotSizeSqft: ['Área do terreno', 'Lot size', 'Área del terreno'],
      lotSizeAcres: ['Terreno em acres', 'Lot acres', 'Terreno en acres'],
      annualPropertyTax: ['Imposto anual', 'Annual tax', 'Impuesto anual'],
      latestSalePrice: ['Última venda', 'Latest sale', 'Última venta'],
      latestSaleDate: ['Data da venda', 'Sale date', 'Fecha de venta']
    };
    return field && labels[field] ? this.t(...labels[field]) : row.label;
  }
  private rowHeight(row: ReportRow, width: number, size = this.font) {
    return this.factRowsPlan([row], width, size).height;
  }
  private factRowsPlan(rows: ReportRow[], width: number, size: number, columns = 1, balanced = false) {
    return layoutReportFacts(rows, width, columns, (text, w) => this.h(text, w, size), row => this.keyLabel(row), balanced);
  }
  private rows(rows: ReportRow[], b: Box, id: string, size = this.font, columns = 1, balanced = false) {
    const plan = this.factRowsPlan(rows, b.w, size, columns, balanced);
    for (const cell of plan.cells) {
      const x = b.x + cell.x, y = b.y + cell.y;
      if (cell.stacked) {
        const labelEnd = this.write(this.keyLabel(cell.row), x, y, cell.width, id, size, false, BODY, b.y + b.h);
        this.write(cell.row.value, x, labelEnd + 2, cell.width, id, size, false, INK, b.y + b.h);
      } else {
        this.write(this.keyLabel(cell.row), x, y, cell.width * .43, id, size, false, BODY, b.y + b.h);
        this.write(cell.row.value, x + cell.width * .43 + 7, y, cell.width * .57 - 7, id, size, false, INK, b.y + b.h);
      }
    }
    return b.y + plan.height;
  }
  private factsHeight(rows: ReportRow[], width: number, size = this.font, columns = 1) {
    return this.factRowsPlan(rows, width, size, columns).height;
  }
  private basicBlockSize(block: ContentBlock) {
    const width = W - 18,
      heading = Math.max(12, this.h(block.title, width, 7.5, true));
    let body = (block.rows?.length ? this.factsHeight(block.rows, width, 6.8, 2) : 0)
      + (block.text ? this.h(block.text, width, 6.8) : 0);
    if (block.table?.length) {
      const widths = this.tableColumnWidths(block, width);
      if (block.columns?.length) body += this.tableRowHeight(block.columns, widths, true);
      body += block.table.reduce((sum, row) => sum + this.tableRowHeight(row, widths), 0);
    }
    if (block.afterText) body += 3 + this.h(block.afterText, width, 6.8);
    return { heading, height: heading + body + 4 };
  }
  /** Measure every remaining block before drawing the bottom half of the one-page release. */
  private basicLowerPlan(blocks: ContentBlock[], start: number, hasGallery: boolean, note: ContentBlock | undefined, showMap: boolean, mapId?: string) {
    const sources = blocks.find(block => block.id === 'report-sources'),
      noteWidth = (showMap ? W * (1 - DESIGN.overview.mapWidthRatio) - G : W) - 16,
      previousGap = this.flow.lineGap;
    for (const galleryHeight of hasGallery ? [DESIGN.gallery.heights.PROPERTY_RELEASE, 92, 74] : [0]) {
      for (const lineGap of [2, 1]) {
        this.flow.lineGap = lineGap;
        const rowTop = start + (hasGallery ? galleryHeight + 9 : 0),
          noteLines = note ? this.flow.lines(note.text || '', noteWidth, 7) : [],
          sourceHeight = sources ? 14 + this.factsHeight(sources.rows || [], noteWidth, 6.5) + (sources.text ? this.h(sources.text, noteWidth, 6.5) : 0) : 0;
        for (const inlineSources of note && sources ? [true, false] : [false]) {
          const remaining = blocks.filter(block => !this.used.has(block.id)
            && block.id !== note?.id && block.id !== mapId && block.id !== 'report-location'
            && !(inlineSources && block.id === sources?.id)),
            baseline = [...this.details, ...remaining],
            baselineHeight = baseline.reduce((sum, block) => sum + this.basicBlockSize(block).height, 0),
            naturalHeight = note ? 37 + noteLines.length * (7 + lineGap) + (inlineSources ? 5 + sourceHeight : 0) : 0,
            height = showMap ? DESIGN.overview.mapHeight : note ? Math.max(42, Math.min(naturalHeight, BOTTOM - rowTop - baselineHeight - G)) : 0,
            capacity = Math.max(0, Math.floor((height - 37 - (inlineSources ? 5 + sourceHeight : 0)) / (7 + lineGap)));
          if (inlineSources && noteLines.length > capacity) continue;
          const continued = note && noteLines.length > capacity ? {
            ...note, id: note.id + '-continued', text: noteLines.slice(capacity).join(' ')
          } : null;
          const tail = [...this.details, ...(continued ? [continued] : []), ...remaining],
            tailHeight = tail.reduce((sum, block) => sum + this.basicBlockSize(block).height, 0),
            cursor = rowTop + height + (height && tail.length ? G : 0);
          if (cursor + tailHeight <= BOTTOM + .01) {
            this.flow.lineGap = previousGap;
            return { galleryHeight, height, lineGap, inlineSources, capacity, cursor };
          }
        }
      }
    }
    this.flow.lineGap = previousGap;
    throw Error('REPORT_REFERENCE_BASIC_OVERFLOW');
  }
  private range(range: NonNullable<ContentBlock['range']>, b: Box, id: string) {
    const y = b.y + 17;
    this.d.setFillColor(225, 233, 239);
    this.d.roundedRect(b.x, y, b.w, 9, 4.5, 4.5, 'F');
    this.d.setFillColor(...this.accent);
    this.d.roundedRect(b.x, y, Math.max(9, b.w * Math.max(0, Math.min(1, range.position))), 9, 4.5, 4.5, 'F');
    const third = b.w / 3;
    [range.low, range.estimate, range.high].forEach((value, i) => this.write(value, b.x + i * third, y + 20, third, id, 9, i === 1, INK, b.y + b.h));
  }
  private donut(value: number, cx: number, cy: number, r: number, id: string, percent = true) {
    const score = Math.max(0, Math.min(100, value));
    this.d.setDrawColor(222, 228, 233);
    this.d.setLineWidth(r * .25);
    this.d.circle(cx, cy, r, 'S');
    this.d.setDrawColor(...this.accent);
    for (let i = 0; i < Math.ceil(score * 2); i++) {
      const a = (-90 + i * 1.8) * Math.PI / 180,
        b = (-90 + Math.min(score * 3.6, (i + 1) * 1.8)) * Math.PI / 180;
      this.d.line(cx + Math.cos(a) * r, cy + Math.sin(a) * r, cx + Math.cos(b) * r, cy + Math.sin(b) * r);
    }
    const label = percent ? `${value}%` : String(value);
    this.d.setFont('NotoSans', 'bold');
    this.d.setFontSize(24);
    const width = this.d.getTextWidth(label);
    this.write(label, cx - width / 2, cy - 14, width + 1, id, 24, true, INK, cy + r);
  }
  private iconFor(block: ContentBlock) {
    if (block.id === 'reference-conclusion-summary') return 'chart';
    if (block.id === 'reference-conclusion-profile') return 'target';
    if (block.id === 'reference-conclusion-questions') return 'question';
    if (block.table) return 'list';
    if (block.range && /arv/.test(block.id)) return 'tag';
    return /positive-signals/.test(block.id) ? 'check' : /-checks$|final-actions|operating-evidence/.test(block.id) ? 'gear' : /-considerations$/.test(block.id) ? 'scales' : /risk|pending|limitation|questions/.test(block.id) ? 'warning' : /profile|publisher/.test(block.id) ? 'user' : block.map ? 'pin' : /market-rent/.test(block.id) ? 'home' : block.range || /financial|scenario/.test(block.id) ? 'chart' : /land|parcel/.test(block.id) ? 'pin' : 'document';
  }
  private presentedRows(block: ContentBlock) {
    const rows = block.rows || [],
      parts = rows.map(row => row.value.split(' · ')),
      origins = parts.map(part => part.slice(1).join(' · '));
    const common = rows.length > 1 && origins.every(origin => origin === origins[0] && /calcul|informad|report|confirm|provided|estim|record|declar|publicad|assum|source|fonte/i.test(origin));
    if (common) return {
      rows: rows.map((row, index) => ({
        ...row,
        value: parts[index][0]
      })),
      origin: origins[0]
    };
    const qualified = origins.filter(origin => /calcul|informad|report|confirm|provided|estim|record|declar|publicad|assum|source|fonte/i.test(origin)),
      unique = [...new Set(qualified)];
    if (!unique.length || rows.length < 2) return {
      rows,
      origin: ''
    };
    return {
      rows: rows.map((row, index) => {
        const n = unique.indexOf(origins[index]);
        return n < 0 ? row : {
          ...row,
          value: parts[index][0] + ' [' + String.fromCharCode(97 + n) + ']'
        };
      }),
      origin: unique.map((origin, index) => '[' + String.fromCharCode(97 + index) + '] ' + origin).join('\n')
    };
  }
  private measureCard(block: ContentBlock, width: number) {
    if (block.kind === 'disclaimer') return 24 + this.h(block.text || '', width - 45, 7.2);
    const inner = width - 16,
      columns = width > 400 ? 2 : 1;
    let h = 37;
    if (block.hero) h += this.h(block.hero.value, inner, 17, true) + 5;
    if (block.text) h += this.h(block.text, inner) + 5;
    if (block.rows?.length) {
      const display = this.presentedRows(block);
      h += this.factsHeight(display.rows, inner, this.font, columns) + (display.origin ? 6 + this.h(display.origin, inner, 8) : 0);
    }
    if (block.range) h += 63;
    if (block.afterText) h += 5 + this.h(block.afterText, inner);
    if (block.table) {
      const widths = this.tableColumnWidths(block, inner);
      h += this.tableRowHeight(block.columns || [], widths, true) + block.table.reduce((n, row) => n + this.tableRowHeight(row, widths), 0);
    }
    if (block.map) h += 213 + this.h(block.map.caption, inner, 8);
    if (block.comparison?.length) h += block.comparison.length * 31;
    return h;
  }
  private tableColumnWidths(block: ContentBlock, width: number) {
    const count = block.columns?.length || 1;
    return count === 7 ? [.04, .30, .14, .13, .09, .19, .11].map(r => width * r) : count === 3 ? [.22, .39, .39].map(r => width * r) : Array(count).fill(width / count);
  }
  private tableRowHeight(row: string[], widths: number[], bold = false) {
    return Math.max(...row.map((text, i) => this.h(text, widths[i] - 8, 7.5, bold))) + 4;
  }
  private card(block: ContentBlock, b: Box) {
    if (block.kind === 'disclaimer') {
      this.d.setFillColor(255, 250, 234);
      this.d.setDrawColor(248, 224, 163);
      this.d.roundedRect(b.x, b.y, b.w, b.h, 6, 6, 'FD');
      this.icon('warning', b.x + 9, b.y + 10, 17, this.accent);
      this.write(block.title, b.x + 35, b.y + 6, b.w - 45, block.id, 8.5, true, INK, b.y + b.h);
      this.write(block.text || '', b.x + 35, b.y + 22, b.w - 45, block.id, 7.2, false, BODY, b.y + b.h);
      this.audit(block.id, block.title, block.kind, b, block.readingSection);
      this.used.add(block.id);
      return b.y + b.h;
    }
    const body = this.frame(b, block.title, this.iconFor(block), block.id, /-missing$|^report-pending$|limitation/.test(block.id));
    let y = body.y;
    if (block.hero) y = this.write(block.hero.value, body.x, y, body.w, block.id, 17, true, this.accent, b.y + b.h) + 5;
    if (block.text) y = this.write(block.text, body.x, y, body.w, block.id, this.font, false, BODY, b.y + b.h) + 5;
    if (block.rows?.length) {
      const display = this.presentedRows(block);
      y = this.rows(display.rows, {
        ...body,
        y,
        h: b.y + b.h - y - 8
      }, block.id, this.font, b.w > 400 ? 2 : 1);
      if (display.origin) y = this.write(display.origin, body.x, y + 6, body.w, block.id, 8, false, BODY, b.y + b.h);
    }
    if (block.map) {
      const image = block.map.sourceId ? this.maps[block.map.sourceId] : this.location;
      this.flow.drawMap(block.map.points, body.x, y, body.w, 200, block.id, image);
      y += 205;
      y = this.write(block.map.caption + (image ? ' © OpenStreetMap contributors.' : ' Schematic, not to scale.'), body.x, y, body.w, block.id, 8, false, BODY, b.y + b.h) + 8;
    }
    if (block.table) {
      const widths = this.tableColumnWidths(block, body.w);
      const drawRow = (row: string[], bold = false, index = -1) => {
        const h = this.tableRowHeight(row, widths, bold);
        this.d.setFillColor(...((bold ? [231, 237, 241] : index % 2 === 0 ? [245, 248, 250] : [251, 253, 254]) as Color));
        this.d.roundedRect(body.x, y, body.w, h, 3, 3, 'F');
        let x = body.x;
        row.forEach((cell, i) => {
          this.write(cell, x + 3, y + 2, widths[i] - 8, block.id, 7.5, bold, INK, b.y + b.h);
          x += widths[i];
        });
        y += h;
      };
      drawRow(block.columns || [], true);
      block.table.forEach((row, index) => drawRow(row, false, index));
    }
    if (block.range) {
      this.range(block.range, {
        ...body,
        y,
        h: 63
      }, block.id);
      y += 63;
    }
    if (block.comparison?.length) {
      const maximum = Math.max(1, ...block.comparison.map(item => item.value));
      for (const item of block.comparison) {
        this.write(item.label, body.x, y, body.w * .42, block.id, 8.5);
        const x = body.x + body.w * .45,
          width = body.w * .35;
        this.d.setFillColor(224, 232, 238);
        this.d.roundedRect(x, y + 3, width, 7, 3.5, 3.5, 'F');
        if (item.value > 0) {
          this.d.setFillColor(...this.accent);
          this.d.roundedRect(x, y + 3, Math.max(1, width * item.value / maximum), 7, 3.5, 3.5, 'F');
        }
        this.write(item.text, x + width + 7, y, body.w * .2 - 7, block.id, 8.5, true, INK, b.y + b.h);
        y += 31;
      }
    }
    if (block.afterText) this.write(block.afterText, body.x, y + 5, body.w, block.id, this.font, false, BODY, b.y + b.h);
    this.audit(block.id, block.title, block.kind, b, block.readingSection);
    this.used.add(block.id);
    return b.y + b.h;
  }
  private characteristics() {
    return ['beds', 'baths', 'sqft'].flatMap((key, slot) => {
      const row = this.vm.property.metrics.find(item => item.evidenceRefs.includes('fact:' + key));
      return row && !['UNAVAILABLE', 'CONFLICTED', 'NOT_APPLICABLE'].includes(row.state || '') ? [{
        row,
        slot,
        icon: ['bed', 'bath', 'area'][slot]
      }] : [];
    });
  }
  private propertyFrame(b: Box) {
    this.d.setFillColor(251, 253, 254);
    this.d.setDrawColor(225, 234, 240);
    this.d.setLineWidth(.65);
    this.d.roundedRect(b.x, b.y, b.w, b.h, 6, 6, 'FD');
  }
  private context() {
    const p = this.vm.property,
      b = {
        x: DESIGN.propertyStrip.x,
        y: DESIGN.propertyStrip.y,
        w: DESIGN.propertyStrip.width,
        h: DESIGN.propertyStrip.height
      };
    this.propertyFrame(b);
    if (p.photos[0]) this.flow.image(p.photos[0], b.x + 4, b.y + 4, 96, 50, 'cover');else {
      this.d.setFillColor(236, 241, 244);
      this.d.roundedRect(b.x + 4, b.y + 4, 96, 50, 4, 4, 'F');
      this.icon('home', b.x + 40, b.y + 15, 27, DARK);
    }
    const id = 'reference-context';
    this.flow.drawDisplayLine(p.address, 132, b.y + 9, 184, id, 10.5, true, INK, b.y + b.h);
    this.flow.drawDisplayLine(p.location, 132, b.y + 33, 184, id, 8, false, BODY, b.y + b.h);
    this.flow.drawDisplayLine(p.price, 326, b.y + 8, 88, id, 14.5, true, this.accent, b.y + b.h);
    const identity = [p.type, p.strategy].filter(Boolean).join(' · ');
    this.d.setFillColor(...this.accent);
    this.d.roundedRect(421, b.y + 8, 139, 15, 3, 3, 'F');
    this.flow.drawDisplayLine(identity, 425, b.y + 11, 131, id, 7, true, this.enterprise ? INK : [255, 255, 255], b.y + b.h);
    this.characteristics().forEach(({
      row,
      slot,
      icon
    }) => {
      const x = 326 + slot * 79;
      this.icon(icon, x, b.y + 35, 12, this.accent);
      this.flow.drawDisplayLine(row.value, x + 17, b.y + 37, 58, id, 8, false, INK, b.y + b.h);
    });
    this.audit('reference-property-strip-' + this.flow.pages.length, 'Subject property', 'property-strip', b);
  }
  private mapLegend(map: NonNullable<ContentBlock['map']>, box: Box, id: string) {
    const entries: {
      label: string;
      icon: string;
      color: Color;
    }[] = [];
    if (map.points.some(point => point.marker === 'S')) entries.push({
      label: this.t('Imóvel em análise', 'Subject property', 'Inmueble en análisis'),
      icon: 'home',
      color: DARK
    });
    const tones = new Set(map.points.filter(point => point.marker !== 'S').map(point => point.markerTone || 'comparable'));
    for (const tone of tones) entries.push({
      icon: 'pin',
      color: tone === 'sold' ? [230, 164, 22] : tone === 'for-sale' ? [220, 53, 69] : tone === 'complementary' ? [139, 92, 246] : [13, 135, 111],
      label: tone === 'sold' ? this.t('Venda registrada', 'Recorded sale', 'Venta registrada') : tone === 'for-sale' ? this.t('Anúncio de suporte', 'For-sale support', 'Anuncio de apoyo') : this.t('Imóvel comparável', 'Comparable property', 'Inmueble comparable')
    });
    const width = 128,
      height = 10 + entries.length * 15,
      points = this.flow.audit.maps.at(-1)?.points || [];
    const candidates = [{
      x: box.x + box.w - width - 5,
      y: box.y + 5
    }, {
      x: box.x + 5,
      y: box.y + 5
    }, {
      x: box.x + box.w - width - 5,
      y: box.y + box.h - height - 5
    }, {
      x: box.x + 5,
      y: box.y + box.h - height - 5
    }];
    const place = candidates.find(candidate => points.every(point => point.x + point.radius + 3 < candidate.x || point.x - point.radius - 3 > candidate.x + width || point.y + point.radius + 3 < candidate.y || point.y - point.radius - 3 > candidate.y + height));
    if (!place || !entries.length) return; // Never cover a plotted comparable with the legend.
    this.d.setFillColor(255, 255, 255);
    this.d.setDrawColor(225, 234, 240);
    this.d.roundedRect(place.x, place.y, width, height, 4, 4, 'FD');
    entries.forEach((entry, index) => {
      const y = place.y + 6 + index * 15;
      this.icon(entry.icon, place.x + 7, y, 10, entry.color);
      this.write(entry.label, place.x + 24, y + 1, width - 30, id + '-legend', 7.5, false, INK, place.y + height);
    });
  }
  private marketPages(tables: ContentBlock[]) {
    const mapped = tables.filter(table => table.map),
      half = (W - G) / 2;
    for (let index = 0; index < mapped.length; index += 2) {
      const pair = mapped.slice(index, index + 2),
        height = pair.length === 2 ? DESIGN.comparableMaps.pairedHeight : DESIGN.comparableMaps.singleHeight,
        width = pair.length === 2 ? half : W;
      if (this.cursor + height > BOTTOM) this.next();
      pair.forEach((table, column) => {
        const map = table.map!,
          b = {
            x: X + column * (width + G),
            y: this.cursor,
            w: width,
            h: height
          },
          body = this.frame(b, table.title, 'pin', table.id + '-map'),
          image = map.sourceId ? this.maps[map.sourceId] : undefined;
        this.flow.drawMap(map.points, body.x, body.y, body.w, height - 38, table.id, image);
        this.mapLegend(map, {
          x: body.x,
          y: body.y,
          w: body.w,
          h: height - 38
        }, table.id);
        this.audit(table.id + '-map', table.title, 'reference-map', b, 3);
      });
      this.cursor += height + G;
    }
    for (const table of tables) {
      const plain = {
          ...table,
          map: undefined
        },
        height = this.measureCard(plain, W);
      if (this.cursor + height > BOTTOM) this.next();
      this.card(plain, {
        x: X,
        y: this.cursor,
        w: W,
        h: height
      });
      this.cursor += height + G;
    }
    const captions = [...new Set(mapped.map(table => table.map!.caption))].filter(Boolean);
    if (captions.length) {
      const hasRaster = mapped.every(table => !!this.maps[table.map!.sourceId || '']),
        block: ContentBlock = {
          id: 'reference-market-observations',
          title: this.t('Observações da análise', 'Analysis notes', 'Observaciones del análisis'),
          kind: 'text',
          text: captions.join('\n\n') + (hasRaster ? ' © OpenStreetMap contributors.' : ' Schematic, not to scale.'),
          readingSection: 3
        };
      const height = this.measureCard(block, W);
      if (this.cursor + height <= BOTTOM) {
        this.card(block, {
          x: X,
          y: this.cursor,
          w: W,
          h: height
        });
        this.cursor += height + G;
      } else this.details.push(block);
    }
  }
  private flushDetails(select: (block: ContentBlock) => boolean) {
    const candidates = this.details.filter(block => !this.used.has(block.id) && select(block));
    for (const block of candidates) {
      if (this.used.has(block.id)) continue;
      const full = !!block.table || !!block.map || !!block.range || (block.rows?.length || 0) > 6 || /criteria-details|report-sources|^saved-scenario/.test(block.id),
        width = full ? W : (W - G) / 2,
        measured = this.measureCard(block, width);
      let height = measured;
      if (this.cursor + height > BOTTOM) continue;
      const partner = !full ? candidates.find(other => other !== block && !this.used.has(other.id) && !other.table && !other.map && !other.range && (other.rows?.length || 0) <= 6 && this.cursor + this.measureCard(other, width) <= BOTTOM) : undefined;
      if (partner) height = Math.max(height, this.measureCard(partner, width));
      this.card(block, {
        x: X,
        y: this.cursor,
        w: width,
        h: height
      });
      if (partner) this.card(partner, {
        x: X + width + G,
        y: this.cursor,
        w: width,
        h: height
      });
      this.cursor += height + G;
    }
  }
  private async overview(blocks: ContentBlock[], yieldRendering: () => Promise<void>) {
    const basic = this.vm.reportType === 'PROPERTY_RELEASE',
      p = this.vm.property,
      hero = basic ? DESIGN.release.heroHeight : this.brief ? 132 : !p.photos.length ? 124 : this.enterprise ? 155 : 150;
    this.chapter(this.t('Property Overview', 'Property Overview', 'Property Overview'), this.t('Informações gerais do imóvel', 'Property overview and context', 'Información general del inmueble'), 'home', false, hero);
    await yieldRendering();
    const top = this.cursor,
      textWidth = p.photos.length ? 246 : W - 14,
      photoX = 291,
      photoWidth = 274;
    let y = this.write(p.address, X + 7, top, textWidth, 'property-overview', basic ? 15 : 18, true, INK);
    y = this.write(p.location, X + 7, y + 4, textWidth, 'property-overview', basic ? 8 : 9, false, BODY) + 7;
    const identity = [p.type, p.strategy].filter(Boolean).join(' · '),
      badgeH = this.h(identity, textWidth - 14, basic ? 7 : 8, true) + 8;
    y = this.write(p.price, X + 7, y, textWidth, 'property-overview', basic ? 22 : 25, true, this.accent) + 7;
    this.d.setFillColor(...this.accent);
    this.d.roundedRect(X + 7, y, textWidth - 4, badgeH, 4, 4, 'F');
    this.write(identity, X + 14, y + 4, textWidth - 18, 'property-overview', basic ? 7 : 8, true, this.enterprise ? INK : [255, 255, 255], y + badgeH);
    y += badgeH;
    const characteristics = this.characteristics(),
      metrics = characteristics.map(item => item.row);
    characteristics.forEach(({
      row,
      slot,
      icon
    }) => {
      const x = X + 7 + slot * 82,
        my = Math.max(y + 7, top + hero - 31);
      this.icon(icon, x, my, 16, this.accent);
      this.flow.drawDisplayLine(row.value, x + 22, my + 2, 58, 'property-overview', basic ? 7 : 8.5, false, INK, my + 22);
    });
    if (p.photos[0]) this.flow.image(p.photos[0], photoX, top, photoWidth, hero, 'cover');
    this.audit('property-overview', p.title, 'overview', {
      x: X,
      y: top,
      w: W,
      h: hero
    }, 1);
    this.used.add('property-overview');
    await yieldRendering();
    const facts = blocks.filter(block => block.id.startsWith('property-group-'));
    const owner = facts.filter(block => /publisher|publicador/i.test(block.title)),
      sales = facts.filter(block => /sale history|histórico|historial/i.test(block.title));
    const publisher = owner.length ? [...owner, ...sales] : [];
    const physical = facts.filter(block => !publisher.includes(block) && /property facts|dados do imóvel|datos del inmueble/i.test(block.title));
    const parcel = facts.filter(block => !publisher.includes(block) && !physical.includes(block) && !sales.includes(block) && !/tax|fisc|impost/i.test(block.title));
    const taxes = facts.filter(block => !publisher.includes(block) && !physical.includes(block) && !parcel.includes(block));
    let groups = [publisher, physical, parcel];
    if (!publisher.length) groups = [physical, parcel, taxes];else if (!basic) physical.push(...taxes);
    // The one-page release gives land, tax and sale records two internal columns.
    // Keep their existing values together instead of extending both cards vertically.
    const compactRecords = basic ? [...parcel, ...taxes] : undefined;
    if (basic) groups = [publisher, physical, compactRecords!];
    groups = groups.filter(group => group.length);
    const count = Math.max(1, groups.length),
      size = basic ? 7 : 8;
    const weight = groups.reduce((sum, group) => sum + (group === compactRecords ? 2 : 1), 0) || 1;
    const widths = groups.map(group => (W - (count - 1) * G) * (group === compactRecords ? 2 : 1) / weight);
    const priorLineGap = this.flow.lineGap;
    this.flow.lineGap = DESIGN.facts.lineGap;
    const factsTop = top + hero + DESIGN.overview.paddingBottom + DESIGN.overview.factsGap,
      maxFactHeight = Math.max(0, DESIGN.facts.bottom - factsTop),
      maxBodyHeight = maxFactHeight - DESIGN.facts.headerHeight - DESIGN.facts.bottomPadding;
    const plans = groups.map((group, index) => {
      const rows = group.flatMap(block => block.rows || []), width = widths[index] - 16;
      let columns = group === compactRecords ? DESIGN.release.recordsColumns : 1, fontSize = size;
      let layout = this.factRowsPlan(rows, width, fontSize, columns, true);
      if (layout.height > maxBodyHeight && columns === 1) {
        columns = 2;
        layout = this.factRowsPlan(rows, width, fontSize, columns, true);
      }
      if (layout.height > maxBodyHeight && fontSize > DESIGN.facts.minimumFontSize) {
        fontSize = DESIGN.facts.minimumFontSize;
        layout = this.factRowsPlan(rows, width, fontSize, columns, true);
      }
      let shown = rows.length;
      while (shown && layout.height > maxBodyHeight) {
        shown--;
        layout = this.factRowsPlan(rows.slice(0, shown), width, fontSize, columns, true);
      }
      return { rows: rows.slice(0, shown), tail: rows.slice(shown), layout, columns, fontSize };
    });
    const factHeight = !groups.length ? 0 : Math.min(maxFactHeight, Math.max(basic || this.brief ? 86 : 100, ...plans.map(plan => DESIGN.facts.headerHeight + plan.layout.height + DESIGN.facts.bottomPadding)));
    groups.forEach((group, index) => {
      const width = widths[index];
      const b = {
        x: X + widths.slice(0, index).reduce((sum, item) => sum + item + G, 0),
        y: factsTop,
        w: width,
        h: factHeight
      };
      const title = group === publisher ? this.t('Informações do publicador', 'Publisher information', 'Información del publicador') : group === physical ? this.t('Detalhes do imóvel', 'Property details', 'Detalles del inmueble') : group === taxes || group === compactRecords ? this.t('Registros fiscais', 'Tax records', 'Registros fiscales') : this.t('Dados do terreno', 'Land information', 'Datos del terreno');
      const id = 'overview-facts-' + index,
        body = this.frame(b, title, group === publisher ? 'user' : group === physical ? 'home' : 'pin', id);
      body.h = b.h - DESIGN.facts.headerHeight - DESIGN.facts.bottomPadding;
      const plan = plans[index];
      let rowY = this.rows(plan.rows, body, id, plan.fontSize, plan.columns, true);
      if (plan.tail.length) this.details.push({ id: id + '-continued', title, kind: 'facts', rows: plan.tail, readingSection: 1 });
      group.forEach(block => this.used.add(block.id));
      if (group === physical) {
        const extra: ReportRow[] = [{
          label: this.t('Tipo', 'Property type', 'Tipo'),
          value: p.type,
          evidenceRefs: ['property:identity']
        }, ...metrics];
        for (const row of extra) {
          const h = this.rowHeight(row, body.w, plan.fontSize);
          if (rowY + h <= b.y + b.h - 9) {
            this.rows([row], {
              ...body,
              y: rowY,
              h: b.y + b.h - rowY - 8
            }, id, plan.fontSize);
            rowY += h;
          }
        }
      }
      this.audit(id, title, 'reference-facts', b, 1);
      const entry = this.flow.audit.sections.at(-1)!;
      entry.selectedFontSize = plan.fontSize;
      entry.factColumns = plan.columns;
    });
    this.flow.lineGap = priorLineGap;
    await yieldRendering();
    taxes.forEach(block => this.used.add(block.id));
    let next = factsTop + factHeight + DESIGN.gallery.gapBefore;
    const note = blocks.find(block => block.id === 'listing-description'),
      map = blocks.find(block => block.map && !block.map.sourceId) || (p.locationPoint ? {
        id: 'overview-location', title: 'Location map', kind: 'map' as const,
        map: { points: [p.locationPoint], caption: '' }
      } : undefined),
      showMap = !!map && !!this.location,
      basicPlan = basic ? this.basicLowerPlan(blocks, next, p.photos.length > 1, note, showMap, map?.id) : undefined;
    const gallery = p.photos.slice(1, 5);
    if (gallery.length) {
      const height = basicPlan?.galleryHeight ?? DESIGN.gallery.heights[this.vm.reportType],
        b = {
          x: X,
          y: next,
          w: W,
          h: height
        },
        body = this.frame(b, this.t('Fotos do imóvel', 'Property photos', 'Fotos del inmueble'), 'photos', 'property-gallery');
      const cell = (body.w - (gallery.length - 1) * 5) / gallery.length;
      for (const [i, photo] of gallery.entries()) {
        this.flow.image(photo, body.x + i * (cell + 5), b.y + DESIGN.gallery.imageTop, cell, height - DESIGN.gallery.imageTop - DESIGN.gallery.paddingBottom, 'cover');
        await yieldRendering();
      }
      this.audit('property-gallery', 'Property photos', 'photos', b, 1);
      next += height + 9;
    }
    if (basicPlan) this.flow.lineGap = basicPlan.lineGap;
    const mapWidth = W * DESIGN.overview.mapWidthRatio,
      sources = blocks.find(block => block.id === 'report-sources'),
      noteBodyWidth = (showMap ? W - mapWidth - G : W) - 16,
      sourceHeight = sources ? 14 + this.factsHeight(sources.rows || [], noteBodyWidth, 6.5) + (sources.text ? this.h(sources.text, noteBodyWidth, 6.5) : 0) : 0,
      candidateHeight = Math.max(42, Math.min(showMap ? DESIGN.overview.mapHeight : Infinity, BOTTOM - next)),
      inlineSources = basicPlan?.inlineSources ?? (this.small && !!note && !!sources && this.h(note.text || '', noteBodyWidth, basic ? 7 : 8.5) + 5 + sourceHeight <= candidateHeight - 37),
      notesHeight = basicPlan?.height ?? candidateHeight;
    if (showMap) {
      const b = {
          x: X,
          y: next,
          w: mapWidth,
          h: notesHeight
        },
        body = this.frame(b, this.t('Mapa de localização', 'Location map', 'Mapa de ubicación'), 'pin', map!.id);
      this.flow.drawMap(map!.map!.points, body.x, body.y, body.w, Math.max(15, body.h - 13), map!.id, this.location);
      this.write('© OpenStreetMap contributors', body.x, b.y + b.h - 16, body.w, map!.id, 6.5, false, BODY, b.y + b.h);
      this.audit(map!.id, map!.title, 'map', b, 1);
      this.used.add(map!.id);
      await yieldRendering();
    }
    if (map && !showMap) this.used.add(map.id);
    if (note) {
      const b = {
          x: showMap ? X + mapWidth + G : X,
          y: next,
          w: showMap ? W - mapWidth - G : W,
          h: notesHeight
        },
        body = this.frame(b, this.t('Notas', 'Notes', 'Notas'), 'document', note.id),
        noteSize = basic ? 7 : 8.5;
      const lines = this.flow.lines(note.text || '', body.w, noteSize),
        capacity = basicPlan?.capacity ?? Math.max(0, Math.floor(body.h / (noteSize + this.flow.lineGap)));
      const noteEnd = this.flow.drawLines(lines.slice(0, capacity), body.x, body.y, body.w, note.id, noteSize, false, BODY, b.y + b.h);
      if (lines.length > capacity) this.details.push({
        ...note,
        id: note.id + '-continued',
        text: lines.slice(capacity).join(' ')
      });
      if (this.small && sources && (!basicPlan || basicPlan.inlineSources)) {
        const need = 14 + this.factsHeight(sources.rows || [], body.w, 6.5) + (sources.text ? this.h(sources.text, body.w, 6.5) : 0);
        if (noteEnd + 5 + need <= b.y + b.h - 6) {
          const sy = this.write(sources.title, body.x, noteEnd + 5, body.w, sources.id, 7, true, INK, b.y + b.h);
          let sourceY = sy + 3;
          if (sources.rows?.length) sourceY = this.rows(sources.rows, {
            ...body,
            y: sourceY,
            h: b.y + b.h - sourceY - 4
          }, sources.id, 6.5);
          if (sources.text) this.write(sources.text, body.x, sourceY, body.w, sources.id, 6.5, false, BODY, b.y + b.h);
          this.used.add(sources.id);
        }
      }
      this.audit(note.id, note.title, 'text', b, 1);
      this.used.add(note.id);
    }
    this.cursor = basicPlan?.cursor ?? (note || showMap ? BOTTOM : next);
  }
  private profile(block: ContentBlock, risk: ContentBlock | undefined) {
    const start = this.cursor,
      half = (W - G) / 2,
      topH = this.small ? 125 : 140,
      bottomH = this.small ? 145 : 150;
    const criteria = block.comparison || [],
      rows = (block.rows || []).filter(row => !criteria.some(item => item.label === row.label));
    const left = {
        x: X,
        y: start,
        w: half,
        h: topH
      },
      right = {
        x: X + half + G,
        y: start,
        w: half,
        h: topH
      };
    const profile = this.frame(left, this.t('Perfil do investidor', 'Investor profile', 'Perfil del inversor'), 'user', block.id);
    const rowSize = 8;
    let shown: ReportRow[] = [],
      tail: ReportRow[] = [];
    for (const row of rows) {
      if (this.factsHeight([...shown, row], profile.w, rowSize) <= profile.h) shown.push(row);else tail.push(row);
    }
    this.rows(shown, profile, block.id, rowSize);
    if (tail.length) this.details.push({
      ...block,
      id: block.id + '-detail',
      rows: tail,
      text: undefined,
      score: undefined,
      comparison: undefined
    });
    const gauge = this.frame(right, this.t('Match Score / Compatibilidade', 'Match Score / Compatibility', 'Match Score / Compatibilidad'), 'target', block.id);
    if (block.score !== undefined) this.donut(block.score, gauge.x + 65, gauge.y + (this.small ? 43 : 51), this.small ? 33 : 39, block.id);
    if (block.text) {
      const x = gauge.x + 132,
        width = gauge.w - 132,
        size = this.small ? 7.5 : 9;
      const lines = this.flow.lines(block.text, width, size),
        cap = Math.floor(gauge.h / (size + this.flow.lineGap));
      this.flow.drawLines(lines.slice(0, cap), x, gauge.y, width, block.id, size, false, BODY, right.y + right.h);
      if (lines.length > cap) this.details.push({
        ...block,
        id: block.id + '-explanation',
        rows: undefined,
        score: undefined,
        comparison: undefined,
        text: lines.slice(cap).join(' ')
      });
    }
    const lowerY = start + topH + G,
      criteriaBox = {
        x: X,
        y: lowerY,
        w: half,
        h: bottomH
      },
      bars = this.frame(criteriaBox, this.t('Fit por critério', 'Fit by criterion', 'Compatibilidad por criterio'), 'chart', block.id);
    let y = bars.y;
    for (const [index, item] of criteria.entries()) {
      const size = this.small ? 7.5 : 9,
        step = Math.max(this.small ? 24 : 26, this.h(item.label, bars.w * .44, size) + 7);
      if (y + step > criteriaBox.y + criteriaBox.h - 8) {
        this.details.push({
          id: block.id + '-criterion-' + index,
          title: item.label,
          kind: 'text',
          text: item.text
        });
        continue;
      }
      this.write(item.label, bars.x, y, bars.w * .44, block.id, size);
      const bx = bars.x + bars.w * .46,
        bw = bars.w * .39;
      this.d.setFillColor(222, 229, 234);
      this.d.roundedRect(bx, y + 3, bw, 9, 4.5, 4.5, 'F');
      if (item.value > 0) {
        this.d.setFillColor(...this.accent);
        this.d.roundedRect(bx, y + 3, Math.max(1, bw * Math.min(1, item.value / 100)), 9, 4.5, 4.5, 'F');
      }
      this.write(item.text, bx + bw + 5, y, bars.w * .15 - 5, block.id, 8, true, this.accent);
      y += step;
    }
    const evidence = (block.rows || []).filter(row => criteria.some(item => item.label === row.label)),
      riskBox = {
        x: X + half + G,
        y: lowerY,
        w: half,
        h: bottomH
      },
      riskBody = this.frame(riskBox, risk?.title || this.t('Critérios e evidências', 'Criteria and evidence', 'Criterios y evidencia'), 'warning', risk?.id || block.id);
    const riskText = risk?.text || '';
    let riskEnd = riskBody.y;
    if (riskText) {
      const size = 8.5,
        lines = this.flow.lines(riskText, riskBody.w - 21, size),
        capacity = Math.floor(riskBody.h / (size + this.flow.lineGap));
      this.icon('warning', riskBody.x, riskBody.y + 2, 13, this.accent);
      riskEnd = this.flow.drawLines(lines.slice(0, capacity), riskBody.x + 21, riskBody.y, riskBody.w - 21, risk?.id || block.id, size, false, BODY, riskBox.y + riskBox.h);
      if (lines.length > capacity) this.details.push({
        id: (risk?.id || block.id) + '-continued',
        title: risk?.title || 'Criteria evidence',
        kind: 'text',
        text: lines.slice(capacity).join('\n')
      });
    }
    if (evidence.length) {
      let y = riskEnd + 5;
      const rest: ReportRow[] = [];
      for (const row of evidence) {
        const text = row.label + ': ' + row.value,
          h = this.h(text, riskBody.w, 7.2);
        if (y + h <= riskBox.y + riskBox.h - 8) {
          this.write(text, riskBody.x, y, riskBody.w, block.id, 7.2, false, BODY, riskBox.y + riskBox.h);
          y += h + 2;
        } else rest.push(row);
      }
      if (rest.length) this.details.push({
        id: block.id + '-criteria-details',
        title: this.t('Evidências dos critérios', 'Criteria evidence', 'Evidencia de criterios'),
        kind: 'facts',
        rows: rest,
        readingSection: 5
      });
    }
    this.audit(block.id, block.title, 'reference-profile', left, 5);
    this.audit(block.id + '-gauge', 'Match Score', 'reference-gauge', right, 5);
    this.audit(block.id + '-criteria', 'Fit by criterion', 'reference-bars', criteriaBox, 5);
    this.audit(risk?.id || block.id + '-evidence', risk?.title || 'Evidence', 'reference-risk', riskBox, 5);
    this.used.add(block.id);
    if (risk) this.used.add(risk.id);
    this.cursor = lowerY + bottomH + G;
    if (this.enterprise && this.cursor + 90 < BOTTOM) {
      const b = {
          x: X,
          y: this.cursor,
          w: W,
          h: Math.min(110, BOTTOM - this.cursor)
        },
        body = this.frame(b, this.t('Resumo de evidências', 'Evidence summary', 'Resumen de evidencia'), 'document', 'reference-profile-evidence'),
        width = (body.w - 24) / 3,
        parts = [{
          title: this.t('Pontos favoráveis', 'Positive signals', 'Puntos favorables'),
          text: this.vm.executive?.opportunity?.text || this.vm.sections.find(section => section.id === 'positive-signals')?.items?.map(item => item.text).join('\n') || '',
          icon: 'check'
        }, {
          title: this.t('Pontos de atenção', 'Watchpoints', 'Puntos de atención'),
          text: this.vm.executive?.blocker?.text || risk?.text || '',
          icon: 'warning'
        }, {
          title: this.t('Conclusão', 'Conclusion', 'Conclusión'),
          text: this.vm.executive?.thesis.text || this.vm.executive?.status || '',
          icon: 'chart'
        }];
      parts.forEach((part, index) => {
        const x = body.x + index * (width + 12);
        this.icon(part.icon, x, body.y, 15, index === 1 ? this.accent : DARK);
        this.flow.drawDisplayLine(part.title, x + 23, body.y + 1, width - 23, 'reference-profile-evidence', 9.5, true, INK, b.y + b.h);
        const lines = this.flow.lines(part.text, width, 8),
          cap = Math.max(0, Math.floor((body.h - 24) / 12));
        this.flow.drawLines(lines.slice(0, cap), x, body.y + 24, width, 'reference-profile-evidence', 8, false, BODY, b.y + b.h);
        if (lines.length > cap) this.details.push({
          id: 'reference-profile-evidence-' + index,
          title: part.title,
          kind: 'text',
          text: lines.slice(cap).join(' ')
        });
      });
      this.audit('reference-profile-evidence', 'Evidence summary', 'reference-evidence-summary', b, 5);
      this.cursor = b.y + b.h + G;
    }
  }
  private kpis(block: ContentBlock) {
    const rows = block.rows || [],
      columns = Math.min(4, rows.length);
    if (!columns) return;
    const width = (W - (columns - 1) * G) / columns,
      size = this.small ? 11 : 14,
      titleHeight = Math.max(...rows.map(row => this.h(row.label, width - 42, 9, true)));
    const heights = rows.map(row => {
      const pieces = row.value.split(' · ');
      return 21 + titleHeight + this.h(pieces[0], width - 22, size, true) + this.h(pieces.slice(1).join(' · '), width - 22, 8);
    });
    for (let i = 0; i < rows.length; i += columns) {
      const height = Math.max(...heights.slice(i, i + columns));
      if (this.cursor + height > BOTTOM) this.next();
      rows.slice(i, i + columns).forEach((row, index) => {
        const b = {
            x: X + index * (width + G),
            y: this.cursor,
            w: width,
            h: height
          },
          pieces = row.value.split(' · ');
        this.d.setFillColor(251, 253, 254);
        this.d.setDrawColor(224, 234, 241);
        this.d.roundedRect(b.x, b.y, b.w, b.h, 7, 7, 'FD');
        this.icon(index % 2 ? 'pie' : 'chart', b.x + 8, b.y + 11, 18, DARK);
        this.write(row.label, b.x + 33, b.y + 10, b.w - 42, block.id, 9, true, INK, b.y + b.h);
        const y = this.write(pieces[0], b.x + 11, b.y + titleHeight + 17, b.w - 22, block.id, size, true, this.accent, b.y + b.h);
        if (pieces.length > 1) this.write(pieces.slice(1).join(' · '), b.x + 11, y + 3, b.w - 22, block.id, 8, false, BODY, b.y + b.h);
        this.audit(block.id + '-kpi-' + (i + index), row.label, 'reference-kpi', b, 4);
      });
      this.cursor += height + G;
    }
    this.used.add(block.id);
  }
  private boundedCard(block: ContentBlock, b: Box) {
    const size = this.font,
      width = b.w - 16,
      visible = {
        ...block
      },
      tail: ContentBlock = {
        ...block,
        id: block.id + '-continued',
        hero: undefined,
        range: undefined,
        rows: undefined,
        text: undefined
      };
    let room = b.h - 37 - (block.hero ? this.h(block.hero.value, width, 17, true) + 5 : 0) - (block.range ? 63 : 0),
      shown: ReportRow[] = [];
    for (const row of block.rows || []) {
      const h = this.rowHeight(row, width, size);
      if (room >= h) {
        shown.push(row);
        room -= h;
      } else (tail.rows ||= []).push(row);
    }
    visible.rows = shown.length ? shown : undefined;
    if (block.text) {
      const lines = this.flow.lines(block.text, width, size),
        count = Math.max(0, Math.floor((room - 5) / (size + this.flow.lineGap)));
      visible.text = lines.slice(0, count).join('\n');
      if (lines.length > count) tail.text = lines.slice(count).join('\n');
    }
    this.card(visible, b);
    if (tail.text || tail.rows?.length) this.details.push(tail);
  }
  private valuation(ranges: ContentBlock[], finance: ContentBlock[]) {
    const main = ranges.find(block => /arv/.test(block.id) && block.range) || ranges.find(block => block.range),
      inputs = finance.find(block => block.id === 'operating-evidence-facts') || finance.find(block => block.id !== 'financial-indicators' && block.rows?.length),
      indicators = finance.find(block => block.id === 'financial-indicators');
    if (!main) {
      this.flowCards(ranges);
      if (indicators) this.kpis(indicators);
      this.details.push(...finance.filter(block => !this.used.has(block.id)));
      return;
    }
    const half = (W - G) / 2,
      top = this.cursor,
      height = 130;
    this.card({
      ...main,
      text: undefined,
      rows: undefined,
      hero: {
        value: main.range!.low + ' — ' + main.range!.high
      }
    }, {
      x: X,
      y: top,
      w: half,
      h: height
    });
    const notes: ContentBlock = {
      id: main.id + '-notes',
      title: this.t('Notas da avaliação', 'Valuation notes', 'Notas de valoración'),
      kind: 'facts',
      text: main.text,
      rows: main.rows,
      readingSection: 3
    };
    if (inputs) {
      const first = {
        ...inputs,
        title: this.t('Principais inputs da análise', 'Main analysis inputs', 'Datos principales del análisis')
      };
      this.boundedCard(first, {
        x: X + half + G,
        y: top,
        w: half,
        h: height
      });
      this.used.add(inputs.id);
    } else if (notes.text || notes.rows?.length) {
      this.boundedCard(notes, {
        x: X + half + G,
        y: top,
        w: half,
        h: height
      });
      this.used.add(notes.id);
    }
    this.cursor = top + height + G;
    if (indicators) {
      const order = (row: ReportRow) => /\bROI\b/i.test(row.label) ? 0 : /cap.*rate|capitaliza/i.test(row.label) ? 1 : /\bNOI\b|receita operacional/i.test(row.label) ? 2 : /monthly.*cash|fluxo.*mens|flujo.*mens/i.test(row.label) ? 3 : 4,
        ranked = [...(indicators.rows || [])].sort((a, b) => order(a) - order(b)),
        primary = ranked.slice(0, 4),
        extra = ranked.slice(4);
      this.icon('calculator', X + 10, this.cursor, 24, DARK);
      this.flow.drawDisplayLine('Investment Scenario Dashboard', X + 45, this.cursor + 3, W - 58, 'reference-dashboard', 12, true, INK, this.cursor + 30);
      this.cursor += 27;
      this.kpis({
        ...indicators,
        rows: primary
      });
      if (extra.length) this.details.push({
        ...indicators,
        id: indicators.id + '-additional',
        rows: extra
      });
    }
    const other = ranges.find(block => block.id !== main.id),
      third = (W - 2 * G) / 3,
      lowerH = Math.min(156, BOTTOM - this.cursor),
      lowerY = this.cursor;
    if (lowerH >= 145) {
      if (other) {
        this.boundedCard({
          ...other,
          text: undefined,
          rows: undefined
        }, {
          x: X,
          y: lowerY,
          w: third,
          h: lowerH
        });
        if (other.text || other.rows?.length) this.details.push({
          ...other,
          id: other.id + '-notes',
          range: undefined,
          hero: undefined
        });
        this.used.add(other.id);
      }
      const b = {
          x: X + third + G,
          y: lowerY,
          w: third,
          h: lowerH
        },
        body = this.frame(b, this.t('Referências de valor', 'Value range references', 'Referencias de valor'), 'pie', main.id + '-scenarios'),
        cx = body.x + 43,
        cy = body.y + 54,
        r = 34;
      const colors: Color[] = [this.accent, [163, 178, 190], [218, 226, 233]];
      for (let segment = 0; segment < 3; segment++) {
        this.d.setFillColor(...colors[segment]);
        for (let angle = segment * 120; angle < (segment + 1) * 120; angle += 3) {
          const a = (angle - 90) * Math.PI / 180,
            c = (angle - 87) * Math.PI / 180;
          this.d.triangle(cx, cy, cx + r * Math.cos(a), cy + r * Math.sin(a), cx + r * Math.cos(c), cy + r * Math.sin(c), 'F');
        }
      }
      this.d.setFillColor(255, 255, 255);
      this.d.circle(cx, cy, 23, 'F');
      this.flow.drawDisplayLine(main.range!.estimate, cx - 27, cy - 7, 54, main.id + '-scenarios', 12, true, INK, b.y + b.h);
      [main.range!.high, main.range!.estimate, main.range!.low].forEach((value, index) => {
        this.d.setFillColor(...colors[index]);
        this.d.circle(body.x + 88, body.y + 11 + index * 31, 3, 'F');
        this.write(value, body.x + 96, body.y + 4 + index * 31, body.w - 96, main.id + '-scenarios', 8.5, true, INK, b.y + b.h);
      });
      this.write(this.t('Referências de faixa, não probabilidades.', 'Range references, not probabilities.', 'Referencias del rango, no probabilidades.'), body.x, body.y + 107, body.w, main.id + '-scenarios', 8, false, BODY, b.y + b.h);
      this.audit(main.id + '-scenarios', 'Value range references', 'reference-range-chart', b, 3);
      if (!this.used.has(notes.id) && (notes.text || notes.rows?.length)) {
        this.boundedCard(notes, {
          x: X + 2 * (third + G),
          y: lowerY,
          w: third,
          h: lowerH
        });
        this.used.add(notes.id);
      }
      this.cursor += lowerH + G;
    } else {
      this.details.push(notes);
      if (other) {
        this.details.push(other);
        this.used.add(other.id);
      }
    }
    for (const block of ranges.filter(block => !this.used.has(block.id))) this.details.push(block);
    this.details.push(...finance.filter(block => !this.used.has(block.id)));
  }
  private verification(pending: ContentBlock) {
    const signals = this.vm.sections.find(section => section.id === 'positive-signals')?.items?.map(item => item.text) || [];
    const groups = new Map<string, string[]>();
    for (const row of pending.table || []) {
      const labels = groups.get(row[2]) || [];
      labels.push(row[0]);
      groups.set(row[2], labels);
    }
    const actions = [...groups].map(([action, labels], index) => `${index + 1}. ${labels.join(', ')}\n${action}`).join('\n\n');
    const blocks: ContentBlock[] = [...(signals.length ? [{
      id: 'reference-positive-signals',
      title: this.t('Sinais positivos', 'Positive signals', 'Señales positivas'),
      kind: 'text' as const,
      text: signals.join('\n\n')
    }] : []), ...(pending.table?.length ? [{
      id: pending.id + '-missing',
      title: this.t('O que ainda falta', 'What’s Missing', 'Qué falta'),
      kind: 'text' as const,
      text: pending.table.map(row => row[0] + '\n' + row[1]).join('\n\n')
    }] : []), ...(pending.text ? [{
      id: pending.id + '-considerations',
      title: this.t('Considerações', 'Considerations', 'Consideraciones'),
      kind: 'text' as const,
      text: pending.text.replace(this.vm.executive?.thesis.text || '\u0000', '').trim()
    }].filter(block => block.text) : []), ...(actions || pending.afterText ? [{
      id: pending.id + '-checks',
      title: this.t('Verificações recomendadas', 'Recommended Verification Steps', 'Verificaciones recomendadas'),
      kind: 'text' as const,
      text: [actions, pending.afterText].filter(Boolean).join('\n\n')
    }] : [])];
    const half = (W - G) / 2,
      firstHeight = 124,
      secondHeight = Math.max(124, ...blocks.slice(2).map(block => this.measureCard(block, half))),
      start = this.cursor;
    blocks.slice(0, 4).forEach((block, index) => {
      const b = {
        x: X + index % 2 * (half + G),
        y: start + Math.floor(index / 2) * (firstHeight + G),
        w: half,
        h: index < 2 ? firstHeight : secondHeight
      };
      this.boundedCard(block, b);
    });
    this.cursor = start + (blocks.length > 2 ? firstHeight + G + secondHeight : firstHeight) + G;
    this.used.add(pending.id);
    if (this.cursor + 32 <= BOTTOM) {
      const b = {
        x: X,
        y: this.cursor,
        w: W,
        h: 32
      };
      this.d.setFillColor(246, 249, 250);
      this.d.roundedRect(b.x, b.y, b.w, b.h, 6, 6, 'F');
      this.flow.drawDisplayLine(this.t('“Verificação rigorosa reduz riscos.”', '“Rigorous verification reduces risks.”', '“La verificación rigurosa reduce riesgos.”'), X + 44, b.y + 7, W - 88, 'reference-quotation', 11, false, INK, b.y + b.h);
      this.write('— Maxxis AI', X + 237, b.y + 20, 130, 'reference-quotation', 7, false, INK, b.y + b.h);
      this.audit('reference-quotation', 'Verification', 'reference-quote', b, 2);
      this.cursor += 32 + G;
    }
  }
  private conclusion(profile: ContentBlock | undefined, pending: ContentBlock | undefined, disclaimer: ContentBlock | undefined, remaining: ContentBlock[] = []) {
    this.chapter('Maxxis AI Analysis', this.t('Conclusão adaptada ao perfil', 'Profile-aware conclusion', 'Conclusión adaptada al perfil'), 'brain');
    const half = (W - G) / 2,
      start = this.cursor,
      summary = this.vm.executive?.thesis.text || this.vm.executive?.status || '',
      criteria = (profile?.rows || []).filter(row => !profile?.comparison?.some(item => item.label === row.label));
    const cards: ContentBlock[] = [{
      id: 'reference-conclusion-summary',
      title: this.t('Síntese da oportunidade', 'Opportunity Summary', 'Resumen de la oportunidad'),
      kind: 'text',
      text: summary
    }, {
      id: 'reference-conclusion-profile',
      title: this.t('Conclusão por perfil', 'Segment-Specific Conclusion', 'Conclusión según perfil'),
      kind: 'facts',
      rows: criteria.slice(0, 2),
      text: this.vm.executive?.status
    }, {
      id: 'reference-conclusion-topics',
      title: this.t('Principais pontos', 'Main Topics', 'Temas principales'),
      kind: 'facts',
      rows: this.vm.executive?.coverage.slice(0, 3) || []
    }, {
      id: 'reference-conclusion-questions',
      title: this.t('Questões em aberto', 'Open Questions', 'Preguntas abiertas'),
      kind: 'text',
      text: pending?.table?.map(row => '• ' + row[0]).join('\n\n') || pending?.text || this.vm.executive?.blocker?.text
    }];
    const initialDetails = this.details.length;
    cards.forEach((block, index) => {
      if (!block.text && !block.rows?.length) return;
      this.boundedCard(block, {
        x: X + index % 2 * (half + G),
        y: start + Math.floor(index / 2) * 117,
        w: half,
        h: 110
      });
    });
    this.cursor = start + 234;
    const actions = [...new Set(pending?.table?.map(row => row[2]) || [])].slice(0, 5);
    if (actions.length) {
      const cell = (W - 22 - (actions.length - 1) * 12) / actions.length,
        height = 37 + Math.max(...actions.map(action => this.h(action, cell - 25, 7.5))),
        b = {
          x: X,
          y: this.cursor,
          w: W,
          h: height
        },
        body = this.frame(b, this.t('Ações recomendadas', 'Recommended Actions', 'Acciones recomendadas'), 'gear', 'reference-final-actions');
      actions.forEach((action, index) => {
        this.icon('number', body.x + index * (cell + 12), body.y - 1, 17, DARK);
        this.write(String(index + 1), body.x + 5 + index * (cell + 12), body.y + 1, 12, 'reference-final-actions', 9, true, [255, 255, 255], b.y + b.h);
        this.write(action, body.x + 25 + index * (cell + 12), body.y, cell - 25, 'reference-final-actions', 7.5, false, BODY, b.y + b.h);
      });
      this.audit('reference-final-actions', 'Recommended actions', 'reference-actions', b, 6);
      this.cursor += height + G;
    }
    const continuation = this.details.slice(initialDetails).filter(block => !this.used.has(block.id));
    const detail = [...continuation, ...remaining.filter(block => !this.used.has(block.id) && !continuation.some(other => other.id === block.id))];
    if (detail.length) this.flowCards(detail);
    const disclaimerHeight = disclaimer ? this.measureCard(disclaimer, W) : 0;
    if (this.cursor + 26 + G + disclaimerHeight <= BOTTOM) {
      const quote = {
        x: X,
        y: this.cursor,
        w: W,
        h: 26
      };
      this.d.setFillColor(247, 250, 251);
      this.d.roundedRect(quote.x, quote.y, quote.w, quote.h, 5, 5, 'F');
      this.flow.drawDisplayLine(this.t('“Análise inteligente hoje, melhores investimentos amanhã.”', '“Intelligent analysis today, better investments tomorrow.”', '“Análisis inteligente hoy, mejores inversiones mañana.”'), X + 39, quote.y + 3, W - 78, 'reference-final-quote', 10, false, this.accent, quote.y + quote.h);
      this.write('— Maxxis AI', X + 237, quote.y + 16, 130, 'reference-final-quote', 6.5, false, INK, quote.y + quote.h);
      this.audit('reference-final-quote', 'Maxxis AI', 'reference-quote', quote, 6);
      this.cursor += 26 + G;
    }
    if (disclaimer) {
      if (this.cursor + disclaimerHeight > BOTTOM) this.next();
      this.card(disclaimer, {
        x: X,
        y: this.cursor,
        w: W,
        h: disclaimerHeight
      });
      this.cursor += disclaimerHeight;
    }
  }
  private flowCards(blocks: ContentBlock[], forceFull = false) {
    const queue = [...blocks];
    while (queue.length) {
      const block = queue.shift()!,
        full = forceFull || !!block.table || !!block.map || !!block.range || (block.rows?.length || 0) > 6 || /criteria-details|report-sources|^saved-scenario/.test(block.id) || block.kind === 'disclaimer',
        width = full ? W : (W - G) / 2;
      let height = this.measureCard(block, width);
      if (height > BOTTOM - 151) {
        if (block.rows && block.rows.length > 1) {
          const half = Math.ceil(block.rows.length / 2);
          queue.unshift({
            ...block,
            rows: block.rows.slice(0, half)
          }, {
            ...block,
            id: block.id + '-part-next',
            rows: block.rows.slice(half),
            text: undefined,
            range: undefined,
            hero: undefined
          });
          continue;
        }
        if (block.text) {
          const lines = this.flow.lines(block.text, width - 22, this.font),
            capacity = Math.floor((BOTTOM - 151 - 55) / (this.font + this.flow.lineGap));
          if (lines.length > capacity) {
            queue.unshift({
              ...block,
              text: lines.slice(0, capacity).join(' ')
            }, {
              ...block,
              id: block.id + '-part-next',
              text: lines.slice(capacity).join(' '),
              rows: undefined,
              range: undefined,
              hero: undefined
            });
            continue;
          }
        }
        throw Error('REPORT_REFERENCE_BLOCK_EXCEEDS_PAGE:' + block.id);
      }
      let partner: ContentBlock | undefined;
      if (!full) {
        const index = queue.findIndex(item => !item.table && (item.rows?.length || 0) <= 6 && !item.range && !item.map && item.kind !== 'disclaimer' && !/report-sources|criteria-details/.test(item.id));
        if (index >= 0) {
          partner = queue.splice(index, 1)[0];
          height = Math.max(height, this.measureCard(partner, width));
        }
      }
      if (this.cursor + height > BOTTOM && this.small && full && (block.rows?.length || 0) > 2) {
        let split = false;
        for (let count = block.rows!.length - 2; count >= 2; count -= 2) {
          const head = {
              ...block,
              rows: block.rows!.slice(0, count)
            },
            headHeight = this.measureCard(head, width);
          if (this.cursor + headHeight <= BOTTOM) {
            this.card(head, {
              x: X,
              y: this.cursor,
              w: width,
              h: headHeight
            });
            this.cursor += headHeight + G;
            queue.unshift({
              ...block,
              id: block.id + '-continued',
              rows: block.rows!.slice(count),
              text: undefined,
              hero: undefined,
              range: undefined
            });
            split = true;
            break;
          }
        }
        if (split) continue;
      }
      if (this.cursor + height > BOTTOM) this.next();
      this.card(block, {
        x: X,
        y: this.cursor,
        w: width,
        h: height
      });
      if (partner) this.card(partner, {
        x: X + width + G,
        y: this.cursor,
        w: width,
        h: height
      });
      this.cursor += height + G;
    }
  }
  async draw(yieldRendering: () => Promise<void>) {
    this.flow.lineGap = 2;
    const blocks = composeReportContent(this.vm),
      analytical = blocks.some(block => !!block.range || block.id === 'profile-compatibility' || !!block.table && block.readingSection === 3),
      themed = this.enterprise && analytical;
    // Sparse reports keep the same identity without reserving empty analytical panels.
    this.brief = !analytical;
    await this.overview(blocks, yieldRendering);
    await yieldRendering();
    if (this.vm.reportType === 'PROPERTY_RELEASE') {
      const tail = [...this.details, ...blocks.filter(block => !this.used.has(block.id) && block.id !== 'report-location')];
      for (const block of tail) {
        const measured = this.basicBlockSize(block), needed = measured.height;
        if (this.cursor + needed > BOTTOM) throw Object.assign(Error('REPORT_REFERENCE_BASIC_OVERFLOW'), {
          layoutPlans: tail.map(item => ({
            id: item.id,
            rows: item.rows?.length,
            chars: item.text?.length,
            cursor: this.cursor,
            needed
          }))
        });
        let y = this.cursor;
        this.write(block.title, X + 9, y, W - 18, block.id, 7.5, true, INK);
        y += measured.heading;
        if (block.rows?.length) y = this.rows(block.rows, {
          x: X + 9,
          y,
          w: W - 18,
          h: BOTTOM - y
        }, block.id, 6.8, 2);
        if (block.text) y = this.write(block.text, X + 9, y, W - 18, block.id, 6.8, false, BODY);
        if (block.table?.length) {
          const widths = this.tableColumnWidths(block, W - 18),
            rows = [...(block.columns?.length ? [block.columns] : []), ...block.table];
          for (const [index, row] of rows.entries()) {
            const heading = !!block.columns?.length && index === 0;
            let x = X + 9;
            row.forEach((text, column) => {
              this.write(text, x + 4, y, widths[column] - 8, block.id, 7.5, heading, BODY);
              x += widths[column];
            });
            y += this.tableRowHeight(row, widths, heading);
          }
        }
        if (block.afterText) y = this.write(block.afterText, X + 9, y + 3, W - 18, block.id, 6.8, false, BODY);
        this.audit(block.id, block.title, block.kind, {
          x: X,
          y: this.cursor,
          w: W,
          h: y - this.cursor
        }, block.readingSection);
        this.cursor = y + 4;
        this.used.add(block.id);
      }
      this.flow.lineGap = 2;
    } else {
      const market = blocks.filter(block => block.kind === 'table' && block.readingSection === 3).sort((a, b) => Number(!/sales|sold|landAcquisition/i.test(a.id)) - Number(!/sales|sold|landAcquisition/i.test(b.id)));
      if (market.length) {
        this.chapter(this.t('Análise comparativa de mercado', 'Comparative Market Analysis', 'Análisis comparativo de mercado'), this.t('Imóveis comparáveis e análise de mercado', 'Comparable properties and market analysis', 'Comparables y análisis de mercado'));
        for (const [marketIndex, table] of market.entries()) {
          const source = this.vm.sections.find(section => section.id === table.id.replace(/-table$/, '')),
            map = blocks.find(block => block.map?.sourceId + '-table' === table.id);
          if (source?.map?.points.some(point => point.id !== 'subject')) table.map = {
            ...source.map,
            sourceId: source.id
          };else if (map) table.map = map.map;
          if (map) this.used.add(map.id);
        }
        this.marketPages(market);
      }
      const rangeBlocks = blocks.filter(block => block.readingSection === 3 && !this.used.has(block.id) && !block.map);
      const finance = blocks.filter(block => block.readingSection === 4);
      if (rangeBlocks.length || finance.length) {
        if (this.enterprise || !this.flow.pages.length || this.cursor > BOTTOM - 180) this.chapter(this.t('Avaliação / ARV / Indicadores', 'Valuation Intelligence / ARV / KPIs', 'Valoración / ARV / Indicadores'), this.t('Análise de valor, métricas e potencial de retorno', 'Value analysis, metrics and return potential', 'Análisis de valor, métricas y rentabilidad'), 'chart', this.enterprise);
        if (this.enterprise) {
          this.valuation(rangeBlocks, finance);
          this.flushDetails(block => !/^saved-scenario/.test(block.id));
        } else {
          this.flowCards(rangeBlocks);
          this.flowCards(finance.filter(block => !this.used.has(block.id)), true);
        }
      }
      const profile = blocks.find(block => block.id === 'profile-compatibility'),
        risk = blocks.find(block => /risk-considerations|decision-blockers/.test(block.id));
      if (profile) {
        if (this.enterprise || this.cursor + (this.small ? 324 : 397) > BOTTOM) this.chapter(this.t('Adequação do investimento e riscos', 'Investment Fit & Risk Analysis', 'Compatibilidad y riesgos'), this.t('Perfil do investidor, adequação e riscos', 'Investor profile, fit and risk analysis', 'Perfil del inversor, compatibilidad y riesgos'), 'home', this.enterprise);
        this.profile(profile, risk);
        if (themed) this.flushDetails(block => !/^saved-scenario/.test(block.id));
      }
      const pending = blocks.find(block => block.id === 'report-pending');
      if (pending) {
        const shownPending: ContentBlock = this.small && pending.table?.length === 1 ? {
          ...pending,
          kind: 'text',
          text: [pending.text, pending.table[0][0] + ': ' + pending.table[0][1] + ' ' + pending.table[0][2]].filter(Boolean).join('\n\n'),
          afterText: pending.afterText?.replace(/\n/g, '; '),
          table: undefined,
          columns: undefined
        } : pending;
        if (themed || this.cursor + this.measureCard(shownPending, W) > BOTTOM) this.chapter(this.t('Conclusões e verificações', 'Key Insights & Verification', 'Conclusiones y verificación'), this.t('Principais conclusões e orientações de verificação', 'Key findings and verification guidance', 'Conclusiones y orientación de verificación'), 'home');
        if (themed) {
          this.verification(pending);
          this.flushDetails(block => /^saved-scenario/.test(block.id));
        } else this.flowCards([shownPending], true);
      }
      const remaining = [...this.details, ...blocks.filter(block => !this.used.has(block.id) && !this.details.some(detail => detail.id === block.id))];
      if (themed) {
        const detail = remaining.filter(block => !['report-disclaimer', 'executive-thesis'].includes(block.id));
        this.conclusion(profile, pending, blocks.find(block => block.id === 'report-disclaimer'), detail);
      } else if (remaining.length) {
        if (this.cursor + remaining.reduce((n, block) => n + this.measureCard(block, W) + G, 0) > BOTTOM && this.flow.pages.length < 3 && !this.brief) this.chapter(this.t('Análise Maxxis AI', 'Maxxis AI Analysis', 'Análisis Maxxis AI'), this.t('Conclusão adaptada ao perfil e fontes da análise', 'Profile-aware conclusion and analysis sources', 'Conclusión adaptada al perfil y fuentes'), 'chart');
        this.flowCards(remaining);
      }
    }
    const result = this.flow.finish();
    for (let page = 1; page <= result.pageCount; page++) {
      this.d.setPage(page);
      const pagination = `${this.t('Página', 'Page', 'Página')} ${page} ${this.t('de', 'of', 'de')} ${result.pageCount}`;
      this.write(readableReportDate(this.flow.meta.generatedAt, this.vm.locale), 35, 815, 350, 'footer-date', 7, false, BODY, 839);
      this.write(pagination, 475, 814, 90, 'footer-page', 9, true, INK, 839);
    }
    return result;
  }
}
