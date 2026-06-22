-- Prevent stale profile_payload skills/categories from being promoted to a
-- contact name in unlocked-contact hydration. Personal/FSBO contacts should
-- prefer the real user profile identity stored in DB.

create or replace function public.ds_get_unlocked_contact_snapshots()
returns table (
  seller_id uuid,
  nuggets_spent integer,
  unlocked_at timestamptz,
  contact jsonb
)
language sql
security definer
set search_path = public
as $$
  with latest_unlocks as (
    select distinct on (u.seller_id)
      u.seller_id,
      u.nuggets_spent,
      u.created_at as unlocked_at
    from public.unlocks u
    where u.buyer_id = auth.uid()
    order by u.seller_id, u.created_at desc
  ),
  latest_property_unlock as (
    select distinct on (pu.owner_id)
      pu.owner_id,
      pu.property_id,
      pu.mode,
      pu.expires_at,
      pu.created_at
    from public.property_unlocks pu
    where pu.buyer_id = auth.uid()
      and pu.status = 'active'
    order by pu.owner_id, pu.created_at desc
  ),
  profile_scope as (
    select
      lu.*,
      lpu.property_id as unlocked_property_id,
      lpu.mode as unlocked_property_mode,
      lpu.expires_at as unlocked_property_expires_at,
      coalesce(
        nullif(unlocked_property.primary_profile, ''),
        nullif(latest_service.primary_profile, ''),
        nullif(latest_property.primary_profile, ''),
        'personal'
      ) as scope_key
    from latest_unlocks lu
    left join latest_property_unlock lpu on lpu.owner_id = lu.seller_id
    left join public.properties unlocked_property on unlocked_property.id = lpu.property_id
    left join lateral (
      select primary_profile
      from public.services s
      where s.owner_id = lu.seller_id
        and coalesce(s.publish_to_connections, true) = true
      order by s.updated_at desc nulls last, s.created_at desc
      limit 1
    ) latest_service on true
    left join lateral (
      select primary_profile
      from public.properties p
      where p.owner_id = lu.seller_id
        and coalesce(p.publish_to_showcase, true) = true
      order by p.updated_at desc nulls last, p.created_at desc
      limit 1
    ) latest_property on true
  ),
  contact_source as (
    select
      ps.*,
      usr.email as account_email,
      usr.full_name as account_name,
      usr.phone as account_phone,
      usr.settings_payload,
      up.full_name as profile_name,
      up.photo_url as profile_photo,
      pp.category,
      pp.subcategory,
      pp.primary_category,
      pp.category_b,
      pp.primary_category_b,
      pp.photo_b_url,
      pp.profile_payload,
      coalesce(pp.profile_payload->'resolved', '{}'::jsonb) as resolved_profiles
    from profile_scope ps
    join public.users usr on usr.id = ps.seller_id
    left join public.user_profiles up on up.user_id = ps.seller_id
    left join public.professional_profiles pp on pp.user_id = ps.seller_id
  ),
  selected_profile as (
    select
      cs.*,
      coalesce(
        nullif(cs.resolved_profiles -> cs.scope_key, '{}'::jsonb),
        nullif(cs.resolved_profiles -> 'personal', '{}'::jsonb),
        nullif(cs.resolved_profiles -> 'professional', '{}'::jsonb),
        '{}'::jsonb
      ) as resolved_profile
    from contact_source cs
  ),
  cleaned_profile as (
    select
      sp.*,
      case
        when lower(nullif(sp.resolved_profile->>'name', '')) in ('d4$', 'drive4$') then null
        else nullif(sp.resolved_profile->>'name', '')
      end as safe_payload_name
    from selected_profile sp
  )
  select
    cp.seller_id,
    cp.nuggets_spent,
    cp.unlocked_at,
    jsonb_build_object(
      'id', cp.seller_id::text,
      'ownerId', cp.seller_id::text,
      'unlockOwnerId', cp.seller_id::text,
      'primaryProfile', coalesce(nullif(cp.scope_key, ''), 'personal'),
      'unlockedPropertyId', cp.unlocked_property_id,
      'exclusiveMode', cp.unlocked_property_mode,
      'exclusiveExpiresAt', cp.unlocked_property_expires_at,
      'name', case
        when cp.scope_key = 'professional' then coalesce(
          cp.safe_payload_name,
          nullif(cp.profile_name, ''),
          nullif(cp.account_name, ''),
          nullif(cp.account_email, ''),
          'Unlocked contact'
        )
        else coalesce(
          nullif(cp.profile_name, ''),
          nullif(cp.account_name, ''),
          cp.safe_payload_name,
          nullif(cp.account_email, ''),
          'Unlocked contact'
        )
      end,
      'title', case
        when cp.scope_key = 'professional' then coalesce(
          cp.safe_payload_name,
          nullif(cp.profile_name, ''),
          nullif(cp.account_name, ''),
          nullif(cp.account_email, ''),
          'Unlocked contact'
        )
        else coalesce(
          nullif(cp.profile_name, ''),
          nullif(cp.account_name, ''),
          cp.safe_payload_name,
          nullif(cp.account_email, ''),
          'Unlocked contact'
        )
      end,
      'type', coalesce(
        nullif(cp.resolved_profile->>'categoryLabelFallback', ''),
        nullif(cp.primary_category_b, ''),
        nullif(cp.category_b, ''),
        nullif(cp.primary_category, ''),
        nullif(cp.category, ''),
        'Contact'
      ),
      'cat', coalesce(nullif(cp.primary_category, ''), nullif(cp.category, ''), ''),
      'badge', coalesce(nullif(cp.resolved_profile->>'badge', ''), ''),
      'loc', coalesce(nullif(cp.resolved_profile->>'loc', ''), ''),
      'photo', coalesce(
        nullif(cp.resolved_profile->>'photo', ''),
        nullif(cp.profile_photo, ''),
        nullif(cp.photo_b_url, ''),
        ''
      ),
      'contactMethods', coalesce(cp.resolved_profile->'contactMethods', '[]'::jsonb),
      'primaryPhone', coalesce(
        nullif(cp.resolved_profile->>'primaryPhone', ''),
        nullif(cp.settings_payload #>> '{systemAccount,phone}', ''),
        nullif(cp.account_phone, ''),
        ''
      ),
      'phone', coalesce(
        nullif(cp.resolved_profile->>'primaryPhone', ''),
        nullif(cp.settings_payload #>> '{systemAccount,phone}', ''),
        nullif(cp.account_phone, ''),
        ''
      ),
      'secondaryPhone', coalesce(nullif(cp.resolved_profile->>'secondaryPhone', ''), ''),
      'tertiaryPhone', coalesce(nullif(cp.resolved_profile->>'tertiaryPhone', ''), ''),
      'whatsapp', coalesce(
        nullif(cp.resolved_profile->>'whatsapp', ''),
        nullif(cp.resolved_profile->>'secondaryPhone', ''),
        ''
      ),
      'email', coalesce(
        nullif(cp.resolved_profile->>'email', ''),
        nullif(cp.settings_payload #>> '{systemAccount,email}', ''),
        nullif(cp.account_email, ''),
        ''
      ),
      'source', 'remote-unlock'
    ) as contact
  from cleaned_profile cp;
$$;

grant execute on function public.ds_get_unlocked_contact_snapshots() to authenticated;
