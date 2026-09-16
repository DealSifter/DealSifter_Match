create table if not exists public.maxxis_provider_budget_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid null references public.properties(id) on delete set null,
  plan text not null check (plan in ('PRO', 'ENTERPRISE')),
  bucket text not null check (bucket in ('chat', 'report')),
  status text not null default 'reserved' check (status in ('reserved', 'succeeded', 'failed')),
  billable_success boolean not null default false,
  created_at timestamptz not null default now(),
  completed_at timestamptz null
);

alter table public.maxxis_provider_budget_usage enable row level security;
revoke all on public.maxxis_provider_budget_usage from public, anon, authenticated;
grant select, insert, update on public.maxxis_provider_budget_usage to service_role;

create index if not exists idx_maxxis_provider_budget_month
  on public.maxxis_provider_budget_usage(user_id, bucket, created_at)
  where status = 'reserved' or billable_success = true;

create or replace function public.ds_reserve_maxxis_provider_budget(
  p_user_id uuid,
  p_property_id uuid,
  p_plan text,
  p_bucket text,
  p_total_budget integer,
  p_chat_percent integer
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan text := upper(trim(coalesce(p_plan, '')));
  v_bucket text := lower(trim(coalesce(p_bucket, '')));
  v_chat_limit integer;
  v_bucket_limit integer;
  v_consumed integer;
  v_month_key integer;
  v_id uuid;
begin
  if p_user_id is null or v_plan not in ('PRO', 'ENTERPRISE') or v_bucket not in ('chat', 'report') then
    raise exception using errcode = '22023', message = 'INVALID_PROVIDER_BUDGET_REQUEST';
  end if;
  if p_total_budget < 1 or p_total_budget > 45 or p_chat_percent < 0 or p_chat_percent > 100 then
    raise exception using errcode = '22023', message = 'INVALID_PROVIDER_BUDGET_CONFIG';
  end if;

  v_chat_limit := floor((p_total_budget * p_chat_percent)::numeric / 100)::integer;
  v_bucket_limit := case when v_bucket = 'chat' then v_chat_limit else p_total_budget - v_chat_limit end;
  if v_bucket_limit <= 0 then
    raise exception using errcode = 'P0001', message = 'PLAN_PROVIDER_BUDGET_EXHAUSTED';
  end if;

  v_month_key := extract(year from timezone('utc', now()))::integer * 100
    + extract(month from timezone('utc', now()))::integer;
  perform pg_advisory_xact_lock(hashtext('maxxis-provider:' || p_user_id::text || ':' || v_bucket), v_month_key);

  select count(*)::integer into v_consumed
    from public.maxxis_provider_budget_usage usage
   where usage.user_id = p_user_id
     and usage.bucket = v_bucket
     and usage.created_at >= date_trunc('month', timezone('utc', now())) at time zone 'utc'
     and usage.created_at < (date_trunc('month', timezone('utc', now())) + interval '1 month') at time zone 'utc'
     and (usage.status = 'reserved' or usage.billable_success = true);

  if v_consumed >= v_bucket_limit then
    raise exception using errcode = 'P0001', message = 'PLAN_PROVIDER_BUDGET_EXHAUSTED';
  end if;

  insert into public.maxxis_provider_budget_usage(user_id, property_id, plan, bucket)
  values (p_user_id, p_property_id, v_plan, v_bucket)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.ds_finalize_maxxis_provider_budget(
  p_reservation_id uuid,
  p_billable_success boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.maxxis_provider_budget_usage
     set status = case when p_billable_success then 'succeeded' else 'failed' end,
         billable_success = coalesce(p_billable_success, false),
         completed_at = now()
   where id = p_reservation_id
     and status = 'reserved';
  if not found then
    raise exception using errcode = 'P0001', message = 'PROVIDER_BUDGET_RESERVATION_NOT_FOUND';
  end if;
end;
$$;

revoke all on function public.ds_reserve_maxxis_provider_budget(uuid, uuid, text, text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.ds_finalize_maxxis_provider_budget(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.ds_reserve_maxxis_provider_budget(uuid, uuid, text, text, integer, integer)
  to service_role;
grant execute on function public.ds_finalize_maxxis_provider_budget(uuid, boolean)
  to service_role;
