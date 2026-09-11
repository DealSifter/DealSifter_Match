create table if not exists public.property_intelligence_cache (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  provider text not null,
  provider_property_id text null,
  data_type text not null,
  schema_version smallint not null default 1,
  payload jsonb not null,
  retrieved_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_intelligence_cache_provider_check check (provider in ('rentcast')),
  constraint property_intelligence_cache_data_type_check check (data_type in ('property_record')),
  constraint property_intelligence_cache_schema_version_check check (schema_version > 0),
  constraint property_intelligence_cache_payload_check check (jsonb_typeof(payload) = 'object'),
  constraint property_intelligence_cache_expiry_check check (expires_at > retrieved_at),
  constraint property_intelligence_cache_key_unique unique (property_id, provider, data_type)
);

alter table public.property_intelligence_cache enable row level security;

create index if not exists idx_property_intelligence_cache_expiry
  on public.property_intelligence_cache(expires_at);

do $$
begin
  if not exists (
    select 1
      from pg_trigger
     where tgrelid = 'public.property_intelligence_cache'::regclass
       and tgname = 'trg_property_intelligence_cache_updated_at'
       and not tgisinternal
  ) then
    create trigger trg_property_intelligence_cache_updated_at
    before update on public.property_intelligence_cache
    for each row execute function public.set_updated_at();
  end if;
end;
$$;

comment on table public.property_intelligence_cache is
  'Backend-only cache of validated, normalized property evidence. Never stores provider credentials, request headers, or raw provider responses.';

create or replace function public.ds_get_property_intelligence_cache(
  p_property_id uuid,
  p_provider text,
  p_data_type text,
  p_schema_version smallint
)
returns table (
  provider_property_id text,
  payload jsonb,
  retrieved_at timestamptz,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.provider_property_id, c.payload, c.retrieved_at, c.expires_at
    from public.property_intelligence_cache c
   where c.property_id = p_property_id
     and c.provider = p_provider
     and c.data_type = p_data_type
     and c.schema_version = p_schema_version
     and c.expires_at > now()
   limit 1;
$$;

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
     or p_data_type <> 'property_record'
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

revoke all on public.property_intelligence_cache from anon, authenticated;
revoke all on function public.ds_get_property_intelligence_cache(uuid, text, text, smallint) from public, anon, authenticated;
revoke all on function public.ds_upsert_property_intelligence_cache(uuid, text, text, text, smallint, jsonb, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.ds_get_property_intelligence_cache(uuid, text, text, smallint) to service_role;
grant execute on function public.ds_upsert_property_intelligence_cache(uuid, text, text, text, smallint, jsonb, timestamptz, timestamptz) to service_role;
