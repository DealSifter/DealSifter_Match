-- Phase 5E: measured search paths for Maxxis Deal AI property and service discovery.
-- Forward-only, non-destructive, and limited to authenticated sanitized DTOs.

create index if not exists idx_services_public_created
  on public.services(created_at desc, id)
  where publish_to_connections = true;

create index if not exists idx_properties_public_state_created
  on public.properties((upper(state)), created_at desc, id)
  where coalesce(is_active, true) = true
    and coalesce(publish_to_showcase, true) = true
    and coalesce(deal_closed, false) = false
    and coalesce(source, '') <> 'demo_seed_mock';

create or replace function public.ds_us_state_name(p_code text)
returns text
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select case upper(btrim(p_code))
    when 'AL' then 'alabama' when 'AK' then 'alaska' when 'AZ' then 'arizona'
    when 'AR' then 'arkansas' when 'CA' then 'california' when 'CO' then 'colorado'
    when 'CT' then 'connecticut' when 'DE' then 'delaware' when 'FL' then 'florida'
    when 'GA' then 'georgia' when 'HI' then 'hawaii' when 'ID' then 'idaho'
    when 'IL' then 'illinois' when 'IN' then 'indiana' when 'IA' then 'iowa'
    when 'KS' then 'kansas' when 'KY' then 'kentucky' when 'LA' then 'louisiana'
    when 'ME' then 'maine' when 'MD' then 'maryland' when 'MA' then 'massachusetts'
    when 'MI' then 'michigan' when 'MN' then 'minnesota' when 'MS' then 'mississippi'
    when 'MO' then 'missouri' when 'MT' then 'montana' when 'NE' then 'nebraska'
    when 'NV' then 'nevada' when 'NH' then 'new hampshire' when 'NJ' then 'new jersey'
    when 'NM' then 'new mexico' when 'NY' then 'new york' when 'NC' then 'north carolina'
    when 'ND' then 'north dakota' when 'OH' then 'ohio' when 'OK' then 'oklahoma'
    when 'OR' then 'oregon' when 'PA' then 'pennsylvania' when 'RI' then 'rhode island'
    when 'SC' then 'south carolina' when 'SD' then 'south dakota' when 'TN' then 'tennessee'
    when 'TX' then 'texas' when 'UT' then 'utah' when 'VT' then 'vermont'
    when 'VA' then 'virginia' when 'WA' then 'washington' when 'WV' then 'west virginia'
    when 'WI' then 'wisconsin' when 'WY' then 'wyoming' when 'DC' then 'district of columbia'
    else ''
  end;
$$;

alter function public.ds_us_state_name(text) owner to postgres;
revoke all on function public.ds_us_state_name(text) from public, anon, authenticated;

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
  ), ranked as (
    select
      s.id,
      s.title,
      s.category,
      s.description,
      s.price,
      s.media_images,
      s.markets,
      s.created_at,
      requested.requested_category,
      row_number() over (
        partition by coalesce(requested.requested_category, '')
        order by s.created_at desc, s.id
      ) as category_rank
    from public.services s
    cross join requested_categories requested
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
  )
  select
    ranked.id,
    ranked.title,
    ranked.category,
    ranked.description,
    ranked.price,
    ranked.media_images,
    ranked.markets,
    ranked.created_at,
    ranked.requested_category
  from ranked
  where ranked.category_rank <= least(greatest(coalesce(p_limit_per_category, 10), 1), 20)
  order by ranked.requested_category nulls first, ranked.created_at desc, ranked.id;
$$;

alter function public.ds_search_public_services(text[], text, text, text, numeric, numeric, integer) owner to postgres;
revoke all on function public.ds_search_public_services(text[], text, text, text, numeric, numeric, integer) from public, anon;
grant execute on function public.ds_search_public_services(text[], text, text, text, numeric, numeric, integer) to authenticated, service_role;

comment on function public.ds_search_public_services(text[], text, text, text, numeric, numeric, integer) is
  'Authenticated, bounded and batched published-service discovery for Maxxis Deal AI. Returns only the existing public service DTO plus the requested category used for grouping.';
