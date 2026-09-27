import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildMaxxisReportSchema } from '../../../domain/maxxis/maxxisReportSchema';
import { renderMaxxisReportPdfCached } from './maxxisReportPdf';
import { resolveReportExportEntitlement } from './reportExportEntitlement';

const schema = buildMaxxisReportSchema({
  reportType: 'DEAL_INTELLIGENCE',
  property: { id: 'perf-property', address: '9537 Dalegrove Dr', city: 'Beverly Hills', state: 'CA', type: 'SFR', price: 2195000, beds: 3, baths: 2, sqft: 1838, rehab: 65000 },
  dealIntelligence: {
    executiveDealOverview: 'Performance fixture using deterministic report data.',
    investmentFit: { score: 29 },
    propertyEvidence: { verifiedRecords: [], userProvided: [], unknown: [], conflicts: [] },
    valuationIntelligence: { status: 'ARV_UNAVAILABLE' },
    comparableEvidence: { used: [], supporting: [], excluded: [] },
    riskAnalysis: [], limitations: ['Comparable evidence unavailable'], nextVerificationSteps: ['Verify condition'],
    provenance: { propertyEvidence: 'PROPERTY_INTELLIGENCE' },
  },
});
const options = {
  schema,
  exportEntitlement: resolveReportExportEntitlement({ plan: 'enterprise', reportType: 'DEAL_INTELLIGENCE', channel: 'PDF' }),
  generatedAt: '2026-09-26T12:00:00.000Z',
};

describe('Maxxis report generation performance contract', () => {
  let firstPromise;
  let secondPromise;
  let result;

  beforeAll(async () => {
    firstPromise = renderMaxxisReportPdfCached(options);
    secondPromise = renderMaxxisReportPdfCached(options);
    result = await firstPromise;
  }, 30000);

  it('single-flights preview and export generation', () => expect(secondPromise).toBe(firstPromise));
  it('produces one complete enterprise document', () => expect(result).toMatchObject({ state: 'RENDERED', document: { pageCount: 6 } }));
  it('records end-to-end generation time', () => expect(result.timings.totalMs).toBeGreaterThanOrEqual(0));
  it('records deterministic view-model preparation time', () => expect(result.timings.preparationMs).toBeGreaterThanOrEqual(0));
  it('records PDF module initialization time', () => expect(result.timings.moduleMs).toBeGreaterThanOrEqual(0));
  it('records asset resolution time', () => expect(result.timings.assetsMs).toBeGreaterThanOrEqual(0));
  it('records aggregate page render time', () => expect(result.timings.pageRenderMs).toBeGreaterThanOrEqual(0));
  it('records binary assembly time', () => expect(result.timings.assemblyMs).toBeGreaterThanOrEqual(0));
  it('records a duration for every one of the six pages', () => expect(result.timings.perPageMs).toHaveLength(6));
  it('keeps every page duration finite', () => expect(result.timings.perPageMs.every(Number.isFinite)).toBe(true));
  it('yields the browser main thread between PDF pages', () => {
    const source = readFileSync(new URL('./maxxisReportPdf.js', import.meta.url), 'utf8');
    expect(source).toContain('await yieldReportRendering()');
    expect(source).toContain("globalThis.scheduler?.yield");
  });
  it('uses cached exports and sequential preview rasterization without provider work', () => {
    const actions = readFileSync(new URL('./MaxxisReportExportActions.jsx', import.meta.url), 'utf8');
    const preview = readFileSync(new URL('../intelligence/MaxxisCanonicalReportPreview.jsx', import.meta.url), 'utf8');
    const pdf = readFileSync(new URL('./maxxisReportPdf.js', import.meta.url), 'utf8');
    expect(actions).toContain('renderMaxxisReportPdfCached');
    expect(preview).toContain('active={index + 1 <= nextPageToRender}');
    expect(`${actions}${preview}${pdf}`).not.toMatch(/generative-ai|gemini/i);
  });
});
