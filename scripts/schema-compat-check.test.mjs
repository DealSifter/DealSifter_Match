import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {codeSchemaContract,compareSchema,schemaCompatCheck,assertSchemaCompatible,compareCatalogPrivileges} from './schema-compat-check.mjs';
import {createValidationTransport,runValidationAcquisition} from './report-r2-validation.mjs';
const fixture=phase=>JSON.parse(readFileSync(new URL('./fixtures/schema-compat-'+phase+'.json',import.meta.url),'utf8'));
const contract=await codeSchemaContract();
test('read-only schema snapshot detects the twelve real pre-migration incompatibilities',()=>{
 const report=compareSchema(contract,fixture('before'));assert.equal(report.incompatibilities.length,12);assert(report.incompatibilities.some(r=>r.value==='rent_estimate'));assert(report.incompatibilities.some(r=>r.value==='rent_estimate_evidence'));
});
test('additive migration permits all current operations, origins, outcomes, statuses, data types and named RPC arguments',()=>{const report=compareSchema(contract,fixture('after'));assert.equal(report.incompatibilities.length,0);assert(report.checked>=118);});
test('original operations remain accepted after the list expansion',()=>{for(const phase of ['before','after']){const rows=compareSchema(contract,fixture(phase)).rows;for(const value of ['property_lookup','property_value_avm','property_sold_search'])assert(rows.filter(r=>r.value===value).every(r=>r.accepted));}});
test('grants, RLS, owners, function security settings and defaults are unchanged',()=>{assert.deepEqual(compareCatalogPrivileges(fixture('before'),fixture('after')),{functionPrivilegesUnchanged:true,tablePrivilegesRlsAndDefaultsUnchanged:true});});
test('new application values fail closed instead of silently passing',()=>{for(const[field,value]of[['operations','unknown_operation'],['dataTypes','unknown_cache_type'],['origins','untrusted_origin'],['outcomes','INTERNAL_ERROR']]){const updated={...contract,[field]:[...contract[field],value]};assert(compareSchema(updated,fixture('after')).incompatibilities.some(r=>r.value===value));}});
test('renaming a required RPC parameter is detected before reserving anything',()=>{const c=fixture('after');c.functions.find(f=>f.name==='ds_reserve_external_provider_usage').args[0]='renamed_provider';assert(compareSchema(contract,c).incompatibilities.some(r=>r.location==='ds_reserve_external_provider_usage:ARGUMENTS'));});
test('defaults and grants drift are detected by the migration evidence comparison',()=>{const c=fixture('after');c.tables[0].rls=!c.tables[0].rls;c.functions[0].grants='changed';assert.deepEqual(compareCatalogPrivileges(fixture('before'),c),{functionPrivilegesUnchanged:false,tablePrivilegesRlsAndDefaultsUnchanged:false});});
test('a missing, forged, stale or incompatible schema receipt cannot construct live transport',async()=>{
 const catalog=fixture('after');catalog.observedUtc=new Date().toISOString();const verified=await schemaCompatCheck({catalog});assert.doesNotThrow(()=>assertSchemaCompatible(verified));assert.throws(()=>assertSchemaCompatible({...verified}));assert.throws(()=>assertSchemaCompatible(verified,Date.now()+660000));
 let calls=0;assert.throws(()=>createValidationTransport({fetchImpl:async()=>{calls++},supabaseOrigin:'https://test.supabase.co'}));assert.equal(calls,0);
 const incompatible=fixture('before');incompatible.observedUtc=new Date().toISOString();
 const awaitedReceipt=await schemaCompatCheck({catalog:incompatible});assert.throws(()=>assertSchemaCompatible(awaitedReceipt));
});
test('preflight rejects the orchestration before any service or budget reservation',async()=>{
 let reservations=0;await assert.rejects(runValidationAcquisition({transport:{assertSchemaCompatible(){throw Error('R2_SCHEMA_COMPAT_PREFLIGHT_REQUIRED')}},orchestrate:async()=>{reservations++}}));assert.equal(reservations,0);
});
