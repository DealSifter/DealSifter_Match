-- Dedicated Gemini quota state. RentCast ledgers and commercial entitlements are unchanged.
create table public.gemini_usage_config(
 singleton boolean primary key default true check(singleton),
 settings jsonb not null,
 revision bigint not null default 1,
 updated_at timestamptz not null default now()
);
insert into public.gemini_usage_config(settings) values ('{
 "mode":"DISABLED","provider_verified":false,"commercial_approved":false,
 "provider_day_timezone":null,"provider_limits":{},"global":{},
 "models":{"gemini-3.5-flash-lite":{},"gemini-3.5-flash":{}},
 "pools":{"free":25,"paid":60,"pro":0,"enterprise":0,"operational":15},
 "plan_pool":{"FREE":"free","PRO":"paid","ENTERPRISE":"paid"},
 "plans":{
  "FREE":{"interactions_day":3,"interactions_month":30,"concurrency":1},
  "PRO":{"interactions_day":20,"interactions_month":300,"concurrency":2},
  "ENTERPRISE":{"interactions_day":50,"interactions_month":1000,"concurrency":3}
 },"retention_days":120,"future_financial_limit_minor":null
}'::jsonb);
create table public.gemini_usage_executions(
 id uuid primary key,
 request_id uuid,
 user_id uuid references auth.users(id) on delete set null,
 plan text not null check(plan in ('FREE','PRO','ENTERPRISE')),
 pool text not null check(pool in ('free','paid','pro','enterprise')),
 consumer text not null check(consumer in ('maxxis_chat','presentation_translate')),
 models text[] not null,
 max_calls integer not null check(max_calls between 1 and 3),
 remaining_calls integer not null check(remaining_calls between 0 and 3),
 token_reservation bigint not null check(token_reservation between 1 and 10000000),
 state text not null default 'reserved' check(state in ('reserved','closed','abandoned')),
 created_at timestamptz not null default clock_timestamp(),
 first_started_at timestamptz,
 expires_at timestamptz not null default clock_timestamp()+interval '2 minutes',
 closed_at timestamptz
);
create index on public.gemini_usage_executions(user_id,created_at);
create table public.gemini_usage_attempts(
 id uuid primary key,
 execution_id uuid not null references public.gemini_usage_executions(id) on delete cascade,
 model text not null check(model ~ '^gemini-[a-z0-9.-]{1,80}$'),
 state text not null default 'uncertain' check(state in ('uncertain','confirmed','unused')),
 dispatched boolean,
 reserved_tokens bigint not null check(reserved_tokens between 1 and 10000000),
 prompt_tokens bigint, output_tokens bigint, thinking_tokens bigint, cached_tokens bigint, tool_tokens bigint,
 charged_tokens bigint not null check(charged_tokens>=0),
 started_at timestamptz not null default clock_timestamp(),
 completed_at timestamptz,
 check(prompt_tokens is null or prompt_tokens>=0), check(output_tokens is null or output_tokens>=0),
 check(thinking_tokens is null or thinking_tokens>=0),check(cached_tokens is null or cached_tokens>=0),check(tool_tokens is null or tool_tokens>=0)
);
create index on public.gemini_usage_attempts(started_at,model);
create index on public.gemini_usage_attempts(execution_id);

create function public.ds_gemini_effective_plan(p_user uuid) returns text
language sql stable security definer set search_path=public,pg_temp as $$
 select case when u.is_admin then 'ENTERPRISE'
 when lower(case when s.status in ('active','trialing') then s.plan_id else u.plan_id end) in ('enterprise','admin') then 'ENTERPRISE'
 when lower(case when s.status in ('active','trialing') then s.plan_id else u.plan_id end) in ('pro','professional') then 'PRO'
 else 'FREE' end
 from public.users u left join lateral(select plan_id,status from public.subscriptions where user_id=u.id order by updated_at desc limit 1)s on true
 where u.id=p_user;
$$;

