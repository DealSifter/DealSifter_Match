import {createClient} from 'npm:@supabase/supabase-js@2';
import {supabaseUrl,supabaseAnonKey,supabaseServiceRoleKey,corsHeaders} from '../_shared/maxxis/config.ts';
import {runPropertyFactReview} from '../_shared/property-fact-reconciliation/runtime.ts';
import {propertyIdentity,evidenceHash} from '../_shared/property-fact-reconciliation/model.ts';
import {readParcelEvidenceReceipt} from '../_shared/public-parcel/evidenceReceipt.ts';
import {candidatesFromAuthorizedBundle} from '../_shared/parcel-evidence-consensus/adapters.ts';
import {PARCEL_SOURCES,productionSourceAllowed} from '../_shared/public-parcel/registry.ts';
import {geometryContains,validPoint} from '../_shared/public-parcel/geometry.ts';
import {resolveFeatureFlags} from '../_shared/featureFlags.ts';
import {getPropertyEvidenceForAuthenticatedUser} from '../_shared/maxxis/getPropertyEvidence.ts';
import {cachedProviderCandidates} from '../_shared/maxxis/canonicalEvidenceTool.ts';
import {loadMaxxisRuntimeAccessContext} from '../_shared/maxxis/runtimeEntitlement.ts';
import type {ParcelResult} from '../_shared/public-parcel/types.ts';
import type {CandidateInput} from '../_shared/parcel-evidence-consensus/types.ts';
import {hasStablePropertyIdentity,parcelMatchesPropertyAddress} from '../_shared/property-fact-reconciliation/acquisition.ts';
import {readJsonWithLimit} from '../_shared/abuseProtection.ts';
type Db={from:(table:string)=>any;rpc:(name:string,args:Record<string,unknown>)=>Promise<{data:any;error:any}>};
const fields='id,owner_id,address,city,state,zip,type,lot,sqft,beds,baths,rehab,lat,lng,geocode_status,hide_street_address_on_card,is_active,publish_to_showcase,updated_at';
Deno.serve(async req=>{
 const origin=req.headers.get('Origin')||'';const cors=corsHeaders(origin);
 const reply=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(origin&&!cors['Access-Control-Allow-Origin'])return reply({error:'ORIGIN_NOT_ALLOWED'},403);
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return reply({error:'METHOD_NOT_ALLOWED'},405);
 const authHeader=req.headers.get('Authorization')||'';if(!authHeader)return reply({error:'UNAUTHORIZED'},401);
 const authClient=createClient(supabaseUrl,supabaseAnonKey,{global:{headers:{Authorization:authHeader}}});
 const {data:auth,error:authError}=await authClient.auth.getUser();if(authError||!auth?.user)return reply({error:'UNAUTHORIZED'},401);
 if(!supabaseServiceRoleKey)return reply({error:'REVIEW_UNAVAILABLE'},503);
 const userId=auth.user.id,client=authClient as unknown as Db,admin=createClient(supabaseUrl,supabaseServiceRoleKey) as unknown as Db;
 try{
  const parsed=await readJsonWithLimit(req,24000);if(!parsed.ok)return reply({error:'INVALID_REVIEW_REQUEST'},400);const body=parsed.body;
  let remoteConfig={};try{remoteConfig=JSON.parse(Deno.env.get('FEATURE_FLAGS_JSON')||'{}');}catch{/* existing default OFF */}
  const flags=resolveFeatureFlags({userId,environment:supabaseUrl.includes('cyeipfskwwisbbayyaca')?'production':'development',remoteConfig});
  const result=await runPropertyFactReview(body,{userId,
   loadOwnedProperty:async(id,actor)=>{const {data,error}=await client.from('properties').select(fields).eq('id',id).eq('owner_id',actor).maybeSingle();if(error)throw new Error('PROPERTY_READ_FAILED');return data;},
   loadReview:async(id,actor)=>{const {data,error}=await client.from('property_fact_reviews').select('state,revision').eq('property_id',id).eq('owner_id',actor).maybeSingle();if(error)throw new Error('REVIEW_READ_FAILED');return data;},
   acquire:async(property,previous,receipt,force)=>{
    const sameIdentity=previous?.identityHash===await evidenceHash(propertyIdentity(property));
    let rows:CandidateInput[]=sameIdentity?Object.values(previous!.rows).flatMap(row=>row.projection.candidates.filter(c=>c.sourceFamily!=='PUBLISHER')):[];
    if(!hasStablePropertyIdentity(property))return [];
    const point=typeof property.lat==='number'&&typeof property.lng==='number'?{lat:property.lat,lng:property.lng}:null;
    let parcels=await readParcelEvidenceReceipt(receipt,{userId,point,secret:supabaseServiceRoleKey,enabled:flags.public_parcel_intelligence});
    if(body.cacheOnly!==true&&!parcels.length&&flags.public_parcel_intelligence&&point&&validPoint(point)&&property.geocode_status==='resolved'
     &&(force||!sameIdentity||!previous?.publicCheckedAt||Date.now()-Date.parse(previous.publicCheckedAt)>6*3600000)){
     try{const response=await fetch(`${supabaseUrl}/functions/v1/public-parcel`,{method:'POST',headers:{Authorization:authHeader,apikey:supabaseAnonKey,'Content-Type':'application/json'},body:JSON.stringify({operation:'query-point',point}),signal:AbortSignal.timeout(8000)});
      const result:ParcelResult=response.ok?await response.json():{status:'UNAVAILABLE',parcels:[]} as unknown as ParcelResult;
      const matches=result.status==='COVERAGE_AVAILABLE'&&!result.ambiguity?result.parcels.filter(p=>geometryContains(p.geometry,point)):[];
      if(matches.length===1){const parcel=matches[0],source=PARCEL_SOURCES.find(s=>s.sourceId===parcel.source);if(source&&productionSourceAllowed(source)&&result.countyFips)parcels=[{parcel,source,countyFips:result.countyFips,subjectMatch:'VERIFIED_SUBJECT',freshness:result.freshness==='STALE_USABLE'?'STALE_USABLE':'FRESH'}];}
     }catch{/* async enrichment failure never blocks registration */}
    }
    const addressMismatch=parcels.some(entry=>!parcelMatchesPropertyAddress(property,entry.parcel.situsAddress));
    if(addressMismatch)rows=rows.filter(candidate=>!candidate.sourceFamily?.startsWith('COUNTY_GIS:'));
    parcels=parcels.filter(entry=>parcelMatchesPropertyAddress(property,entry.parcel.situsAddress));
    if(parcels.length){const fresh=candidatesFromAuthorizedBundle({publicParcels:parcels});const families=new Set(fresh.map(c=>c.sourceFamily));rows=[...rows.filter(c=>!families.has(c.sourceFamily)),...fresh];}
    try{const access=await loadMaxxisRuntimeAccessContext(userId,authClient as unknown as Parameters<typeof loadMaxxisRuntimeAccessContext>[1],String(property.id));
     if(access.ok){const plan=access.context.plan==='ENTERPRISE'?'ENTERPRISE':access.context.plan==='PRO'?'PRO':'FREE';
      const cached=await getPropertyEvidenceForAuthenticatedUser({propertyId:property.id},authHeader,userId,String(property.id),false,{plan,bucket:'chat'});
      const current=cachedProviderCandidates(cached,String(property.id));if(current.length)rows=[...rows.filter(c=>c.sourceFamily!=='RENTCAST'),...current];}
    }catch{/* cache unavailable, never acquire a paid record */}
    return rows;
   },
   store:async(id,actor,revision,state,publicFacts,notify)=>{const {data,error}=await admin.rpc('ds_store_property_fact_review',{p_property_id:id,p_owner_id:actor,p_expected_revision:revision,p_state:state,p_public_facts:publicFacts,p_notify:notify});if(error)throw new Error(/FACT_REVIEW_STALE|PROPERTY_FACTS_CHANGED/.test(error.message)?'FACT_REVIEW_STALE':'REVIEW_SAVE_FAILED');return Number(data);},
  });return reply({success:true,data:result});
 }catch(error){const message=error instanceof Error?error.message:'';const code=/^[A-Z_]+$/.test(message)?message:'REVIEW_UNAVAILABLE';return reply({success:false,error:code},code==='PROPERTY_OWNER_REQUIRED'?403:/STALE|FACTS_CHANGED/.test(code)?409:/INVALID|INELIGIBLE/.test(code)?400:503);}
});
