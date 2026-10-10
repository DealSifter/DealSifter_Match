-- Reuse the existing cache and usage guard; isolate hypothetical exit product pools.
alter table public.property_intelligence_cache drop constraint if exists property_intelligence_cache_data_type_check;
alter table public.property_intelligence_cache add constraint property_intelligence_cache_data_type_check check
  (data_type in ('property_record', 'property_value_avm', 'property_sold_record_pool',
    'property_sold_record_pool_exit_sfr', 'property_sold_record_pool_exit_townhouse', 'property_sold_record_pool_exit_condo'));

create or replace function public.ds_upsert_property_intelligence_cache(
  p_property_id uuid, p_provider text, p_provider_property_id text, p_data_type text,
  p_schema_version smallint, p_payload jsonb, p_retrieved_at timestamptz, p_expires_at timestamptz
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_cache_id uuid;
begin
  if p_provider <> 'rentcast' or p_data_type not in ('property_record', 'property_value_avm', 'property_sold_record_pool',
     'property_sold_record_pool_exit_sfr', 'property_sold_record_pool_exit_townhouse', 'property_sold_record_pool_exit_condo')
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
$$;
revoke all on function public.ds_upsert_property_intelligence_cache(uuid,text,text,text,smallint,jsonb,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.ds_upsert_property_intelligence_cache(uuid,text,text,text,smallint,jsonb,timestamptz,timestamptz) to service_role;
