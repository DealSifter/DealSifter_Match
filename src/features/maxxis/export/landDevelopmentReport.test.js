import { describe, expect, it } from 'vitest';
import { buildMaxxisReportSchema } from '../../../domain/maxxis/maxxisReportSchema';
import { calculateLandDevelopmentScenario } from '../../../../supabase/functions/_shared/maxxis/landDevelopmentScenario.ts';
import { renderMaxxisReportPdf } from './maxxisReportPdf';
import { resolveReportExportEntitlement } from './reportExportEntitlement';

const property = { id: 'synthetic-gable', address: '741 Gable Dr', city: 'Center Point', state: 'AL', type: 'Land', lot: '1.14 acres', price: 19000 };
const assumptions = { purchasePrice: 19000, lotSizeAcres: 1.14, state: 'AL', developmentIntent: 'SUBDIVIDE_AND_BUILD', proposedUnitCount: 2, proposedBuildingSqftPerUnit: 1500, proposedPropertyType: 'SFR' };
const scenario = { strategy: 'LAND', confirmed: true, status: 'COMPLETE', assumptions, calculatedOutputs: calculateLandDevelopmentScenario(assumptions) };
describe('Land development report projection and containment', () => {
  it.each(['pt', 'en', 'es'])('contains five available comps in each side-by-side family: %s', async language => {
    const valuationComps = Array.from({ length: 5 }, (_, index) => ({ address: `${100 + index} Recorded Comparable Lane, Center Point, AL`, salePrice: 210000 + index * 10000,
      saleDate: '2026-09-10', saleAgeDays: 30, distanceMiles: 0.123456 + index / 10, lotSizeSqft: 24000, livingAreaSqft: 1500, unitValue: 200 + index, latitude: 33.65, longitude: -86.68 }));
    const reference = { status: 'AVAILABLE', valuationCompCount: 5, valuationComps, weightedUnitValue: 202, weightedLotPricePerSqft: 0.5, range: { low: 190000, high: 230000 } };
    const populated = { ...scenario, calculatedOutputs: { ...scenario.calculatedOutputs, landAcquisitionReference: reference, finishedHomeExitReference: reference } };
    const schema = buildMaxxisReportSchema({ reportType: 'DEAL_INTELLIGENCE', property, dealIntelligence: { activeScenario: populated,
      propertyEvidence: { verifiedRecords: [], userProvided: [], unknown: [], conflicts: [] }, provenance: { property: 'USER_PROVIDED' },
      comparableEvidence: { used: [], supporting: [], excluded: [] }, valuationIntelligence: { status: 'NOT_APPLICABLE' } } });
    const output = await renderMaxxisReportPdf({ schema, language, exportEntitlement: resolveReportExportEntitlement({ plan: 'enterprise', reportType: 'DEAL_INTELLIGENCE', channel: 'PDF' }) });
    expect(output.document.layoutAudit.continuations).toEqual([]);
    expect(output.document.pageCount).toBe(6);
    expect(output.document.layoutAudit.lines.filter(line => line.sectionId === 'landAcquisition').map(line => line.text).join(' ')).toContain('104 Recorded Comparable');
  }, 30000);
  it('keeps factual release free of hypothetical development fields', () => {
    const schema = buildMaxxisReportSchema({ reportType: 'PROPERTY_RELEASE', property, dealIntelligence: { activeScenario: scenario } });
    expect(schema.presentation.landDevelopment).toBeNull();
  });
  it.each(['pt', 'en', 'es'])('renders six Enterprise pages with contained development data in %s', async language => {
    const schema = buildMaxxisReportSchema({ reportType: 'DEAL_INTELLIGENCE', language, property,
      dealIntelligence: { activeScenario: scenario, executiveDealOverview: 'Recorded land facts and explicit hypothetical development assumptions.',
        propertyEvidence: { verifiedRecords: [], userProvided: [], unknown: [], conflicts: [] }, provenance: { property: 'USER_PROVIDED' },
        comparableEvidence: { used: [], supporting: [], excluded: [] }, valuationIntelligence: { status: 'NOT_APPLICABLE' } } });
    const result = await renderMaxxisReportPdf({ schema, language, exportEntitlement: resolveReportExportEntitlement({ plan: 'enterprise', reportType: 'DEAL_INTELLIGENCE', channel: 'PDF' }) });
    expect(result.document.pageCount).toBe(6);
    const sections = result.document.layoutAudit.sections.filter(section => section.sectionId.startsWith('land'));
    expect(sections.map(section => section.sectionId)).toEqual(expect.arrayContaining(['landSubject', 'landAcquisition', 'landExit', 'landBenchmark', 'landPremises', 'landKnownBasis', 'landNextInput']));
    expect(sections.every(section => !section.contentReduced && !section.clippedLines && !section.overflowPixels)).toBe(true);
    expect(result.document.layoutAudit.lines.filter(line => line.sectionId.startsWith('land')).every(line => !line.overflowX && !line.overflowY && line.fontSize >= 9)).toBe(true);
    expect(result.document.layoutAudit.continuations).toHaveLength(0);
  }, 30000);
  it('renders concise Pro development data without Enterprise comparable cards', async () => {
    const schema = buildMaxxisReportSchema({ reportType: 'MAXXIS_ANALYSIS', language: 'pt', property,
      maxxisAnalysis: { activeScenario: scenario, executiveSummary: 'Cenário hipotético com premissas explícitas.', provenance: { property: 'USER_PROVIDED' } } });
    const result = await renderMaxxisReportPdf({ schema, language: 'pt', exportEntitlement: resolveReportExportEntitlement({ plan: 'pro', reportType: 'MAXXIS_ANALYSIS', channel: 'PDF' }) });
    expect(result.document.pageCount).toBe(3);
    expect(result.document.layoutAudit.sections.filter(section => section.sectionId.startsWith('landDevelopment'))).toHaveLength(1);
  }, 30000);
});
