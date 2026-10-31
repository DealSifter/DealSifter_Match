import { ReportBrandShell } from './reportBrandShell';
import { composeReportContent, contentKey, type ContentBlock } from './reportContentPlan';
const X = 26, WIDTH = 543.28, TOP = 130, BOTTOM = 790, PAD = 9, GAP = 7;
export class ContentReportComposition extends ReportBrandShell {
  private renderWidth = WIDTH;
  private renderX = X;
  fullWidth(block: ContentBlock) { return ['overview', 'table', 'disclaimer'].includes(block.kind); }
  setWidth(block: ContentBlock) { this.renderWidth = this.fullWidth(block) ? WIDTH : (WIDTH - GAP) / 2; }
  textHeight(text: string, width = this.renderWidth - 2 * PAD, size = 9, bold = false) { return this.flow.lines(text, width, size, bold).length * (size + 4); }
  tableWidths(block: ContentBlock) {
    const WIDTH = this.renderWidth;
    const count = block.columns?.length || 1, width = WIDTH - 2 * PAD;
    return count === 3 ? [width * .22, width * .43, width * .35] : count === 5 ? [width * .06, width * .41, width * .19, width * .18, width * .16] : Array.from({ length: count }, () => width / count);
  }
  rowHeight(row: string[], widths: number[]) { return Math.max(...row.map((cell, i) => this.textHeight(cell, widths[i] - 9, 8.5))) + 5; }
  measure(block: ContentBlock) {
    const WIDTH = this.renderWidth;
    if (block.kind === 'disclaimer') return 12 + this.textHeight(block.text || '', WIDTH - 2 * PAD, 8);
    let height = PAD * 2 + this.textHeight(block.title, WIDTH - 2 * PAD, 10, true) + 5;
    if (block.kind === 'overview') return height + Math.max(this.textHeight(block.text || '', (WIDTH - 2 * PAD) * .55, 10), block.photos?.length ? 110 : 0);
    if (block.text) height += this.textHeight(block.text);
    if (block.rows?.length) for (let i = 0; i < block.rows.length; i += 2) height += Math.max(...block.rows.slice(i, i + 2).map(row => this.textHeight(`${row.label}: ${row.value}`, (WIDTH - 3 * PAD) / 2))) + 4;
    if (block.table?.length) { const widths = this.tableWidths(block); height += this.rowHeight(block.columns || [], widths) + block.table.reduce((sum, row) => sum + this.rowHeight(row, widths), 0); }
    if (block.map) height += (this.vm.reportType === 'PROPERTY_RELEASE' ? 95 : 135) + 5 + this.textHeight(block.map.caption, WIDTH - 2 * PAD, 8);
    if (block.kind === 'photos' && block.photos?.length) height += Math.ceil(block.photos.length / 4) * 76;
    if (block.score !== undefined) height += 29;
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
      if (block.photos?.[0]) f.image(block.photos[0], X + WIDTH * .59, cursor, WIDTH * .39 - PAD, height - (cursor - y) - PAD, 'contain');
    } else {
      if (block.text) cursor = f.drawText(block.text, X + PAD, cursor, WIDTH - PAD * 2, block.id, block.kind === 'disclaimer' ? 8 : 9, false, [44, 70, 108], end);
      for (let i = 0; i < (block.rows?.length || 0); i += 2) {
        const rows = block.rows!.slice(i, i + 2), half = (WIDTH - 3 * PAD) / 2;
        const rowH = Math.max(...rows.map(row => this.textHeight(`${row.label}: ${row.value}`, half))) + 4;
        rows.forEach((row, index) => f.drawText(`${row.label}: ${row.value}`, X + PAD + index * (half + PAD), cursor, half, block.id, 9, false, [44, 70, 108], end)); cursor += rowH;
      }
      if (block.table?.length) {
        const widths = this.tableWidths(block), drawRow = (row: string[], heading = false) => {
          let x = X + PAD; const h = this.rowHeight(row, widths);
          row.forEach((cell, index) => { f.drawText(cell, x + 3, cursor + 1, widths[index] - 9, block.id, 8.5, heading, [44, 70, 108], end); x += widths[index]; }); cursor += h;
        };
        drawRow(block.columns || [], true); block.table.forEach(row => drawRow(row));
      }
      if (block.map) {
        const mapH = this.vm.reportType === 'PROPERTY_RELEASE' ? 95 : 135;
        const image = block.map.sourceId ? this.maps[block.map.sourceId] : this.location;
        f.drawMap(block.map.points, X + PAD, cursor, WIDTH - PAD * 2, mapH, block.id, image);
        f.drawText(block.map.caption, X + PAD, cursor + mapH + 5, WIDTH - PAD * 2, block.id, 8, false, [44, 70, 108], end);
      }
      if (block.kind === 'photos') block.photos?.forEach((photo, index) => f.image(photo, X + PAD + index % 4 * (WIDTH - 2 * PAD) / 4, cursor + Math.floor(index / 4) * 76, (WIDTH - 2 * PAD) / 4 - 5, 71, 'contain'));
      if (block.score !== undefined) {
        const w = WIDTH - 2 * PAD; d.setFillColor(222, 232, 238); d.rect(X + PAD, cursor + 7, w, 7, 'F'); d.setFillColor(...this.accent); d.rect(X + PAD, cursor + 7, w * block.score / 100, 7, 'F');
        f.drawText('0%', X + PAD, cursor + 15, 35, block.id, 7, false, [44, 70, 108], end); f.drawText('100%', X + WIDTH - PAD - 30, cursor + 15, 30, block.id, 7, false, [44, 70, 108], end);
      }
    }
    f.audit.sections.push({ sectionId: block.id, title: block.title, kind: block.kind, page: d.getCurrentPageInfo().pageNumber, availableHeight: height, renderedLines: f.audit.lines.length - before, selectedFontSize: 9, clippedLines: 0, overflowPixels: 0,
      bounds: { x: X, y, width: WIDTH, height, right: X + WIDTH, bottom: end } });
    f.pages[f.pages.length - 1].sectionKeys.push(block.id); f.y = end + GAP;
  }
  async draw(yieldRendering: () => Promise<void>) {
    const original = composeReportContent(this.vm), queue = this.fitBlocks(original.filter(block => block.kind !== 'disclaimer'));
    const disclaimer = original.find(block => block.kind === 'disclaimer')!, keys = new Set<string>();
    const cap = this.vm.reportType === 'PROPERTY_RELEASE' ? 1 : this.vm.reportType === 'MAXXIS_ANALYSIS' ? 3 : Infinity;
    const nextPage = () => { if (this.flow.pages.length >= cap) throw Object.assign(Error(`REPORT_PAGE_LIMIT_EXCEEDED:${cap}`), { layoutAudit: this.flow.audit, remainingBlockIds: queue.map(block => block.id) }); this.page(this.vm.header.product, this.vm.header.subtitle); };
    nextPage();
    let columns = [TOP, TOP];
    while (queue.length) {
      let index = queue.findIndex(block => { this.setWidth(block); const y = this.fullWidth(block) ? Math.max(...columns) : Math.min(...columns); return this.measure(block) <= BOTTOM - y; });
      if (index >= 0 && this.fullWidth(queue[index])) {
        const gap = Math.abs(columns[0] - columns[1]);
        const filler = queue.findIndex(block => { this.setWidth(block); return !this.fullWidth(block) && this.measure(block) + GAP <= gap; });
        if (filler >= 0) index = filler;
      }
      if (index < 0) { nextPage(); columns = [TOP, TOP]; index = 0; }
      const [block] = queue.splice(index, 1), key = contentKey(JSON.stringify(block));
      if (keys.has(key)) throw Error(`DUPLICATE_REPORT_BLOCK:${block.id}`); keys.add(key);
      this.setWidth(block);
      const full = this.fullWidth(block), column = columns[0] <= columns[1] ? 0 : 1;
      this.renderX = full ? X : X + column * ((WIDTH + GAP) / 2);
      this.flow.y = full ? Math.max(...columns) : columns[column];
      this.drawBlock(block);
      if (full) columns = [this.flow.y, this.flow.y]; else columns[column] = this.flow.y;
      await yieldRendering();
    }
    this.setWidth(disclaimer); this.renderX = X; this.flow.y = Math.max(...columns);
    if (this.flow.y + this.measure(disclaimer) > BOTTOM) nextPage();
    this.drawBlock(disclaimer);
    const result = this.flow.finish();
    for (let page = 1; page <= result.pageCount; page++) {
      this.d.setPage(page); this.flow.drawText(`${new Date(this.flow.meta.generatedAt).toISOString()} UTC`, 35, 817, 400, 'footer-date', 7, false, [44, 70, 108], 839);
      this.flow.drawText(`${this.t('Página', 'Page', 'Página')} ${page} / ${result.pageCount}`, 485, 817, 80, 'footer-page', 7, false, [44, 70, 108], 839);
    }
    return result;
  }
}
