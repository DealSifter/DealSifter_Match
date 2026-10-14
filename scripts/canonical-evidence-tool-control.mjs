import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {getCanonicalPropertyEvidenceWithDependencies} from '../supabase/functions/_shared/maxxis/canonicalEvidenceTool.ts';
import {buildPropertyFactLookupAnswer} from '../supabase/functions/_shared/maxxis/propertyFactLookup.ts';
import {issueParcelEvidenceReceipt} from '../supabase/functions/_shared/public-parcel/evidenceReceipt.ts';
import {normalizeParcel} from '../supabase/functions/_shared/public-parcel/arcgis.ts';
import {PARCEL_SOURCES} from '../supabase/functions/_shared/public-parcel/registry.ts';
import {buildCanonicalPropertyFacts} from '../supabase/functions/_shared/maxxis/propertyEvidenceProjection.ts';
import {normalizePropertyDetails} from '../supabase/functions/_shared/maxxis/propertyDetails.ts';
const propertyId='11111111-1111-4111-8111-111111111111',userId='22222222-2222-4222-8222-222222222222';
const row={id:propertyId,type:'LAND',lot:'1.14 ac',latitude:40,longitude:-111,is_active:true,publish_to_showcase:true};
const original=structuredClone(row),point={lat:40,lng:-111},now=Date.now();
const cachedEvidence={fields:{lotSizeSqft:{value:23854,status:'VERIFIED_RECORD',retrievedAt:new Date(now).toISOString()}},freshness:{state:'FRESH'},internalFields:{email:'private@example.test'},conflicts:[]};
const source=PARCEL_SOURCES.find(item=>item.sourceId==='us-ut-salt-lake-parcels');
const dy=Math.sqrt(1.23*4046.8564224)/111195.08/2,dx=dy/Math.cos(40*Math.PI/180);
const parcel=normalizeParcel(source,{PARCEL_ID:'001',PARCEL_ACRES:1.23},{type:'Polygon',coordinates:[[[-111-dx,40-dy],[-111+dx,40-dy],[-111+dx,40+dy],[-111-dx,40+dy],[-111-dx,40-dy]]]},new Date(now).toISOString(),null);
const signed=await issueParcelEvidenceReceipt({status:'COVERAGE_AVAILABLE',parcels:[parcel],countyFips:'49035',sourceIds:[source.sourceId],ambiguity:false,exceededLimit:false,freshness:'FRESH',cacheHit:true,expiresAt:new Date(now+3600000).toISOString()},point,userId,'synthetic-secret-not-production',now);
assert.ok(signed);
let unexpectedNetworkCalls=0;const originalFetch=globalThis.fetch;
globalThis.fetch=async()=>{unexpectedNetworkCalls++;throw new Error('LIVE_NETWORK_FORBIDDEN');};
const cases=[];
try{
 for(const receipt of [undefined,signed]){
  const result=await getCanonicalPropertyEvidenceWithDependencies({input:{propertyId},propertyId,userId,receipt,secret:'synthetic-secret-not-production',parcelEnabled:true,
   loadPublicProperty:async()=>structuredClone(row),loadCachedProvider:async()=>({type:'property_evidence',propertyId,state:'available',entitlementState:'authorized',cacheState:'hit',
    evidence:cachedEvidence})});
  assert.equal(result.state,'available');const field=result.readModel.analyticalEvidence.fields.lotArea;
  assert.equal(field.value,null);assert.equal(field.analyticalUsability,receipt?'PROVISIONAL':'CONFLICTED');
  assert.deepEqual(result.readModel.resolvedLotDimensions,buildCanonicalPropertyFacts(normalizePropertyDetails(row).property,cachedEvidence).resolvedLotDimensions);
  if(receipt){assert.equal(field.range.min,1.14*43560);assert.ok(Math.abs(field.range.max-1.23*43560)<.001);assert.equal(field.outliers[0].sourceType,'RENTCAST');}
  const localized={};for(const language of ['pt','en','es']){
   const question=language==='pt'?'Qual é a área do lote?':language==='es'?'Cuál es el área del lote?':'What is the lot size?';
   const answer=buildPropertyFactLookupAnswer(question,language,{propertyFacts:{canonicalPropertyFacts:result.readModel},publicParcelState:result.publicParcelState});
   assert.ok(answer.text.includes('RentCast'));assert.ok(!/MATERIAL_CONFLICT|OUTLIER_DETECTED|USER_PROVIDED|private@example/.test(answer.text));localized[language]=answer.text;
  }
  assert.ok(!JSON.stringify(result).includes('private@example.test'));
  cases.push({syntheticGisPresent:Boolean(receipt),analyticalUsability:field.analyticalUsability,range:field.range,legacyProjectionUnchanged:true,legacyAcres:result.readModel.resolvedLotDimensions.resolvedAcres,localized});
 }
 assert.deepEqual(row,original);assert.equal(unexpectedNetworkCalls,0);
}finally{globalThis.fetch=originalFetch;}
await writeFile('qa/canonical-evidence-maxxis/tool-to-chat-integration.json',JSON.stringify({pass:true,fixtureOnly:true,mode:'REAL_AUTHORIZED_TOOL_AND_FORMATTER_WITH_SYNTHETIC_READ_CALLBACKS',providerCalls:0,geminiCalls:0,propertyRowWrites:0,cases},null,2)+'\n');
console.log(JSON.stringify({pass:true,cases:cases.length,liveCalls:unexpectedNetworkCalls}));
