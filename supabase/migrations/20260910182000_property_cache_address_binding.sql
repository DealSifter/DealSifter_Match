-- Legacy entries deliberately remain NULL and therefore MISS until refreshed.
alter table public.property_intelligence_cache add column address_fingerprint text
  check (address_fingerprint ~ '^[0-9a-f]{64}$');

drop function public.ds_get_property_intelligence_cache(uuid,text,text,smallint);
create function public.ds_get_property_intelligence_cache(p_property_id uuid,p_provider text,p_data_type text,p_schema_version smallint)
returns table(provider_property_id text,payload jsonb,retrieved_at timestamptz,expires_at timestamptz,address_fingerprint text)
language sql stable security definer set search_path=public,pg_temp as $$
 select c.provider_property_id,c.payload,c.retrieved_at,c.expires_at,c.address_fingerprint
 from public.property_intelligence_cache c where c.property_id=p_property_id
 and c.provider=p_provider and c.data_type=p_data_type and c.schema_version=p_schema_version and c.expires_at>now() limit 1;
$$;

-- Keep the existing validated writer backend-only; wrapper stores binding in the SAME transaction.
create function public.ds_upsert_property_intelligence_cache(
 p_property_id uuid,p_provider text,p_provider_property_id text,p_data_type text,p_schema_version smallint,
 p_payload jsonb,p_retrieved_at timestamptz,p_expires_at timestamptz,p_address_fingerprint text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare cache_id uuid;
begin
 if p_address_fingerprint is null or p_address_fingerprint !~ '^[0-9a-f]{64}$' then
  raise exception 'INVALID_ADDRESS_FINGERPRINT';
 end if;
 cache_id := public.ds_upsert_property_intelligence_cache(p_property_id,p_provider,p_provider_property_id,p_data_type,p_schema_version,p_payload,p_retrieved_at,p_expires_at);
 update public.property_intelligence_cache set address_fingerprint=p_address_fingerprint where id=cache_id;
 return cache_id;
end;
$$;
revoke all on function public.ds_get_property_intelligence_cache(uuid,text,text,smallint) from public,anon,authenticated;
revoke all on function public.ds_upsert_property_intelligence_cache(uuid,text,text,text,smallint,jsonb,timestamptz,timestamptz,text) from public,anon,authenticated;
grant execute on function public.ds_get_property_intelligence_cache(uuid,text,text,smallint) to service_role;
grant execute on function public.ds_upsert_property_intelligence_cache(uuid,text,text,text,smallint,jsonb,timestamptz,timestamptz,text) to service_role;
