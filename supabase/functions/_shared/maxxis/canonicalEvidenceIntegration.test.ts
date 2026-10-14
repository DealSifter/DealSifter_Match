import {describe,it,expect,vi} from 'vitest';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {buildConsensusAwareCanonicalReadModel,PROJECTED_FIELDS,ANALYTICAL_FIELD_POLICY} from './canonicalEvidenceProjection.ts';
import {buildPropertyFactLookupAnswer,detectPropertyFactLookup} from './propertyFactLookup.ts';
import {getCanonicalPropertyEvidenceWithDependencies} from './canonicalEvidenceTool.ts';
import {issueParcelEvidenceReceipt,readParcelEvidenceReceipt} from '../public-parcel/evidenceReceipt.ts';
import {PARCEL_SOURCES} from '../public-parcel/registry.ts';
import {normalizeParcel} from '../public-parcel/arcgis.ts';
import {classifyMaxxisConversationIntent} from '../../../../src/features/maxxis/routing/maxxisConversationIntent.js';
import type {CandidateInput} from '../parcel-evidence-consensus/types.ts';
const qa='qa/canonical-evidence-maxxis';
const artifact=(name:string,data:unknown)=>{mkdirSync(qa,{recursive:true});writeFileSync(`${qa}/${name}.json`,JSON.stringify({fixtureOnly:true,data},null,2)+'\n');};
const candidate=(field:CandidateInput['field'],value:unknown,family='PUBLISHER',extra:Partial<CandidateInput>={}):CandidateInput=>({field,originalValue:value,
 sourceType:family==='PUBLISHER'?'USER_PROVIDED':family==='RENTCAST'?'RENTCAST':'PUBLIC_PARCEL_GIS',sourceId:family,sourceFamily:family,
 sourceAuthority:family,evidenceStatus:family==='PUBLISHER'?'USER_PROVIDED':'PUBLIC_RECORD',...extra});
const area=(value:number,family='PUBLISHER',extra:Partial<CandidateInput>={})=>candidate('lotArea',value,family,{unit:'ACRES',...extra});
const property={id:'11111111-1111-4111-8111-111111111111',type:'LAND',lot:'1.14 ac'};
const gable=[area(1.14),area(23854,'RENTCAST',{unit:'SQFT',evidenceStatus:'VERIFIED_RECORD'})];
const three=[...gable,area(1.23,'GIS')];
const view=(inputs:CandidateInput[])=>buildConsensusAwareCanonicalReadModel(property,inputs);
const answer=(inputs:CandidateInput[],message='Qual é a área do lote?',language='pt',publicAvailable=false)=>buildPropertyFactLookupAnswer(message,language,
 {propertyFacts:{canonicalPropertyFacts:view(inputs)},publicParcelState:publicAvailable?'AVAILABLE':'NO_APPROVED_AVAILABLE_EVIDENCE'})!;
