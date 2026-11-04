import {readFileSync} from 'node:fs';
import {describe,it,expect,vi} from 'vitest';
import {buildMaxxisReportSchema,mergeMaxxisReportProperty} from '../../../domain/maxxis/maxxisReportSchema';
import {buildStrictReportViewModel} from './reportIntegrityViewModel';
import {composeReportContent} from './reportContentPlan';
import {getReportPublisherDisclosure,setReportPublisherDisclosure} from './reportPublisherDisclosure';
import {renderMaxxisReportPdf} from './maxxisReportPdf';
import {resolveReportExportEntitlement} from './reportExportEntitlement';
import {ReportBrandShell} from './reportBrandShell';
import {r43Fixtures,R4_TIME} from '../../../../scripts/report-r43-fixtures.mjs';

const photo='data:image/jpeg;base64,'+readFileSync(new URL('../../../assets/maxxis/report-previews/sample-property-photo.jpg',import.meta.url)).toString('base64');
const input=()=>structuredClone(r43Fixtures([photo]).find((row:any)=>row.id==='rich')!.input);
const schema=(type='DEAL_INTELLIGENCE')=>buildMaxxisReportSchema({reportType:type,...input()});

describe('report visual recovery using real report inputs and renderer',()=>{
 it('keeps the authorized publisher identity with its contacts instead of a different record owner',()=>{
   const property=mergeMaxxisReportProperty({id:'fixture-id',owner:{name:'Recorded Entity',allowedContacts:[{type:'email',value:'record@example.invalid'}]}},{id:'fixture-id',owner:{name:'Fixture Publisher',allowedContacts:[{type:'email',value:'publisher@example.invalid'}]}});
   expect(property.owner.name).toBe('Fixture Publisher');expect(property.owner.allowedContacts).toEqual([{type:'email',value:'publisher@example.invalid'}]);
 });
 it('includes only already-authorized publisher contacts by default in the complete report, with opt-out',()=>{
   const allowed=schema();
   expect(getReportPublisherDisclosure(allowed)).toBe(true);
   const model=buildStrictReportViewModel({schema:allowed});
   expect(model.property.facts.find(row=>row.title==='Publisher and authorized contacts')?.rows.some(row=>row.label==='Email')).toBe(true);
   setReportPublisherDisclosure(allowed,false);expect(getReportPublisherDisclosure(allowed)).toBe(false);
   expect(buildStrictReportViewModel({schema:allowed}).property.facts.some(row=>row.title==='Publisher and authorized contacts')).toBe(false);
   const lockedInput=input();lockedInput.property.owner={name:'Fixture Publisher',allowedContacts:[]};
   const locked=buildMaxxisReportSchema({reportType:'DEAL_INTELLIGENCE',...lockedInput});
   expect(getReportPublisherDisclosure(locked,true)).toBe(false);
   expect(getReportPublisherDisclosure(schema('MAXXIS_ANALYSIS'))).toBe(false);
 });
 it('does not let empty external placeholders hide published attributes or turn them into verified records',()=>{
   const sample=input();sample.property.canonicalPropertyFacts={physical:{beds:{value:null,status:'UNKNOWN'}},conflicts:[]};sample.property.beds=4;
   const vm=buildStrictReportViewModel({schema:buildMaxxisReportSchema({reportType:'DEAL_INTELLIGENCE',...sample})});
   expect(vm.values.beds.numericValue).toBe(4);expect(vm.values.beds.state).toBe('VALUE');expect(vm.values.beds.source).not.toContain('Public record');
   sample.property.canonicalPropertyFacts.physical.beds={value:null,status:'CONFLICTED'};
   expect(buildStrictReportViewModel({schema:buildMaxxisReportSchema({reportType:'DEAL_INTELLIGENCE',...sample})}).values.beds.state).toBe('CONFLICTED');
 });
 it('retains supported range and criteria chart data in the final composition',()=>{
   const vm=buildStrictReportViewModel({schema:schema()}),blocks=composeReportContent(vm);
   for(const section of vm.sections.filter(row=>row.range))expect(blocks.some(block=>block.range?.estimate===section.range!.estimate)).toBe(true);
   expect(blocks.find(row=>row.id==='profile-compatibility')?.comparison?.length).toBeGreaterThan(0);
 });
 it('renders the title only in the dark header, restores section icons and keeps all content inside page bounds',async()=>{
   const icon=vi.spyOn(ReportBrandShell.prototype,'icon');
   try{
     const report=await renderMaxxisReportPdf({schema:schema(),language:'en',generatedAt:R4_TIME,exportEntitlement:resolveReportExportEntitlement({plan:'enterprise',reportType:'DEAL_INTELLIGENCE',channel:'PDF'})});
     expect(report.state).toBe('RENDERED');if(report.state!=='RENDERED')return;
     const audit=report.document.layoutAudit;
     expect(audit.lines.filter((row:any)=>row.sectionId==='headerProduct').every((row:any)=>row.y<75&&row.fontSize>=12)).toBe(true);
     expect(audit.lines.some((row:any)=>row.sectionId==='headerPageTitle'||row.sectionId==='headerPageSubtitle')).toBe(false);
     expect(audit.lines.filter((row:any)=>row.sectionId==='headerCompleteness')).toHaveLength(report.document.pageCount);
     expect(audit.lines.filter((row:any)=>row.sectionId==='headerCompleteness').every((row:any)=>row.y>=52&&row.bottomY<=66)).toBe(true);
     expect(audit.lines.filter((row:any)=>row.sectionId==='referenceChapter')).toHaveLength(report.document.pageCount);
     expect(audit.lines.filter((row:any)=>row.sectionId==='referenceChapter').every((row:any)=>row.fontSize===17)).toBe(true);
     expect(audit.lines.some((row:any)=>row.sectionId==='property-overview'&&row.fontSize>=21)).toBe(true);
     expect(icon.mock.calls.map(row=>row[0])).toEqual(expect.arrayContaining(['home','chart','user','document']));
     expect(audit.sections.every((row:any)=>row.bounds.bottom<=790)).toBe(true);
     const comparable = composeReportContent(buildStrictReportViewModel({schema:schema()})).find(block=>block.table?.[0]?.[0]==='1');
     expect(comparable).toBeDefined();
     if (comparable) {
       const lines = audit.lines.filter((row:any)=>row.sectionId===comparable.id);
       const firstData = lines.findLastIndex((row:any)=>row.text==='1');
       expect(firstData).toBeGreaterThan(0);
       expect(lines.slice(0,firstData).filter((row:any)=>row.bottomY>lines[firstData].y).map((row:any)=>({text:row.text,y:row.y,bottom:row.bottomY,dataY:lines[firstData].y}))).toEqual([]);
     }
   }finally{icon.mockRestore();}
 });
});
