-- Keep profile identity tied to real DB/Storage records and hydrate unlocks
-- from the property actually unlocked when that context exists.

update public.user_profiles up
set photo_url = 'https://cyeipfskwwisbbayyaca.supabase.co/storage/v1/object/public/profile-images/' || up.user_id::text || '/avatar.jpg'
where nullif(up.photo_url, '') is null
  and exists (
    select 1
    from storage.objects obj
    where obj.bucket_id = 'profile-images'
      and obj.name = up.user_id::text || '/avatar.jpg'
  );

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
  )
  select
    sp.seller_id,
    sp.nuggets_spent,
    sp.unlocked_at,
    jsonb_build_object(
      'id', sp.seller_id::text,
      'ownerId', sp.seller_id::text,
      'unlockOwnerId', sp.seller_id::text,
      'primaryProfile', coalesce(nullif(sp.scope_key, ''), 'personal'),
      'unlockedPropertyId', sp.unlocked_property_id,
      'exclusiveMode', sp.unlocked_property_mode,
      'exclusiveExpiresAt', sp.unlocked_property_expires_at,
      'name', coalesce(
        nullif(sp.resolved_profile->>'name', ''),
        nullif(sp.profile_name, ''),
        nullif(sp.account_name, ''),
        nullif(sp.account_email, ''),
        'Unlocked contact'
      ),
      'title', coalesce(
        nullif(sp.resolved_profile->>'name', ''),
        nullif(sp.profile_name, ''),
        nullif(sp.account_name, ''),
        nullif(sp.account_email, ''),
        'Unlocked contact'
      ),
      'type', coalesce(
        nullif(sp.resolved_profile->>'categoryLabelFallback', ''),
        nullif(sp.primary_category_b, ''),
        nullif(sp.category_b, ''),
        nullif(sp.primary_category, ''),
        nullif(sp.category, ''),
        'Contact'
      ),
      'cat', coalesce(nullif(sp.primary_category, ''), nullif(sp.category, ''), ''),
      'badge', coalesce(nullif(sp.resolved_profile->>'badge', ''), ''),
      'loc', coalesce(nullif(sp.resolved_profile->>'loc', ''), ''),
      'photo', coalesce(
        nullif(sp.resolved_profile->>'photo', ''),
        nullif(sp.profile_photo, ''),
        nullif(sp.photo_b_url, ''),
        ''
      ),
      'contactMethods', coalesce(sp.resolved_profile->'contactMethods', '[]'::jsonb),
      'primaryPhone', coalesce(
        nullif(sp.resolved_profile->>'primaryPhone', ''),
        nullif(sp.settings_payload #>> '{systemAccount,phone}', ''),
        nullif(sp.account_phone, ''),
        ''
      ),
      'phone', coalesce(
        nullif(sp.resolved_profile->>'primaryPhone', ''),
        nullif(sp.settings_payload #>> '{systemAccount,phone}', ''),
        nullif(sp.account_phone, ''),
        ''
      ),
      'secondaryPhone', coalesce(nullif(sp.resolved_profile->>'secondaryPhone', ''), ''),
      'tertiaryPhone', coalesce(nullif(sp.resolved_profile->>'tertiaryPhone', ''), ''),
      'whatsapp', coalesce(
        nullif(sp.resolved_profile->>'whatsapp', ''),
        nullif(sp.resolved_profile->>'secondaryPhone', ''),
        ''
      ),
      'email', coalesce(
        nullif(sp.resolved_profile->>'email', ''),
        nullif(sp.settings_payload #>> '{systemAccount,email}', ''),
        nullif(sp.account_email, ''),
        ''
      ),
      'source', 'remote-unlock'
    ) as contact
  from selected_profile sp;
$$;

grant execute on function public.ds_get_unlocked_contact_snapshots() to authenticated;
