-- Global feed privacy boundary.
--
-- Public discovery data is returned only by ds_get_global_feed_inventory().
-- Contact details remain available exclusively through entitlement-aware RPCs
-- such as ds_get_unlocked_contact_cards(). Base-table owner policies remain in
-- place so users can continue reading and editing their own records.

create or replace function public.ds_sanitize_public_feed_jsonb(p_value jsonb)
returns jsonb
language plpgsql
immutable
strict
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  case jsonb_typeof(p_value)
    when 'object' then
      select coalesce(
        jsonb_object_agg(entry.key, public.ds_sanitize_public_feed_jsonb(entry.value)),
        '{}'::jsonb
      )
      into v_result
      from jsonb_each(p_value) entry
      where lower(entry.key) !~ '(email|phone|mobile|cellphone|whatsapp|contact|telegram|signal|facetime|skype|wechat|linkedin|instagram|facebook|twitter|website|street|address)';

      return v_result;
    when 'array' then
      select coalesce(
        jsonb_agg(public.ds_sanitize_public_feed_jsonb(item.value) order by item.ordinality),
        '[]'::jsonb
      )
      into v_result
      from jsonb_array_elements(p_value) with ordinality item(value, ordinality);

      return v_result;
    else
      return p_value;
  end case;
end;
$$;

revoke all on function public.ds_sanitize_public_feed_jsonb(jsonb) from public, anon, authenticated;

