import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {buildMaxxisReportSchema} from '../../../domain/maxxis/maxxisReportSchema';
import {buildStrictReportViewModel} from './reportIntegrityViewModel';
import {composeReportContent,REPORT_RAW_ISO,REPORT_INTERNAL_LABELS} from './reportContentPlan';
import {semanticAssertionId} from './reportReadingPlan';
import {renderMaxxisReportPdf} from './maxxisReportPdf';
import {resolveReportExportEntitlement} from './reportExportEntitlement';
import {r42Fixtures,R4_TIME} from '../../../../scripts/report-r42-fixtures.mjs';
const photo='data:image/jpeg;base64,'+readFileSync(new URL('../../../assets/maxxis/report-previews/sample-property-photo.jpg',import.meta.url)).toString('base64');
const fixture=(id:string)=>r42Fixtures([photo]).find((f:any)=>f.id===id)!.input;
const model=(id='rich',type='DEAL_INTELLIGENCE')=>buildStrictReportViewModel({schema:buildMaxxisReportSchema({...fixture(id),reportType:type}),language:'en'});
const levels=[['PROPERTY_RELEASE','free'],['MAXXIS_ANALYSIS','pro'],['DEAL_INTELLIGENCE','enterprise']] as const;
describe('R4.2 reading order and semantic report contract (network denied)',()=>{
 it('gives equivalent missing-evidence claims one stable semantic identity',()=>{
  expect(semanticAssertionId('Current market evidence does not support a valuation conclusion.')).toBe('SEM_EVIDENCIA_VALUATION');
  expect(semanticAssertionId('Reported price and attributes are starting points, not confirmed opportunity signals.')).toBe('SEM_EVIDENCIA_VALUATION');
  const blocks=composeReportContent(model('sparse')),limits=blocks.filter(b=>b.assertionIds?.length);
  expect(limits).toHaveLength(1); expect(limits[0].assertionIds).toEqual(expect.arrayContaining(['SEM_PERFIL','SEM_DADO_EXTERNO','SEM_EVIDENCIA_VALUATION']));
  expect(new Set(limits[0].assertionIds).size).toBe(limits[0].assertionIds!.length);
  expect(blocks.some(b=>['profile-readiness','investor-profile','opportunity-readiness','decision-blockers'].includes(b.id))).toBe(false);
 });
 it('keeps every fixed section monotonic and compatibility/criteria atomic',()=>{
  const blocks=composeReportContent(model()),order=blocks.map(b=>b.readingSection!);
  expect(order.every((n,i)=>i===0||n>=order[i-1])).toBe(true);
  const profile=blocks.filter(b=>b.id==='profile-compatibility');expect(profile).toHaveLength(1);
  expect(profile[0].score).toBe(71); expect(profile[0].rows!.length).toBeGreaterThan(3);
 });
 it('shows existing NOI/Cap Rate only in finances, preserves origin and keeps photos within overview',()=>{
  const vm=model(),blocks=composeReportContent(vm);
  const rows=blocks.flatMap(block=>(block.rows||[]).map(row=>({row,section:block.readingSection})));
  for(const {row,section} of rows.filter(({row})=>/\bNOI\b|cap rate|\bROI\b/i.test(row.label))){expect(section).toBe(4);expect(row.value).toMatch(/calculated from the inputs shown|reported by the publisher/);}
  expect(rows.some(({row})=>row.label==='NOI'&&row.value.includes('18,356'))).toBe(true);
  expect(blocks.filter(b=>b.kind==='photos')).toHaveLength(0);expect(blocks[0].photos).toHaveLength(1);
  vm.values.roi={state:'VALUE',text:'12%',numericValue:12,source:'Provided by publisher',evidenceRefs:['fixture:publisher-roi']};
  expect(composeReportContent(vm).find(b=>b.id==='financial-indicators')!.rows!.find(r=>r.label==='ROI')!.value).toContain('reported by the publisher');
 });
 it('uses tier-scoped completeness while leaving coverage scoring unimplemented',()=>{
  expect(model('rich','MAXXIS_ANALYSIS').completion).toBe('COMPLETE');
  expect(model('partial','MAXXIS_ANALYSIS').completion).toBe('PARTIAL');
  expect(model('sparse','MAXXIS_ANALYSIS').completion).toBe('PARTIAL');
  expect(model('sparse','PROPERTY_RELEASE').completion).toBe('COMPLETE');
  expect(model('sparse').completion).toBe('PRELIMINARY');
 });
 it('keeps only additional checks, and puts the rent amount first',()=>{
  const blocks=composeReportContent(model()),pending=blocks.find(b=>b.id==='report-pending');
  expect(blocks.some(b=>b.id==='next-actions')).toBe(false);
  const extra=(pending?.afterText||'').split('\n').slice(1);expect(extra.length).toBeLessThanOrEqual(3);
  expect(extra.filter(text=>/title|encumbrance/i.test(text))).toHaveLength(1);
  for(const check of extra)expect(pending!.table!.flat()).not.toContain(check);
  expect(blocks.find(b=>b.id==='market-rent')!.hero!.value).toBe('$2,400/mo');
 });
 for(const id of ['rich','partial','sparse'])for(const[type,plan]of levels)it(`${id} ${type}: reference chapters, centered masthead badges and intact body panels`,async()=>{
  const schema=buildMaxxisReportSchema({...fixture(id),reportType:type});
  const result=await renderMaxxisReportPdf({schema,language:'en',generatedAt:R4_TIME,exportEntitlement:resolveReportExportEntitlement({plan,reportType:type,channel:'PDF'})});
  expect(result.state).toBe('RENDERED');const audit=result.document.layoutAudit,sections=audit.sections;
  const text=audit.lines.map((line:any)=>line.text).join(' ');expect(text).not.toMatch(REPORT_RAW_ISO);expect(text).not.toMatch(REPORT_INTERNAL_LABELS);
  // The latest visual contract replaces the old cross-section flow with thematic pages.
  for(const a of sections)for(const b of sections)if(a!==b&&a.page===b.page){
   expect(Math.min(a.bounds.right,b.bounds.right)>Math.max(a.bounds.x,b.bounds.x)&&Math.min(a.bounds.bottom,b.bounds.bottom)>Math.max(a.bounds.y,b.bounds.y)).toBe(false);
  }
  const chapters=audit.lines.filter((line:any)=>line.sectionId==='referenceChapter').map((line:any)=>line.text);
  expect(chapters[0]).toBe('Property Overview');
  const thematic=['Comparative Market Analysis','Valuation Intelligence / ARV / KPIs','Investment Fit & Risk Analysis','Key Insights & Verification','Analysis Inputs & Sources','Maxxis AI Analysis'].map(title=>chapters.indexOf(title)).filter(index=>index>=0);
  if(type==='DEAL_INTELLIGENCE')expect(thematic.every((index,position)=>position===0||index>thematic[position-1])).toBe(true);
  for(const badge of audit.lines.filter((line:any)=>line.sectionId==='headerCompleteness')){
   expect(badge.x+badge.width/2).toBeCloseTo(534,1);expect(badge.y).toBeGreaterThanOrEqual(52);expect(badge.bottomY).toBeLessThanOrEqual(66);
  }
  if(id==='sparse'&&type==='DEAL_INTELLIGENCE')expect(result.document.pageCount).toBe(1);
  expect(audit.lines.every((line:any)=>line.overflowX===0&&line.overflowY===0)).toBe(true);
 });
});
