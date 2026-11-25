-- SEC-03: scoped contacts, exclusivity and buyer-selected reciprocal scope.
-- Persist only the buyer scope frozen in their authenticated intent, not the
-- purchase payload. Preserve the existing routine body/idempotency in each environment.
do $patch$
declare v_definition text; v_marker text := '''intentToken'', p_intent_token, ''profileScope'', v_profile_scope,';
begin
  select pg_get_functiondef('public.ds_purchase_property_unlock(uuid,text,jsonb,uuid)'::regprocedure) into v_definition;
  if position('''buyerProfileScope'', case' in v_definition)=0 then
    if (length(v_definition)-length(replace(v_definition,v_marker,'')))/length(v_marker)<>1 then
      raise exception 'SEC-03 purchase body drift';
    end if;
    execute replace(v_definition,v_marker,
      '''buyerProfileScope'', case when v_intent.metadata->>''buyerProfileScope'' in (''personal'',''professional'',''fsbo'') then v_intent.metadata->>''buyerProfileScope'' else null end, ' || v_marker);
  end if;
end;
$patch$;

CREATE OR REPLACE FUNCTION public.ds_get_unlocked_contact_cards(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := p_user_id;
  v_is_service_role boolean := coalesce((auth.jwt() ->> 'role') = 'service_role', false);
  v_result jsonb;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if not v_is_service_role and v_user_id is distinct from auth.uid() then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  with sources as (
    select
      u.seller_id owner_id, u.profile_scope,
      'contact'::text unlock_scope, u.created_at unlocked_at,
      null::uuid property_id, null::timestamptz exclusive_expires_at
    from public.unlocks u
    where u.buyer_id = v_user_id and u.seller_id is distinct from v_user_id
    union all
    select
      pu.owner_id, pu.profile_scope,
      case when pu.mode in ('total', 'partial') then 'exclusive' else 'property' end,
      pu.created_at, pu.property_id,
      case when pu.mode in ('total', 'partial') then pu.expires_at end
    from public.property_unlocks pu
    where pu.buyer_id = v_user_id
      and pu.owner_id is distinct from v_user_id
      and coalesce(pu.status, 'active') = 'active'
      and (pu.mode = 'normal' or pu.expires_at > now())
    union all
    select
      pu.buyer_id, pu.metadata->>'buyerProfileScope',
      'reciprocal'::text, pu.created_at, null::uuid, pu.expires_at
    from public.property_unlocks pu
    where pu.owner_id = v_user_id and pu.buyer_id is distinct from v_user_id
      and pu.mode in ('total','partial') and pu.status='active' and pu.expires_at>now()
      and pu.metadata->>'buyerProfileScope' in ('personal','professional','fsbo')
  ),
  rollup as (
    select
      owner_id,
      public.ds_normalize_profile_scope(profile_scope) profile_scope,
      (array_agg(unlock_scope order by
        case unlock_scope when 'exclusive' then 1 when 'property' then 2 else 3 end,
        unlocked_at desc
      ))[1] unlock_scope,
      max(unlocked_at) unlocked_at,
      max(exclusive_expires_at) exclusive_expires_at,
      coalesce(jsonb_agg(distinct property_id) filter (where property_id is not null), '[]'::jsonb) property_ids,
      bool_or(unlock_scope in ('contact','reciprocal')) contact_entitlement
    from sources
    group by owner_id, public.ds_normalize_profile_scope(profile_scope)
  ),
  enriched as (
    select
      r.*,
      exists (
        select 1 from public.property_unlocks pu
        where pu.owner_id = r.owner_id and pu.profile_scope = r.profile_scope
          and pu.buyer_id = v_user_id and pu.mode in ('total', 'partial')
          and pu.status = 'active' and pu.expires_at > now()
      ) active_mine,
      exists (
        select 1 from public.property_unlocks pu
        where pu.owner_id = r.owner_id and pu.profile_scope = r.profile_scope
          and pu.buyer_id is distinct from v_user_id and pu.mode in ('total', 'partial')
          and pu.status = 'active' and pu.expires_at > now()
      ) active_other,
      usr.email account_email, usr.full_name account_name, usr.phone account_phone,
      usr.settings_payload,
      up.full_name profile_name, up.photo_url profile_photo,
      pp.category, pp.primary_category, pp.category_b, pp.primary_category_b,
      pp.photo_b_url, coalesce(pp.profile_payload->'resolved', '{}'::jsonb) resolved
    from rollup r
    join public.users usr on usr.id = r.owner_id
    left join public.user_profiles up on up.user_id = r.owner_id
    left join public.professional_profiles pp on pp.user_id = r.owner_id
  ),
  cards as (
    select
      e.*,
      coalesce(nullif(e.resolved->e.profile_scope, '{}'::jsonb), '{}'::jsonb) profile,
      case when e.active_mine then 'active_mine'
           when e.active_other then 'active_other'
           else 'none' end exclusive_status
    from enriched e
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'entitlement_key', c.owner_id::text || ':' || c.profile_scope,
      'owner_id', c.owner_id,
      'primary_profile', c.profile_scope,
      'unlock_scope', c.unlock_scope,
      'unlocked_at', c.unlocked_at,
      'exclusive_expires_at', c.exclusive_expires_at,
      'exclusive_status', c.exclusive_status,
      'contact', jsonb_build_object(
        'name', coalesce(nullif(c.profile->>'name', ''), nullif(c.profile_name, ''), nullif(c.account_name, ''), 'Unlocked contact'),
        'avatar_url', coalesce(nullif(c.profile->>'photo', ''), case when c.profile_scope = 'professional' then nullif(c.photo_b_url, '') end, ''),
        'category', coalesce(nullif(c.profile->>'categoryLabelFallback', ''), nullif(c.profile->>'category', ''),
          case when c.profile_scope = 'professional' then nullif(c.primary_category_b, '') end,
          nullif(c.primary_category, ''), nullif(c.category, ''), ''),
        'location', coalesce(nullif(c.profile->>'loc', ''), ''),
        'email', case when not c.active_other then nullif(c.profile->>'email', '') end,
        'phone_primary', case when not c.active_other then nullif(c.profile->>'primaryPhone', '') end,
        'phone_secondary', case when not c.active_other then nullif(c.profile->>'secondaryPhone', '') end,
        'phone_tertiary', case when not c.active_other then nullif(c.profile->>'tertiaryPhone', '') end,
        'whatsapp', case when not c.active_other then coalesce(nullif(c.profile->>'whatsapp', ''), nullif(c.profile->>'secondaryPhone', '')) end,
        'contact_methods', coalesce(c.profile->'contactMethods', '[]'::jsonb)
      ),
      'portfolio', coalesce((
        select jsonb_agg(item order by item->>'item_type', item->>'title')
        from (
          select jsonb_build_object(
            'item_id', p.id, 'item_type', 'property',
            'title', coalesce(nullif(p.address, ''), nullif(p.type, ''), 'Property'),
            'is_unlocked', c.contact_entitlement or c.property_ids ? p.id::text,
            'is_exclusive', exists (
              select 1 from public.property_unlocks ex
              where ex.property_id = p.id and ex.mode in ('total', 'partial')
                and ex.status = 'active' and ex.expires_at > now()
            )
          ) item
          from public.properties p
          where p.owner_id = c.owner_id
            and public.ds_normalize_profile_scope(p.primary_profile) = c.profile_scope
            and coalesce(p.publish_to_showcase, true) and coalesce(p.is_active, true)
          union all
          select jsonb_build_object(
            'item_id', s.id, 'item_type', 'service',
            'title', coalesce(nullif(s.title, ''), nullif(s.category, ''), 'Service'),
            'is_unlocked', c.contact_entitlement,
            'is_exclusive', c.exclusive_status in ('active_mine', 'active_other')
          )
          from public.services s
          where s.owner_id = c.owner_id
            and public.ds_normalize_profile_scope(s.primary_profile) = c.profile_scope
            and coalesce(s.publish_to_connections, true)
        ) portfolio_items
      ), '[]'::jsonb),
      'unlocked_property_ids', case when c.contact_entitlement then coalesce((
        select jsonb_agg(p.id)
        from public.properties p
        where p.owner_id = c.owner_id
          and public.ds_normalize_profile_scope(p.primary_profile) = c.profile_scope
          and coalesce(p.publish_to_showcase, true) and coalesce(p.is_active, true)
      ), '[]'::jsonb) else c.property_ids end
    ) order by c.unlocked_at desc
  ), '[]'::jsonb)
  into v_result
  from cards c;

  return v_result;
end;
$function$
;

-- Preserve the legacy row/JSON contract, but take contacts only from the same
-- canonical authorization used by the current client. No login-email fallback.
create or replace function public.ds_get_unlocked_contact_snapshots()
returns table(seller_id uuid,nuggets_spent integer,unlocked_at timestamptz,contact jsonb)
language sql security definer set search_path=public,pg_temp as $legacy$
  select
    (card->>'owner_id')::uuid,
    case when card->>'unlock_scope'='reciprocal' then 0 else coalesce((
      select sum(u.nuggets_spent)::integer from public.unlocks u
      where u.buyer_id=auth.uid() and u.seller_id=(card->>'owner_id')::uuid
        and u.profile_scope=card->>'primary_profile'
    ),(
      select sum(pu.total_cost)::integer from public.property_unlocks pu
      where pu.buyer_id=auth.uid() and pu.owner_id=(card->>'owner_id')::uuid
        and pu.profile_scope=card->>'primary_profile'
    ),0) end,
    (card->>'unlocked_at')::timestamptz,
    jsonb_build_object(
      'id',card->>'owner_id','ownerId',card->>'owner_id','unlockOwnerId',card->>'owner_id',
      'primaryProfile',card->>'primary_profile','entitlementKey',card->>'entitlement_key',
      'unlockedPropertyId',card->'unlocked_property_ids'->>0,
      'exclusiveMode',(select case when card->>'unlock_scope'='reciprocal' then 'reciprocal_'||pu.mode else pu.mode end
        from public.property_unlocks pu
        where ((pu.buyer_id=auth.uid() and pu.owner_id=(card->>'owner_id')::uuid and pu.profile_scope=card->>'primary_profile')
          or (card->>'unlock_scope'='reciprocal' and pu.owner_id=auth.uid() and pu.buyer_id=(card->>'owner_id')::uuid and pu.metadata->>'buyerProfileScope'=card->>'primary_profile'))
          and pu.status='active' and (pu.mode='normal' or pu.expires_at>now()) order by pu.created_at desc limit 1),
      'exclusiveExpiresAt',card->>'exclusive_expires_at',
      'name',card#>>'{contact,name}','title',card#>>'{contact,name}',
      'type',card#>>'{contact,category}','cat',card#>>'{contact,category}','badge','',
      'loc',card#>>'{contact,location}','photo',card#>>'{contact,avatar_url}',
      'contactMethods',coalesce(card#>'{contact,contact_methods}','[]'::jsonb),
      'primaryPhone',card#>>'{contact,phone_primary}','phone',card#>>'{contact,phone_primary}',
      'secondaryPhone',card#>>'{contact,phone_secondary}','tertiaryPhone',card#>>'{contact,phone_tertiary}',
      'whatsapp',card#>>'{contact,whatsapp}','email',card#>>'{contact,email}',
      'source','remote-unlock')
  from jsonb_array_elements(public.ds_get_unlocked_contact_cards(auth.uid())) card;
$legacy$;
revoke execute on function public.ds_get_unlocked_contact_cards(uuid) from public,anon;
revoke execute on function public.ds_get_unlocked_contact_snapshots() from public,anon;
grant execute on function public.ds_get_unlocked_contact_cards(uuid) to authenticated,service_role;
grant execute on function public.ds_get_unlocked_contact_snapshots() to authenticated,service_role;
