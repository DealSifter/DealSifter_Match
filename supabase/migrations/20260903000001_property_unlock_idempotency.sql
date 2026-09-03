-- Make normal property unlock purchase idempotent for an already active buyer/property unlock.
-- A repeated confirmation must return the existing entitlement with zero cost instead of
-- inserting another property_unlock row or charging Nuggets again.

create or replace function public.ds_purchase_property_unlock(
  p_property_id uuid,
  p_mode text default 'normal',
  p_metadata jsonb default '{}'::jsonb,
  p_intent_token uuid default null
)
returns table (
  unlock_id uuid, property_id uuid, owner_id uuid, buyer_id uuid, mode text,
  base_cost integer, exclusivity_cost integer, total_cost integer,
  expires_at timestamptz, remaining_nuggets integer, normal_unlock_count integer
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_buyer_id uuid := auth.uid();
  v_owner_id uuid;
  v_profile_scope text;
  v_mode text := lower(trim(coalesce(p_mode, 'normal')));
  v_base_cost integer;
  v_exclusivity_cost integer := 0;
  v_listed_cost integer;
  v_charge_cost integer;
  v_normal_count integer := 0;
  v_expires_at timestamptz;
  v_remaining integer;
  v_is_admin boolean := false;
  v_unlock_id uuid;
  v_intent public.unlock_intents%rowtype;
  v_existing public.property_unlocks%rowtype;
begin
  if v_buyer_id is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_intent_token is null then raise exception 'unlock intent required' using errcode = '22023'; end if;
  if v_mode not in ('normal', 'total', 'partial') then raise exception 'invalid unlock mode' using errcode = '22023'; end if;

  select p.owner_id, public.ds_normalize_profile_scope(p.primary_profile)
    into v_owner_id, v_profile_scope
  from public.properties p
  where p.id = p_property_id
    and coalesce(p.is_active, true)
    and not coalesce(p.deal_closed, false);
  if v_owner_id is null then raise exception 'property not available for unlock' using errcode = 'P0002'; end if;
  if v_owner_id = v_buyer_id then raise exception 'cannot unlock own property' using errcode = '22023'; end if;

  perform pg_advisory_xact_lock(hashtext('property-unlock:' || p_property_id::text));
  perform public.ds_prune_property_unlocks();

  select * into v_intent
  from public.unlock_intents ui
  where ui.id = p_intent_token
    and ui.buyer_id = v_buyer_id
    and ui.seller_id = v_owner_id
    and ui.property_id = p_property_id
    and ui.profile_scope = v_profile_scope
    and ui.scope = 'property'
    and ui.mode = v_mode
    and ui.status = 'pending'
  for update;
  if v_intent.id is null then raise exception 'unlock intent invalid' using errcode = '22023'; end if;
  if v_intent.expires_at <= now() then
    update public.unlock_intents ui set status = 'expired' where ui.id = v_intent.id;
    raise exception 'unlock intent expired' using errcode = '57014';
  end if;

  select * into v_existing
  from public.property_unlocks pu
  where pu.property_id = p_property_id
    and pu.buyer_id = v_buyer_id
    and pu.owner_id = v_owner_id
    and pu.profile_scope = v_profile_scope
    and pu.mode = v_mode
    and pu.status = 'active'
    and (pu.expires_at is null or pu.expires_at > now())
  order by pu.created_at desc
  limit 1;

  if v_existing.id is not null then
    select coalesce(u.nuggets, 0) into v_remaining
    from public.users u
    where u.id = v_buyer_id;

    select count(*) into v_normal_count
    from public.property_unlocks pu
    where pu.property_id = p_property_id
      and pu.mode = 'normal';

    update public.unlock_intents ui
    set status = 'consumed', consumed_at = now()
    where ui.id = v_intent.id;

    insert into public.app_events(user_id, event_type, entity_type, entity_id, value_nuggets, metadata)
    values (
      v_buyer_id,
      'property_unlock_already_active',
      'property',
      p_property_id::text,
      0,
      jsonb_build_object('ownerId', v_owner_id, 'profileScope', v_profile_scope, 'mode', v_mode)
    );

    return query select
      v_existing.id, p_property_id, v_owner_id, v_buyer_id, v_mode,
      v_existing.base_cost, v_existing.exclusivity_cost, 0,
      v_existing.expires_at, v_remaining, v_normal_count;
    return;
  end if;

  if public.ds_has_active_profile_exclusivity(v_owner_id, v_profile_scope, v_buyer_id) then
    raise exception 'profile is under active exclusivity' using errcode = '55000';
  end if;

  v_base_cost := public.ds_profile_portfolio_cost(v_owner_id, v_profile_scope);
  select count(*) into v_normal_count
  from public.property_unlocks pu
  where pu.property_id = p_property_id
    and pu.mode = 'normal';
  if exists (
    select 1 from public.property_unlocks pu
    where pu.property_id = p_property_id
      and pu.mode in ('total', 'partial')
      and pu.status = 'active'
      and pu.expires_at > now()
  ) then
    raise exception 'property is under active exclusivity' using errcode = '55000';
  end if;

  if v_mode = 'total' then
    if v_normal_count <> 0 then raise exception 'total exclusivity unavailable' using errcode = '55000'; end if;
    v_exclusivity_cost := 20;
    v_expires_at := now() + interval '7 days';
  elsif v_mode = 'partial' then
    if v_normal_count < 1 or v_normal_count > 2 then raise exception 'partial exclusivity unavailable' using errcode = '55000'; end if;
    v_exclusivity_cost := 18;
    v_expires_at := now() + interval '7 days';
  end if;
  v_listed_cost := v_base_cost + v_exclusivity_cost;
  if v_intent.total_cost <> v_listed_cost
    or v_intent.normal_unlock_count <> v_normal_count then
    update public.unlock_intents ui set status = 'expired' where ui.id = v_intent.id;
    raise exception 'unlock cost changed; current_cost=%', v_listed_cost using errcode = '40001';
  end if;

  perform public.ds_require_plan_action('unlock');
  select coalesce(u.nuggets, 0), coalesce(u.is_admin, false)
    into v_remaining, v_is_admin
  from public.users u where u.id = v_buyer_id for update;
  v_charge_cost := case when v_is_admin then 0 else v_listed_cost end;
  if not v_is_admin then
    update public.users u
    set nuggets = coalesce(u.nuggets, 0) - v_listed_cost, updated_at = now()
    where u.id = v_buyer_id and coalesce(u.nuggets, 0) >= v_listed_cost
    returning u.nuggets into v_remaining;
    if v_remaining is null then raise exception 'not enough nuggets' using errcode = '22003'; end if;
  end if;

  insert into public.property_unlocks(
    property_id, owner_id, buyer_id, profile_scope, mode, base_cost,
    exclusivity_cost, total_cost, normal_unlock_count_at_purchase,
    metadata, expires_at
  ) values (
    p_property_id, v_owner_id, v_buyer_id, v_profile_scope, v_mode, v_base_cost,
    v_exclusivity_cost, v_charge_cost, v_normal_count,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'intentToken', p_intent_token, 'profileScope', v_profile_scope,
      'adminBypass', v_is_admin, 'listedCost', v_listed_cost
    ),
    v_expires_at
  ) returning id into v_unlock_id;

  insert into public.unlocks(buyer_id, seller_id, profile_scope, nuggets_spent)
  values (v_buyer_id, v_owner_id, v_profile_scope, v_charge_cost)
  on conflict (buyer_id, seller_id, profile_scope)
  do update set nuggets_spent = public.unlocks.nuggets_spent + excluded.nuggets_spent;

  update public.unlock_intents ui set status = 'consumed', consumed_at = now() where ui.id = v_intent.id;
  insert into public.app_events(user_id, event_type, entity_type, entity_id, value_nuggets, metadata)
  values (
    v_buyer_id,
    case when v_mode = 'normal' then 'property_unlock_normal' else 'exclusive_contact_purchased' end,
    'property', p_property_id::text, v_charge_cost,
    jsonb_build_object('ownerId', v_owner_id, 'profileScope', v_profile_scope, 'mode', v_mode)
  );

  return query select
    v_unlock_id, p_property_id, v_owner_id, v_buyer_id, v_mode,
    v_base_cost, v_exclusivity_cost, v_charge_cost, v_expires_at,
    v_remaining, v_normal_count;
end;
$$;

grant execute on function public.ds_purchase_property_unlock(uuid, text, jsonb, uuid) to authenticated;
