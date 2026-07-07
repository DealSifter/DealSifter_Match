-- Make unlocked-contact hydration deterministic across direct contact unlocks,
-- property unlocks and reciprocal exclusive unlock visibility.

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
  with unlock_sources as (
    select
      u.seller_id,
      coalesce(u.nuggets_spent, 0)::integer as nuggets_spent,
      u.created_at as unlocked_at,
      null::uuid as unlocked_property_id,
      null::text as unlocked_property_mode,
      null::timestamptz as unlocked_property_expires_at
    from public.unlocks u
    where u.buyer_id = auth.uid()

    union all

    select
      pu.owner_id as seller_id,
      coalesce(pu.total_cost, 0)::integer as nuggets_spent,
      pu.created_at as unlocked_at,
      pu.property_id as unlocked_property_id,
      pu.mode as unlocked_property_mode,
      pu.expires_at as unlocked_property_expires_at
    from public.property_unlocks pu
    where pu.buyer_id = auth.uid()
      and pu.owner_id is distinct from auth.uid()
      and coalesce(pu.status, 'active') = 'active'

    union all

    select
      pu.buyer_id as seller_id,
      0::integer as nuggets_spent,
      pu.created_at as unlocked_at,
      pu.property_id as unlocked_property_id,
      'reciprocal_' || coalesce(pu.mode, 'exclusive') as unlocked_property_mode,
      pu.expires_at as unlocked_property_expires_at
    from public.property_unlocks pu
    where pu.owner_id = auth.uid()
      and pu.buyer_id is distinct from auth.uid()
      and pu.mode in ('total', 'partial')
      and coalesce(pu.status, 'active') = 'active'
      and pu.expires_at > now()
  ),
  latest_unlocks as (
    select distinct on (us.seller_id)
      us.seller_id,
      us.nuggets_spent,
      us.unlocked_at,
      us.unlocked_property_id,
      us.unlocked_property_mode,
      us.unlocked_property_expires_at
    from unlock_sources us
    where us.seller_id is not null
      and us.seller_id is distinct from auth.uid()
    order by us.seller_id, us.unlocked_at desc
  ),
  profile_scope as (
    select
      lu.*,
      coalesce(
        nullif(unlocked_property.primary_profile, ''),
        nullif(latest_service.primary_profile, ''),
        nullif(latest_property.primary_profile, ''),
        'personal'
      ) as scope_key
    from latest_unlocks lu
    left join public.properties unlocked_property on unlocked_property.id = lu.unlocked_property_id
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

drop policy if exists notifications_no_direct_delete on public.notifications;
drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own
  on public.notifications for delete
  using (auth.uid() = user_id);
