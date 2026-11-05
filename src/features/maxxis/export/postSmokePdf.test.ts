import { describe, expect, it, vi } from 'vitest';
import { buildMaxxisReportSchema } from '../../../domain/maxxis/maxxisReportSchema';
import { renderMaxxisReportPdf } from './maxxisReportPdf';
import { resolveReportExportEntitlement } from './reportExportEntitlement';

function input(withValue: boolean) {
  return {
    reportType: 'DEAL_INTELLIGENCE',
    property: { id: 'post-smoke-fictional', address: '1200 Sample Avenue', city: 'Example City', state: 'FL', zip: '00000', type: 'SFR', price: 2100000,
      beds: 5, baths: 3, sqft: 2333, objective: 'Sell', capRate: 5, fieldProvenance: { capRate: 'USER_PROVIDED' },
      description: 'Fictional notes about the documented property layout. Outdoor spaces provide additional access and room for the garden. '.repeat(12) },
    dealIntelligence: {
      provenance: { propertyEvidence: 'FICTIONAL_TEST_FIXTURE' },
      evidenceReasons: { propertyRecord: null, valuation: withValue ? null : 'NO_COVERAGE', recordedSales: 'NO_COVERAGE' },
      propertyEvidence: { provider: 'RentCast', retrievedAt: '2026-11-04T17:00:00Z', verifiedRecords: [{ field: 'beds', value: 5 }], unknown: [], conflicts: [] },
      valuationIntelligence: { status: 'ARV_UNAVAILABLE', range: null, providerEstimate: withValue ? { value: 2425000, rangeLow: 1788000, rangeHigh: 3063000, provider: 'RentCast', retrievedAt: '2026-11-04T17:00:00Z' } : null },
      comparableEvidence: { used: [], supporting: [], excluded: [] },
      marketRent: { state: 'AVAILABLE', evidence: { provider: 'rentcast', evidenceType: 'rent_estimate', status: 'AVAILABLE', rent: 7890, rangeLow: 4910, rangeHigh: 10880,
        scope: 'PROPERTY', retrievedAt: '2026-11-04T16:00:00Z', subjectProperty: { livingAreaSqft: 2333, bedrooms: 5 }, comparables: [] } },
    },
  };
}

describe('post-smoke PDF semantics and continuity', () => {
  it.each([true, false])('keeps rental references distinct from property values and publisher rates (valuation: %s)', async withValue => {
    const data = input(withValue), schema = buildMaxxisReportSchema(data);
    const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(Error('OFFLINE_ONLY'));
    let result: any;
    try {
      result = await renderMaxxisReportPdf({ schema, language: 'en', exportEntitlement: resolveReportExportEntitlement({ plan: 'enterprise', reportType: 'DEAL_INTELLIGENCE', channel: 'PDF' }) });
      expect(network).not.toHaveBeenCalled();
    } finally { network.mockRestore(); }
    expect(result.state, JSON.stringify(result.validation)).toBe('RENDERED');
    expect(result.document.pageCount).toBeLessThanOrEqual(6);
    const audit = result.document.layoutAudit, lines = audit.lines;
    const chart = audit.sections.find((s: any) => s.kind === 'reference-range-chart');
    expect(chart.sectionId).toBe(withValue ? 'provider-reference-scenarios' : 'market-rent-scenarios');
    expect(chart.title).toBe(withValue ? 'Value range references' : 'Monthly rent range');
    const rateText = lines.filter((line: any) => line.sectionId === 'financial-indicators').map((line: any) => line.text).join(' ');
    expect(rateText).toContain('5%');
    expect(rateText).toContain('reported by the publisher');
    expect(rateText).not.toContain('calculated from the inputs shown');
    const notes = lines.filter((line: any) => line.sectionId.startsWith('listing-description') && line.fontSize <= 9).map((line: any) => line.text).join(' ').replace(/\s+/g, ' ').trim();
    expect(notes).toBe(data.property.description.trim());
    const continuation = lines.find((line: any) => line.sectionId === 'listing-description-continued' && line.fontSize <= 9);
    if (continuation) expect(continuation.text).toMatch(/^(Fictional|Outdoor)\b/);
    const last = audit.sections.filter((s: any) => s.page === result.document.pageCount && s.kind !== 'heading');
    expect(last.some((s: any) => s.sectionId !== 'report-disclaimer')).toBe(true);
    expect(audit.lines.every((line: any) => line.overflowX === 0 && line.overflowY === 0)).toBe(true);
  }, 30000);
});
