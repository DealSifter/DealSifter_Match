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
  for(const [type,report] of Object.entries(manifest.reports)){
   const sample=report.coverage;
   expect(sample.photos).toBe(5);
   expect(sample.maps).toBeGreaterThan(0);
   expect(sample.demonstrationOnly).toBe(true);
   expect(sample.unavailableFields).toBe(false);
   if(type!=='PROPERTY_RELEASE'){
    expect(sample.profileGauge).toBe(true);expect(sample.criteriaChart).toBe(true);expect(sample.scenario).toBe(true);
   }
   if(type==='DEAL_INTELLIGENCE'){
    expect(sample.valuationRange).toBe(true);expect(sample.rentRange).toBe(true);expect(sample.maps).toBeGreaterThanOrEqual(2);
    expect(report.pageCount).toBeLessThanOrEqual(6);
   }
  }
 });
 it.each(['PROPERTY_RELEASE','MAXXIS_ANALYSIS','DEAL_INTELLIGENCE'])('ships every renderer-produced page for %s with matching application fingerprints',type=>{
  const report=manifest.reports[type];
  expect(report.pdfSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(report.pages).toHaveLength(report.pageCount);
  for(const page of report.pages){
   const application=readFileSync(new URL(page.file,base));
   expect(sha256(application)).toBe(page.sha256);
   expect(page.width/page.height).toBeCloseTo(595.28/841.89,2);
  }
 });
});
