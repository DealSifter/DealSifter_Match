import { ReportBrandShell } from './reportBrandShell';
import { readingSectionTitle, READING_SECTIONS, type ReadingSection } from './reportReadingPlan';
import { composeReportContent, contentKey, readableReportDate, type ContentBlock } from './reportContentPlan';
const X = 26, WIDTH = 543.28, TOP = 86, BOTTOM = 790, PAD = 8, GAP = 7;
export class ContentReportComposition extends ReportBrandShell {
  private compact = false;
  private get bodySize() { return this.compact ? 8.5 : 9.5; }
  private get headingHeight() { return this.compact ? 22 : 32; }
  private blockTitleHeight(block: ContentBlock) { return Math.max(16, this.textHeight(block.title, this.renderWidth - 2 * PAD - 24, 11, true)); }
  private get titleGap() { return this.compact ? 3 : 5; }
  private blockIcon(block: ContentBlock) {
    if (block.kind === 'overview') return 'home';
    if (block.map) return 'pin';
    if (block.id.startsWith('report-pending') || /risk|limitation/.test(block.id)) return 'warning';
    if (/profile|publisher|owner/.test(block.id)) return 'user';
    if (/rent|arv|financial|scenario/.test(block.id)) return 'chart';
    if (/land|location/.test(block.id)) return 'pin';
    return 'document';
  }
  private overviewParts() {
    const property = this.vm.property;
    const basic = this.vm.reportType === 'PROPERTY_RELEASE';
    return [
      { text: property.address, size: basic && this.compact ? 13 : this.compact ? 15 : 18, bold: true, accent: false },
      { text: property.location, size: 10, bold: false, accent: false },
      { text: property.price, size: basic && this.compact ? 18 : this.compact ? 21 : 24, bold: true, accent: true },
      { text: [property.type, property.strategy].filter(Boolean).join(' \u00b7 '), size: 9, bold: false, accent: false },
      ...property.metrics.filter(row => !['UNAVAILABLE', 'CONFLICTED', 'NOT_APPLICABLE'].includes(row.state || '') && !/NOI|ROI|cap\s*rate|cash.flow/i.test(row.label)).map(row => ({text: row.label + ': ' + row.value, size: 9, bold: false, accent: false})),
    ].filter(part => part.text);
  }
  private get overviewGap() { return this.vm.reportType === 'PROPERTY_RELEASE' && this.compact ? 1 : 3; }
  private overviewTextHeight(width: number) { return this.overviewParts().reduce((height, part) => height + this.textHeight(part.text, width, part.size, part.bold) + this.overviewGap, 0); }
  private renderWidth = WIDTH;
  private renderX = X;
  fullWidth(block: ContentBlock) { return ['overview', 'table', 'disclaimer'].includes(block.kind) || block.kind==='map'&&block.map?.points.some(point=>point.id!=='subject') || ['market-rent', 'arv-market', 'operating-evidence-facts', 'financial-indicators', 'profile-compatibility', 'report-sources', 'listing-description'].some(id => block.id === id || block.id.startsWith(id + '-part-')); }
  mapHeight(block: ContentBlock) { return this.vm.reportType==='PROPERTY_RELEASE'?95:block.map?.points.some(point=>point.id!=='subject')?180:140; }
  photoLayout(block: ContentBlock) {
    const basic = this.vm.reportType === 'PROPERTY_RELEASE';
    const photos = block.photos || [], gallery = photos.slice(1, 5);
    const compactGallery=gallery.length>2;
    const columns=basic||compactGallery?Math.max(1,gallery.length):gallery.length===1?1:2,cell = basic ? (this.compact ? 42 : 56) : compactGallery?(this.compact?48:58):gallery.length===1 ? 92 : 90;
    return { gallery, columns, hero: basic ? (this.compact ? 110 : 145) : (this.compact ? 150 : 180), cell,
      galleryHeight: gallery.length ? Math.ceil(gallery.length / columns) * (cell + GAP) + GAP : 0 };
  }
  splitForSpace(block: ContentBlock, available: number): [ContentBlock, ContentBlock] | null {
    this.setWidth(block);
    const continued = (tail: ContentBlock): ContentBlock => ({ ...tail, id: block.id + '-part-next', assertionIds: undefined });
    if (block.id.startsWith('profile-compatibility') && (block.rows?.length || 0) > 2) {
      for (let count = block.rows!.length - (block.rows!.length % 2 || 2); count >= 2; count -= 2) {
        const head = { ...block, rows: block.rows!.slice(0, count), score: undefined, comparison: undefined };
        if (this.measure(head) <= available) return [head, continued({ ...block, text: undefined, rows: block.rows!.slice(count) })];
      }
    }
    if (block.id.startsWith('listing-description') && block.text) {
      const paragraphs = block.text.split(/\n\s*\n/).filter(Boolean);
      for (let count = paragraphs.length - 1; count >= 1; count--) {
        const head = { ...block, text: paragraphs.slice(0, count).join('\n\n') };
        if (this.measure(head) <= available) return [head, continued({ ...block, text: paragraphs.slice(count).join('\n\n') })];
      }
    }
    return null;
  }
  setWidth(block: ContentBlock) { this.renderWidth = this.fullWidth(block) ? WIDTH : (WIDTH - GAP) / 2; }
  textHeight(text: string, width = this.renderWidth - 2 * PAD, size = this.bodySize, bold = false) { return this.flow.lines(text, width, size, bold).length * (size + 4); }
  comparisonRowHeight(item: NonNullable<ContentBlock['comparison']>[number]) { return Math.max(25, this.textHeight(item.label, (this.renderWidth - 2 * PAD) * .43, 8) + 6, this.textHeight(item.text, this.renderWidth * .15 - 10, 7) + 6); }
  profileRows(block: ContentBlock) { return (block.rows || []).filter(row=>!block.comparison?.some(item=>item.label===row.label&&row.value.trim()!==''&&Number(row.value.replace('%',''))===item.value)); }
  profileHeight(block: ContentBlock) {
    const left=(this.renderWidth-3*PAD)*.53,rows=this.profileRows(block);
    let height=block.text?this.textHeight(block.text,left,this.bodySize)+5:0;
    for(let i=0;i<rows.length;i+=2)height+=Math.max(...rows.slice(i,i+2).map(row=>this.textHeight(`${row.label}: ${row.value}`,(left-PAD)/2)))+4;
    return Math.max(height,(block.score===undefined?0:70)+(block.comparison?.length||0)*26);
  }
  private get rowColumns() { return 2; }
  tableWidths(block: ContentBlock) {
    const WIDTH = this.renderWidth;
    const count = block.columns?.length || 1, width = WIDTH - 2 * PAD;
    if(count===7)return [.04,.30,.14,.13,.09,.19,.11].map(ratio=>width*ratio);
    return count === 3 ? [width * .22, width * .43, width * .35] : count === 5 ? [width * .06, width * .41, width * .19, width * .18, width * .16] : Array.from({ length: count }, () => width / count);
  }
  rowHeight(row: string[], widths: number[], heading = false) { return Math.max(...row.map((cell, i) => this.textHeight(cell, widths[i] - 9, 8.5, heading))) + 5; }
  measure(block: ContentBlock) {
    const WIDTH = this.renderWidth;
    if (block.kind === 'disclaimer') return 12 + this.textHeight(block.text || '', WIDTH - 2 * PAD, 8);
    let height = PAD * 2 + (block.kind === 'overview' ? 0 : this.blockTitleHeight(block) + this.titleGap);
    if(block.id.startsWith('profile-compatibility')&&block.comparison?.length)return height+this.profileHeight(block);
    if (block.kind === 'overview') { const layout = this.photoLayout(block); return height + Math.max(this.overviewTextHeight(block.photos?.length ? (WIDTH - 3 * PAD) * .42 : WIDTH - 2 * PAD), block.photos?.length ? layout.hero : 0) + layout.galleryHeight; }
    if (block.hero) height += 25;
    if (block.text) height += this.textHeight(block.text, WIDTH - 2 * PAD, block.textSize ?? this.bodySize);
    if (block.afterText) height += 4 + this.textHeight(block.afterText);
    if (block.rows?.length) for (let i = 0; i < block.rows.length; i += this.rowColumns) height += Math.max(...block.rows.slice(i, i + this.rowColumns).map(row => this.textHeight(`${row.label}: ${row.value}`, (WIDTH - (this.rowColumns + 1) * PAD) / this.rowColumns))) + 4;
    if (block.table?.length) { const widths = this.tableWidths(block); height += this.rowHeight(block.columns || [], widths, true) + block.table.reduce((sum, row) => sum + this.rowHeight(row, widths), 0); }
    if (block.map) height += this.mapHeight(block) + 10 + this.textHeight(block.map.caption, WIDTH - 2 * PAD, 8);
    if (block.kind === 'photos' && block.photos?.length) height += Math.ceil(block.photos.length / 4) * 76;
    if (block.score !== undefined) height += 42;
    if (block.range) height += 62;
    if (block.comparison?.length) height += block.comparison.reduce((sum,item)=>sum+this.comparisonRowHeight(item),8);
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
    const warning = block.id.startsWith('report-pending') || block.kind === 'disclaimer';
    d.setFillColor(...(warning ? [255, 251, 239] as [number,number,number] : [250, 252, 253] as [number,number,number]));
    d.setDrawColor(...(warning ? [249, 228, 171] as [number,number,number] : [226, 236, 241] as [number,number,number]));
    d.setLineWidth(.4); d.roundedRect(X, y, WIDTH, height, 7, 7, 'FD');
    let cursor = y + 6;
    if (block.kind === 'overview') cursor = y + PAD;
    else if (block.kind !== 'disclaimer') {
      this.icon(this.blockIcon(block), X + PAD, y + PAD, 16, warning ? this.accent : [39,49,57]);
      f.drawText(block.title, X + PAD + 24, y + PAD, WIDTH - PAD * 2 - 24, block.id, 11, true, [12,28,65], end);
      cursor = y + PAD + this.blockTitleHeight(block) + 5;
    }
    if (block.id.startsWith('profile-compatibility')&&block.comparison?.length) {
      const left=(WIDTH-3*PAD)*.53,rightX=X+2*PAD+left,right=WIDTH-3*PAD-left,rows=this.profileRows(block);
      let leftY=cursor,rightY=cursor;
      if(block.text)leftY=f.drawText(block.text,X+PAD,leftY,left,block.id,this.bodySize,false,[44,70,108],end)+5;
      for(let i=0;i<rows.length;i+=2){const pair=rows.slice(i,i+2),cell=(left-PAD)/2,h=Math.max(...pair.map(row=>this.textHeight(`${row.label}: ${row.value}`,cell)))+4;
        pair.forEach((row,index)=>f.drawText(`${row.label}: ${row.value}`,X+PAD+index*(cell+PAD),leftY,cell,block.id,this.bodySize,false,[44,70,108],end));leftY+=h;}
      if(block.score!==undefined){
        const cx=rightX+right/2,cy=rightY+24,r=23,score=Math.max(0,Math.min(100,block.score));
        d.setFillColor(225,237,242);d.circle(cx,cy,r,'F');
        if(score>0){d.setFillColor(...this.accent);const points:[number,number][]=[[cx,cy],[cx,cy-r]];for(let i=1;i<=36;i++){const angle=-Math.PI/2+2*Math.PI*(score/100)*i/36;points.push([cx+r*Math.cos(angle),cy+r*Math.sin(angle)]);}points.push([cx,cy]);d.lines(points.slice(1).map((p,i)=>[p[0]-points[i][0],p[1]-points[i][1]]),cx,cy,[1,1],'F',true);}
        d.setFillColor(255,255,255);d.circle(cx,cy,17,'F');
        f.drawText(`${block.score}%`,cx-19,cy-8,42,block.id,11,true,[12,28,65],end);
        f.drawText('Match Score',rightX,rightY+51,right,block.id,8,true,[44,70,108],end);rightY+=70;
      }
      for(const item of block.comparison){
        f.drawText(item.label,rightX,rightY,right-42,block.id,8,false,[44,70,108],end);
        f.drawText(item.text,rightX+right-39,rightY,39,block.id,8,true,[44,70,108],end);
        d.setFillColor(225,237,242);d.rect(rightX,rightY+15,right,5,'F');const ratio=Math.max(0,Math.min(1,item.value/100));
        if(ratio){d.setFillColor(...this.accent);d.rect(rightX,rightY+15,right*ratio,5,'F');}rightY+=26;
      }
    } else if (block.kind === 'overview') {
      const layout = this.photoLayout(block), textWidth = block.photos?.length ? (WIDTH - 3 * PAD) * .42 : WIDTH - 2 * PAD;
      const textHeight = this.overviewTextHeight(textWidth);
      let textY = cursor;
      for (const part of this.overviewParts()) textY = f.drawText(part.text, X + PAD, textY, textWidth, block.id, part.size, part.bold, part.accent ? this.accent : [12,28,65], end) + this.overviewGap;
      if (block.photos?.[0]) f.image(block.photos[0], X + PAD + textWidth + PAD, cursor, WIDTH - textWidth - 3 * PAD, Math.max(layout.hero, textHeight), 'cover');
      if (layout.gallery.length) {
        const galleryTop = cursor + Math.max(textHeight, layout.hero) + GAP;
        layout.gallery.forEach((photo, index) => {
          const row=Math.floor(index/layout.columns),count=Math.min(layout.columns,layout.gallery.length-row*layout.columns),cell=(WIDTH-2*PAD-(count-1)*GAP)/count;
          f.image(photo,X+PAD+index%layout.columns*(cell+GAP),galleryTop+row*(layout.cell+GAP),cell,layout.cell,'cover');
        });
      }
    } else {
      if (block.hero) cursor = f.drawText(block.hero.value, X + PAD, cursor, WIDTH - PAD * 2, block.id, 18, true, this.accent, end) + 3;
      if (block.text) cursor = f.drawText(block.text, X + PAD, cursor, WIDTH - PAD * 2, block.id, block.kind === 'disclaimer' ? 8 : block.textSize ?? this.bodySize, false, [44, 70, 108], end);
      for (let i = 0; i < (block.rows?.length || 0); i += this.rowColumns) {
        const rows = block.rows!.slice(i, i + this.rowColumns), half = (WIDTH - (this.rowColumns + 1) * PAD) / this.rowColumns;
        const rowH = Math.max(...rows.map(row => this.textHeight(`${row.label}: ${row.value}`, half))) + 4;
        rows.forEach((row, index) => f.drawText(`${row.label}: ${row.value}`, X + PAD + index * (half + PAD), cursor, half, block.id, this.bodySize, false, [44, 70, 108], end)); cursor += rowH;
      }
      if (block.map) {
        const mapH = this.mapHeight(block);
        const image = block.map.sourceId ? this.maps[block.map.sourceId] : this.location;
        f.drawMap(block.map.points, X + PAD, cursor, WIDTH - PAD * 2, mapH, block.id, image);
        cursor = f.drawText(block.map.caption, X + PAD, cursor + mapH + 5, WIDTH - PAD * 2, block.id, 8, false, [44, 70, 108], end) + 5;
      }
      if (block.table?.length) {
        const widths = this.tableWidths(block), drawRow = (row: string[], heading = false) => {
          let x = X + PAD; const h = this.rowHeight(row, widths, heading);
          if (heading) { d.setFillColor(233,239,242); d.roundedRect(x, cursor, WIDTH - 2 * PAD, h, 4, 4, 'F'); }
          else if (block.table!.indexOf(row) % 2 === 0) { d.setFillColor(245,248,250); d.rect(x, cursor, WIDTH - 2 * PAD, h, 'F'); }
          row.forEach((cell, index) => { f.drawText(cell, x + 3, cursor + 1, widths[index] - 9, block.id, 8.5, heading, [44, 70, 108], end); x += widths[index]; }); cursor += h;
        };
        drawRow(block.columns || [], true); block.table.forEach(row => drawRow(row));
      }
      if (block.afterText) cursor = f.drawText(block.afterText, X + PAD, cursor + 4, WIDTH - 2 * PAD, block.id, this.bodySize, false, [44, 70, 108], end);
      if (block.kind === 'photos') block.photos?.forEach((photo, index) => f.image(photo, X + PAD + index % 4 * (WIDTH - 2 * PAD) / 4, cursor + Math.floor(index / 4) * 76, (WIDTH - 2 * PAD) / 4 - 5, 71, 'contain'));
      if (block.score !== undefined) {
        cursor = f.drawText(`Match Score: ${block.score}%`, X + PAD, cursor, WIDTH - 2 * PAD, block.id, 9, true, [44,70,108], end);
        const w = WIDTH - 2 * PAD; d.setFillColor(222, 232, 238); d.rect(X + PAD, cursor + 7, w, 7, 'F'); d.setFillColor(...this.accent); d.rect(X + PAD, cursor + 7, w * block.score / 100, 7, 'F');
        f.drawText('0%', X + PAD, cursor + 15, 35, block.id, 7, false, [44, 70, 108], end); f.drawText('100%', X + WIDTH - PAD - 30, cursor + 15, 30, block.id, 7, false, [44, 70, 108], end);
        cursor += 34;
      }
      if (block.range) {
        const range = block.range, width = WIDTH - 2 * PAD;
        d.setFillColor(225, 237, 242); d.roundedRect(X + PAD, cursor + 13, width, 10, 5, 5, 'F');
        d.setFillColor(...this.accent); d.circle(X + PAD + Math.max(.02, Math.min(.98, range.position)) * width, cursor + 18, 6, 'F');
        f.drawText(range.low, X + PAD, cursor + 30, width / 3, block.id, 8, false, [44,70,108], end);
        f.drawText(range.estimate, X + PAD + width / 3, cursor + 30, width / 3, block.id, 8, true, [44,70,108], end);
        f.drawText(range.high, X + PAD + 2 * width / 3, cursor + 30, width / 3, block.id, 8, false, [44,70,108], end); cursor += 62;
      }
      for (const item of block.comparison || []) {
        f.drawText(item.label, X + PAD, cursor, (WIDTH - 2 * PAD) * .43, block.id, 8, false, [44,70,108], end);
        const left = X + WIDTH * .47, width = WIDTH * .34;
        d.setFillColor(225,237,242); d.roundedRect(left,cursor+3,width,6,3,3,'F');
        const maximum = block.id==='profile-compatibility' ? 100 : Math.max(1,...block.comparison!.map(row=>Math.abs(row.value)));
        const ratio = Math.max(0,Math.min(1,item.value/maximum)); if(ratio>0){d.setFillColor(...this.accent);d.roundedRect(left,cursor+3,Math.max(1,width*ratio),6,Math.min(3,width*ratio/2),3,'F');}
        f.drawText(item.text, left+width+7,cursor,WIDTH*.15-10,block.id,7,false,[44,70,108],end);cursor+=this.comparisonRowHeight(item);
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
    const plan = (compact: boolean, forceBefore?: ReadingSection, balanceProfile = false) => {
      this.compact = compact;
      const blockGap = this.vm.reportType === 'PROPERTY_RELEASE' ? 3 : compact ? 4 : GAP;
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
        const breakBefore = new Set<ContentBlock>();
        if (balanceProfile && section === 5 && cursor > (page ? 86 : TOP)) {
          this.setWidth(queue[0]);
          const split = this.splitForSpace(queue[0], Math.min(BOTTOM - cursor - this.headingHeight, this.measure(queue[0]) * .7));
          if (split) { queue.splice(0, 1, ...split); breakBefore.add(split[1]); }
        }
        while (queue.length) {
          if (breakBefore.has(queue[0])) { breakBefore.delete(queue[0]); newPage(); columns = [cursor, cursor]; headingNeeded = true; }
          if (headingNeeded) {
            this.setWidth(queue[0]);
            const available = BOTTOM - Math.max(...columns) - this.headingHeight;
            if (this.measure(queue[0]) > available && !this.splitForSpace(queue[0], available)) { newPage(); columns = [cursor, cursor]; }
            const y = Math.max(...columns);
            placements.push({ section, page, column: 0, y, height: this.headingHeight, heading: true });
            columns = [y + this.headingHeight, y + this.headingHeight]; headingNeeded = false;
          }
          let index = queue.findIndex(block => { this.setWidth(block); return this.measure(block) <= BOTTOM - (this.fullWidth(block) ? Math.max(...columns) : Math.min(...columns)); });
          if (index < 0) {
            const available = BOTTOM - Math.max(...columns);
            const splitIndex = queue.findIndex(block => !!this.splitForSpace(block, available));
            if (splitIndex >= 0) {
              const parts = this.splitForSpace(queue[splitIndex], available)!;
              queue.splice(splitIndex, 1, ...parts);
              continue;
            }
            newPage(); columns = [cursor, cursor]; headingNeeded = true;
            this.setWidth(queue[0]);
            if (this.measure(queue[0]) + this.headingHeight > BOTTOM - 86 && !this.splitForSpace(queue[0], BOTTOM - 86 - this.headingHeight)) throw Error(Number.isFinite(cap) ? 'REPORT_PAGE_LIMIT_EXCEEDED:' + cap : 'REPORT_BLOCK_EXCEEDS_PAGE:' + queue[0].id);
            continue;
          }
          // Fill only gaps within this section. No earlier section is revisited.
          const [block] = queue.splice(index, 1); this.setWidth(block);
          const full = this.fullWidth(block), column = full || columns[0] <= columns[1] ? 0 : 1;
          const y = full ? Math.max(...columns) : columns[column], height = this.measure(block);
          placements.push({ block, section, page, column, y, height });
          if (full) columns = [y + height + blockGap, y + height + blockGap]; else columns[column] = y + height + blockGap;
        }
        cursor = Math.max(...columns);
      }
      const lastArea = placements.filter(item => item.page === page).reduce((area, item) => area + (item.heading || this.fullWidth(item.block!) ? WIDTH : (WIDTH - GAP) / 2) * item.height, 0);
      const nonFinalExcess = Array.from({length:page},(_,index)=>{
        const area=placements.filter(item=>item.page===index).reduce((sum,item)=>sum+(item.heading||this.fullWidth(item.block!)?WIDTH:(WIDTH-GAP)/2)*item.height,0);
        return Math.max(0,.7-area/((BOTTOM-(index?86:TOP))*WIDTH));
      }).reduce((sum,value)=>sum+value,0);
      return { placements, pages: page + 1, compact, nonFinalExcess, orphan: lastArea / ((BOTTOM - (page ? 86 : TOP)) * WIDTH) < .25 };
    };
    const trials = [plan(false), plan(true), plan(true, 5), plan(true, 4), plan(false, undefined, true), plan(true, undefined, true)];
    const candidates = trials.filter(candidate => candidate.pages <= cap);
    candidates.sort((a,b) => a.pages - b.pages || Number(a.orphan) - Number(b.orphan) || a.nonFinalExcess - b.nonFinalExcess || Number(a.compact) - Number(b.compact));
    const selected = candidates[0];
    if (!selected) throw Object.assign(Error('REPORT_PAGE_LIMIT_EXCEEDED:' + cap), { layoutPlans: trials.map(trial => ({ compact: trial.compact, pages: trial.pages, blocks: trial.placements.map(item => ({ id: item.block?.id, section: item.section, page: item.page, y: item.y, height: item.height })) })) });
    this.compact = selected.compact;
    const keys = new Set<string>();
    for (let page = 0; page < selected.pages; page++) {
      this.page(this.vm.header.product, this.vm.header.subtitle);
      for (const item of selected.placements.filter(item => item.page === page)) {
        if (item.heading) {
          const id = 'reading-section-' + item.section + '-page-' + (page + 1), title = readingSectionTitle(item.section, this.vm.locale);
          const icons = ['home', 'warning', 'chart', 'pie', 'user', 'document'];
          this.icon(icons[item.section - 1], X + PAD, item.y + 1, this.compact ? 20 : 26, [39,49,57]);
          this.flow.drawText(title, X + PAD + 36, item.y + 2, WIDTH - 2 * PAD - 36, id, this.compact ? 13 : 16, true, [12,28,65], item.y + this.headingHeight);
          this.flow.audit.sections.push({ sectionId: id, title, kind: 'heading', page: page + 1, readingSection: item.section, availableHeight: this.headingHeight, renderedLines: 1, selectedFontSize: this.compact ? 13 : 16, clippedLines: 0, overflowPixels: 0, bounds: { x: X, y: item.y, width: WIDTH, height: this.headingHeight, right: X + WIDTH, bottom: item.y + this.headingHeight } });
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
      this.flow.drawText(`${this.t('Página', 'Page', 'Página')} ${page} / ${result.pageCount}`, 485, 817, 80, 'footer-page', 9, true, [44, 70, 108], 839);
    }
    return result;
  }
}
