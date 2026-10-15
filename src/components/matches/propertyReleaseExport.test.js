import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { buildMaxxisReportSchema } from '../../domain/maxxis/maxxisReportSchema';
import { renderMaxxisReportPdf } from '../../features/maxxis/export/maxxisReportPdf';
import { resolveReportExportEntitlement } from '../../features/maxxis/export/reportExportEntitlement';

const source=readFileSync(new URL('./MatchesPortfolio.jsx',import.meta.url),'utf8');
describe('L1 portfolio export with continuation pages',()=>{
  it('preserves long factual notes for a free account without higher-tier access',async()=>{
    const notes=Array.from({length:30},(_,index)=>`Recorded owner note ${index+1}: verify the published property information before proceeding.`).join(' ');
    const property={id:'l1-regression-fixture',address:'100 Synthetic Example St',city:'Example City',state:'AR',zip:'00000',type:'SFR',price:90000,beds:3,baths:2,sqft:1760,lot:5000,notes};
    const fetchSpy=vi.spyOn(globalThis,'fetch').mockImplementation(()=>{throw new Error('NO_PROVIDER_CALLS_ALLOWED');});
    try{
      const result=await renderMaxxisReportPdf({schema:buildMaxxisReportSchema({reportType:'PROPERTY_RELEASE',property}),exportEntitlement:resolveReportExportEntitlement({plan:'free',reportType:'PROPERTY_RELEASE',channel:'PDF'})});
      expect(result.state).toBe('RENDERED');
      expect(result.document.pageCount).toBeGreaterThan(1);
      expect(result.document.layoutAudit.continuations.length).toBeGreaterThan(0);
      expect(new TextDecoder().decode(result.document.binary.subarray(0,5))).toBe('%PDF-');
      expect(fetchSpy).not.toHaveBeenCalled();
      for(const reportType of ['MAXXIS_ANALYSIS','DEAL_INTELLIGENCE'])expect(resolveReportExportEntitlement({plan:'free',reportType,channel:'PDF'}).allowed).toBe(false);
    }finally{fetchSpy.mockRestore();}
  });
  it('accepts renderer continuations without changing report-tier authorization',()=>{
    const exportPath=source.split('const generateReleasePdf =')[1].split('const handleExportToEmail')[0];
    expect(exportPath).toContain("plan: 'free', reportType: INTELLIGENCE_REPORT_TYPES.PROPERTY_RELEASE");
    expect(exportPath).toContain("rendered.state !== 'RENDERED'");
    expect(exportPath).toContain('rendered.document?.pageCount >= 1');
    expect(exportPath).not.toMatch(/pageCount\s*[!=]==?\s*1/);
    expect(exportPath).toContain('downloadMaxxisReportPdf');
  });
  it('keeps the export dialog available for retry after a handled failure',()=>{
    const handler=source.split('const handleConfirmEmailExport =')[1].split('const metaChips')[0];
    expect(handler).toContain('if (isPreparingExport) return');
    expect(handler).toContain('setExportError(matchesT.exportFailed');
    expect(handler).toMatch(/catch[\s\S]*?return;[\s\S]*?finally/);
    expect(source).toContain('role="alert"');
  });
});
