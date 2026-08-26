-- Phase 5E: build only the active, parameterized property predicates so the
-- planner can use measured partial indexes instead of a generic optional-filter plan.

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
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_sql text := $query$
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
  $query$;
begin
  if p_state is not null and cardinality(p_state) > 0 then
    v_sql := v_sql || ' and upper(p.state) = any($1)';
  end if;
  if nullif(btrim(p_city), '') is not null then
    v_sql := v_sql || ' and p.city ilike ''%'' || btrim($2) || ''%''';
  end if;
  if nullif(btrim(p_zip_code), '') is not null then
    v_sql := v_sql || ' and p.zip ilike btrim($3) || ''%''';
  end if;
  if nullif(btrim(p_property_type), '') is not null then
    v_sql := v_sql || ' and p.type ilike ''%'' || btrim($4) || ''%''';
  end if;
  if p_min_price is not null then
    v_sql := v_sql || ' and p.price >= $5';
  end if;
  if p_max_price is not null then
    v_sql := v_sql || ' and p.price <= $6';
  end if;
  if p_bedrooms is not null then
    v_sql := v_sql || ' and p.beds >= $7';
  end if;
  if p_bathrooms is not null then
    v_sql := v_sql || ' and p.baths >= $8';
  end if;
  if nullif(btrim(p_objective), '') is not null then
    v_sql := v_sql || ' and p.objective ilike ''%'' || btrim($9) || ''%''';
  end if;
  if p_property_ids is not null and cardinality(p_property_ids) > 0 then
    v_sql := v_sql || ' and p.id = any($10)';
  end if;
  v_sql := v_sql || ' order by p.created_at desc limit least(greatest(coalesce($11, 10), 1), 100)';

  return query execute v_sql using
    p_state,
    p_city,
    p_zip_code,
    p_property_type,
    p_min_price,
    p_max_price,
    p_bedrooms,
    p_bathrooms,
    p_objective,
    p_property_ids,
    p_limit;
end;
$$;

alter function public.ds_search_public_properties(text[], text, text, text, numeric, numeric, integer, integer, text, uuid[], integer) owner to postgres;
revoke all on function public.ds_search_public_properties(text[], text, text, text, numeric, numeric, integer, integer, text, uuid[], integer) from public, anon;
grant execute on function public.ds_search_public_properties(text[], text, text, text, numeric, numeric, integer, integer, text, uuid[], integer) to authenticated, service_role;

comment on function public.ds_search_public_properties(text[], text, text, text, numeric, numeric, integer, integer, text, uuid[], integer) is
  'Authenticated filtered discovery for active, published, open properties. Uses parameterized active predicates and returns only the minimal Maxxis Deal AI search DTO plus one public image.';
