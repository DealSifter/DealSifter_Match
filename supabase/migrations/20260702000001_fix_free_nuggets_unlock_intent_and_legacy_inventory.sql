-- Production regression fixes:
-- 1) Free users must start with 3 nuggets.
-- 2) Unlock intent RPC must qualify unlock_intents.expires_at to avoid PL/pgSQL
--    ambiguity with the returned expires_at column.
-- 3) Global inventory must not drop legacy published records that predate
--    primary_profile/profile_payload hardening.

alter table public.users
  alter column nuggets set default 3;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, nuggets, plan_id, deleted_at, deletion_id)
  values (
    new.id,
    nullif(new.email, ''),
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), nullif(new.raw_user_meta_data->>'name', ''), ''),
    3,
    'free',
    null,
    null
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(nullif(excluded.full_name, ''), public.users.full_name),
      deleted_at = null,
      deletion_id = null,
      updated_at = now()
  where public.users.deleted_at is null;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Conservative repair for free accounts created during the broken window:
-- only users with zero balance and no financial/unlock history are granted the
-- missing starter balance.
update public.users u
set nuggets = 3,
    updated_at = now()
where coalesce(nullif(lower(trim(u.plan_id)), ''), 'free') = 'free'
  and coalesce(u.nuggets, 0) = 0
  and not exists (select 1 from public.nugget_purchases np where np.user_id = u.id)
  and not exists (select 1 from public.unlocks ul where ul.buyer_id = u.id)
  and not exists (select 1 from public.property_unlocks pu where pu.buyer_id = u.id);

create or replace function public.ds_create_unlock_intent(
  p_seller_id uuid default null,
  p_property_id uuid default null,
  p_mode text default 'normal',
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  intent_token uuid,
  seller_id uuid,
  property_id uuid,
  scope text,
  mode text,
  base_cost integer,
  exclusivity_cost integer,
  total_cost integer,
  normal_unlock_count integer,
  expires_at timestamptz,
  blocked boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer_id uuid := auth.uid();
  v_seller_id uuid := p_seller_id;
  v_property_id uuid := p_property_id;
  v_scope text := case when p_property_id is null then 'contact' else 'property' end;
  v_mode text := lower(trim(coalesce(p_mode, 'normal')));
  v_base_cost integer := 1;
  v_exclusivity_cost integer := 0;
  v_total_cost integer := 1;
  v_normal_count integer := 0;
  v_active_exclusive_id uuid;
  v_token uuid;
  v_expires_at timestamptz := now() + interval '5 minutes';
begin
  if v_buyer_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if v_mode not in ('normal', 'total', 'partial') then
    raise exception 'invalid unlock mode' using errcode = '22023';
  end if;

  if p_metadata is not null
     and (
       octet_length(p_metadata::text) > 1024
       or public.ds_redact_inline_media_jsonb(p_metadata) <> p_metadata
     ) then
    raise exception 'metadata too large or unsafe' using errcode = '22023';
  end if;

  if v_property_id is not null then
    select p.owner_id
      into v_seller_id
    from public.properties p
    where p.id = v_property_id
      and p.is_active = true
      and coalesce(p.deal_closed, false) = false;

    if v_seller_id is null then
      raise exception 'property not available for unlock' using errcode = 'P0002';
    end if;
  end if;

  if v_seller_id is null then
    raise exception 'seller required' using errcode = '22023';
  end if;

  if v_seller_id = v_buyer_id then
    raise exception 'cannot unlock own contact' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('contact-unlock-intent:' || v_buyer_id::text || ':' || v_seller_id::text));

  if v_property_id is not null then
    perform public.ds_prune_property_unlocks();

    select count(*)
      into v_normal_count
    from public.property_unlocks pu
    where pu.property_id = v_property_id
      and pu.mode = 'normal';

    select pu.id
      into v_active_exclusive_id
    from public.property_unlocks pu
    where pu.property_id = v_property_id
      and pu.mode in ('total', 'partial')
      and pu.status = 'active'
      and pu.expires_at > now()
    order by pu.created_at desc
    limit 1;

    if v_active_exclusive_id is not null then
      raise exception 'property is under active exclusivity' using errcode = '55000';
    end if;
  end if;

  select greatest(1, (
    (select count(*)::integer
     from public.properties p
     where p.owner_id = v_seller_id
       and coalesce(p.is_active, true) = true
       and coalesce(p.publish_to_showcase, true) = true
       and coalesce(p.deal_closed, false) = false)
    +
    (select count(*)::integer
     from public.services s
     where s.owner_id = v_seller_id
       and coalesce(s.publish_to_connections, true) = true)
  ))
  into v_base_cost;

  if v_mode = 'total' then
    if v_property_id is null then
      raise exception 'property required for exclusivity' using errcode = '22023';
    end if;
    if v_normal_count <> 0 then
      raise exception 'total exclusivity requires zero previous normal unlocks' using errcode = '55000';
    end if;
    v_exclusivity_cost := 20;
  elsif v_mode = 'partial' then
    if v_property_id is null then
      raise exception 'property required for exclusivity' using errcode = '22023';
    end if;
    if v_normal_count < 1 or v_normal_count > 2 then
      raise exception 'partial exclusivity requires one or two previous normal unlocks' using errcode = '55000';
    end if;
    v_exclusivity_cost := 18;
  end if;

  v_total_cost := v_base_cost + v_exclusivity_cost;

  update public.unlock_intents ui
  set status = 'expired'
  where ui.buyer_id = v_buyer_id
    and ui.status = 'pending'
    and ui.expires_at <= now();

  insert into public.unlock_intents(
    buyer_id,
    seller_id,
    property_id,
    scope,
    mode,
    base_cost,
    exclusivity_cost,
    total_cost,
    normal_unlock_count,
    expires_at,
    metadata
  )
  values (
    v_buyer_id,
    v_seller_id,
    v_property_id,
    v_scope,
    v_mode,
    v_base_cost,
    v_exclusivity_cost,
    v_total_cost,
    v_normal_count,
    v_expires_at,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_token;

  return query
  select
    v_token,
    v_seller_id,
    v_property_id,
    v_scope,
    v_mode,
    v_base_cost,
    v_exclusivity_cost,
    v_total_cost,
    v_normal_count,
    v_expires_at,
    false;
end;
$$;

grant execute on function public.ds_create_unlock_intent(uuid, uuid, text, jsonb) to authenticated;

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
        else 'personal'
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
    where coalesce(s.publish_to_connections, true) = true
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
      and coalesce(u.deleted_at is null, true)
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
