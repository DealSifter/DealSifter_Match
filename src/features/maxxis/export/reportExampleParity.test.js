import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {reportPreviewRendererFingerprint} from '../../../../scripts/report-preview-fingerprint.mjs';
const root=new URL('../../../../',import.meta.url);
const base=new URL('src/assets/maxxis/report-previews/',root);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',base),'utf8'));
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
describe('example preview parity with production PDFs',()=>{
 it('fails when the production layout changes without regenerating the examples',async()=>{
  expect(manifest.rendererFingerprint).toBe(await reportPreviewRendererFingerprint(root));
 });
 it('demonstrates populated media, investor charts, valuation and scenario modules',()=>{
  const coverage=JSON.parse(readFileSync(new URL('qa/report-template/sample-coverage.json',root),'utf8'));
  for(const [type,sample] of Object.entries(coverage)){
   expect(sample.photos).toBe(5);
   expect(sample.maps).toBeGreaterThan(0);
   expect(sample.text).toContain('DEMONSTRATION ONLY');
   expect(sample.text).not.toMatch(/\bUnavailable\b|not configured|not yet been queried|Coordinate diagram/i);
   if(type!=='PROPERTY_RELEASE'){
    expect(sample.profileGauge).toBe(true);expect(sample.criteriaTable).toBe(true);expect(sample.scenario).toBe(true);
   }
   if(type==='DEAL_INTELLIGENCE'){
    expect(sample.valuationRange).toBe(true);expect(sample.rentRange).toBe(true);expect(sample.maps).toBe(1);
   }
  }
 });
 it.each(['PROPERTY_RELEASE','MAXXIS_ANALYSIS','DEAL_INTELLIGENCE'])('ships every physical PDF page for %s with matching QA and application assets',type=>{
  const report=manifest.reports[type];
  expect(sha256(readFileSync(new URL(`qa/report-template/${report.product}.pdf`,root)))).toBe(report.pdfSha256);
  expect(report.pages).toHaveLength(report.pageCount);
  for(const page of report.pages){
   const application=readFileSync(new URL(page.file,base));
   expect(sha256(application)).toBe(page.sha256);
   expect(application.equals(readFileSync(new URL(`qa/report-template/${page.file}`,root)))).toBe(true);
   expect(page.width/page.height).toBeCloseTo(595.28/841.89,2);
  }
 });
});
