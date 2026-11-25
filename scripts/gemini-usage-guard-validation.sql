-- Run only inside BEGIN/ROLLBACK on the isolated staging migration.
create temporary table gemini_test_results(name text primary key);
create function pg_temp.g_assert(ok boolean,label text)returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'ASSERT:%',label;end if;insert into gemini_test_results values(label);end;$$;
create function pg_temp.g_denied(q text,expected text,label text)returns void language plpgsql as $$begin begin execute q;exception when others then if position(expected in sqlerrm)>0 then insert into gemini_test_results values(label);return;end if;raise;end;raise exception 'EXPECTED_DENIAL:%',label;end;$$;
insert into auth.users(id,email,raw_user_meta_data)values
 ('f1250000-0000-4000-8000-000000000001','gemini-free@qa.invalid','{"full_name":"Gemini QA Free"}'),
 ('f1250000-0000-4000-8000-000000000002','gemini-pro@qa.invalid','{"full_name":"Gemini QA Pro"}'),
 ('f1250000-0000-4000-8000-000000000003','gemini-enterprise@qa.invalid','{"full_name":"Gemini QA Enterprise"}');
update public.users set plan_id=case right(id::text,1)when '1'then 'free'when '2'then 'pro'else 'enterprise'end,is_admin=false where id::text like 'f1250000-%';
create function pg_temp.g_id(n integer)returns uuid language sql as $$select('f1250000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;$$;
create function pg_temp.g_reset()returns void language plpgsql as $$begin
 delete from public.gemini_usage_executions;
 update public.gemini_usage_config set settings=jsonb_set(settings,'{mode}','"DISABLED"');
 update public.gemini_usage_config set settings=jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(settings,
 '{provider_verified}','true'),'{commercial_approved}','true'),'{provider_day_timezone}','"America/Los_Angeles"'),
 '{global}','{"calls_minute":100,"calls_day":1000,"calls_month":10000,"tokens_minute":10000000,"tokens_day":100000000,"tokens_month":1000000000,"concurrency":100}'),
 '{provider_limits}','{"calls_minute":100,"calls_day":1000,"tokens_minute":10000000}'),
 '{pools}','{"free":25,"paid":60,"pro":0,"enterprise":0,"operational":15}'),'{models}','{"gemini-3.5-flash-lite":{},"gemini-3.5-flash":{}}');
 update public.gemini_usage_config set settings=jsonb_set(settings,'{mode}','"ENFORCEMENT"');
end;$$;
create function pg_temp.g_reserve(n integer,u integer default 1,consumer text default 'maxxis_chat')returns jsonb language sql as $$
 select public.ds_gemini_reserve_execution(pg_temp.g_id(n),pg_temp.g_id(u),consumer,case when consumer='maxxis_chat'then 3 else 1 end,100,array['gemini-3.5-flash-lite','gemini-3.5-flash']);$$;
