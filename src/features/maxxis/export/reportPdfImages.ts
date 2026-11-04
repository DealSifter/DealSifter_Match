import type { jsPDF } from 'jspdf';

/** Read PNG dimensions without jsPDF decoding/compressing the entire raster. */
export function pngDimensions(data: string): { width: number; height: number; fileType: string } | null {
  if (!data.startsWith('data:image/png;base64,')) return null;
  try {
    const header = atob(data.slice(data.indexOf(',') + 1, data.indexOf(',') + 33));
    if (header.slice(1, 4) !== 'PNG' || header.slice(12, 16) !== 'IHDR') return null;
    const read = (offset: number) => ((header.charCodeAt(offset) * 0x1000000) + (header.charCodeAt(offset + 1) << 16) + (header.charCodeAt(offset + 2) << 8) + header.charCodeAt(offset + 3));
    const width = read(16), height = read(20);
    return width > 0 && height > 0 ? { width, height, fileType: 'PNG' } : null;
  } catch { return null; }
}

/** Per-document aliases reuse one embedded raster in all pages and galleries. */
export class ReportPdfImages {
  private readonly entries = new Map<string, { width: number; height: number; fileType: string; alias: string }>();
  constructor(private readonly doc: jsPDF) {}
  properties(data: string) {
    let entry = this.entries.get(data);
    if (!entry) {
      const image = pngDimensions(data) || this.doc.getImageProperties(data);
      entry = { width: image.width, height: image.height, fileType: image.fileType, alias: `report-image-${this.entries.size}` };
      this.entries.set(data, entry);
    }
    return entry;
  }
  add(data: string, x: number, y: number, width: number, height: number, alias?: string) {
    const image = this.properties(data);
    // FAST changes lossless PNG compression effort, never image colors or quality.
    this.doc.addImage(data, image.fileType, x, y, width, height, alias || image.alias, 'FAST');
  }
}