-- Pending capacity is counted in the CURRENT window, including across midnight.
-- Started attempts are attributed to their actual dispatch window, not reservation time.
create function public.ds_gemini_usage_totals(p_since timestamptz,p_user uuid default null,p_pool text default null,p_model text default null,p_instant boolean default false)
returns table(calls bigint,tokens bigint,interactions bigint,concurrency bigint)
language sql stable security definer set search_path=public,pg_temp as $$
 with e as(select * from public.gemini_usage_executions x where(p_user is null or user_id=p_user)and(p_pool is null or pool=p_pool)),
 a as(select a.* from public.gemini_usage_attempts a join e on e.id=a.execution_id where a.state<>'unused'and a.started_at>=p_since and(p_model is null or a.model=p_model)),
 pending as(select * from e where state='reserved' and expires_at>clock_timestamp() and(p_model is null or p_model=any(models)))
 select
 (select count(*) from a)+case when p_instant then 0 else coalesce((select sum(remaining_calls) from pending),0) end,
 coalesce((select sum(charged_tokens) from a),0)+case when p_instant then 0 else coalesce((select sum(remaining_calls*token_reservation)from pending),0)end,
 (select count(*)from e where consumer='maxxis_chat'and(first_started_at>=p_since or(first_started_at is null and state='reserved'and expires_at>clock_timestamp()))),
 (select count(*)from pending);
$$;