select pg_temp.g_assert((public.ds_gemini_reserve_execution(pg_temp.g_id(10),pg_temp.g_id(1),'maxxis_chat',3,100,array['gemini-3.5-flash-lite'])->>'enforced')='false','disabled_preserves_no_reservation');
select pg_temp.g_denied($q$update public.gemini_usage_config set settings=jsonb_set(settings,'{mode}','"ENFORCEMENT"')$q$,'CONFIGURATION_REQUIRED','activation_needs_real_config_and_approval');
select pg_temp.g_denied($q$update public.gemini_usage_config set settings=settings-'pools'$q$,'INVALID_POOLS','missing_pool_config_denied');
select pg_temp.g_reset();
select pg_temp.g_assert((pg_temp.g_reserve(10)->>'enforced')='true','free_below_limit');
select pg_temp.g_reserve(10);
select pg_temp.g_assert((select count(*)=1 from public.gemini_usage_executions),'reservation_idempotence');
select pg_temp.g_denied('select pg_temp.g_reserve(11)','INDIVIDUAL_LIMIT','free_concurrency_pending_counted');
select public.ds_gemini_begin_attempt(pg_temp.g_id(10),pg_temp.g_id(100),'gemini-3.5-flash-lite',50);
select pg_temp.g_denied($q$select public.ds_gemini_begin_attempt(pg_temp.g_id(10),pg_temp.g_id(100),'gemini-3.5-flash-lite',50)$q$,'ALREADY_STARTED','attempt_replay_cannot_dispatch_again');
select public.ds_gemini_finalize_attempt(pg_temp.g_id(100),10,5,2,4,3,20);
select public.ds_gemini_finalize_attempt(pg_temp.g_id(100),0,0,0,0,0,0);
select pg_temp.g_assert((select charged_tokens=20 and cached_tokens=4 from public.gemini_usage_attempts where id=pg_temp.g_id(100)),'tokens_no_cache_double_count_and_finalize_idempotence');
select public.ds_gemini_begin_attempt(pg_temp.g_id(10),pg_temp.g_id(101),'gemini-3.5-flash',50);
select public.ds_gemini_finalize_attempt(pg_temp.g_id(101),null,null,null,null,null,null);
select public.ds_gemini_close_execution(pg_temp.g_id(10));select public.ds_gemini_close_execution(pg_temp.g_id(10));
select pg_temp.g_assert((select calls=2 and tokens=70 and interactions=1 and concurrency=0 from public.ds_gemini_usage_totals(clock_timestamp()-interval '1 hour',pg_temp.g_id(1))),'one_interaction_multiple_calls_unused_released_timeout_held');
select pg_temp.g_assert((select state='uncertain'and charged_tokens=50 from public.gemini_usage_attempts where id=pg_temp.g_id(101)),'unknown_usage_no_refund');
select pg_temp.g_reserve(11);select public.ds_gemini_begin_attempt(pg_temp.g_id(11),pg_temp.g_id(102),'gemini-3.5-flash-lite',50);select public.ds_gemini_close_execution(pg_temp.g_id(11));
select pg_temp.g_reserve(12);select public.ds_gemini_begin_attempt(pg_temp.g_id(12),pg_temp.g_id(103),'gemini-3.5-flash-lite',50);select public.ds_gemini_close_execution(pg_temp.g_id(12));
select pg_temp.g_denied('select pg_temp.g_reserve(13)','INDIVIDUAL_LIMIT','free_daily_interaction_limit');
update public.gemini_usage_executions set first_started_at=clock_timestamp()-interval '1 day';
update public.gemini_usage_config set settings=jsonb_set(jsonb_set(settings,'{plans,FREE,interactions_month}','3'),'{plans,FREE,interactions_day}','3');
select pg_temp.g_denied('select pg_temp.g_reserve(14)','INDIVIDUAL_LIMIT','free_monthly_interaction_limit');
select pg_temp.g_reset();
select pg_temp.g_reserve(20,2);select pg_temp.g_reserve(21,2);
select pg_temp.g_denied('select pg_temp.g_reserve(22,2)','INDIVIDUAL_LIMIT','pro_concurrency_two');
select pg_temp.g_reserve(23,3);select pg_temp.g_reserve(24,3);select pg_temp.g_reserve(25,3);
select pg_temp.g_denied('select pg_temp.g_reserve(26,3)','INDIVIDUAL_LIMIT','enterprise_concurrency_three');
select pg_temp.g_denied($q$update public.gemini_usage_config set settings=jsonb_set(settings,'{global,calls_day}','2')$q$,'CAPACITY_LIMIT','admin_cannot_reduce_below_committed');
select pg_temp.g_denied($q$update public.gemini_usage_config set settings=jsonb_set(settings,'{pools,free}','90')$q$,'INVALID_POOLS','pool_percent_sum_consistency');
select pg_temp.g_denied($q$update public.gemini_usage_config set settings=jsonb_set(settings,'{global,calls_minute}','101')$q$,'PROVIDER_LIMIT','internal_not_above_confirmed_provider');
select pg_temp.g_reset();
update public.gemini_usage_config set settings=jsonb_set(settings,'{pools}','{"free":0,"paid":85,"pro":0,"enterprise":0,"operational":15}');
select pg_temp.g_denied('select pg_temp.g_reserve(30)','FREE_POOL_LIMIT','free_collective_exhausted');
select pg_temp.g_assert((pg_temp.g_reserve(31,2)->>'enforced')='true','paid_reserved_capacity_available');
select pg_temp.g_reset();
update public.gemini_usage_config set settings=jsonb_set(jsonb_set(settings,'{pools}','{"free":0,"paid":100,"pro":0,"enterprise":0,"operational":0}'),'{global,calls_day}','5');
select pg_temp.g_reserve(40,2);
select pg_temp.g_denied('select pg_temp.g_reserve(41,3)','CAPACITY_LIMIT','global_capacity_limit_includes_pending');
select pg_temp.g_reset();
update public.gemini_usage_config set settings=jsonb_set(settings,'{models,gemini-3.5-flash-lite}','{"calls_minute":1}');
update public.gemini_usage_config set settings=jsonb_set(settings,'{pools}','{"free":100,"paid":0,"pro":0,"enterprise":0,"operational":0}');
select pg_temp.g_reserve(50);
select public.ds_gemini_begin_attempt(pg_temp.g_id(50),pg_temp.g_id(150),'gemini-3.5-flash-lite',50);
select pg_temp.g_denied($q$select public.ds_gemini_begin_attempt(pg_temp.g_id(50),pg_temp.g_id(151),'gemini-3.5-flash-lite',50)$q$,'MODEL_LIMIT','per_model_instant_limit');
update public.gemini_usage_executions set expires_at=clock_timestamp()-interval '1 second'where id=pg_temp.g_id(50);
select pg_temp.g_reserve(51);
select pg_temp.g_assert((select state='abandoned'and remaining_calls=0 from public.gemini_usage_executions where id=pg_temp.g_id(50)),'abandoned_unused_capacity_released');
select pg_temp.g_assert((select charged_tokens=50 from public.gemini_usage_attempts where id=pg_temp.g_id(150)),'abandoned_started_consumption_preserved');
select pg_temp.g_reset();
select pg_temp.g_reserve(60,1,'presentation_translate');
select public.ds_gemini_begin_attempt(pg_temp.g_id(60),pg_temp.g_id(160),'gemini-3.5-flash-lite',50);select public.ds_gemini_close_execution(pg_temp.g_id(60));
select pg_temp.g_assert((select calls=1 and interactions=0 from public.ds_gemini_usage_totals(clock_timestamp()-interval '1 hour',pg_temp.g_id(1))),'translation_uses_calls_not_chat_interactions');
select pg_temp.g_assert(not has_table_privilege('authenticated','public.gemini_usage_config','SELECT,UPDATE')and not has_table_privilege('anon','public.gemini_usage_attempts','SELECT,INSERT')and not has_function_privilege('authenticated','public.ds_gemini_reserve_execution(uuid,uuid,text,integer,bigint,text[],uuid)','EXECUTE'),'client_read_write_rpc_denied');
select pg_temp.g_assert(not exists(select 1 from information_schema.columns where table_schema='public'and table_name in('gemini_usage_executions','gemini_usage_attempts')and column_name~'prompt$|message|history|contact|payload|jwt|api_key|secret'),'ledger_contains_no_payload_columns');
select pg_temp.g_reset();
select pg_temp.g_reserve(70);select public.ds_gemini_begin_attempt(pg_temp.g_id(70),pg_temp.g_id(170),'gemini-3.5-flash-lite',50);
select public.ds_gemini_finalize_attempt(pg_temp.g_id(170),null,null,null,null,null,null,false);select public.ds_gemini_close_execution(pg_temp.g_id(70));
select pg_temp.g_assert((select calls=0 and tokens=0 and interactions=0 from public.ds_gemini_usage_totals(clock_timestamp()-interval '1 hour')),'proven_not_dispatched_capacity_refunded');
select pg_temp.g_reserve(71);select public.ds_gemini_begin_attempt(pg_temp.g_id(71),pg_temp.g_id(171),'gemini-3.5-flash-lite',50);select public.ds_gemini_close_execution(pg_temp.g_id(71));
delete from auth.users where id=pg_temp.g_id(1);
select pg_temp.g_assert((select user_id is null from public.gemini_usage_executions where id=pg_temp.g_id(71))and(select calls=1 and tokens=50 from public.ds_gemini_usage_totals(clock_timestamp()-interval '1 hour')),'account_deletion_preserves_global_usage_without_blocking_auth');
grant insert,select on gemini_test_results to authenticated;
set local role authenticated;
select pg_temp.g_denied('select * from public.gemini_usage_attempts','permission denied','authenticated_cannot_read_ledger');
select pg_temp.g_denied('update public.gemini_usage_config set revision=revision+1','permission denied','authenticated_cannot_modify_quota');
select pg_temp.g_denied('delete from public.gemini_usage_executions','permission denied','authenticated_cannot_modify_counters');
reset role;
select array_agg(name order by name)passed_tests from gemini_test_results;