create or replace function public.ds_get_global_feed_inventory()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with request_context as (
    select (
      auth.uid() is not null
      or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    ) as is_allowed
  ),
  raw_property_rows as (
    select
      p.id,
      p.owner_id,
      p.type,
      case when p.hide_street_address_on_card then null else p.address end as address,
      p.city,
      p.state,
      p.zip,
      p.price,
      p.beds,
      p.baths,
      p.sqft,
      p.improvement,
      p.lot,
      p.deal_tag,
      p.objective,
      p.rehab,
      p.cap_rate,
      p.description,
      p.markets,
      p.is_active,
      p.deal_closed,
      p.pending_deal,
      p.pending_deal_started_at,
      p.pending_deal_expires_at,
      p.publish_to_showcase,
      p.include_in_preview,
      p.source,
      p.owner_account_type,
      case
        when lower(coalesce(p.source, '')) = 'fsbo'
          or lower(coalesce(p.owner_account_type, '')) = 'fsbo_owner'
          then 'fsbo'
        when lower(trim(coalesce(p.primary_profile, ''))) in ('personal', 'professional', 'fsbo')
          then lower(trim(p.primary_profile))
        else 'personal'
      end as primary_profile,
      p.video,
      case when p.hide_street_address_on_card then null else p.lat end as lat,
      case when p.hide_street_address_on_card then null else p.lng end as lng,
      p.geocode_status,
      p.geocode_source,
      p.geocode_confidence,
      null::text as geocode_input,
      p.geocoded_at,
      p.hide_street_address_on_card,
      p.created_at,
      p.updated_at
    from public.properties p
    cross join request_context rc
    where rc.is_allowed
      and coalesce(p.is_active, true) = true
      and coalesce(p.publish_to_showcase, true) = true
      and coalesce(p.deal_closed, false) = false
      and coalesce(p.source, '') <> 'demo_seed_mock'
  ),
  property_rows as (
    select *
    from raw_property_rows p
    where p.owner_id is not null
    order by p.created_at desc
    limit 250
  ),
  raw_service_rows as (
    select
      s.id,
      s.owner_id,
      s.title,
      s.category,
      s.description,
      s.price,
      s.media_images,
      s.publish_to_connections,
      s.markets,
      case
        when lower(trim(coalesce(s.primary_profile, ''))) in ('personal', 'professional', 'fsbo')
          then lower(trim(s.primary_profile))
        else 'professional'
      end as primary_profile,
      s.created_at,
      s.updated_at
    from public.services s
    cross join request_context rc
    where rc.is_allowed
      and coalesce(s.publish_to_connections, true) = true
  ),
  service_rows as (
    select *
    from raw_service_rows s
    where s.owner_id is not null
    order by s.created_at desc
    limit 250
  ),
  owner_ids as (
    select owner_id from property_rows
    union
    select owner_id from service_rows
  ),
  image_rows as (
    select
      pi.property_id,
      pi.image_url,
      pi.sort_order
    from public.property_images pi
    where exists (
      select 1 from property_rows p where p.id = pi.property_id
    )
    order by pi.sort_order asc
  ),
  spotlight_rows as (
    select
      cs.id,
      cs.user_id,
      cs.owner_id,
      cs.card_kind,
      cs.card_id,
      cs.scope,
      cs.starts_at,
      cs.expires_at,
      cs.nuggets_spent
    from public.card_spotlights cs
    cross join request_context rc
    where rc.is_allowed
      and cs.expires_at > now()
    order by cs.expires_at desc
    limit 500
  ),
  user_rows as (
    select
      u.id,
      u.full_name,
      u.account_type
    from public.users u
    where exists (select 1 from owner_ids o where o.owner_id = u.id)
      and u.deleted_at is null
  ),
  personal_rows as (
    select
      up.user_id,
      up.full_name,
      up.photo_url,
      up.bio,
      up.visibility
    from public.user_profiles up
    where exists (select 1 from owner_ids o where o.owner_id = up.user_id)
  ),
  professional_rows as (
    select
      pp.user_id,
      pp.category,
      pp.subcategory,
      pp.markets,
      pp.skills,
      pp.services,
      pp.pitch,
      pp.primary_category,
      pp.category_b,
      pp.primary_category_b,
      pp.photo_b_url,
      public.ds_sanitize_public_feed_jsonb(coalesce(pp.profile_payload, '{}'::jsonb)) as profile_payload
    from public.professional_profiles pp
    where exists (select 1 from owner_ids o where o.owner_id = pp.user_id)
  )
  select jsonb_build_object(
    'properties', coalesce((select jsonb_agg(to_jsonb(property_rows)) from property_rows), '[]'::jsonb),
    'services', coalesce((select jsonb_agg(to_jsonb(service_rows)) from service_rows), '[]'::jsonb),
    'propertyImages', coalesce((select jsonb_agg(to_jsonb(image_rows)) from image_rows), '[]'::jsonb),
    'spotlights', coalesce((select jsonb_agg(to_jsonb(spotlight_rows)) from spotlight_rows), '[]'::jsonb),
    'users', coalesce((select jsonb_agg(to_jsonb(user_rows)) from user_rows), '[]'::jsonb),
    'personalProfiles', coalesce((select jsonb_agg(to_jsonb(personal_rows)) from personal_rows), '[]'::jsonb),
    'professionalProfiles', coalesce((select jsonb_agg(to_jsonb(professional_rows)) from professional_rows), '[]'::jsonb)
  );
$$;

revoke all on function public.ds_get_global_feed_inventory() from public, anon;
grant execute on function public.ds_get_global_feed_inventory() to authenticated, service_role;

-- Discovery through sensitive base tables bypasses field-level privacy because
-- RLS filters rows, not columns. Owners retain their original *_select_own
-- policies; global discovery now goes exclusively through the sanitized RPC.
drop policy if exists properties_select_showcase on public.properties;
drop policy if exists users_select_showcase on public.users;
drop policy if exists professional_profile_select_showcase on public.professional_profiles;

comment on function public.ds_get_global_feed_inventory() is
  'Authenticated global discovery DTO. Excludes locked contact data and suppresses exact address/geolocation when card privacy is enabled.';

comment on function public.ds_sanitize_public_feed_jsonb(jsonb) is
  'Recursively removes contact and exact-address fields from profile JSON before global feed delivery.';

-- Rollback intentionally requires restoring the previous RPC definition and
-- showcase policies from their originating migrations. Do not use a permissive
-- rollback in production because it would reintroduce the privacy exposure.
