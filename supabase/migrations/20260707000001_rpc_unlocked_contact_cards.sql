-- Canonical unlocked-contact entitlement payload.
-- This RPC is the backend source of truth for contacts a user may see after
-- direct contact unlocks, property unlocks, exclusive unlocks, and reciprocal
-- exclusive visibility.

create or replace function public.ds_get_unlocked_contact_cards(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := p_user_id;
  v_is_service_role boolean := coalesce((auth.jwt() ->> 'role') = 'service_role', false);
  v_result jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication required'
      using errcode = '28000';
  end if;

  -- Security boundary for frontend RPC calls. The function runs as definer so
  -- it can assemble profile/contact data across tables, but callers may only
  -- request their own unlock graph unless they are service_role.
  if not v_is_service_role and v_user_id is distinct from auth.uid() then
    raise exception 'unauthorized'
      using errcode = '28000';
  end if;

  with unlock_sources as (
    select
      u.seller_id as owner_id,
      'contact'::text as unlock_scope,
      u.created_at as unlocked_at,
      null::uuid as unlocked_property_id,
      null::text as property_mode,
      null::timestamptz as exclusive_expires_at,
      true as contact_access
    from public.unlocks u
    where u.buyer_id = v_user_id
      and u.seller_id is distinct from v_user_id

    union all

    select
      pu.owner_id as owner_id,
      case
        when pu.mode in ('total', 'partial') then 'exclusive'
        else 'property'
      end as unlock_scope,
      pu.created_at as unlocked_at,
      pu.property_id as unlocked_property_id,
      pu.mode as property_mode,
      case when pu.mode in ('total', 'partial') then pu.expires_at else null end as exclusive_expires_at,
      true as contact_access
    from public.property_unlocks pu
    where pu.buyer_id = v_user_id
      and pu.owner_id is distinct from v_user_id
      and coalesce(pu.status, 'active') = 'active'
      and (pu.mode = 'normal' or coalesce(pu.expires_at, now()) > now())

    union all

    select
      pu.buyer_id as owner_id,
      'reciprocal'::text as unlock_scope,
      pu.created_at as unlocked_at,
      pu.property_id as unlocked_property_id,
      pu.mode as property_mode,
      pu.expires_at as exclusive_expires_at,
      true as contact_access
    from public.property_unlocks pu
    where pu.owner_id = v_user_id
      and pu.buyer_id is distinct from v_user_id
      and pu.mode in ('total', 'partial')
      and coalesce(pu.status, 'active') = 'active'
      and pu.expires_at > now()
  ),
  owner_rollup as (
    select
      us.owner_id,
      (array_agg(us.unlock_scope order by
        case us.unlock_scope
          when 'exclusive' then 1
          when 'property' then 2
          when 'contact' then 3
          when 'reciprocal' then 4
          else 5
        end,
        us.unlocked_at desc
      ))[1] as unlock_scope,
      max(us.unlocked_at) as unlocked_at,
      max(us.exclusive_expires_at) filter (where us.exclusive_expires_at is not null) as exclusive_expires_at,
      bool_or(us.contact_access) as has_contact_access,
      coalesce(
        jsonb_agg(distinct to_jsonb(us.unlocked_property_id)) filter (where us.unlocked_property_id is not null),
        '[]'::jsonb
      ) as unlocked_property_ids
    from unlock_sources us
    where us.owner_id is not null
    group by us.owner_id
  ),
  owner_status as (
    select
      o.*,
      exists (
        select 1
        from public.property_unlocks mine
        where mine.owner_id = o.owner_id
          and mine.buyer_id = v_user_id
          and mine.mode in ('total', 'partial')
          and coalesce(mine.status, 'active') = 'active'
          and mine.expires_at > now()
      ) as has_active_mine,
      exists (
        select 1
        from public.property_unlocks other
        where other.owner_id = o.owner_id
          and other.buyer_id is distinct from v_user_id
          and other.mode in ('total', 'partial')
          and coalesce(other.status, 'active') = 'active'
          and other.expires_at > now()
      ) as has_active_other
    from owner_rollup o
  ),
  scoped_owners as (
    select
      os.*,
      coalesce(
        nullif(unlocked_property.primary_profile, ''),
        nullif(latest_service.primary_profile, ''),
        nullif(latest_property.primary_profile, ''),
        'personal'
      ) as raw_primary_profile
    from owner_status os
    left join public.properties unlocked_property
      on unlocked_property.id = (
        select (jsonb_array_elements_text(os.unlocked_property_ids))::uuid
        limit 1
      )
    left join lateral (
      select s.primary_profile
      from public.services s
      where s.owner_id = os.owner_id
        and coalesce(s.publish_to_connections, true) = true
      order by s.updated_at desc nulls last, s.created_at desc
      limit 1
    ) latest_service on true
    left join lateral (
      select p.primary_profile
      from public.properties p
      where p.owner_id = os.owner_id
        and coalesce(p.publish_to_showcase, true) = true
      order by p.updated_at desc nulls last, p.created_at desc
      limit 1
    ) latest_property on true
  ),
  profile_source as (
    select
      so.*,
      case
        when lower(trim(coalesce(so.raw_primary_profile, ''))) in ('personal', 'professional', 'fsbo')
          then lower(trim(so.raw_primary_profile))
        else 'personal'
      end as primary_profile,
      case
        when so.has_active_mine then 'active_mine'
        when so.has_active_other then 'active_other'
        else 'none'
      end as exclusive_status,
      (so.has_contact_access and not (so.has_active_other and not so.has_active_mine)) as can_show_sensitive_contact,
      usr.email as account_email,
      usr.full_name as account_name,
      usr.phone as account_phone,
      usr.settings_payload,
      up.full_name as user_profile_name,
      up.photo_url as user_profile_photo,
      pp.category,
      pp.subcategory,
      pp.primary_category,
      pp.category_b,
      pp.primary_category_b,
      pp.photo_b_url,
      pp.profile_payload,
      coalesce(pp.profile_payload->'resolved', '{}'::jsonb) as resolved_profiles
    from scoped_owners so
    join public.users usr on usr.id = so.owner_id
    left join public.user_profiles up on up.user_id = so.owner_id
    left join public.professional_profiles pp on pp.user_id = so.owner_id
  ),
  selected_profile as (
    select
      ps.*,
      coalesce(
        nullif(ps.resolved_profiles -> ps.primary_profile, '{}'::jsonb),
        nullif(ps.resolved_profiles -> 'personal', '{}'::jsonb),
        nullif(ps.resolved_profiles -> 'professional', '{}'::jsonb),
        '{}'::jsonb
      ) as resolved_profile
    from profile_source ps
  ),
  cleaned_profile as (
    select
      sp.*,
      case
        when lower(coalesce(nullif(sp.resolved_profile->>'name', ''), '')) in ('d4$', 'drive4$') then null
        else nullif(sp.resolved_profile->>'name', '')
      end as safe_profile_name
    from selected_profile sp
  ),
  owner_cards as (
    select
      cp.owner_id,
      cp.primary_profile,
      cp.unlock_scope,
      cp.unlocked_at,
      cp.exclusive_expires_at,
      cp.unlocked_property_ids,
      cp.exclusive_status,
      cp.can_show_sensitive_contact,
      cp.resolved_profile,
      cp.account_email,
      cp.account_name,
      cp.account_phone,
      cp.settings_payload,
      cp.user_profile_name,
      cp.user_profile_photo,
      cp.category,
      cp.subcategory,
      cp.primary_category,
      cp.category_b,
      cp.primary_category_b,
      cp.photo_b_url,
      cp.safe_profile_name,
      jsonb_build_object(
        'name', coalesce(
          cp.safe_profile_name,
          nullif(cp.user_profile_name, ''),
          nullif(cp.account_name, ''),
          'Unlocked contact'
        ),
        'avatar_url', coalesce(
          nullif(cp.resolved_profile->>'photo', ''),
          case when cp.primary_profile = 'professional' then nullif(cp.photo_b_url, '') else null end,
          nullif(cp.user_profile_photo, ''),
          ''
        ),
        'category', coalesce(
          nullif(cp.resolved_profile->>'categoryLabelFallback', ''),
          nullif(cp.resolved_profile->>'category', ''),
          case when cp.primary_profile = 'professional' then nullif(cp.primary_category_b, '') else null end,
          case when cp.primary_profile = 'professional' then nullif(cp.category_b, '') else null end,
          nullif(cp.primary_category, ''),
          nullif(cp.category, ''),
          ''
        ),
        'location', coalesce(nullif(cp.resolved_profile->>'loc', ''), ''),
        'email', case when cp.can_show_sensitive_contact then coalesce(
          nullif(cp.resolved_profile->>'email', ''),
          nullif(cp.settings_payload #>> '{systemAccount,email}', ''),
          nullif(cp.account_email, '')
        ) else null end,
        'phone_primary', case when cp.can_show_sensitive_contact then coalesce(
          nullif(cp.resolved_profile->>'primaryPhone', ''),
          nullif(cp.settings_payload #>> '{systemAccount,phone}', ''),
          nullif(cp.account_phone, '')
        ) else null end,
        'phone_secondary', case when cp.can_show_sensitive_contact then nullif(cp.resolved_profile->>'secondaryPhone', '') else null end,
        'whatsapp', case when cp.can_show_sensitive_contact then coalesce(
          nullif(cp.resolved_profile->>'whatsapp', ''),
          nullif(cp.resolved_profile->>'secondaryPhone', '')
        ) else null end,
        'contact_methods', coalesce(cp.resolved_profile->'contactMethods', '[]'::jsonb)
      ) as contact
    from cleaned_profile cp
  ),
  portfolio_rows as (
    select
      oc.owner_id,
      jsonb_build_object(
        'item_id', p.id,
        'item_type', 'property',
        'title', coalesce(nullif(p.address, ''), nullif(p.type, ''), 'Property'),
        'is_unlocked', (
          oc.unlock_scope in ('contact', 'reciprocal')
          or exists (
            select 1
            from public.property_unlocks pu
            where pu.buyer_id = v_user_id
              and pu.owner_id = oc.owner_id
              and pu.property_id = p.id
              and coalesce(pu.status, 'active') = 'active'
              and (pu.mode = 'normal' or coalesce(pu.expires_at, now()) > now())
          )
        ),
        'is_exclusive', exists (
          select 1
          from public.property_unlocks ex
          where ex.property_id = p.id
            and ex.owner_id = oc.owner_id
            and ex.mode in ('total', 'partial')
            and coalesce(ex.status, 'active') = 'active'
            and ex.expires_at > now()
        )
      ) as item
    from owner_cards oc
    join public.properties p on p.owner_id = oc.owner_id
    where coalesce(p.publish_to_showcase, true) = true
      and coalesce(p.is_active, true) = true

    union all

    select
      oc.owner_id,
      jsonb_build_object(
        'item_id', s.id,
        'item_type', 'service',
        'title', coalesce(nullif(s.title, ''), nullif(s.category, ''), 'Service'),
        'is_unlocked', oc.unlock_scope in ('contact', 'reciprocal'),
        'is_exclusive', oc.exclusive_status in ('active_mine', 'active_other')
      ) as item
    from owner_cards oc
    join public.services s on s.owner_id = oc.owner_id
    where coalesce(s.publish_to_connections, true) = true
  ),
  portfolio_by_owner as (
    select
      pr.owner_id,
      coalesce(jsonb_agg(pr.item order by pr.item->>'item_type', pr.item->>'title'), '[]'::jsonb) as portfolio
    from portfolio_rows pr
    group by pr.owner_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'owner_id', oc.owner_id,
        'primary_profile', oc.primary_profile,
        'unlock_scope', oc.unlock_scope,
        'unlocked_at', oc.unlocked_at,
        'exclusive_expires_at', oc.exclusive_expires_at,
        'contact', oc.contact,
        'portfolio', coalesce(pbo.portfolio, '[]'::jsonb),
        'unlocked_property_ids', oc.unlocked_property_ids,
        'exclusive_status', oc.exclusive_status
      )
      order by oc.unlocked_at desc
    ),
    '[]'::jsonb
  )
    into v_result
  from owner_cards oc
  left join portfolio_by_owner pbo on pbo.owner_id = oc.owner_id;

  return v_result;
end;
$$;

grant execute on function public.ds_get_unlocked_contact_cards(uuid) to authenticated, service_role;

comment on function public.ds_get_unlocked_contact_cards(uuid) is
  'Returns canonical unlocked owner contact cards for the authenticated user, including portfolio and exclusivity status. Sensitive contact fields are returned only when the user has a valid unlock entitlement and no third-party active exclusivity blocks access.';
