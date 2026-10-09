-- Separate backend-only retained reader. Existing fresh reader and TTLs unchanged.
create or replace function public.ds_get_retained_property_intelligence_cache(
  p_property_id uuid, p_provider text, p_data_type text, p_schema_version smallint
) returns table(provider_property_id text, payload jsonb, retrieved_at timestamptz,
  expires_at timestamptz, address_fingerprint text)
language sql stable security definer set search_path = public, pg_temp as $$
  select c.provider_property_id, c.payload, c.retrieved_at, c.expires_at, c.address_fingerprint
  from public.property_intelligence_cache c
  where c.property_id = p_property_id and c.provider = p_provider
    and c.data_type = p_data_type and c.schema_version = p_schema_version
  limit 1;
$$;
revoke all on function public.ds_get_retained_property_intelligence_cache(uuid,text,text,smallint) from public, anon, authenticated;
grant execute on function public.ds_get_retained_property_intelligence_cache(uuid,text,text,smallint) to service_role;
