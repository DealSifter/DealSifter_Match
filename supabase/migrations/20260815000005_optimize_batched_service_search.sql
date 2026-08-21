-- Phase 5E follow-up: let each requested category stop on the measured
-- partial created_at index instead of ranking the complete published set.

create or replace function public.ds_search_public_services(
  p_categories text[] default null,
  p_state text default null,
  p_city text default null,
  p_keyword text default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_limit_per_category integer default 10
)
returns table (
  id uuid,
  title text,
  category text,
  description text,
  price numeric,
  media_images text[],
  markets text[],
  created_at timestamptz,
  matched_category text
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with requested_categories as (
    select distinct nullif(btrim(requested.value), '') as requested_category
    from unnest(
      case
        when p_categories is null or cardinality(p_categories) = 0
          then array[null::text]
        else p_categories[1:10]
      end
    ) as requested(value)
  )
  select
    service.id,
    service.title,
    service.category,
    service.description,
    service.price,
    service.media_images,
    service.markets,
    service.created_at,
    requested.requested_category
  from requested_categories requested
  cross join lateral (
    select
      s.id,
      s.title,
      s.category,
      s.description,
      s.price,
      s.media_images,
      s.markets,
      s.created_at
    from public.services s
    where (
        auth.uid() is not null
        or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
      )
      and s.publish_to_connections = true
      and (
        requested.requested_category is null
        or s.category ilike '%' || requested.requested_category || '%'
      )
      and (
        nullif(btrim(p_state), '') is null
        or exists (
          select 1
          from unnest(coalesce(s.markets, array[]::text[])) market(value)
          where lower(btrim(market.value)) = lower(btrim(p_state))
             or lower(btrim(market.value)) = public.ds_us_state_name(p_state)
             or lower(btrim(p_state)) = any(
               regexp_split_to_array(lower(market.value), '[^a-z]+')
             )
        )
      )
      and (
        nullif(btrim(p_city), '') is null
        or exists (
          select 1
          from unnest(coalesce(s.markets, array[]::text[])) market(value)
          where market.value ilike '%' || btrim(p_city) || '%'
        )
      )
      and (
        nullif(btrim(p_keyword), '') is null
        or s.title ilike '%' || btrim(p_keyword) || '%'
        or s.category ilike '%' || btrim(p_keyword) || '%'
        or s.description ilike '%' || btrim(p_keyword) || '%'
      )
      and (p_min_price is null or s.price >= p_min_price)
      and (p_max_price is null or s.price <= p_max_price)
    order by s.created_at desc, s.id
    limit least(greatest(coalesce(p_limit_per_category, 10), 1), 20)
  ) service
  order by requested.requested_category nulls first, service.created_at desc, service.id;
$$;

alter function public.ds_search_public_services(text[], text, text, text, numeric, numeric, integer) owner to postgres;
revoke all on function public.ds_search_public_services(text[], text, text, text, numeric, numeric, integer) from public, anon;
grant execute on function public.ds_search_public_services(text[], text, text, text, numeric, numeric, integer) to authenticated, service_role;
