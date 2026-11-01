import { ReportBrandShell } from './reportBrandShell';
import { readingSectionTitle, READING_SECTIONS, type ReadingSection } from './reportReadingPlan';
import { composeReportContent, contentKey, readableReportDate, type ContentBlock } from './reportContentPlan';
const X = 26, WIDTH = 543.28, TOP = 130, BOTTOM = 790, PAD = 6, GAP = 4;
export class ContentReportComposition extends ReportBrandShell {
  private compact = false;
  private get bodySize() { return this.compact ? 8.5 : 9; }
  private renderWidth = WIDTH;
  private renderX = X;
  fullWidth(block: ContentBlock) { return ['overview', 'table', 'disclaimer'].includes(block.kind) || ['market-rent', 'financial-indicators', 'profile-compatibility', 'report-sources', 'listing-description'].includes(block.id); }
  setWidth(block: ContentBlock) { this.renderWidth = this.fullWidth(block) ? WIDTH : (WIDTH - GAP) / 2; }
  textHeight(text: string, width = this.renderWidth - 2 * PAD, size = this.bodySize, bold = false) { return this.flow.lines(text, width, size, bold).length * (size + 4); }
  tableWidths(block: ContentBlock) {
    const WIDTH = this.renderWidth;
    const count = block.columns?.length || 1, width = WIDTH - 2 * PAD;
    if(count===7)return [.04,.30,.14,.13,.09,.19,.11].map(ratio=>width*ratio);
    return count === 3 ? [width * .22, width * .43, width * .35] : count === 5 ? [width * .06, width * .41, width * .19, width * .18, width * .16] : Array.from({ length: count }, () => width / count);
  }
  rowHeight(row: string[], widths: number[]) { return Math.max(...row.map((cell, i) => this.textHeight(cell, widths[i] - 9, 8.5))) + 5; }
  measure(block: ContentBlock) {
    const WIDTH = this.renderWidth;
    if (block.kind === 'disclaimer') return 12 + this.textHeight(block.text || '', WIDTH - 2 * PAD, 8);
    let height = PAD * 2 + this.textHeight(block.title, WIDTH - 2 * PAD, 10, true) + 5;
    if (block.kind === 'overview') return height + Math.max(this.textHeight(block.text || '', (WIDTH - 2 * PAD) * .55, 10), block.photos?.length ? 94 : 0) + ((block.photos?.length || 0) > 1 ? 54 : 0);
    if (block.hero) height += 25;
    if (block.text) height += this.textHeight(block.text, WIDTH - 2 * PAD, block.textSize ?? this.bodySize);
    if (block.afterText) height += 4 + this.textHeight(block.afterText);
    if (block.rows?.length) for (let i = 0; i < block.rows.length; i += 2) height += Math.max(...block.rows.slice(i, i + 2).map(row => this.textHeight(`${row.label}: ${row.value}`, (WIDTH - 3 * PAD) / 2))) + 4;
    if (block.table?.length) { const widths = this.tableWidths(block); height += this.rowHeight(block.columns || [], widths) + block.table.reduce((sum, row) => sum + this.rowHeight(row, widths), 0); }
    if (block.map) height += (this.vm.reportType === 'PROPERTY_RELEASE' ? 95 : 135) + 5 + this.textHeight(block.map.caption, WIDTH - 2 * PAD, 8);
    if (block.kind === 'photos' && block.photos?.length) height += Math.ceil(block.photos.length / 4) * 76;
    if (block.score !== undefined) height += 42;
    return height;
  }
  fitBlocks(blocks: ContentBlock[]): ContentBlock[] {
    const result: ContentBlock[] = [];
    for (const block of blocks) {
      this.setWidth(block);
      if (this.measure(block) <= BOTTOM - TOP) { result.push(block); continue; }
      if (block.table) {
        let chunk: string[][] = [], index = 0;
        for (const row of block.table) {
          if (chunk.length && this.measure({ ...block, table: [...chunk, row] }) > BOTTOM - TOP) { result.push({ ...block, id: `${block.id}-${index++}`, table: chunk }); chunk = []; }
          chunk.push(row);
        }
        result.push({ ...block, id: `${block.id}-${index}`, table: chunk });
      } else if (block.rows) {
        let chunk: typeof block.rows = [], index = 0;
        for (const row of block.rows) {
          if (chunk.length && this.measure({ ...block, rows: [...chunk, row] }) > BOTTOM - TOP) { result.push({ ...block, id: `${block.id}-${index++}`, rows: chunk }); chunk = []; }
          chunk.push(row);
        }
        result.push({ ...block, id: `${block.id}-${index}`, rows: chunk });
      } else if (block.text) {
        const lines = this.flow.lines(block.text, this.renderWidth - 2 * PAD, 9), capacity = Math.floor((BOTTOM - TOP - 50) / 13);
        for (let i = 0; i < lines.length; i += capacity) result.push({ ...block, id: `${block.id}-${i / capacity}`, text: lines.slice(i, i + capacity).join('\n') });
      } else throw Error(`REPORT_BLOCK_EXCEEDS_PAGE:${block.id}`);
    }
    return result;
  }
  drawBlock(block: ContentBlock) {
    const WIDTH = this.renderWidth, X = this.renderX;
    const f = this.flow, d = f.doc, height = this.measure(block), y = f.y, end = y + height, before = f.audit.lines.length;
    if (height > BOTTOM - TOP) throw Error(`REPORT_BLOCK_EXCEEDS_PAGE:${block.id}`);
    if (block.kind !== 'disclaimer') {
      d.setFillColor(...(block.id.startsWith('report-pending') ? [255, 251, 239] : [249, 252, 254]) as [number, number, number]);
      d.setDrawColor(219, 233, 240); d.setLineWidth(.65); d.roundedRect(X, y, WIDTH, height, 7, 7, 'FD');
    }
    let cursor = block.kind === 'disclaimer' ? y + 6 : f.drawText(block.title, X + PAD, y + PAD, WIDTH - PAD * 2, block.id, 10, true, [12, 28, 65], end) + 5;
    if (block.kind === 'overview') {
      f.drawText(block.text || '', X + PAD, cursor, (WIDTH - PAD * 2) * .55, block.id, 10, false, [44, 70, 108], end);
      const galleryHeight = (block.photos?.length || 0) > 1 ? 54 : 0;
      if (block.photos?.[0]) f.image(block.photos[0], X + WIDTH * .59, cursor, WIDTH * .39 - PAD, height - (cursor - y) - PAD - galleryHeight, 'contain');
      const gallery = block.photos?.slice(1) || [];
      if (gallery.length) {
        const cell = (WIDTH - 2 * PAD) / gallery.length;
        gallery.forEach((photo, index) => f.image(photo, X + PAD + index * cell, end - PAD - 50, cell - GAP, 50, 'contain'));
      }
    } else {
      if (block.hero) cursor = f.drawText(block.hero.value, X + PAD, cursor, WIDTH - PAD * 2, block.id, 18, true, this.accent, end) + 3;
      if (block.text) cursor = f.drawText(block.text, X + PAD, cursor, WIDTH - PAD * 2, block.id, block.kind === 'disclaimer' ? 8 : block.textSize ?? this.bodySize, false, [44, 70, 108], end);
      for (let i = 0; i < (block.rows?.length || 0); i += 2) {
        const rows = block.rows!.slice(i, i + 2), half = (WIDTH - 3 * PAD) / 2;
        const rowH = Math.max(...rows.map(row => this.textHeight(`${row.label}: ${row.value}`, half))) + 4;
        rows.forEach((row, index) => f.drawText(`${row.label}: ${row.value}`, X + PAD + index * (half + PAD), cursor, half, block.id, this.bodySize, false, [44, 70, 108], end)); cursor += rowH;
      }
      if (block.table?.length) {
        const widths = this.tableWidths(block), drawRow = (row: string[], heading = false) => {
          let x = X + PAD; const h = this.rowHeight(row, widths);
          row.forEach((cell, index) => { f.drawText(cell, x + 3, cursor + 1, widths[index] - 9, block.id, 8.5, heading, [44, 70, 108], end); x += widths[index]; }); cursor += h;
        };
        drawRow(block.columns || [], true); block.table.forEach(row => drawRow(row));
      }
      if (block.afterText) cursor = f.drawText(block.afterText, X + PAD, cursor + 4, WIDTH - 2 * PAD, block.id, this.bodySize, false, [44, 70, 108], end);
      if (block.map) {
        const mapH = this.vm.reportType === 'PROPERTY_RELEASE' ? 95 : 135;
        const image = block.map.sourceId ? this.maps[block.map.sourceId] : this.location;
        f.drawMap(block.map.points, X + PAD, cursor, WIDTH - PAD * 2, mapH, block.id, image);
        f.drawText(block.map.caption, X + PAD, cursor + mapH + 5, WIDTH - PAD * 2, block.id, 8, false, [44, 70, 108], end);
      }
      if (block.kind === 'photos') block.photos?.forEach((photo, index) => f.image(photo, X + PAD + index % 4 * (WIDTH - 2 * PAD) / 4, cursor + Math.floor(index / 4) * 76, (WIDTH - 2 * PAD) / 4 - 5, 71, 'contain'));
      if (block.score !== undefined) {
        cursor = f.drawText(`Match Score: ${block.score}%`, X + PAD, cursor, WIDTH - 2 * PAD, block.id, 9, true, [44,70,108], end);
        const w = WIDTH - 2 * PAD; d.setFillColor(222, 232, 238); d.rect(X + PAD, cursor + 7, w, 7, 'F'); d.setFillColor(...this.accent); d.rect(X + PAD, cursor + 7, w * block.score / 100, 7, 'F');
        f.drawText('0%', X + PAD, cursor + 15, 35, block.id, 7, false, [44, 70, 108], end); f.drawText('100%', X + WIDTH - PAD - 30, cursor + 15, 30, block.id, 7, false, [44, 70, 108], end);
      }
    }
    f.audit.sections.push({ sectionId: block.id, title: block.title, kind: block.kind, page: d.getCurrentPageInfo().pageNumber, availableHeight: height, renderedLines: f.audit.lines.length - before, selectedFontSize: 9, clippedLines: 0, overflowPixels: 0,
      readingSection: block.readingSection, assertionIds: block.assertionIds, bounds: { x: X, y, width: WIDTH, height, right: X + WIDTH, bottom: end } });
    f.pages[f.pages.length - 1].sectionKeys.push(block.id); f.y = end + GAP;
  }
  async draw(yieldRendering: () => Promise<void>) {
    const original = composeReportContent(this.vm).filter(block => !block.map || !!(block.map.sourceId ? this.maps[block.map.sourceId] : this.location) || block.map.points.some(point => point.id !== 'subject'));
    // Keep geography beside the property/comparable context, before lower priority narrative.
    for (const block of original) if (block.map) {
      const real = !!(block.map.sourceId ? this.maps[block.map.sourceId] : this.location);
      block.map.caption += real ? ' \u00a9 OpenStreetMap contributors.' : ' Schematic, not to scale.';
    }
    const map = original.find(block => block.map);
    if (map) {
      const table = original.find(block => block.id === map.map!.sourceId + '-table');
      original.splice(original.indexOf(map), 1);
      if (table) table.map = map.map; // Table and its numbered geography are one intact block.
      else original.splice(1, 0, map);
    }
    const cap = this.vm.reportType === 'PROPERTY_RELEASE' ? 1 : this.vm.reportType === 'MAXXIS_ANALYSIS' ? 3 : Infinity;
    type Placement = { block?: ContentBlock; section: ReadingSection; page: number; column: number; y: number; height: number; heading?: boolean };
    const plan = (compact: boolean, forceBefore?: ReadingSection) => {
      this.compact = compact;
      const placements: Placement[] = [];
      let page = 0, cursor = TOP;
      const newPage = () => { page++; cursor = 86; };
      for (const section of READING_SECTIONS) {
        const queue = original.filter(block => block.readingSection === section);
        if (!queue.length) continue;
        if (compact && section === 1) queue.sort((a, b) => {
          if (a.id === 'property-overview') return -1;
          if (b.id === 'property-overview') return 1;
          this.setWidth(b); const bHeight = this.measure(b);
          this.setWidth(a); return bHeight - this.measure(a);
        });
        if (forceBefore === section && cursor > (page ? 86 : TOP)) newPage();
        let columns = [cursor, cursor];
        let headingNeeded = true;
        while (queue.length) {
          if (headingNeeded) {
            this.setWidth(queue[0]);
            if (Math.max(...columns) + 18 + this.measure(queue[0]) > BOTTOM) { newPage(); columns = [cursor, cursor]; }
            const y = Math.max(...columns);
            placements.push({ section, page, column: 0, y, height: 18, heading: true });
            columns = [y + 18, y + 18]; headingNeeded = false;
          }
          let index = queue.findIndex(block => { this.setWidth(block); return this.measure(block) <= BOTTOM - (this.fullWidth(block) ? Math.max(...columns) : Math.min(...columns)); });
          if (index < 0) {
            newPage(); columns = [cursor, cursor]; headingNeeded = true;
            this.setWidth(queue[0]);
            if (this.measure(queue[0]) + 18 > BOTTOM - 86) throw Error(Number.isFinite(cap) ? 'REPORT_PAGE_LIMIT_EXCEEDED:' + cap : 'REPORT_BLOCK_EXCEEDS_PAGE:' + queue[0].id);
            continue;
          }
          // Fill only gaps within this section. No earlier section is revisited.
          const [block] = queue.splice(index, 1); this.setWidth(block);
          const full = this.fullWidth(block), column = full || columns[0] <= columns[1] ? 0 : 1;
          const y = full ? Math.max(...columns) : columns[column], height = this.measure(block);
          placements.push({ block, section, page, column, y, height });
          if (full) columns = [y + height + GAP, y + height + GAP]; else columns[column] = y + height + GAP;
        }
        cursor = Math.max(...columns);
      }
      const lastArea = placements.filter(item => item.page === page).reduce((area, item) => area + (item.heading || this.fullWidth(item.block!) ? WIDTH : (WIDTH - GAP) / 2) * item.height, 0);
      return { placements, pages: page + 1, compact, orphan: lastArea / ((BOTTOM - (page ? 86 : TOP)) * WIDTH) < .25 };
    };
    const trials = [plan(false), plan(true), plan(true, 5), plan(true, 4)];
    const candidates = trials.filter(candidate => candidate.pages <= cap);
    candidates.sort((a,b) => a.pages - b.pages || Number(a.orphan) - Number(b.orphan) || Number(a.compact) - Number(b.compact));
    const selected = candidates[0];
    if (!selected) throw Object.assign(Error('REPORT_PAGE_LIMIT_EXCEEDED:' + cap), { layoutPlans: trials.map(trial => ({ compact: trial.compact, pages: trial.pages, blocks: trial.placements.map(item => ({ id: item.block?.id, section: item.section, page: item.page, y: item.y, height: item.height })) })) });
    this.compact = selected.compact;
    const keys = new Set<string>();
    for (let page = 0; page < selected.pages; page++) {
      this.page(this.vm.header.product, this.vm.header.subtitle);
      for (const item of selected.placements.filter(item => item.page === page)) {
        if (item.heading) {
          const id = 'reading-section-' + item.section + '-page-' + (page + 1), title = readingSectionTitle(item.section, this.vm.locale);
          this.flow.drawText(title, X + PAD, item.y, WIDTH - 2 * PAD, id, 10, true, this.accent, item.y + 18);
          this.flow.audit.sections.push({ sectionId: id, title, kind: 'heading', page: page + 1, readingSection: item.section, availableHeight: 18, renderedLines: 1, selectedFontSize: 10, clippedLines: 0, overflowPixels: 0, bounds: { x: X, y: item.y, width: WIDTH, height: 18, right: X + WIDTH, bottom: item.y + 18 } });
          continue;
        }
        const block = item.block!, key = contentKey(JSON.stringify(block));
        if (keys.has(key)) throw Error('DUPLICATE_REPORT_BLOCK:' + block.id); keys.add(key);
        this.setWidth(block); this.renderX = this.fullWidth(block) ? X : X + item.column * ((WIDTH + GAP) / 2); this.flow.y = item.y;
        this.drawBlock(block); await yieldRendering();
      }
    }
    const result = this.flow.finish();
    for (let page = 1; page <= result.pageCount; page++) {
      this.d.setPage(page); this.flow.drawText(readableReportDate(this.flow.meta.generatedAt, this.vm.locale), 35, 817, 400, 'footer-date', 7, false, [44, 70, 108], 839);
      this.flow.drawText(`${this.t('Página', 'Page', 'Página')} ${page} / ${result.pageCount}`, 485, 817, 80, 'footer-page', 7, false, [44, 70, 108], 839);
    }
    return result;
  }
}
