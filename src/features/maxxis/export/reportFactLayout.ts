import type { ReportRow } from './reportIntegrityTypes';

type Cell = { row: ReportRow; x: number; y: number; width: number; height: number; stacked: boolean };
type Measure = (text: string, width: number) => number;

export const isFullWidthFact = (row: ReportRow) => row.evidenceRefs.includes('fact:legalDescription');

/** The drawing and height calculation share one plan; long legal text never uses a value subcolumn. */
export function layoutReportFacts(rows: readonly ReportRow[], width: number, columns: number, measure: Measure, label: (row: ReportRow) => string, balanced = false) {
  const cells: Cell[] = [], gap = 14, rowGap = balanced ? 1 : 3, cellWidth = (width - (columns - 1) * gap) / columns;
  const stacked = (row: ReportRow, w: number) => {
    if (isFullWidthFact(row)) return true;
    if (!balanced || columns < 2) return false;
    const lineHeight = measure('M', w);
    return label(row).split(/\s+/).some(word => measure(word, w * .43) > lineHeight)
      || row.value.split(/\s+/).some(word => measure(word, w * .57 - 7) > lineHeight);
  };
  const height = (row: ReportRow, w: number) => stacked(row, w)
    ? measure(label(row), w) + 2 + measure(row.value, w) + rowGap
    : Math.max(measure(label(row), w * .43), measure(row.value, w * .57 - 7)) + rowGap;
  let y = 0;
  const place = (segment: readonly ReportRow[]) => {
    if (balanced && columns === 2 && segment.length > 1) {
      const heights = segment.map(row => height(row, cellWidth));
      let split = 1, best = Infinity;
      for (let at = 1; at < segment.length; at++) {
        const candidate = Math.max(heights.slice(0, at).reduce((a, b) => a + b, 0), heights.slice(at).reduce((a, b) => a + b, 0));
        if (candidate < best) { split = at; best = candidate; }
      }
      [segment.slice(0, split), segment.slice(split)].forEach((part, column) => {
        let next = y;
        part.forEach(row => { const h = height(row, cellWidth); cells.push({ row, x: column * (cellWidth + gap), y: next, width: cellWidth, height: h, stacked: stacked(row, cellWidth) }); next += h; });
      });
      y += best;
    } else for (let i = 0; i < segment.length; i += columns) {
      const pair = segment.slice(i, i + columns), h = Math.max(...pair.map(row => height(row, cellWidth)));
      pair.forEach((row, column) => cells.push({ row, x: column * (cellWidth + gap), y, width: cellWidth, height: height(row, cellWidth), stacked: stacked(row, cellWidth) }));
      y += h;
    }
  };
  let segment: ReportRow[] = [];
  // Keep the long description below both short-field columns rather than interrupting them.
  const ordered = balanced ? [...rows.filter(row => !isFullWidthFact(row)), ...rows.filter(isFullWidthFact)] : rows;
  for (const row of ordered) {
    if (!isFullWidthFact(row)) { segment.push(row); continue; }
    place(segment); segment = [];
    const h = height(row, width);
    cells.push({ row, x: 0, y, width, height: h, stacked: true });
    y += h;
  }
  place(segment);
  return { cells, height: y, columns };
}
