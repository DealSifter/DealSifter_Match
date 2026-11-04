import { describe, expect, it } from 'vitest';
import { layoutReportFacts } from './reportFactLayout';
import type { ReportRow } from './reportIntegrityTypes';

const row = (label: string, value: string, field = label): ReportRow => ({ label, value, evidenceRefs: ['fact:' + field] });
const measure = (text: string, width: number) => Math.ceil(text.length * 4 / width) * 10;

describe('full-width report facts', () => {
  it.each([1, 2])('puts the complete legal description below its label across %i-column records', columns => {
    const legal = row('Legal description', 'Fictional Lot 5, Block A. Easement across the east boundary of the sample parcel.', 'legalDescription');
    const rows = [row('County', 'Sample County'), legal, row('Tax year', '2026')], before = JSON.stringify(rows);
    const plan = layoutReportFacts(rows, 260, columns, measure, value => value.label, true);
    const cell = plan.cells.find(cell => cell.row === legal)!;
    expect(cell).toMatchObject({ x: 0, width: 260, stacked: true });
    expect(cell.height).toBe(measure(legal.label, 260) + 2 + measure(legal.value, 260) + 1);
    expect(plan.cells.map(cell => cell.row)).toHaveLength(rows.length);
    expect(JSON.stringify(rows)).toBe(before);
    for (const a of plan.cells) for (const b of plan.cells) if (a !== b) {
      expect(a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height).toBe(false);
    }
  });

  it('balances variable-height facts in two independent columns without losing values', () => {
    const rows = [row('APN', '000-000'), row('Subdivision', 'Illustrative subdivision with a deliberately longer name'), row('County', 'Example'), row('Year', '2004'), row('Tax', '$5,000')];
    const pairwise = layoutReportFacts(rows, 300, 2, measure, value => value.label);
    const balanced = layoutReportFacts(rows, 300, 2, measure, value => value.label, true);
    expect(balanced.height).toBeLessThanOrEqual(pairwise.height);
    expect(balanced.cells.map(cell => cell.row)).toEqual(rows);
    expect(new Set(balanced.cells.map(cell => cell.x)).size).toBe(2);
  });
});