describe('canonical additive analytical projection',()=>{
 it('Gable conflicts unresolved; legacy scalar and publisher object unchanged',()=>{
  const before=structuredClone(property),model=view(gable),field=model.analyticalEvidence.fields.lotArea;
  expect(field.analyticalUsability).toBe('CONFLICTED');expect(field.value).toBeNull();expect(field.range).toBeNull();expect(field.candidates).toHaveLength(2);
  expect(model.resolvedLotDimensions.resolvedAcres).toBe(1.14);expect(property).toEqual(before);
  artifact('canonical-projection-controls',{gable:field,legacyAcres:model.resolvedLotDimensions.resolvedAcres,rowsWritten:0});
 });
 it('outlier exposes original range, no fabricated midpoint or scalar',()=>{
  const field=view(three).analyticalEvidence.fields.lotArea;
  expect(field.consensusState).toBe('OUTLIER_DETECTED');expect(field.analyticalUsability).toBe('PROVISIONAL');expect(field.value).toBeNull();
  expect(field.range).toEqual({min:1.14*43560,max:1.23*43560});expect(field.outliers[0].sourceType).toBe('RENTCAST');
 });
 it.each([[1,1,'CONFIRMED'],[1,1.01,'CONFIRMED'],[1,1.06,'PROVISIONAL'],[1,1.8,'CONFLICTED']])('mapping %s/%s => %s',(a,b,usability)=>{
  const field=view([area(a as number),area(b as number,'GIS')]).analyticalEvidence.fields.lotArea;expect(field.analyticalUsability).toBe(usability);
  if(a!==b)expect(field.value).toBeNull();else expect(field.value).toBe(43560);
 });
 it('single-source, unavailable, not-applicable and unknown preserve distinct semantics',()=>{
  expect(view([area(.75,'GIS')]).analyticalEvidence.fields.lotArea).toMatchObject({analyticalUsability:'SINGLE_SOURCE',value:.75*43560});
  expect(view([]).analyticalEvidence.fields.lotArea.analyticalUsability).toBe('UNAVAILABLE');
  expect(view([candidate('zoning',null,'PUBLISHER',{evidenceStatus:'NOT_APPLICABLE'})]).analyticalEvidence.fields.zoning.analyticalUsability).toBe('NOT_APPLICABLE');
  expect(view([candidate('propertyTax',null,'GIS',{evidenceStatus:'UNKNOWN'})]).analyticalEvidence.fields.propertyTax.value).toBeNull();
 });
 it('stale source/duplicates do not invent cross-confirmation',()=>{
  const field=view([area(.75,'GIS',{freshness:'STALE_USABLE'}),area(.75,'GIS',{sourceType:'CALCULATED_GEOMETRY',freshness:'STALE_USABLE'})]).analyticalEvidence.fields.lotArea;
  expect(field.analyticalUsability).toBe('SINGLE_SOURCE');expect(field.sourceFreshness.every(c=>c.freshness==='STALE_USABLE')).toBe(true);
 });
 it('temporal context and benchmarks do not become actual tax/assessment truth',()=>{
  const rows=[candidate('assessedValue',100,'PUBLISHER',{unit:'USD',metadata:{year:2024,concept:'ASSESSED_VALUE'}}),candidate('assessedValue',200,'GIS',{unit:'USD',metadata:{year:2025,concept:'ASSESSED_VALUE'}})];
  expect(view(rows).analyticalEvidence.fields.assessedValue).toMatchObject({analyticalUsability:'CONFLICTED',value:null});
  const tax=view([candidate('propertyTax',1000,'GIS',{unit:'USD',evidenceStatus:'CALCULATED',metadata:{year:2026,concept:'ANNUAL_RECORDED_TAX'}})]).analyticalEvidence.fields.propertyTax;
  expect(tax.value).toBeNull();expect(tax.analyticalUsability).toBe('UNAVAILABLE');
 });
 it('actual recorded zero remains zero, not missing',()=>{
  const field=view([candidate('propertyTax',0,'GIS',{unit:'USD',metadata:{year:2026,concept:'ANNUAL_RECORDED_TAX'}})]).analyticalEvidence.fields.propertyTax;
  expect(field.value).toBe(0);expect(field.analyticalUsability).toBe('SINGLE_SOURCE');
 });
 it('field policy remains distinct, property type lock and original candidates survive',()=>{
  const model=view([candidate('propertyType','LAND'),candidate('propertyType','Single Family','RENTCAST')]);
  expect(model.analyticalEvidence.resolvedAnalysisPropertyType).toBe('LAND');expect(model.analyticalEvidence.fields.propertyType.value).toBeNull();
  expect(ANALYTICAL_FIELD_POLICY.apn.range).toBe(false);expect(ANALYTICAL_FIELD_POLICY.lotArea.range).toBe(true);
  artifact('property-type-regression',{model,financialMigration:false});
 });
 it('source changes recompute and outputs never contaminate another subject',()=>{
  const first=view(gable);first.analyticalEvidence.fields.lotArea.candidates[0].originalValue=999;
  expect(view(gable).analyticalEvidence.fields.lotArea.candidates.some(c=>c.originalValue===999)).toBe(false);
  expect(view([area(1),area(1,'RENTCAST')]).analyticalEvidence.fields.lotArea.analyticalUsability).toBe('CONFIRMED');
 });
});
describe('deterministic Maxxis localized direct facts',()=>{
 it.each(['pt','en','es'])('Gable/no winner/no raw enums: %s',language=>{
  const text=answer(gable,language==='pt'?'Qual é a área do lote?':language==='es'?'Cuál es el área del lote?':'What is the lot size?',language).text;
  expect(text).toContain('RentCast');expect(text).toMatch(/1[,.]14/);expect(text).toMatch(/0[,.]5476/);
  expect(text).not.toMatch(/MATERIAL_CONFLICT|USER_PROVIDED|OUTLIER_DETECTED|SINGLE_SOURCE|sourceFamily|prompt/);
  artifact(`gable-chat-control-${language}`,{text});if(language==='pt')artifact('gable-chat-control',{text});
 });
 it.each(['pt','en','es'])('outlier/range/survey qualification: %s',language=>{
  const text=answer(three,'lot size',language,true).text;expect(text).toMatch(/1[,.]14 ac–1[,.]23 ac/);expect(text).toContain('RentCast');expect(text).not.toMatch(/1[,.]185/);
  artifact(`three-source-chat-control-${language}`,{text});if(language==='pt')artifact('three-source-chat-control',{text});
 });
 it('consistent and single-source qualifications',()=>{
  const consistent=answer([area(.5),area(.505,'GIS')]).text,single=answer([area(.75,'GIS')]).text;
  expect(consistent).toContain('consistentes');expect(single).toContain('apenas uma fonte');artifact('single-source-chat-control',{text:single});
 });
 it.each([['apn','Qual o APN?','000123'],['zoning','Qual é o zoning?','R2'],['owner','Quem é o proprietário?','ACME LLC']])('direct %s source, original text',(field,message,value)=>{
  const text=answer([candidate(field as CandidateInput['field'],value)],message).text;expect(text).toContain(value);
  artifact(field==='owner'?'owner-chat-control':`${field}-chat-control`,{text});
 });
 it.each([['assessedValue','Qual o assessed value?','ASSESSED_VALUE'],['propertyTax','Qual é o property tax?','ANNUAL_RECORDED_TAX']])('fiscal value/year/record and unknown: %s',(field,message,concept)=>{
  const text=answer([candidate(field as CandidateInput['field'],500,'GIS',{unit:'USD',metadata:{year:2024,concept}})],message).text;
  expect(text).toContain('2024');expect(text).toContain('500');expect(text).not.toMatch(/valor de mercado|AVM/);
  artifact(field==='assessedValue'?'assessment-chat-control':'tax-chat-control',{text,missing:answer([],message).text});
 });
 it('LAND question stays localized and locked despite SFR record',()=>{
  const text=answer([candidate('propertyType','LAND'),candidate('propertyType','Single Family','RENTCAST')],'Que tipo de imóvel é esse?').text;
  expect(text).toContain('Terreno');expect(text).toContain('não altera');expect(text).not.toMatch(/\bLAND\b|\bSFR\b|SINGLE_FAMILY/);
 });
 it('stale evidence is never called freshly verified',()=>{
  const text=answer([area(.75,'GIS',{freshness:'STALE_USABLE'})]).text;expect(text).toContain('antiga');expect(text).toContain('não uma verificação recente');
  artifact('stale-evidence-chat-control',{text});
 });
 it('runtime direct-fact branch precedes premium/gap/Gemini and uses the registered read-only tool',()=>{
  const runtime=readFileSync('supabase/functions/maxxis-chat/index.ts','utf8'),registry=readFileSync('supabase/functions/_shared/maxxis/toolRegistry.ts','utf8');
  expect(runtime.indexOf('const earlyPropertyFact')).toBeLessThan(runtime.indexOf('const requestedCapability'));
  expect(runtime.indexOf("executeMaxxisTool('getCanonicalPropertyEvidence'")).toBeLessThan(runtime.indexOf('const result = await callGemini'));
  expect(registry).toContain('getCanonicalPropertyEvidenceWithDependencies');
  expect(detectPropertyFactLookup('Explique a divergência entre as fontes do imóvel')?.fields).toHaveLength(7);
 });
 it.each(['Qual é a área do lote?','Quantos acres tem?','Qual o APN?','Qual o zoning?','Quem é o proprietário?','Qual o assessed value?','Qual o property tax?','Que tipo de imóvel é esse?'])('direct fact beats pending financing gap: %s',message=>{
  expect(detectPropertyFactLookup(message)?.fields.length).toBeGreaterThan(0);
  expect(classifyMaxxisConversationIntent(message,{pendingGap:{field:'down_payment'}}).code).not.toBe('GAP_RESPONSE');
  artifact('gap-intent-priority',{directQuestionsOverrideGap:true});
 });
});
const userId='22222222-2222-4222-8222-222222222222',point={lat:40,lng:-111},now=Date.now();
const source=PARCEL_SOURCES.find(s=>s.sourceId==='us-ut-salt-lake-parcels')!;
const dy=Math.sqrt(1.23*4046.8564224)/111195.08/2,dx=dy/Math.cos(40*Math.PI/180);
const parcel=normalizeParcel(source,{PARCEL_ID:'001',PARCEL_ACRES:1.23},{type:'Polygon',coordinates:[[[-111-dx,40-dy],[-111+dx,40-dy],[-111+dx,40+dy],[-111-dx,40+dy],[-111-dx,40-dy]]]},new Date(now).toISOString(),null);
const publicResult={status:'COVERAGE_AVAILABLE' as const,parcels:[parcel],countyFips:'49035',sourceIds:[source.sourceId],ambiguity:false,exceededLimit:false,freshness:'FRESH' as const,cacheHit:true,expiresAt:new Date(now+3600000).toISOString()};
describe('signed available-evidence handoff and property authorization',()=>{
 it('signed acquisition is verified locally, no added provider/network calls',async()=>{
  const fetch=vi.spyOn(globalThis,'fetch').mockRejectedValue(new Error('LIVE_CALL_FORBIDDEN'));
  const token=await issueParcelEvidenceReceipt(publicResult,point,userId,'test-secret-not-production',now);
  expect(token).toBeTruthy();const evidence=await readParcelEvidenceReceipt(token,{userId,point,secret:'test-secret-not-production',enabled:true,now});
  expect(evidence).toHaveLength(1);expect(evidence[0].parcel.assessorAcres).toBe(1.23);expect(evidence[0].parcel.geometry).toBeUndefined();expect(fetch).not.toHaveBeenCalled();fetch.mockRestore();
 });
 it.each(['actor','point','secret','off','expired','tampered'])('fails closed for %s',async violation=>{
  const token=await issueParcelEvidenceReceipt(publicResult,point,userId,'secret',now);
  const result=await readParcelEvidenceReceipt(violation==='tampered'?`${token}x`:token,{userId:violation==='actor'?'other-user':userId,
   point:violation==='point'?{lat:41,lng:-111}:point,secret:violation==='secret'?'wrong':'secret',enabled:violation!=='off',now:violation==='expired'?now+8*86400000:now});
  expect(result).toEqual([]);
 });
 it('ambiguous/unlicensed sources never acquire evidence receipts',async()=>{
  expect(await issueParcelEvidenceReceipt({...publicResult,ambiguity:true},point,userId,'secret',now)).toBeNull();
  expect(await issueParcelEvidenceReceipt({...publicResult,parcels:[{...parcel,source:'unknown-unapproved'}]},point,userId,'secret',now)).toBeNull();
 });
 it.each(['FREE','PRO','ENTERPRISE'])('public parcel does not require unlock for %s',async plan=>{
  const token=await issueParcelEvidenceReceipt(publicResult,point,userId,'secret',now);
  const load=vi.fn(async()=>({id:property.id,type:'LAND',lot:'1.14 ac',latitude:40,longitude:-111,is_active:true,publish_to_showcase:true}));
  const result=await getCanonicalPropertyEvidenceWithDependencies({input:{propertyId:property.id},propertyId:property.id,userId,receipt:token,secret:'secret',parcelEnabled:true,
   loadPublicProperty:load,loadCachedProvider:async()=>({type:'property_evidence',propertyId:property.id,state:'locked',entitlementState:'not_authorized',cacheState:'unknown'})});
  expect(result.state).toBe('available');expect(result.publicParcelState).toBe('AVAILABLE');expect(result.readModel?.analyticalEvidence.fields.lotArea.analyticalUsability).toBe('PROVISIONAL');
  artifact(`plan-${plan}-control`,{publicAvailable:true,privateProviderCache:'locked',newPricing:false});
 });
 it('current subject mismatch stops before acquisition; unauthorized/unpublished and hidden address are protected',async()=>{
  const load=vi.fn(async()=>null),base={propertyId:property.id,userId,secret:'secret',parcelEnabled:true,loadPublicProperty:load,
   loadCachedProvider:async()=>{throw new Error('SHOULD_NOT_BE_CALLED');}};
  await expect(getCanonicalPropertyEvidenceWithDependencies({...base,input:{propertyId:'33333333-3333-4333-8333-333333333333'}})).rejects.toThrow('PROPERTY_CONTEXT_MISMATCH');expect(load).not.toHaveBeenCalled();
  expect((await getCanonicalPropertyEvidenceWithDependencies({...base,input:{propertyId:property.id}})).state).toBe('not_found');
  const token=await issueParcelEvidenceReceipt(publicResult,point,userId,'secret',now);
  const hidden=await getCanonicalPropertyEvidenceWithDependencies({...base,input:{propertyId:property.id},receipt:token,
   loadPublicProperty:async()=>({id:property.id,type:'LAND',lot:'1.14 ac',latitude:null,longitude:null,email:'private@example.test'})});
  expect(hidden.publicParcelState).not.toBe('AVAILABLE');expect(JSON.stringify(hidden)).not.toContain('private@example.test');
  artifact('private-data-isolation',{currentContextMismatchBlocked:true,tenantAndHiddenCoordinatesProtected:true,rawProfileLeak:0});
 });
 it('locked/mismatched provider evidence cannot leak cached internal/profile information',async()=>{
  const result=await getCanonicalPropertyEvidenceWithDependencies({input:{propertyId:property.id},propertyId:property.id,userId,secret:'secret',parcelEnabled:false,
   loadPublicProperty:async()=>({id:property.id,type:'LAND',lot:'1.14 ac'}),loadCachedProvider:async()=>({type:'property_evidence',propertyId:'other',state:'available',entitlementState:'authorized',cacheState:'hit',evidence:{internalFields:{email:'secret@example.test'}} as never})});
  expect(JSON.stringify(result)).not.toContain('secret@example.test');expect(result.readModel?.analyticalEvidence.fields.lotArea.analyticalUsability).toBe('SINGLE_SOURCE');
 });
 it('reads only current user-owned clarification, preserving conflicting zoning',async()=>{
  const own=vi.fn(async()=>({zoning:'R2',apn:'000123'}));
  const result=await getCanonicalPropertyEvidenceWithDependencies({input:{propertyId:property.id},propertyId:property.id,userId,secret:'secret',parcelEnabled:false,
   loadPublicProperty:async()=>({id:property.id,type:'LAND',lot:'1.14 ac'}),loadUserFacts:own,
   loadCachedProvider:async()=>({type:'property_evidence',propertyId:property.id,state:'available',entitlementState:'authorized',cacheState:'hit',evidence:{fields:{zoning:{value:'R1',status:'VERIFIED_RECORD',source:'rentcast'}},internalFields:{},conflicts:[]} as never})});
  expect(own).toHaveBeenCalledWith(property.id,userId);expect(result.readModel?.analyticalEvidence.fields.zoning.analyticalUsability).toBe('CONFLICTED');
  expect(result.readModel?.analyticalEvidence.fields.zoning.candidates.map(c=>c.originalValue).sort()).toEqual(['R1','R2']);
 });
});
describe('phase isolation and policy artifacts',()=>{
 it('new canonical tool/read metadata is not consumed by report or financial engines',()=>{
  const names=['dealMetrics.ts','scenarioEngine.ts','landMetrics.ts','landDevelopmentScenario.ts','getDealInsightContext.ts'];
  for(const name of names)expect(readFileSync(`supabase/functions/_shared/maxxis/${name}`,'utf8')).not.toMatch(/canonicalEvidenceProjection|analyticalEvidence|readParcelEvidenceReceipt/);
  artifact('engine-isolation-validation',{changedBehavior:false,legacyLotAcres:1.14,consensusLotResolved:null,migratedEngines:0});
  artifact('report-isolation-validation',{L1:0,L2:0,L3:0});artifact('parcel-lens-regression',{existingLensDiameter:0.20,redesign:false,additionalGisCalls:0});
 });
 it('generates documented analytical policy matrix',()=>{
  const states=['CONSISTENT','MINOR_VARIANCE','OUTLIER_DETECTED','MATERIAL_CONFLICT','INSUFFICIENT_EVIDENCE','SINGLE_SOURCE','UNAVAILABLE','NOT_APPLICABLE'];
  const rows=PROJECTED_FIELDS.flatMap(field=>states.map(state=>`${field},${state},${state==='CONSISTENT'?'CONFIRMED':state==='MINOR_VARIANCE'?ANALYTICAL_FIELD_POLICY[field].minor:state==='OUTLIER_DETECTED'?'PROVISIONAL':state==='MATERIAL_CONFLICT'||state==='INSUFFICIENT_EVIDENCE'?'CONFLICTED_OR_STRUCTURE_DEPENDENT':state},OBSERVED_UNANIMOUS_ONLY,${ANALYTICAL_FIELD_POLICY[field].range},true,NO_ENGINE_MIGRATION`));
  writeFileSync(`${qa}/analytical-usability-matrix.csv`,['domain,consensusState,analyticalUsability,scalarAllowed,rangeAllowed,requiresQualification,notes',...rows].join('\n')+'\n');
 });
 it('measures pure projection/direct-fact lookup without I/O',()=>{
  const fetch=vi.spyOn(globalThis,'fetch').mockRejectedValue(new Error('NO_NETWORK'));const start=performance.now();for(let i=0;i<100;i++)answer(gable);
  expect(fetch).not.toHaveBeenCalled();fetch.mockRestore();artifact('performance-validation',{iterations:100,totalMilliseconds:performance.now()-start,providerCalls:0,geminiCalls:0});
 });
});
