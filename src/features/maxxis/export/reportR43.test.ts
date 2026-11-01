import {describe,it,expect} from 'vitest';
import {buildMaxxisReportSchema} from '../../../domain/maxxis/maxxisReportSchema';
import {buildStrictReportViewModel} from './reportIntegrityViewModel';
import {composeReportContent,reportSourceRows} from './reportContentPlan';
import {excludeSubjectReferences} from '../../../../supabase/functions/_shared/maxxis/reportMarketReferences';
import {r43Fixtures} from '../../../../scripts/report-r43-fixtures.mjs';
const special=()=>structuredClone(r43Fixtures().find(f=>f.id==='listing-only-subject')!.input);
const vm=(input=special())=>buildStrictReportViewModel({schema:buildMaxxisReportSchema({...input,reportType:'DEAL_INTELLIGENCE'}),language:'en'});
describe('R4.3 report integrity, offline fictional subjects',()=>{
 it('excludes the subject, retains listing semantics, and records exclusions',()=>{
  const model=vm(),table=model.sections.find(s=>s.id==='sales-comparables')!;
  expect(model.excludedSubjectComparables).toBe(1);expect(table.table!.rows).toHaveLength(3);
  expect(table.title).toBe('Comparable listings (for sale)');expect(table.table!.columns).toContain('Listed');
  expect(table.table!.rows.flat()).not.toContain(model.property.address);
  expect(table.map!.points.filter(p=>p.marker==='S')).toHaveLength(1);
 });
 it('excludes alternate identities and near-identical physical duplicates without excluding neighbours',()=>{
  const subject={id:'subject',address:'100 Example St',price:200000,beds:3,baths:2,sqft:1500,latitude:28,longitude:-82};
  const rows=[{...subject},{...subject,id:'alias',address:'100 EXAMPLE ST.'},{...subject,id:'other',address:'Alias road',latitude:28.00001},{...subject,id:'neighbour',address:'102 Example St',price:210000}];
  const result=excludeSubjectReferences(rows,subject);expect(result.excludedCount).toBe(3);expect(result.references[0].id).toBe('neighbour');
 });
 it('keeps sale history separate from absent publisher content',()=>{
  const model=vm(),blocks=composeReportContent(model);
  expect(model.property.facts.find(f=>f.title==='Sale history')!.rows.map(r=>r.label)).toEqual(['Latest recorded sale','Recorded sale date']);
  expect(model.property.facts.some(f=>f.title==='Publisher and authorized contacts')).toBe(false);
  expect(blocks.some(b=>b.title==='Sale history')).toBe(true);
 });
 it('bounds mixed tables to five recorded sales and three listings before atomic map layout',()=>{
  const input=special();
  input.dealIntelligence.comparableEvidence={used:[],supporting:Array.from({length:9},(_,n)=>({compIdentifier:`fixture-sale-${n}`,address:`${1700+n} Fictional Avenue`,salePrice:300000+n*1000,saleDate:'2026-10-01',latitude:27.95+n*.0001,longitude:-82.45+n*.0001,role:'SUPPORTING'}))};
  input.dealIntelligence.evidenceReasons.recordedSales=null;
  const model=vm(input),table=model.sections.find(s=>s.id==='sales-comparables')!.table!;
  expect(table.rows.filter(r=>r[5].startsWith('SOLD')).length).toBe(5);expect(table.rows.filter(r=>r[5]==='FOR SALE').length).toBe(3);expect(table.columns).toContain('Type');
  expect(model.indicatorReasons!.arv).toBe('USER_INPUT_REQUIRED');
 });
 it('removes the S legend when subject coordinates are absent',()=>{
  const input=special();delete input.property.latitude;delete input.property.longitude;
  const block=composeReportContent(vm(input)).find(b=>b.map)!;
  expect(block.map!.caption).not.toContain('S:');expect(block.map!.points.some(p=>p.marker==='S')).toBe(false);
 });
 it('keeps internal failure reason and action through the snapshot, model and PDF content plan',()=>{
  const model=vm(),pending=composeReportContent(model).find(b=>b.id==='report-pending')!;
  expect(model.indicatorReasons!.recordedSales).toBe('INTERNAL_ERROR');
  const row=pending.table!.find(r=>r[0].includes('Comparable sales'))!;
  expect(row).toHaveLength(3);expect(row[1]).toContain('our side');expect(row[2]).toContain('No provider data was lost');
 });
 it('keeps the full description in a final small-font block and the numeric score with criteria',()=>{
  const input=special();input.property.description='Full fictional description. '.repeat(15)+'FINAL SENTENCE.';
  const blocks=composeReportContent(vm(input)),description=blocks.find(b=>b.id==='listing-description')!;
  expect(description.readingSection).toBe(6);expect(description.textSize).toBe(8);expect(description.text).toContain('FINAL SENTENCE.');
  const profile=blocks.find(b=>b.id==='profile-compatibility')!;expect(profile.score).toBe(71);expect(profile.text).toContain('weights several criteria');
 });
 it('consolidates source families with the latest available retrieval date',()=>{
  const rows=reportSourceRows({propertyEvidence:{provider:'RentCast',retrievedAt:'2026-10-01',fields:[{field:'county',source:'RentCast',retrievedAt:'2026-10-03'},{field:'zoning',source:'RentCast',retrievedAt:'2026-10-02'}]}},'en');
  expect(rows).toHaveLength(1);expect(rows[0].value).toBe('Oct 3, 2026');
  expect(reportSourceRows({marketRent:{provider:'RentCast'}},'en')[0].value).toBe('Retrieval date unavailable');
 });
 it('preserves the normal user report address; QA aliases are never introduced by application projection',()=>{
  const model=vm();expect(model.property.address).toBe('1200 Example Avenue');
  expect(JSON.stringify(composeReportContent(model))).not.toContain('Address withheld');
 });
});
