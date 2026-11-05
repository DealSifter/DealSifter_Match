import {describe,it,expect} from 'vitest';
import {comparableMapViewport,comparableMapMarkers} from './comparableMapGeometry';
import {composeReportContent,reportSourceRows} from './reportContentPlan';
import {buildStrictReportViewModel} from './reportIntegrityViewModel';
import {buildMaxxisReportSchema} from '../../../domain/maxxis/maxxisReportSchema';
import {ContentReportComposition} from './contentReportComposition';
import {r43Fixtures} from '../../../../scripts/report-r43-fixtures.mjs';
describe('R4.4 presentation contract, offline',()=>{
 it('keeps every source family, groups repeated fields and reports a missing date once',()=>{
  const sources=reportSourceRows({propertyEvidence:{provider:'RentCast',retrievedAt:'2026-10-30'},valuationEvidence:{provider:'RentCast'},comparableEvidence:{provider:'RentCast'},marketRent:{provider:'RentCast'},listings:{provider:'RentCast',data_type:'sale_listing_evidence'}},'en');
  expect(sources).toHaveLength(5);expect(sources.filter(row=>row.value==='Retrieval date unavailable')).toHaveLength(1);
  expect(new Set(sources.map(row=>row.label)).size).toBe(5);
 });
 it('retains normalized estimate range and uses specific residual actions',()=>{
  const input=structuredClone(r43Fixtures().find(f=>f.id==='listing-only-subject')!.input);
  input.dealIntelligence.valuationIntelligence.providerEstimate={value:300000,rangeLow:280000,rangeHigh:320000,provider:'RentCast',retrievedAt:'2026-10-30'};
  const model=buildStrictReportViewModel({schema:buildMaxxisReportSchema({...input,reportType:'DEAL_INTELLIGENCE'}),language:'en'}),blocks=composeReportContent(model);
  expect(model.sections.find(s=>s.id==='provider-reference')!.range).toMatchObject({low:'$280,000',high:'$320,000'});
  const estimate=blocks.find(b=>b.id==='provider-reference')!;expect(estimate.readingSection).toBe(3);expect(estimate.text).toContain('$280,000');
  const pending=blocks.find(b=>b.id==='report-pending')!.table!;
  expect(pending.find(row=>row[0].includes('Comparable sales'))!.slice(1)).toEqual(['A temporary issue occurred on our side.','Regenerate later.']);
  model.indicatorReasons!.arv='USER_INPUT_REQUIRED';
  const arvPending=composeReportContent(model).find(b=>b.id==='report-pending')!.table!;
  expect(arvPending.find(row=>row[0]==='ARV')![2]).toBe('Confirm the target condition of the property so eligible sales can be evaluated.');
  expect(arvPending.flat().join(' ')).not.toContain('Maxxis will ask in chat');
 });
 it('separates coincident map markers deterministically without changing their anchors or numbering',()=>{
  const points=Array.from({length:9},(_,i)=>({latitude:27.95,longitude:-82.45,marker:i?String(i):'S'})),view=comparableMapViewport(points),markers=comparableMapMarkers(view);
  expect(markers).toEqual(comparableMapMarkers(view));expect(markers.map(p=>p.item.marker)).toEqual(points.map(p=>p.marker));
  for(const p of markers){expect(p.anchorX).toBe(450);expect(p.anchorY).toBe(165);expect(p.x).toBeGreaterThanOrEqual(25);for(const other of markers)if(p!==other)expect(Math.hypot(p.x-other.x,p.y-other.y)).toBeGreaterThanOrEqual(41.99);}
 });
 it('splits criteria at row boundaries and descriptions at paragraph boundaries with no repeated assertions',()=>{
  const composition=Object.create(ContentReportComposition.prototype);
  composition.setWidth=()=>{};composition.measure=(block:any)=>30+(block.rows?.length||0)*20+(block.text?.length||0);
  const original={id:'profile-compatibility',title:'Criteria',kind:'facts',rows:Array.from({length:8},(_,i)=>({label:String(i),value:'Criterion'})),assertionIds:['PROFILE'],score:71};
  const [head,tail]=composition.splitForSpace(original,120)!;
  expect([...head.rows!,...tail.rows!]).toEqual(original.rows);expect(head.score).toBeUndefined();expect(tail.score).toBe(71);expect(tail.assertionIds).toBeUndefined();
  const parts=composition.splitForSpace({id:'listing-description',title:'Description',kind:'text',text:'First paragraph.\n\nSecond paragraph.'},50)!;
  expect(parts.map((p:any)=>p.text).join('\n\n')).toBe('First paragraph.\n\nSecond paragraph.');
 });
});
