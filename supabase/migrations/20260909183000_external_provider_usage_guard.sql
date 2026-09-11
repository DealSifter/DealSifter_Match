create table if not exists public.external_provider_usage (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  operation text not null,
  property_id uuid null references public.properties(id) on delete set null,
  user_id uuid null references auth.users(id) on delete set null,
  status text not null default 'reserved',
  http_status integer null,
  billable_success boolean not null default false,
  was_cache_hit boolean not null default false,
  error_code text null,
  created_at timestamptz not null default now(),
  completed_at timestamptz null,
  constraint external_provider_usage_provider_check check (provider in ('rentcast')),
  constraint external_provider_usage_operation_check check (operation in ('property_lookup')),
  constraint external_provider_usage_status_check check (status in ('reserved', 'succeeded', 'failed')),
  constraint external_provider_usage_http_status_check check (http_status is null or http_status between 100 and 599),
  constraint external_provider_usage_error_code_check check (error_code is null or error_code ~ '^[A-Z][A-Z0-9_]{1,63}$')
);

alter table public.external_provider_usage enable row level security;

create index if not exists idx_external_provider_usage_monthly_guard
  on public.external_provider_usage(provider, created_at)
  where status = 'reserved' or billable_success = true;

create index if not exists idx_external_provider_usage_user_created
  on public.external_provider_usage(user_id, created_at desc)
  where user_id is not null;

comment on table public.external_provider_usage is
  'Backend-only audit and atomic reservation ledger for external data-provider usage. Never stores API keys, headers, raw responses, or address data.';

create or replace function public.ds_reserve_external_provider_usage(
  p_provider text,
  p_operation text,
  p_property_id uuid default null,
  p_user_id uuid default null,
  p_hard_limit integer default 45
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usage_id uuid;
  v_consumed integer;
  v_month_key integer;
begin
  if p_provider <> 'rentcast' or p_operation <> 'property_lookup' then
    raise exception using errcode = '22023', message = 'INVALID_PROVIDER_USAGE_RESERVATION';
  end if;
  if p_hard_limit < 1 or p_hard_limit > 45 then
    raise exception using errcode = '22023', message = 'INVALID_PROVIDER_HARD_LIMIT';
  end if;

  v_month_key := (extract(year from timezone('utc', now()))::integer * 100)
    + extract(month from timezone('utc', now()))::integer;
  perform pg_advisory_xact_lock(hashtext(p_provider), v_month_key);

  select count(*)::integer
    into v_consumed
    from public.external_provider_usage
   where provider = p_provider
     and created_at >= date_trunc('month', timezone('utc', now())) at time zone 'utc'
     and created_at < (date_trunc('month', timezone('utc', now())) + interval '1 month') at time zone 'utc'
     and (status = 'reserved' or billable_success = true);

  if v_consumed >= p_hard_limit then
    raise exception using errcode = 'P0001', message = 'MONTHLY_PROVIDER_LIMIT_REACHED';
  end if;

  insert into public.external_provider_usage (
    provider, operation, property_id, user_id, status, billable_success, was_cache_hit
  ) values (
    p_provider, p_operation, p_property_id, p_user_id, 'reserved', false, false
  ) returning id into v_usage_id;

  return v_usage_id;
end;
$$;

create or replace function public.ds_finalize_external_provider_usage(
  p_usage_id uuid,
  p_billable_success boolean,
  p_http_status integer default null,
  p_error_code text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.external_provider_usage
     set status = case when p_billable_success then 'succeeded' else 'failed' end,
         billable_success = p_billable_success,
         http_status = p_http_status,
         error_code = case when p_error_code ~ '^[A-Z][A-Z0-9_]{1,63}$' then p_error_code else null end,
         completed_at = now()
   where id = p_usage_id
     and status = 'reserved';

  if not found then
    raise exception using errcode = 'P0001', message = 'PROVIDER_USAGE_RESERVATION_NOT_FOUND';
  end if;
end;
$$;

revoke all on public.external_provider_usage from anon, authenticated;
revoke all on function public.ds_reserve_external_provider_usage(text, text, uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.ds_finalize_external_provider_usage(uuid, boolean, integer, text) from public, anon, authenticated;
grant execute on function public.ds_reserve_external_provider_usage(text, text, uuid, uuid, integer) to service_role;
grant execute on function public.ds_finalize_external_provider_usage(uuid, boolean, integer, text) to service_role;
