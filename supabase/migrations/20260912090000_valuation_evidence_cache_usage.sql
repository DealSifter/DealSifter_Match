-- Additive support for RentCast AVM/value evidence. No entitlement, Nugget, Stripe, or public UI changes.
alter table public.property_intelligence_cache
  drop constraint if exists property_intelligence_cache_data_type_check;
alter table public.property_intelligence_cache
  add constraint property_intelligence_cache_data_type_check
  check (data_type in ('property_record', 'property_value_avm'));

create or replace function public.ds_upsert_property_intelligence_cache(
  p_property_id uuid,
  p_provider text,
  p_provider_property_id text,
  p_data_type text,
  p_schema_version smallint,
  p_payload jsonb,
  p_retrieved_at timestamptz,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cache_id uuid;
begin
  if p_provider <> 'rentcast'
     or p_data_type not in ('property_record', 'property_value_avm')
     or p_schema_version < 1
     or jsonb_typeof(p_payload) <> 'object'
     or p_expires_at <= p_retrieved_at then
    raise exception using errcode = '22023', message = 'INVALID_PROPERTY_INTELLIGENCE_CACHE_ENTRY';
  end if;

  insert into public.property_intelligence_cache (
    property_id, provider, provider_property_id, data_type, schema_version,
    payload, retrieved_at, expires_at
  ) values (
    p_property_id, p_provider, nullif(trim(p_provider_property_id), ''), p_data_type,
    p_schema_version, p_payload, p_retrieved_at, p_expires_at
  )
  on conflict (property_id, provider, data_type) do update
    set provider_property_id = excluded.provider_property_id,
        schema_version = excluded.schema_version,
        payload = excluded.payload,
        retrieved_at = excluded.retrieved_at,
        expires_at = excluded.expires_at,
        updated_at = now()
  returning id into v_cache_id;

  return v_cache_id;
end;
$$;

alter table public.external_provider_usage
  drop constraint if exists external_provider_usage_operation_check;
alter table public.external_provider_usage
  add constraint external_provider_usage_operation_check
  check (operation in ('property_lookup', 'property_value_avm'));

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
  if p_provider <> 'rentcast' or p_operation not in ('property_lookup', 'property_value_avm') then
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

revoke all on function public.ds_upsert_property_intelligence_cache(uuid, text, text, text, smallint, jsonb, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.ds_upsert_property_intelligence_cache(uuid, text, text, text, smallint, jsonb, timestamptz, timestamptz, text) from public, anon, authenticated;
revoke all on function public.ds_reserve_external_provider_usage(text, text, uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.ds_upsert_property_intelligence_cache(uuid, text, text, text, smallint, jsonb, timestamptz, timestamptz) to service_role;
grant execute on function public.ds_upsert_property_intelligence_cache(uuid, text, text, text, smallint, jsonb, timestamptz, timestamptz, text) to service_role;
grant execute on function public.ds_reserve_external_provider_usage(text, text, uuid, uuid, integer) to service_role;
