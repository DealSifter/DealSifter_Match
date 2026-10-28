import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('./migration.sql.proposed',import.meta.url),'utf8');
const doc=readFileSync(new URL('./PROPOSAL.md',import.meta.url),'utf8');
test('proposal stays additive, no backfill or modification of existing consensus/RLS',()=>{
 assert.equal((sql.match(/create table /gi)||[]).length,1);
 assert.match(sql,/after insert or update on public.properties/i);
 assert.doesNotMatch(sql,/insert\s+into\s+public\.property_fact_check_jobs[^;]*?\bselect\s+.*\bfrom\s+public\.properties/i);
 assert.doesNotMatch(sql,/alter table public\.(properties|property_fact_reviews)|create or replace function public\.ds_store_property_fact_review/i);
});
test('save enqueue dedups meaningful input and changes generation atomically',()=>{
 assert.match(sql,/ds_fact_job_inputs\(to_jsonb\(new\)\)=public.ds_fact_job_inputs\(to_jsonb\(old\)\)/);
 assert.match(sql,/on conflict\(property_id\) do update/);
 assert.match(sql,/generation=j.generation\+1/);
 assert.doesNotMatch(sql,/exception when others/i);
});
test('lease/concurrency/retry safeguards are proposed, not asserted live',()=>{
 for(const required of ['skip locked','attempts<3',"interval '2 minutes'","interval '1 minute'","interval '5 minutes'",'j.generation is distinct from p_generation','j.lease_token is distinct from p_lease_token','j.input_hash<>public.ds_fact_job_hash'])assert.ok(sql.includes(required),required);
 assert.ok(sql.indexOf('select * into p from public.properties')<sql.indexOf('select * into j from public.property_fact_check_jobs'));
});
test('review and completion share wrapper, failed acquisition cannot succeed',()=>{
 assert.match(sql,/perform public.ds_store_property_fact_review/);
 assert.match(sql,/INCOMPLETE_ACQUISITION/);
 assert.match(sql,/terminal:=case when p_outcome='RETRY'/);
 assert.match(sql,/p.updated_at/);
});
test('backend-only grants and bounded terminal retention',()=>{
 assert.match(sql,/revoke all on public.property_fact_check_jobs from public,anon,authenticated/);
 assert.doesNotMatch(sql,/grant .* to (anon|authenticated)/i);
 assert.match(sql,/BACKEND_ONLY/);
 assert.match(sql,/completed_at<now\(\)-interval '14 days'/);
 assert.match(sql,/limit 100/);
});
test('no schedule, extensions or provider calls activated; pending integration disclosed',()=>{
 assert.doesNotMatch(sql,/cron\.schedule|net\.http|create extension|https?:\/\//i);
 for(const required of ['NOT IMPLEMENTED','PENDING','scheduler','cache-only','listener','reenqueue'])assert.ok(doc.includes(required),required);
 assert.match(doc,/DEPLOY READY: NO/);
});
