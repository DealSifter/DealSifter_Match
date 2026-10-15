import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {loadEnv} from 'vite';
const origin='https://dealsiftermatch.vercel.app',base='https://cyeipfskwwisbbayyaca.supabase.co/functions/v1';
const directory=process.env.SMART_PROPERTY_QA_DIRECTORY||'qa/smart-property-enrichment/final-integration',results=[];
for(const slug of ['maxxis-chat','maxxis-deal-workflow','maxxis-provider-message-draft','property-fact-review','public-parcel']){
 const options=await fetch(`${base}/${slug}`,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST'},signal:AbortSignal.timeout(15000)});
 const unauthenticated=await fetch(`${base}/${slug}`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(15000)});
 const result={function:slug,preflightStatus:options.status,allowedOrigin:options.headers.get('access-control-allow-origin'),unauthenticatedStatus:unauthenticated.status};results.push(result);
}
const evil=await fetch(`${base}/property-fact-review`,{method:'OPTIONS',headers:{Origin:'https://evil.example','Access-Control-Request-Method':'POST'},signal:AbortSignal.timeout(15000)});
// Public anon role only, empty IDs: confirms PostgREST knows the new sanitized
// RPC without reading a property, using or creating a real user session.
const env=loadEnv('production',process.cwd(),'VITE_'),publicKey=env.VITE_SUPABASE_ANON_KEY;
assert.ok(publicKey,'Existing public client key required');
const rpc=await fetch('https://cyeipfskwwisbbayyaca.supabase.co/rest/v1/rpc/ds_public_effective_property_facts',{method:'POST',headers:{apikey:publicKey,Authorization:`Bearer ${publicKey}`,'Content-Type':'application/json'},body:JSON.stringify({p_property_ids:[]}),signal:AbortSignal.timeout(15000)});
const rpcBody=await rpc.json().catch(()=>null),schemaCacheReady=rpc.status===200&&Array.isArray(rpcBody)&&rpcBody.length===0;
const pass=results.every(row=>row.preflightStatus===200&&row.allowedOrigin===origin&&row.unauthenticatedStatus===401)&&evil.status===403&&schemaCacheReady;
await writeFile(`${directory}/production-edge-smoke.json`,JSON.stringify({pass,mode:'ANONYMOUS_AUTH_BOUNDARY_CORS_AND_EMPTY_PUBLIC_RPC',realAuthenticatedSession:false,propertyWrites:0,providerCalls:0,results,untrustedOriginStatus:evil.status,publicRpc:{status:rpc.status,schemaCacheReady,propertyIdsRequested:0,rowsReturned:Array.isArray(rpcBody)?rpcBody.length:null}},null,2)+'\n');
console.log(JSON.stringify({pass,results,untrustedOriginStatus:evil.status,schemaCacheReady}));assert.equal(pass,true);
