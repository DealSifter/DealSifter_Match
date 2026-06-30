-- Harden global marketplace inventory.
-- Feed and MapView must only receive real published records with an explicit,
-- valid profile scope. Legacy FSBO rows are normalized by source/account type.

create or replace function public.ds_get_global_feed_inventory()
returns jsonb
language sql
security definer
set search_path = public
as $$
  with raw_property_rows as (
    select
      p.id,
      p.owner_id,
      p.type,
      p.address,
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
        else null
      end as primary_profile,
      p.video,
      p.lat,
      p.lng,
      p.geocode_status,
      p.geocode_source,
      p.geocode_confidence,
      p.geocode_input,
      p.geocoded_at,
      p.created_at,
      p.updated_at
    from public.properties p
    where coalesce(p.is_active, true) = true
      and coalesce(p.publish_to_showcase, true) = true
      and coalesce(p.deal_closed, false) = false
      and coalesce(p.source, '') <> 'demo_seed_mock'
  ),
  property_rows as (
    select *
    from raw_property_rows p
    where p.owner_id is not null
      and p.primary_profile is not null
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
        else null
      end as primary_profile,
      s.created_at,
      s.updated_at
    from public.services s
    where coalesce(s.publish_to_connections, true) = true
  ),
  service_rows as (
    select *
    from raw_service_rows s
    where s.owner_id is not null
      and s.primary_profile is not null
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
    where cs.expires_at > now()
    order by cs.expires_at desc
    limit 500
  ),
  user_rows as (
    select
      u.id,
      u.email,
      u.full_name,
      u.phone,
      u.account_type,
      u.is_admin
    from public.users u
    where exists (select 1 from owner_ids o where o.owner_id = u.id)
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
      pp.profile_payload
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

grant execute on function public.ds_get_global_feed_inventory() to authenticated;
