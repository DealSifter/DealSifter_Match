// Read-only production verification. Never prints credentials, contacts or addresses.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(readFileSync('.env.local','utf8').split(/\r?\n/).filter(l=>/^[A-Z_][A-Z0-9_]*=/.test(l)).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).trim().replace(/^(['"])(.*)\1$/,'$2')];}));
const url=env.VITE_SUPABASE_URL;
if(new URL(url).hostname!=='cyeipfskwwisbbayyaca.supabase.co') throw Error('Wrong target');
const id='07343e87-1ef8-4ca5-a88e-be49d95431a7';
const admin=createClient(url,env.SUPABASE_SERVICE_ROLE_KEY || env.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const anon=createClient(url,env.VITE_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const results=[];
async function check(name,query){const {data,error}=await query;results.push({surface:name,status:error?'UNVERIFIED':JSON.stringify(data).includes(id)?'FAIL':'PASS',errorCode:error?.code});}
const fixture=await admin.from('properties').select('id,publish_to_showcase').eq('id',id).single();
results.push({surface:'fixture unpublished',status:!fixture.error&&fixture.data?.publish_to_showcase===false?'PASS':'FAIL'});
await check('Feed + MapView public inventory',admin.rpc('ds_get_global_feed_inventory'));
await check('Maxxis search',admin.rpc('ds_search_public_properties',{p_property_ids:[id]}));
await check('Public property detail',admin.rpc('ds_get_public_property_details',{p_property_id:id}));
// Use an existing non-owner; no session generation or user mutation.
const other=await admin.from('properties').select('owner_id').eq('id','b9bf9dc5-30af-4365-b05f-ea48895dbc19').single();
if(other.error || !other.data?.owner_id || other.data.owner_id==='840f4ab3-4951-44cd-95ff-62115d64c80e') throw Error('Non-owner not verified');
await check('Other user unlocked portfolio RPC',admin.rpc('ds_get_unlocked_contact_cards',{p_user_id:other.data.owner_id}));
await check('Anonymous base listing',anon.from('properties').select('id').eq('id',id));
console.log(JSON.stringify(results,null,2));
if(results.some(x=>x.status!=='PASS')) process.exitCode=1;
