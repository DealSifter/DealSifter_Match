import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {PGlite} from '../.cache/smart-property-pglite/node_modules/@electric-sql/pglite/dist/index.js';
const db=new PGlite(),a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',p='33333333-3333-4333-8333-333333333333';
const checks=[];async function pass(name,fn){await fn();checks.push({name,pass:true});}
try{
 await db.exec(`create role authenticated;create role anon;create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function public.ds_is_current_user_admin() returns boolean language sql stable as $$select false$$;
 grant usage on schema public,auth to authenticated,anon,service_role;grant execute on function auth.uid() to authenticated,anon,service_role;
 create table public.properties(id uuid primary key,owner_id uuid references auth.users,rehab numeric not null default 0,beds integer not null default 0,baths integer not null default 0,is_active boolean default true,publish_to_showcase boolean default true,deal_closed boolean default false,hide_street_address_on_card boolean default false,updated_at timestamptz default now());
 alter table public.properties enable row level security;create policy property_read on public.properties for select to authenticated using(owner_id=auth.uid());grant select on public.properties to authenticated;
 create table public.notifications(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users,type text constraint notifications_type_check check(type in ('unlock','exclusive','spotlight_expired','support')),payload jsonb default '{}',read_at timestamptz,created_at timestamptz default now());
 alter table public.notifications enable row level security;create policy notif_read on public.notifications for select to authenticated using(user_id=auth.uid());grant select on public.notifications to authenticated;grant all on public.properties,public.notifications to service_role;
 insert into auth.users values('${a}'),('${b}');insert into public.properties(id,owner_id,rehab) values('${p}','${a}',0);`);
 await db.exec(await readFile('supabase/migrations/20261014213000_smart_property_fact_review.sql','utf8'));
 const state={propertyId:p,evidenceHash:'a'.repeat(64),rows:{lotArea:{state:'REVIEW_REQUIRED'}},summary:{complements:1,conflicts:1}},pub={lotArea:{value:null,unit:'SQFT',state:'CONFLICTED',sourceType:null,status:'UNKNOWN',freshness:'UNKNOWN'}};
 const store=async(owner,revision,publicFacts=pub)=>db.query('select ds_store_property_fact_review($1,$2,$3,$4::jsonb,$5::jsonb,true) as revision',[p,owner,revision,JSON.stringify(state),JSON.stringify(publicFacts)]);
 await db.exec(`set role service_role;set request.jwt.claim.role='service_role';`);
 await pass('backend-owned-state-save',async()=>assert.equal((await store(a,0)).rows[0].revision,1));
 await pass('same-evidence-notification-dedup',async()=>{await store(a,1);assert.equal((await db.query('select count(*)::int n from notifications')).rows[0].n,1);});
 await pass('stale-revision-rejected',()=>assert.rejects(store(a,0),/FACT_REVIEW_STALE/));
 await pass('wrong-owner-rejected',()=>assert.rejects(store(b,0),/PROPERTY_OWNER_REQUIRED/));
 await pass('private-metadata-in-public-projection-rejected',()=>assert.rejects(store(a,2,{lotArea:{...pub.lotArea,by:a}}),/INVALID_PUBLIC_FACTS/));
 await pass('nested-private-payload-rejected',()=>assert.rejects(store(a,2,{lotArea:{...pub.lotArea,value:{email:'private@example.test'}}}),/INVALID_PUBLIC_FACTS/));
 await pass('missing-value-rejected',()=>assert.rejects(store(a,2,{lotArea:{state:'AVAILABLE'}}),/INVALID_PUBLIC_FACTS/));
 await pass('missing-state-rejected',()=>assert.rejects(store(a,2,{lotArea:{value:42}}),/INVALID_PUBLIC_FACTS/));
 await pass('nested-source-metadata-rejected',()=>assert.rejects(store(a,2,{lotArea:{...pub.lotArea,sourceType:{email:'private@example.test'}}}),/INVALID_PUBLIC_FACTS/));
 await pass('missing-state-identity-rejected',async()=>{await assert.rejects(db.query('select ds_store_property_fact_review($1,$2,2,$3::jsonb,$4::jsonb,false)',[p,a,'{}',JSON.stringify(pub)]),/INVALID_FACT_STATE/);});
 await db.exec(`reset role;set role authenticated;set request.jwt.claim.role='authenticated';set request.jwt.claim.sub='${b}';`);
 await pass('user-b-private-state-isolated',async()=>assert.equal((await db.query('select count(*)::int n from property_fact_reviews')).rows[0].n,0));
 await pass('user-b-history-isolated',async()=>assert.equal((await db.query('select count(*)::int n from property_fact_review_history')).rows[0].n,0));
 await pass('client-cannot-forge-backend-state',()=>assert.rejects(store(a,2),/permission denied/));
 await db.exec(`set request.jwt.claim.sub='${a}';`);
 await pass('owner-state-and-history-readable',async()=>{assert.equal((await db.query('select count(*)::int n from property_fact_reviews')).rows[0].n,1);assert.equal((await db.query('select count(*)::int n from property_fact_review_history')).rows[0].n,2);});
 await pass('owner-cannot-direct-write-decisions',()=>assert.rejects(db.query("update property_fact_reviews set state='{}'"),/permission denied/));
 await db.exec("reset role;set request.jwt.claim.sub='';set role anon;");
 await pass('anonymous-public-facts-without-private-metadata',async()=>{const result=(await db.query('select * from ds_public_effective_property_facts($1::uuid[])',[[p]])).rows;assert.deepEqual(result[0].facts,pub);assert.ok(!JSON.stringify(result).includes(a));});
 await pass('anonymous-private-state-denied',()=>assert.rejects(db.query('select * from property_fact_reviews'),/permission denied/));
 await db.exec('reset role;');
 await pass('hidden-address-parcel-identifiers-remain-private',async()=>{await db.query("update property_fact_reviews set public_facts=public_facts||'{\"apn\":{\"value\":\"PRIVATE-APN\",\"state\":\"AVAILABLE\"}}'::jsonb");await db.query('update properties set hide_street_address_on_card=true where id=$1',[p]);await db.exec('set role anon;');const result=(await db.query('select * from ds_public_effective_property_facts($1::uuid[])',[[p]])).rows;assert.ok(!JSON.stringify(result).includes('PRIVATE-APN'));await db.exec('reset role;');});
 await pass('legacy-zero-not-backfilled',async()=>assert.equal((await db.query('select rehab from properties where id=$1',[p])).rows[0].rehab,'0'));
 await pass('new-optional-blanks-are-null',async()=>{const id='44444444-4444-4444-8444-444444444444';await db.query('insert into properties(id,owner_id) values($1,$2)',[id,a]);const row=(await db.query('select rehab,beds,baths from properties where id=$1',[id])).rows[0];assert.deepEqual(row,{rehab:null,beds:null,baths:null});});
 await pass('unpublished-facts-not-public',async()=>{await db.query('update properties set publish_to_showcase=false where id=$1',[p]);assert.equal((await db.query('select * from ds_public_effective_property_facts($1::uuid[])',[[p]])).rows.length,0);});
 if(process.env.SMART_PROPERTY_UX_BATCH_QA==='1'){
  const {runPropertyFactReview}=await import('../supabase/functions/_shared/property-fact-reconciliation/runtime.ts');
  const batchId='55555555-5555-4555-8555-555555555555',mixedId='66666666-6666-4666-8666-666666666666';
  await db.exec("reset role;set role service_role;set request.jwt.claim.role='service_role';");
  await db.query('insert into properties(id,owner_id,beds,baths,rehab) values($1,$3,null,null,null),($2,$3,4,null,null)',[batchId,mixedId,a]);
  const candidate=(field,value,unit=null)=>({field,originalValue:value,value,unit,sourceType:'PUBLIC_PARCEL_GIS',sourceId:'qa-county',sourceFamily:'COUNTY_GIS:00000',evidenceStatus:'PUBLIC_RECORD',freshness:'FRESH'});
  const additions=[candidate('apn','000-TEST'),candidate('owner','QA OWNER'),candidate('assessedValue',120000,'USD'),candidate('propertyTax',2000,'USD'),candidate('zoning','R1'),candidate('yearBuilt',1980),candidate('subdivision','QA SUBDIVISION'),candidate('legalDescription','QA LEGAL')];
  let mutations=0,acquisitions=0;
  const dependencies=(id,evidence)=>({userId:a,loadOwnedProperty:async wanted=>wanted===id?{id,owner_id:a,address:'100 QA Street',city:'QA',state:'NC',zip:'27614',type:'SFR',...(id===mixedId?{lot:5000,beds:4}:{})}:null,
   loadReview:async()=>{const result=await db.query('select state,revision from property_fact_reviews where property_id=$1 and owner_id=$2',[id,a]);const row=result.rows[0];return row?{...row,revision:Number(row.revision)}:null;},
   acquire:async()=>{acquisitions++;return evidence;},store:async(_id,owner,revision,state,publicFacts,notify)=>{mutations++;const result=await db.query('select ds_store_property_fact_review($1,$2,$3,$4::jsonb,$5::jsonb,$6) revision',[id,owner,revision,JSON.stringify(state),JSON.stringify(publicFacts),notify]);return Number(result.rows[0].revision);}});
  const deps=dependencies(batchId,additions),first=await runPropertyFactReview({propertyId:batchId,action:'CHECK',cacheOnly:true},deps);
  const decisions=Object.values(first.snapshot.rows).filter(row=>row.bulkCandidateId).map(row=>({field:row.field,action:'ACCEPT_EXTERNAL_VALUE',candidateId:row.bulkCandidateId}));
  await pass('eight-complement-one-transaction-persist-and-reload',async()=>{
   const before=mutations,lookupBefore=acquisitions;
   const applied=await runPropertyFactReview({propertyId:batchId,action:'DECIDE',revision:first.revision,evidenceHash:first.snapshot.evidenceHash,decisions},deps);
   assert.equal(decisions.length,8);assert.equal(mutations-before,1);assert.equal(acquisitions,lookupBefore);assert.equal(applied.snapshot.summary.pending,0);
   const reloaded=await runPropertyFactReview({propertyId:batchId,action:'READ'},deps);assert.equal(Object.values(reloaded.snapshot.rows).filter(row=>row.decision?.action==='ACCEPT_EXTERNAL_VALUE').length,8);assert.equal(reloaded.snapshot.rows.apn.originalValue,null);assert.equal(reloaded.snapshot.rows.apn.effective.sourceType,'PUBLIC_PARCEL_GIS');
  });
  await pass('invalid-batch-has-zero-partial-writes',async()=>{
   const current=await runPropertyFactReview({propertyId:batchId,action:'READ'},deps),before=mutations;
   await assert.rejects(runPropertyFactReview({propertyId:batchId,action:'DECIDE',revision:current.revision,evidenceHash:current.snapshot.evidenceHash,decisions:[{field:'apn',action:'REVIEW_LATER'},{field:'beds',action:'ACCEPT_EXTERNAL_VALUE',candidateId:'invalid'}]},deps),/INELIGIBLE/);
   assert.equal(mutations,before);assert.equal((await deps.loadReview()).revision,current.revision);
  });
  const mixedEvidence=[...additions.slice(0,5),candidate('lotArea',7000,'SQFT'),candidate('beds',3),candidate('baths',2)],mixedDeps=dependencies(mixedId,mixedEvidence);
  const mixed=await runPropertyFactReview({propertyId:mixedId,action:'CHECK',cacheOnly:true},mixedDeps);
  await pass('mixed-eight-decisions-atomic-provenance-and-defer',async()=>{
   const choices=Object.values(mixed.snapshot.rows).filter(row=>row.pending).map(row=>row.field==='lotArea'?{field:row.field,action:'KEEP_MY_VALUE'}:row.field==='baths'?{field:row.field,action:'REVIEW_LATER'}:{field:row.field,action:'ACCEPT_EXTERNAL_VALUE',candidateId:row.candidates[0].candidateId});
   const before=mutations,lookupBefore=acquisitions;const result=await runPropertyFactReview({propertyId:mixedId,action:'DECIDE',revision:mixed.revision,evidenceHash:mixed.snapshot.evidenceHash,decisions:choices},mixedDeps);
   assert.equal(choices.length,8);assert.equal(mutations-before,1);assert.equal(acquisitions,lookupBefore);assert.equal(result.snapshot.summary.pending,0);assert.equal(result.snapshot.rows.lotArea.effective.value,5000);assert.equal(result.snapshot.rows.beds.effective.value,3);assert.equal(result.snapshot.rows.beds.originalValue,4);assert.equal(result.snapshot.rows.baths.decision.action,'REVIEW_LATER');
   const raw=(await db.query('select beds,baths,rehab from properties where id=$1',[mixedId])).rows[0];assert.deepEqual(raw,{beds:4,baths:null,rehab:null});
  });
  await pass('same-evidence-post-apply-check-does-not-notify-again',async()=>{
   const checked=await runPropertyFactReview({propertyId:mixedId,action:'CHECK',cacheOnly:true},mixedDeps);assert.equal(checked.snapshot.summary.pending,0);
   assert.equal((await db.query("select count(*)::int n from notifications where payload->>'property_id'=$1",[mixedId])).rows[0].n,1);
  });
 }
 if(process.env.SMART_PROPERTY_PUBLISHER_ZONING_QA==='1'){
  const {runPropertyFactReview}=await import('../supabase/functions/_shared/property-fact-reconciliation/runtime.ts');
  const zoningId='77777777-7777-4777-8777-777777777777';
  await db.exec("reset role;set role service_role;set request.jwt.claim.role='service_role';");
  await db.query('insert into properties(id,owner_id) values($1,$2)',[zoningId,a]);
  const deps={userId:a,loadOwnedProperty:async()=>({id:zoningId,owner_id:a,address:'100 QA Land',city:'QA',state:'AL',zip:'35126',type:'Land'}),
   loadReview:async()=>{const result=await db.query('select state,revision from property_fact_reviews where property_id=$1 and owner_id=$2',[zoningId,a]);const row=result.rows[0];return row?{...row,revision:Number(row.revision)}:null;},
   acquire:async()=>{throw new Error('DECLARATION_MUST_NOT_ACQUIRE');},store:async(id,owner,revision,state,facts,notify)=>Number((await db.query('select ds_store_property_fact_review($1,$2,$3,$4::jsonb,$5::jsonb,$6) revision',[id,owner,revision,JSON.stringify(state),JSON.stringify(facts),notify])).rows[0].revision)};
  await pass('publisher-zoning-explicit-declaration-sql-persistence',async()=>{const result=await runPropertyFactReview({propertyId:zoningId,action:'DECLARE_ZONING',revision:0,declaredZoning:'R2'},deps);assert.equal(result.snapshot.rows.zoning.effective.status,'PUBLISHER_DECLARED');});
  await db.exec(`reset role;set role authenticated;set request.jwt.claim.role='authenticated';set request.jwt.claim.sub='${b}';`);
  await pass('other-user-reads-qualified-shared-zoning-without-owner-private-history',async()=>{
   const facts=(await db.query('select * from ds_public_effective_property_facts($1::uuid[])',[[zoningId]])).rows[0].facts;
   assert.equal(facts.zoning.value,'R2');assert.equal(facts.zoning.status,'PUBLISHER_DECLARED');assert.equal(facts.zoning.sourceType,'USER_PROVIDED');assert(!JSON.stringify(facts).includes(a));
   assert.equal((await db.query('select count(*)::int n from property_fact_review_history where property_id=$1',[zoningId])).rows[0].n,0);
  });
  await db.exec('reset role;');
  await pass('unpublished-shared-zoning-is-not-public',async()=>{await db.query('update properties set publish_to_showcase=false where id=$1',[zoningId]);assert.equal((await db.query('select * from ds_public_effective_property_facts($1::uuid[])',[[zoningId]])).rows.length,0);});
 }
 await writeFile(`${process.env.SMART_PROPERTY_QA_DIRECTORY||'qa/smart-property-enrichment'}/security-validation.json`,JSON.stringify({pass:true,mode:'LOCAL_REAL_POSTGRES_PGLITE',productionWrites:0,checks},null,2)+'\n');
 console.log(JSON.stringify({pass:true,checks:checks.length}));
}finally{await db.close();}
