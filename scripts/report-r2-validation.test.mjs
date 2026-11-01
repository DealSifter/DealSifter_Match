import {test} from 'node:test';import assert from 'node:assert/strict';
import {validationDataTypes,createValidationTransport,runValidationAcquisition} from './report-r2-validation.mjs';
const base={supabaseOrigin:'https://test.supabase.co',reportId:'offline-report',requestId:'offline-request'};
test('optional restriction rejects forbidden families and duplicate entries',()=>{
 for(const list of [['sale_listing_evidence'],['market_evidence'],['rental_listing_evidence'],['property_record','property_record']])assert.throws(()=>validationDataTypes(list));
 assert.equal(validationDataTypes().size,4);
});
test('HTTP error stops further RentCast requests without retry',async()=>{
 let actual=0;const t=createValidationTransport({...base,fetchImpl:async()=>{actual++;return new Response('{}',{status:404});}});
 await t.fetch('https://api.rentcast.io/v1/avm/value');await assert.rejects(t.fetch('https://api.rentcast.io/v1/avm/value'));assert.equal(actual,1);
});
test('empty response stops next request; identity rejection also stops before HTTP',async()=>{
 const t=createValidationTransport({...base,fetchImpl:async()=>new Response('[]')});
 await t.fetch('https://api.rentcast.io/v1/properties');await assert.rejects(t.fetch('https://api.rentcast.io/v1/avm/value'));assert.equal(t.rentcastCalls,1);
 const id=createValidationTransport({...base,fetchImpl:async()=>{throw Error('must not run');}});id.stop('IDENTITY_REJECTED');await assert.rejects(id.fetch('https://api.rentcast.io/v1/avm/value'));assert.equal(id.rentcastCalls,0);
});
test('absolute four-call limit, forbidden endpoint and network allowlist are enforced',async()=>{
 let actual=0;const t=createValidationTransport({...base,fetchImpl:async()=>{actual++;return new Response('{"price":100}');}});
 await assert.rejects(t.fetch('https://api.rentcast.io/v1/markets'));await assert.rejects(t.fetch('https://generativelanguage.googleapis.com/anything'));
 for(let n=0;n<4;n++)await t.fetch('https://api.rentcast.io/v1/avm/value');await assert.rejects(t.fetch('https://api.rentcast.io/v1/avm/value'));assert.equal(actual,4);
});
test('ArcGIS has a separate six-request ceiling',async()=>{
 const t=createValidationTransport({...base,arcgisOrigins:['https://example.arcgis.com'],fetchImpl:async()=>new Response('{}')});
 for(let n=0;n<6;n++)await t.fetch('https://example.arcgis.com/FeatureServer/0');await assert.rejects(t.fetch('https://example.arcgis.com/FeatureServer/0'));assert.equal(t.arcgisCalls,6);assert.equal(t.rentcastCalls,0);
});
test('restriction is applied before services can reserve quota',async()=>{
 let reservations=0;const presentProperty=()=>({state:'unavailable'}),transport={assertContinue(){},stop(){},stopped:null};
 await runValidationAcquisition({dataTypes:['rent_estimate_evidence'],propertyId:'offline',userId:'offline',transport,
 services:{presentProperty,property:{getPropertyEvidence(){reservations++;}},valuation:{getValuationEvidence(){reservations++;}},sold:{getSoldEvidence(){reservations++;}},rent:{get(){return {state:'AVAILABLE',cacheHit:true};}}},
 orchestrate:async deps=>{await deps.loadPropertyEvidence();await deps.loadArvEvaluation();return {};},loadArvEvaluation:async()=>null});
 assert.equal(reservations,0);
});
test('cached repetition invokes no HTTP and creates no new reservations',async()=>{
 let reservations=0;const cached=new Set(),transport={assertContinue(){},stop(){},stopped:null};
 const service=type=>async()=>{const cacheHit=cached.has(type);if(!cacheHit){reservations++;cached.add(type);}return {cacheHit,state:'AVAILABLE'};};
 const options={propertyId:'offline',userId:'offline',transport,services:{property:{getPropertyEvidence:service('record')},valuation:{getValuationEvidence:service('avm')},sold:{getSoldEvidence:service('sold')},rent:{get:service('rent')},presentProperty:()=>({state:'available'})},orchestrate:async deps=>{await deps.loadPropertyEvidence();await deps.loadArvEvaluation();return {};},loadArvEvaluation:async()=>null};
 await runValidationAcquisition(options);assert.equal(reservations,4);await runValidationAcquisition(options);assert.equal(reservations,4);
});
test('attempt journal persists safe metadata before and after HTTP without query or credentials',async()=>{
 const journal=[];const t=createValidationTransport({...base,onAttempt:async attempts=>journal.push(JSON.parse(JSON.stringify(attempts))),fetchImpl:async()=>new Response('{"price":100}')});
 await t.fetch('https://api.rentcast.io/v1/avm/value?address=FICTIONAL',{headers:{'X-Api-Key':'fixture-placeholder'}});
 assert.equal(journal.length,2);assert.equal(journal[0][0].http,null);assert.equal(journal[1][0].http,200);
 assert.equal(JSON.stringify(journal).includes('FICTIONAL'),false);assert.equal(JSON.stringify(journal).includes('fixture-placeholder'),false);
});
