-- Metadata-only allowlist expansion, copied from verified Production definitions.

-- Existing function bodies, ACLs, RLS, guard, billing and financial logic are preserved.

begin;

CREATE OR REPLACE FUNCTION public.ds_reserve_external_provider_usage(p_provider text, p_operation text, p_property_id uuid DEFAULT NULL::uuid, p_user_id uuid DEFAULT NULL::uuid, p_hard_limit integer DEFAULT 45)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_usage_id uuid; v_consumed integer; v_month_key integer;
begin
  if p_provider <> 'rentcast'
     or p_operation not in ('property_lookup', 'property_value_avm', 'property_sold_search', 'sale_listings', 'rent_estimate', 'rental_listings', 'market_data') then
    raise exception using errcode = '22023', message = 'INVALID_PROVIDER_USAGE_RESERVATION';
  end if;
  if p_hard_limit < 1 or p_hard_limit > 45 then
    raise exception using errcode = '22023', message = 'INVALID_PROVIDER_HARD_LIMIT';
  end if;
  v_month_key := (extract(year from timezone('utc', now()))::integer * 100)
    + extract(month from timezone('utc', now()))::integer;
  perform pg_advisory_xact_lock(hashtext(p_provider), v_month_key);
  select count(*)::integer into v_consumed from public.external_provider_usage
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
$function$;

CREATE OR REPLACE FUNCTION public.ds_upsert_property_intelligence_cache(p_property_id uuid, p_provider text, p_provider_property_id text, p_data_type text, p_schema_version smallint, p_payload jsonb, p_retrieved_at timestamp with time zone, p_expires_at timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_cache_id uuid;
begin
  if p_provider <> 'rentcast' or p_data_type not in ('property_record', 'property_value_avm', 'property_sold_record_pool', 'property_sold_record_pool_exit_sfr', 'property_sold_record_pool_exit_townhouse', 'property_sold_record_pool_exit_condo', 'sale_listing_evidence', 'rent_estimate_evidence', 'rental_listing_evidence', 'market_evidence')
     or p_schema_version < 1 or jsonb_typeof(p_payload) <> 'object' or p_expires_at <= p_retrieved_at then
    raise exception using errcode = '22023', message = 'INVALID_PROPERTY_INTELLIGENCE_CACHE_ENTRY';
  end if;
  insert into public.property_intelligence_cache
    (property_id, provider, provider_property_id, data_type, schema_version, payload, retrieved_at, expires_at)
    values (p_property_id, p_provider, nullif(trim(p_provider_property_id), ''), p_data_type,
      p_schema_version, p_payload, p_retrieved_at, p_expires_at)
    on conflict (property_id, provider, data_type) do update set provider_property_id = excluded.provider_property_id,
      schema_version = excluded.schema_version, payload = excluded.payload, retrieved_at = excluded.retrieved_at,
      expires_at = excluded.expires_at, updated_at = now() returning id into v_cache_id;
  return v_cache_id;
end;
$function$;

alter table public.property_intelligence_cache drop constraint property_intelligence_cache_data_type_check;

alter table public.property_intelligence_cache add constraint property_intelligence_cache_data_type_check check (data_type in ('property_record', 'property_value_avm', 'property_sold_record_pool', 'property_sold_record_pool_exit_sfr', 'property_sold_record_pool_exit_townhouse', 'property_sold_record_pool_exit_condo', 'sale_listing_evidence', 'rent_estimate_evidence', 'rental_listing_evidence', 'market_evidence'));

commit;
