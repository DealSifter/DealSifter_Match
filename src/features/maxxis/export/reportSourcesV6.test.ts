import {describe,it,expect} from 'vitest';
import {buildMaxxisReportSchema} from '../../../domain/maxxis/maxxisReportSchema';
import {buildStrictReportViewModel} from './reportIntegrityViewModel';
import {composeReportContent} from './reportContentPlan';
import {r43Fixtures} from '../../../../scripts/report-r43-fixtures.mjs';
describe('v6 source coverage through the canonical schema',()=>{
 const input=()=>structuredClone(r43Fixtures().find(f=>f.id==='rich')!.input);
 it('lists every used evidence family, with the real provider and retrieval date',()=>{
  const fixture=input(), intelligence=fixture.dealIntelligence;
  intelligence.propertyEvidence={...intelligence.propertyEvidence,provider:'RentCast',retrievedAt:'2026-10-30T12:00:00Z'};
  intelligence.comparableEvidence={...intelligence.comparableEvidence,provider:'RentCast',retrievedAt:'2026-10-29T12:00:00Z'};
  for(const key of ['used','supporting','excluded'])for(const row of intelligence.comparableEvidence[key]||[])delete row.retrievedAt;
  intelligence.valuationIntelligence={...intelligence.valuationIntelligence,providerEstimate:{value:350000,provider:'RentCast',retrievedAt:'2026-10-28T12:00:00Z'}};
  intelligence.marketRent={state:'AVAILABLE',evidence:{provider:'rentcast',evidenceType:'rent_estimate',status:'AVAILABLE',rent:2400,retrievedAt:'2026-10-27T12:00:00Z',comparables:[]}};
  const schema=buildMaxxisReportSchema({...fixture,reportType:'DEAL_INTELLIGENCE'}),vm=buildStrictReportViewModel({schema,language:'en'});
  expect(schema.sections.comparableEvidence.data).toMatchObject({provider:'RentCast',retrievedAt:'2026-10-29T12:00:00Z'});
  const sources=composeReportContent(vm).find(b=>b.id==='report-sources')!.rows!;
  for(const [family,date]of [['Property record','Oct 30, 2026'],['Automated value estimate / listing support','Oct 28, 2026'],['Comparable sales','Oct 29, 2026'],['Market rent','Oct 27, 2026']])expect(sources.find(row=>row.label==='RentCast · '+family)?.value).toBe(date);
 });
 it('keeps an older saved sales family visible and never invents its missing metadata',()=>{
  const schema=buildMaxxisReportSchema({...input(),reportType:'DEAL_INTELLIGENCE'}),vm=buildStrictReportViewModel({schema,language:'en'});
  const sources=composeReportContent(vm).find(b=>b.id==='report-sources')!.rows!;
  expect(sources.some(row=>row.label.includes('Comparable sales'))).toBe(true);
  expect(sources.filter(row=>row.value==='Retrieval date unavailable').length).toBeLessThanOrEqual(1);
 });
});