create function public.ds_gemini_validate_config(c jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare k text; v jsonb; n numeric; total integer:=0; p text; required_key text;
begin
 if jsonb_typeof(c)<>'object' or c->>'mode' not in ('DISABLED','ENFORCEMENT') or c->>'mode' is null then raise exception 'GEMINI_INVALID_CONFIG';end if;
 if exists(select 1 from jsonb_object_keys(c)as root_key(name) where root_key.name not in ('mode','provider_verified','commercial_approved','provider_day_timezone','provider_limits','global','models','pools','plan_pool','plans','retention_days','future_financial_limit_minor'))then raise exception 'GEMINI_INVALID_CONFIG';end if;
 if coalesce(jsonb_typeof(c->'provider_verified'),'null')<>'boolean' or coalesce(jsonb_typeof(c->'commercial_approved'),'null')<>'boolean' then raise exception 'GEMINI_INVALID_CONFIG';end if;
 if coalesce((c->>'retention_days')::integer,0)not between 90 and 365 then raise exception 'GEMINI_INVALID_CONFIG';end if;
 if not(c?'future_financial_limit_minor')or c->'future_financial_limit_minor'<>'null'::jsonb then raise exception 'GEMINI_FINANCIAL_ENFORCEMENT_NOT_IMPLEMENTED';end if;
 foreach k in array array['free','paid','pro','enterprise','operational']loop
  v:=c->'pools'->k;if coalesce(jsonb_typeof(v),'null')<>'number' or(v::text)::numeric<>trunc((v::text)::numeric) or(v::text)::integer not between 0 and 100 then raise exception 'GEMINI_INVALID_POOLS';end if;
  total:=total+(v::text)::integer;
 end loop;
 if total is null or total<>100 or coalesce(c#>>'{plan_pool,FREE}','')<>'free' or coalesce(c#>>'{plan_pool,PRO}','') not in ('paid','pro') or coalesce(c#>>'{plan_pool,ENTERPRISE}','')not in('paid','enterprise') then raise exception 'GEMINI_INVALID_POOLS';end if;
 foreach p in array array['FREE','PRO','ENTERPRISE']loop
  if jsonb_typeof(c->'plans'->p)<>'object' then raise exception 'GEMINI_INVALID_CONFIG';end if;
  foreach k in array array['interactions_day','interactions_month','concurrency']loop
   if coalesce((c->'plans'->p->>k)::bigint,0)not between 1 and 1000000000 then raise exception 'GEMINI_INVALID_CONFIG';end if;
  end loop;
  if(c->'plans'->p->>'interactions_day')::bigint>(c->'plans'->p->>'interactions_month')::bigint then raise exception 'GEMINI_INVALID_CONFIG';end if;
 end loop;
 if coalesce(jsonb_typeof(c->'models'),'null')<>'object' or not(c->'models'?'gemini-3.5-flash-lite') or not(c->'models'?'gemini-3.5-flash')then raise exception 'GEMINI_INVALID_CONFIG';end if;
 -- Strictly typed dimensions; never accept negative, fractional or unbounded numbers.
 for v in select value from jsonb_each(c->'plans') union all select c->'global' union all select c->'provider_limits' union all select value from jsonb_each(c->'models')loop
  if coalesce(jsonb_typeof(v),'null')<>'object'then raise exception 'GEMINI_INVALID_CONFIG';end if;
  for k,n in select key,case when value='null'::jsonb then null else(value::text)::numeric end from jsonb_each(v)loop
   if k not in('calls_minute','calls_day','calls_month','tokens_minute','tokens_day','tokens_month','interactions_day','interactions_month','concurrency')or(n is not null and(n<1 or n>1000000000000 or n<>trunc(n)))then raise exception 'GEMINI_INVALID_CONFIG';end if;
  end loop;
 end loop;
 if c->>'provider_day_timezone' is not null and not exists(select 1 from pg_timezone_names where name=c->>'provider_day_timezone')then raise exception 'GEMINI_INVALID_TIMEZONE';end if;
 if c->>'mode'='ENFORCEMENT'then
  if c->>'provider_verified'<>'true'or c->>'commercial_approved'<>'true'or c->>'provider_day_timezone' is null then raise exception 'GEMINI_CONFIGURATION_REQUIRED';end if;
  foreach k in array array['calls_minute','calls_day','calls_month','tokens_minute','tokens_day','tokens_month','concurrency']loop
   if coalesce((c->'global'->>k)::bigint,0)<1 then raise exception 'GEMINI_CONFIGURATION_REQUIRED';end if;
  end loop;
  foreach k in array array['calls_minute','calls_day','tokens_minute']loop
   if coalesce((c->'provider_limits'->>k)::bigint,0)<1 or(c->'global'->>k)::bigint>(c->'provider_limits'->>k)::bigint then raise exception 'GEMINI_PROVIDER_LIMIT_NOT_CONFIRMED';end if;
  end loop;
 end if;
end;$$;

create function public.ds_gemini_assert_capacity(c jsonb,p_check_user uuid default null)returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare period text; since_at timestamptz; stats record; metric text; limit_value bigint; used bigint; pool_key text; model_key text; uid uuid; plan_key text; scope_config jsonb;
begin
 foreach period in array array['minute','day','month']loop
  since_at:=case period when 'minute'then clock_timestamp()-interval '60 seconds' when 'day'then date_trunc('day',clock_timestamp()at time zone(c->>'provider_day_timezone'))at time zone(c->>'provider_day_timezone') else date_trunc('month',clock_timestamp()at time zone 'UTC')at time zone 'UTC'end;
  select * into stats from public.ds_gemini_usage_totals(since_at,null,null,null,period='minute');
  foreach metric in array array['calls','tokens']loop
   limit_value:=(c->'global'->>(metric||'_'||period))::bigint;used:=case metric when 'calls'then stats.calls else stats.tokens end;
   if used>limit_value then raise exception 'GEMINI_CAPACITY_LIMIT';end if;
  end loop;
  if stats.concurrency>(c#>>'{global,concurrency}')::bigint then raise exception 'GEMINI_CAPACITY_LIMIT';end if;
  foreach pool_key in array array['free','paid','pro','enterprise']loop
   select * into stats from public.ds_gemini_usage_totals(since_at,null,pool_key,null,period='minute');
   if stats.concurrency>floor((c#>>'{global,concurrency}')::numeric*(c->'pools'->>pool_key)::numeric/100)then
    if pool_key='free'then raise exception 'GEMINI_FREE_POOL_LIMIT';else raise exception 'GEMINI_PAID_POOL_LIMIT';end if;
   end if;
   foreach metric in array array['calls','tokens']loop
    limit_value:=floor((c->'global'->>(metric||'_'||period))::numeric*(c->'pools'->>pool_key)::numeric/100)::bigint;
    used:=case metric when 'calls'then stats.calls else stats.tokens end;
    if used>limit_value then
     if pool_key='free'then raise exception 'GEMINI_FREE_POOL_LIMIT';else raise exception 'GEMINI_PAID_POOL_LIMIT';end if;
    end if;
   end loop;
  end loop;
  for model_key,scope_config in select key,value from jsonb_each(c->'models')loop
   select * into stats from public.ds_gemini_usage_totals(since_at,null,null,model_key,period='minute');
   foreach metric in array array['calls','tokens']loop
    select * into stats from public.ds_gemini_usage_totals(since_at,null,null,model_key,period='minute');
    if stats.concurrency>(scope_config->>'concurrency')::bigint then raise exception 'GEMINI_MODEL_LIMIT';end if;
    limit_value:=(scope_config->>(metric||'_'||period))::bigint;used:=case metric when 'calls'then stats.calls else stats.tokens end;
    if used>limit_value then raise exception 'GEMINI_MODEL_LIMIT';end if;
    if limit_value is not null then
     foreach pool_key in array array['free','paid','pro','enterprise']loop
      select * into stats from public.ds_gemini_usage_totals(since_at,null,pool_key,model_key,period='minute');
      used:=case metric when 'calls'then stats.calls else stats.tokens end;
      if used>floor(limit_value::numeric*(c->'pools'->>pool_key)::numeric/100)then
       if pool_key='free'then raise exception 'GEMINI_FREE_POOL_LIMIT';else raise exception 'GEMINI_PAID_POOL_LIMIT';end if;
      end if;
     end loop;
    end if;
   end loop;
  end loop;
  for uid in select distinct user_id from public.gemini_usage_executions where created_at>clock_timestamp()-interval '32 days'and(p_check_user is null or user_id=p_check_user)and user_id is not null loop
   plan_key:=public.ds_gemini_effective_plan(uid);scope_config:=c->'plans'->plan_key;
   select * into stats from public.ds_gemini_usage_totals(case when period='day'then date_trunc('day',clock_timestamp()at time zone 'UTC')at time zone 'UTC'else since_at end,uid,null,null,period='minute');
   foreach metric in array array['calls','tokens']loop
    limit_value:=(scope_config->>(metric||'_'||period))::bigint;used:=case metric when 'calls'then stats.calls else stats.tokens end;
    if used>limit_value then raise exception 'GEMINI_INDIVIDUAL_LIMIT';end if;
   end loop;
   if period<>'minute'and stats.interactions>(scope_config->>('interactions_'||period))::bigint then raise exception 'GEMINI_INDIVIDUAL_LIMIT';end if;
   if stats.concurrency>(scope_config->>'concurrency')::bigint then raise exception 'GEMINI_INDIVIDUAL_LIMIT';end if;
  end loop;
 end loop;
end;$$;

create function public.ds_gemini_config_guard()returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(hashtext('gemini-usage-guard-v1'));
 perform public.ds_gemini_validate_config(new.settings);
 if(old.settings->>'provider_day_timezone'is distinct from new.settings->>'provider_day_timezone'or old.settings->'plan_pool'is distinct from new.settings->'plan_pool')and exists(select 1 from public.gemini_usage_executions where created_at>=date_trunc('month',clock_timestamp()at time zone 'UTC')at time zone 'UTC')then raise exception 'GEMINI_CONFIG_CHANGE_HAS_COMMITTED_USAGE';end if;
 if new.settings->>'mode'='ENFORCEMENT'then perform public.ds_gemini_assert_capacity(new.settings);end if;
 new.revision:=old.revision+1;new.updated_at:=clock_timestamp();return new;
end;$$;
create trigger gemini_config_guard before update on public.gemini_usage_config for each row execute function public.ds_gemini_config_guard();

create function public.ds_gemini_reserve_execution(p_id uuid,p_user uuid,p_consumer text,p_calls integer,p_tokens bigint,p_models text[],p_request_id uuid default null)returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare c jsonb;e public.gemini_usage_executions;effective text;pool_key text;
begin
 perform pg_advisory_xact_lock(hashtext('gemini-usage-guard-v1'));
 select settings into c from public.gemini_usage_config where singleton;
 if c->>'mode'='DISABLED'then return jsonb_build_object('enforced',false);end if;
 if c is null or c->>'mode'<>'ENFORCEMENT'then raise exception 'GEMINI_CONFIGURATION_REQUIRED';end if;
 perform public.ds_gemini_validate_config(c);
 if p_id is null or p_user is null or p_consumer not in('maxxis_chat','presentation_translate')or p_calls not between 1 and 3 or(p_consumer='presentation_translate'and p_calls<>1)or p_tokens not between 1 and 10000000 or coalesce(cardinality(p_models),0)not between 1 and 3 or exists(select 1 from unnest(p_models)m where not(c->'models'?m))then raise exception 'GEMINI_INVALID_REQUEST';end if;
 effective:=public.ds_gemini_effective_plan(p_user);if effective is null then raise exception 'GEMINI_UNAUTHORIZED';end if;
 update public.gemini_usage_executions set state='abandoned',remaining_calls=0,closed_at=clock_timestamp()where state='reserved'and expires_at<=clock_timestamp();
 select * into e from public.gemini_usage_executions where id=p_id;
 if found then
  if e.user_id<>p_user or e.consumer<>p_consumer or e.max_calls<>p_calls or e.token_reservation<>p_tokens or e.models<>p_models or e.state<>'reserved'then raise exception 'GEMINI_EXECUTION_CONFLICT';end if;
  return jsonb_build_object('enforced',true,'id',e.id);
 end if;
 pool_key:=c->'plan_pool'->>effective;
 insert into public.gemini_usage_executions(id,user_id,plan,pool,consumer,max_calls,remaining_calls,token_reservation,models,request_id)values(p_id,p_user,effective,pool_key,p_consumer,p_calls,p_calls,p_tokens,p_models,p_request_id);
 perform public.ds_gemini_assert_capacity(c,p_user);
 return jsonb_build_object('enforced',true,'id',p_id);
end;$$;

create function public.ds_gemini_begin_attempt(p_execution uuid,p_attempt uuid,p_model text,p_tokens bigint)returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare c jsonb;e public.gemini_usage_executions;
begin
 perform pg_advisory_xact_lock(hashtext('gemini-usage-guard-v1'));
 select settings into c from public.gemini_usage_config where singleton;
 if c->>'mode'='DISABLED'then return jsonb_build_object('enforced',false);end if;
 if c is null or c->>'mode'<>'ENFORCEMENT'then raise exception 'GEMINI_CONFIGURATION_REQUIRED';end if;
 select * into e from public.gemini_usage_executions where id=p_execution for update;
 if e.id is null or e.state<>'reserved'or e.expires_at<=clock_timestamp()or e.remaining_calls<1 or not(p_model=any(e.models))or p_tokens not between 1 and e.token_reservation then raise exception 'GEMINI_RESERVATION_UNAVAILABLE';end if;
 -- A replay must never dispatch a second HTTP request, even before finalization.
 if exists(select 1 from public.gemini_usage_attempts where id=p_attempt)then raise exception 'GEMINI_ATTEMPT_ALREADY_STARTED';end if;
 insert into public.gemini_usage_attempts(id,execution_id,model,reserved_tokens,charged_tokens)values(p_attempt,p_execution,p_model,p_tokens,p_tokens);
 update public.gemini_usage_executions set remaining_calls=remaining_calls-1,first_started_at=coalesce(first_started_at,clock_timestamp())where id=p_execution;
 perform public.ds_gemini_assert_capacity(c,e.user_id);
 return jsonb_build_object('enforced',true,'id',p_attempt);
end;$$;

create function public.ds_gemini_finalize_attempt(p_attempt uuid,p_prompt bigint,p_output bigint,p_thinking bigint,p_cached bigint,p_tool bigint,p_total bigint,p_dispatched boolean default true)returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(hashtext('gemini-usage-guard-v1'));
 if exists(select 1 from unnest(array[p_prompt,p_output,p_thinking,p_cached,p_tool,p_total])x where x<0 or x>1000000000000)then raise exception 'GEMINI_INVALID_USAGE';end if;
 update public.gemini_usage_attempts set prompt_tokens=p_prompt,output_tokens=p_output,thinking_tokens=p_thinking,cached_tokens=p_cached,tool_tokens=p_tool,
 dispatched=p_dispatched,
 charged_tokens=case when p_dispatched=false then 0 when p_total is not null then greatest(p_total,coalesce(p_prompt,0)+coalesce(p_output,0)+coalesce(p_thinking,0)+coalesce(p_tool,0))else greatest(reserved_tokens,coalesce(p_prompt,0)+coalesce(p_output,0)+coalesce(p_thinking,0)+coalesce(p_tool,0))end,
 state=case when p_dispatched=false then 'unused'when p_total is not null then 'confirmed'else 'uncertain'end,completed_at=clock_timestamp()
 where id=p_attempt and completed_at is null;
 if found and p_dispatched=false then
  update public.gemini_usage_executions e set first_started_at=(select min(started_at)from public.gemini_usage_attempts where execution_id=e.id and state<>'unused')where id=(select execution_id from public.gemini_usage_attempts where id=p_attempt);
 end if;
 -- Idempotent; uncertain attempts cannot later be silently refunded by a retry.
end;$$;
create function public.ds_gemini_close_execution(p_id uuid)returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(hashtext('gemini-usage-guard-v1'));
 update public.gemini_usage_executions set state='closed',remaining_calls=0,closed_at=clock_timestamp()where id=p_id and state='reserved';
 perform public.ds_gemini_prune_usage();
end;$$;
create function public.ds_gemini_set_config(p_settings jsonb,p_expected_revision bigint)returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare r bigint;
begin
 update public.gemini_usage_config set settings=p_settings where singleton and revision=p_expected_revision returning revision into r;
 if r is null then raise exception 'GEMINI_CONFIG_REVISION_CONFLICT';end if;return r;
end;$$;
create function public.ds_gemini_prune_usage()returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare n integer;days integer;
begin
 perform pg_advisory_xact_lock(hashtext('gemini-usage-guard-v1'));
 select(settings->>'retention_days')::integer into days from public.gemini_usage_config where singleton;
 update public.gemini_usage_executions set state='abandoned',remaining_calls=0,closed_at=clock_timestamp()where state='reserved'and expires_at<=clock_timestamp();
 delete from public.gemini_usage_executions where id in(select id from public.gemini_usage_executions where state<>'reserved'and created_at<clock_timestamp()-make_interval(days=>days) order by created_at limit 500);
 get diagnostics n=row_count;return n;
end;$$;

-- Helpers, configuration and ledger are backend-only, including read access.
alter table public.gemini_usage_config enable row level security;
alter table public.gemini_usage_executions enable row level security;
alter table public.gemini_usage_attempts enable row level security;
revoke all on public.gemini_usage_config,public.gemini_usage_executions,public.gemini_usage_attempts from public,anon,authenticated,service_role;
grant select on public.gemini_usage_config to service_role;
do $permissions$ declare f record;begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname like 'ds_gemini_%'loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
  if f.signature::text like '%ds_gemini_reserve_execution(%'or f.signature::text like '%ds_gemini_begin_attempt(%'or f.signature::text like '%ds_gemini_finalize_attempt(%'or f.signature::text like '%ds_gemini_close_execution(%'or f.signature::text like '%ds_gemini_set_config(%'or f.signature::text like '%ds_gemini_prune_usage(%'then execute format('grant execute on function %s to service_role',f.signature);end if;
 end loop;
end;$permissions$;
