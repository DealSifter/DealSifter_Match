import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path) => readFileSync(new URL(`../../../../${path}`, import.meta.url), 'utf8');

describe('Maxxis gap submission production regression', () => {
  it('authorizes report-owned and plan-included analysis context instead of requiring only a property unlock', () => {
    const migration = source('supabase/migrations/20260928043000_maxxis_analysis_context_access.sql');
    const endpoint = source('supabase/functions/maxxis-analysis-inputs/index.ts');
    expect(migration).toContain('ds_has_maxxis_analysis_context_access');
    expect(migration).toContain('maxxis_report_entitlements');
    expect(migration).toContain("('pro', 'professional', 'enterprise', 'admin')");
    expect(endpoint).toContain("client.rpc('ds_has_maxxis_analysis_context_access'");
    expect(endpoint).not.toContain("client.rpc('ds_has_property_intelligence_entitlement'");
  });

  it('uses cache-only evidence during a condition-only recompute', () => {
    const assistant = source('src/components/maxxis/MaxxisAssistant.jsx');
    const client = source('src/services/maxxisService.js');
    const server = source('supabase/functions/maxxis-chat/index.ts');
    const context = source('supabase/functions/_shared/maxxis/getDealInsightContext.ts');
    expect(assistant).toContain("analysisRecomputeMode: 'GAP_UPDATE_CACHE_ONLY'");
    expect(client).toContain("analysisRecomputeMode === 'GAP_UPDATE_CACHE_ONLY'");
    expect(server).toContain("cacheOnly: analysisRecomputeMode === 'GAP_UPDATE_CACHE_ONLY'");
    expect(context).toContain('valuationService.getCachedValuationEvidence');
    expect(context).toContain('soldService.getCachedSoldEvidence');
  });

  it('keeps report rendering code outside the change surface', () => {
    const changedSurface = [
      'src/components/maxxis/MaxxisAssistant.jsx',
      'src/features/maxxis/intelligence/MaxxisAnalysisGapResolution.jsx',
      'src/services/maxxisAnalysisInputsService.js',
      'supabase/functions/maxxis-analysis-inputs/index.ts',
      'supabase/functions/maxxis-chat/index.ts',
    ];
    expect(changedSurface.some((path) => /ReportTemplate|ReportPreview|Pdf/i.test(path))).toBe(false);
  });
});
