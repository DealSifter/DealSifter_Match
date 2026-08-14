-- Sanitized property access for authenticated discovery consumers such as Maxxis.
-- Base-table RLS remains owner-only; these narrowly scoped RPCs return public DTOs.

create or replace function public.ds_sanitize_public_property_text(p_value text)
returns text
language sql
immutable
strict
set search_path = pg_catalog, public
as $$
  select regexp_replace(
    regexp_replace(
      regexp_replace(
        p_value,
        'https?://[^[:space:]]+',
        '[redacted]',
        'gi'
      ),
      '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}',
      '[redacted]',
      'gi'
    ),
    '(\+?[0-9][0-9(). -]{7,}[0-9])',
    '[redacted]',
    'g'
  );
$$;

alter function public.ds_sanitize_public_property_text(text) owner to postgres;
revoke all on function public.ds_sanitize_public_property_text(text) from public, anon, authenticated;

create or replace function public.ds_get_public_property_details(p_property_id uuid)
returns table (
  id uuid,
  type text,
  city text,
  state text,
  zip text,
  price numeric,
  beds integer,
  baths integer,
  sqft text,
  improvement text,
  lot text,
  deal_tag text,
  objective text,
  rehab numeric,
  cap_rate numeric,
  description text,
  markets text[],
  is_active boolean,
  publish_to_showcase boolean,
  deal_closed boolean,
  images text[]
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    p.id,
    p.type,
    p.city,
    p.state,
    p.zip,
    p.price,
    p.beds,
    p.baths,
    p.sqft,
    public.ds_sanitize_public_property_text(coalesce(p.improvement, '')),
    public.ds_sanitize_public_property_text(coalesce(p.lot, '')),
    public.ds_sanitize_public_property_text(coalesce(p.deal_tag, '')),
    public.ds_sanitize_public_property_text(coalesce(p.objective, '')),
    p.rehab,
    p.cap_rate,
    public.ds_sanitize_public_property_text(coalesce(p.description, '')),
    p.markets,
    p.is_active,
    p.publish_to_showcase,
    coalesce(p.deal_closed, false),
    coalesce((
      select array_agg(public_image.image_url order by public_image.sort_order, public_image.id)
      from (
        select pi.id, pi.image_url, pi.sort_order
        from public.property_images pi
        where pi.property_id = p.id
          and pi.image_url ~ '^https://'
          and pi.image_url !~* '/storage/v1/object/sign/'
          and pi.image_url !~* '[?&](token|signature|sig|expires|x-amz-|x-goog-)='
        order by pi.sort_order, pi.id
        limit 12
      ) public_image
    ), array[]::text[])
  from public.properties p
  where (
      auth.uid() is not null
      or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    )
    and p.id = p_property_id
    and coalesce(p.is_active, true) = true
    and coalesce(p.publish_to_showcase, true) = true
    and coalesce(p.deal_closed, false) = false
    and coalesce(p.source, '') <> 'demo_seed_mock';
$$;

alter function public.ds_get_public_property_details(uuid) owner to postgres;
revoke all on function public.ds_get_public_property_details(uuid) from public, anon;
grant execute on function public.ds_get_public_property_details(uuid) to authenticated, service_role;

create or replace function public.ds_search_public_properties(
  p_state text[] default null,
  p_city text default null,
  p_zip_code text default null,
  p_property_type text default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_bedrooms integer default null,
  p_bathrooms integer default null,
  p_objective text default null,
  p_property_ids uuid[] default null,
  p_limit integer default 10
)
returns table (
  id uuid,
  type text,
  city text,
  state text,
  zip text,
  price numeric,
  beds integer,
  baths integer,
  sqft text,
  objective text,
  image text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    p.id,
    p.type,
    p.city,
    p.state,
    p.zip,
    p.price,
    p.beds,
    p.baths,
    p.sqft,
    public.ds_sanitize_public_property_text(coalesce(p.objective, '')),
    coalesce((
      select pi.image_url
      from public.property_images pi
      where pi.property_id = p.id
        and pi.image_url ~ '^https://'
        and pi.image_url !~* '/storage/v1/object/sign/'
        and pi.image_url !~* '[?&](token|signature|sig|expires|x-amz-|x-goog-)='
      order by pi.sort_order, pi.id
      limit 1
    ), ''),
    p.created_at
  from public.properties p
  where (
      auth.uid() is not null
      or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    )
    and coalesce(p.is_active, true) = true
    and coalesce(p.publish_to_showcase, true) = true
    and coalesce(p.deal_closed, false) = false
    and coalesce(p.source, '') <> 'demo_seed_mock'
    and (p_state is null or cardinality(p_state) = 0 or upper(p.state) = any(p_state))
    and (nullif(btrim(p_city), '') is null or p.city ilike '%' || btrim(p_city) || '%')
    and (nullif(btrim(p_zip_code), '') is null or p.zip ilike btrim(p_zip_code) || '%')
    and (nullif(btrim(p_property_type), '') is null or p.type ilike '%' || btrim(p_property_type) || '%')
    and (p_min_price is null or p.price >= p_min_price)
    and (p_max_price is null or p.price <= p_max_price)
    and (p_bedrooms is null or p.beds >= p_bedrooms)
    and (p_bathrooms is null or p.baths >= p_bathrooms)
    and (nullif(btrim(p_objective), '') is null or p.objective ilike '%' || btrim(p_objective) || '%')
    and (p_property_ids is null or cardinality(p_property_ids) = 0 or p.id = any(p_property_ids))
  order by p.created_at desc
  limit least(greatest(coalesce(p_limit, 10), 1), 100);
$$;

alter function public.ds_search_public_properties(text[], text, text, text, numeric, numeric, integer, integer, text, uuid[], integer) owner to postgres;
revoke all on function public.ds_search_public_properties(text[], text, text, text, numeric, numeric, integer, integer, text, uuid[], integer) from public, anon;
grant execute on function public.ds_search_public_properties(text[], text, text, text, numeric, numeric, integer, integer, text, uuid[], integer) to authenticated, service_role;

comment on function public.ds_get_public_property_details(uuid) is
  'Authenticated sanitized lookup for one active, published, open property. Omits ownership, contact, address, exact geolocation, entitlement, and administrative fields.';

comment on function public.ds_search_public_properties(text[], text, text, text, numeric, numeric, integer, integer, text, uuid[], integer) is
  'Authenticated filtered discovery for active, published, open properties. Returns only the minimal Maxxis search DTO and one public image.';
