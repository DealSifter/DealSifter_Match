-- Admin accounts are operational users. They must pass commercial gates without
-- consuming nuggets, while all ownership, intent-token and exclusivity safety
-- rules remain enforced.

create or replace function public.ds_deduct_nuggets(
  p_amount integer,
  p_reason text default 'manual'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_amount integer := greatest(0, coalesce(p_amount, 0));
  v_reason text := left(coalesce(nullif(trim(p_reason), ''), 'manual'), 80);
  v_balance integer;
  v_is_admin boolean := false;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  perform pg_advisory_xact_lock(hashtext('nuggets:' || v_user_id::text));

  select coalesce(u.nuggets, 0), coalesce(u.is_admin, false)
    into v_balance, v_is_admin
  from public.users u
  where u.id = v_user_id
  for update;

  if v_balance is null then
    raise exception 'user profile not found' using errcode = 'P0002';
  end if;

  if v_amount <= 0 or v_is_admin then
    return jsonb_build_object(
      'newBalance', coalesce(v_balance, 0),
      'amount', case when v_is_admin then 0 else v_amount end,
      'reason', v_reason,
      'adminBypass', v_is_admin
    );
  end if;

  if v_balance < v_amount then
    raise exception 'insufficient_nuggets' using errcode = 'P0001';
  end if;

  update public.users
  set nuggets = nuggets - v_amount,
      updated_at = now()
  where id = v_user_id
  returning nuggets into v_balance;

  return jsonb_build_object('newBalance', v_balance, 'amount', v_amount, 'reason', v_reason, 'adminBypass', false);
end;
$$;

grant execute on function public.ds_deduct_nuggets(integer, text) to authenticated;

create or replace function public.ds_purchase_card_spotlights(p_items jsonb)
returns table (
  spotlight_id uuid,
  card_kind text,
  card_id text,
  remaining_nuggets integer,
  total_cost integer,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_items jsonb := coalesce(p_items, '[]'::jsonb);
  v_count integer := 0;
  v_total_cost integer := 0;
  v_charge_total integer := 0;
  v_item_cost integer := 10;
  v_remaining integer := 0;
  v_is_admin boolean := false;
  v_item jsonb;
  v_kind text;
  v_card_id text;
  v_scope text;
  v_owner_id uuid;
  v_property_owner uuid;
  v_service_owner uuid;
  v_spotlight_id uuid;
  v_expires_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if jsonb_typeof(v_items) <> 'array' then
    raise exception 'invalid spotlight items' using errcode = '22023';
  end if;

  v_count := jsonb_array_length(v_items);
  if v_count <= 0 then
    raise exception 'select at least one card' using errcode = '22023';
  end if;
  if v_count > 12 then
    raise exception 'too many cards selected' using errcode = '22023';
  end if;

  v_total_cost := v_count * 10;

  perform pg_advisory_xact_lock(hashtext('nuggets:' || v_user_id::text));

  select coalesce(u.nuggets, 0), coalesce(u.is_admin, false)
    into v_remaining, v_is_admin
  from public.users u
  where u.id = v_user_id
  for update;

  if v_remaining is null then
    raise exception 'user profile not found' using errcode = 'P0002';
  end if;

  v_charge_total := case when v_is_admin then 0 else v_total_cost end;
  v_item_cost := case when v_is_admin then 0 else 10 end;

  if not v_is_admin then
    update public.users u
       set nuggets = coalesce(u.nuggets, 0) - v_total_cost
     where u.id = v_user_id
       and coalesce(u.nuggets, 0) >= v_total_cost
    returning u.nuggets into v_remaining;

    if v_remaining is null then
      raise exception 'not enough nuggets' using errcode = '22003';
    end if;
  end if;

  for v_item in select * from jsonb_array_elements(v_items)
  loop
    v_kind := lower(trim(v_item->>'cardKind'));
    v_card_id := trim(v_item->>'cardId');
    v_scope := nullif(trim(v_item->>'scope'), '');
    v_owner_id := coalesce(nullif(v_item->>'ownerId', '')::uuid, v_user_id);

    if v_kind not in ('profile', 'property', 'service') or length(v_card_id) < 3 then
      raise exception 'invalid spotlight item' using errcode = '22023';
    end if;

    if v_kind = 'property' then
      select p.owner_id into v_property_owner
        from public.properties p
       where p.id::text = v_card_id
         and p.owner_id = v_user_id
         and p.is_active = true
         and p.publish_to_showcase = true
         and coalesce(p.deal_closed, false) = false;

      if v_property_owner is null then
        raise exception 'property is not eligible for spotlight' using errcode = '42501';
      end if;
      v_owner_id := v_property_owner;
    elsif v_kind = 'service' then
      select s.owner_id into v_service_owner
        from public.services s
       where s.id::text = v_card_id
         and s.owner_id = v_user_id
         and s.publish_to_connections = true;

      if v_service_owner is null then
        raise exception 'service is not eligible for spotlight' using errcode = '42501';
      end if;
      v_owner_id := v_service_owner;
    else
      if v_owner_id <> v_user_id or v_card_id not like ('profile:%:' || v_user_id::text) then
        raise exception 'profile is not eligible for spotlight' using errcode = '42501';
      end if;
    end if;

    insert into public.card_spotlights(user_id, owner_id, card_kind, card_id, scope, nuggets_spent, starts_at, expires_at, metadata)
    values (
      v_user_id,
      v_owner_id,
      v_kind,
      v_card_id,
      v_scope,
      v_item_cost,
      now(),
      now() + interval '30 days',
      coalesce(v_item->'metadata', '{}'::jsonb) || jsonb_build_object('adminBypass', v_is_admin, 'listedCost', 10)
    )
    returning public.card_spotlights.id, public.card_spotlights.expires_at into v_spotlight_id, v_expires_at;

    begin
      insert into public.app_events(user_id, event_type, entity_type, entity_id, value_nuggets, metadata)
      values (
        v_user_id,
        'highlight_purchased',
        v_kind,
        left(v_card_id, 96),
        v_item_cost,
        jsonb_build_object('scope', v_scope, 'ownerId', v_owner_id, 'spotlightId', v_spotlight_id, 'adminBypass', v_is_admin, 'listedCost', 10)
      );
    exception when others then
      null;
    end;

    spotlight_id := v_spotlight_id;
    card_kind := v_kind;
    card_id := v_card_id;
    remaining_nuggets := v_remaining;
    total_cost := v_charge_total;
    expires_at := v_expires_at;
    return next;
  end loop;
end;
$$;

grant execute on function public.ds_purchase_card_spotlights(jsonb) to authenticated;

create or replace function public.ds_purchase_property_unlock(
  p_property_id uuid,
  p_mode text default 'normal',
  p_metadata jsonb default '{}'::jsonb,
  p_intent_token uuid default null
)
returns table (
  unlock_id uuid,
  property_id uuid,
  owner_id uuid,
  buyer_id uuid,
  mode text,
  base_cost integer,
  exclusivity_cost integer,
  total_cost integer,
  expires_at timestamptz,
  remaining_nuggets integer,
  normal_unlock_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer_id uuid := auth.uid();
  v_owner_id uuid;
  v_mode text := lower(trim(coalesce(p_mode, 'normal')));
  v_base_cost integer := 1;
  v_exclusivity_cost integer := 0;
  v_total_cost integer := 0;
  v_charge_cost integer := 0;
  v_normal_count integer := 0;
  v_active_exclusive_id uuid;
  v_expires_at timestamptz := null;
  v_remaining integer;
  v_is_admin boolean := false;
  v_unlock_id uuid;
  v_intent public.unlock_intents%rowtype;
begin
  if v_buyer_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if p_intent_token is null then
    raise exception 'unlock intent required' using errcode = '22023';
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

  perform pg_advisory_xact_lock(hashtext('property-unlock:' || p_property_id::text));
  perform public.ds_prune_property_unlocks();

  select p.owner_id
    into v_owner_id
  from public.properties p
  where p.id = p_property_id
    and p.is_active = true
    and coalesce(p.deal_closed, false) = false;

  if v_owner_id is null then
    raise exception 'property not available for unlock' using errcode = 'P0002';
  end if;

  if v_owner_id = v_buyer_id then
    raise exception 'cannot unlock own property' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('contact-unlock:' || v_buyer_id::text || ':' || v_owner_id::text));

  select *
    into v_intent
  from public.unlock_intents ui
  where ui.id = p_intent_token
    and ui.buyer_id = v_buyer_id
    and ui.seller_id = v_owner_id
    and ui.property_id = p_property_id
    and ui.scope = 'property'
    and ui.mode = v_mode
    and ui.status = 'pending'
  for update;

  if v_intent.id is null then
    raise exception 'unlock intent invalid' using errcode = '22023';
  end if;

  if v_intent.expires_at <= now() then
    update public.unlock_intents set status = 'expired' where id = v_intent.id;
    raise exception 'unlock intent expired' using errcode = '57014';
  end if;

  select greatest(1, count(*)::integer)
    into v_base_cost
  from (
    select p2.id
    from public.properties p2
    where p2.owner_id = v_owner_id
      and p2.is_active = true
      and coalesce(p2.deal_closed, false) = false
    union all
    select s2.id
    from public.services s2
    where s2.owner_id = v_owner_id
      and s2.publish_to_connections = true
  ) portfolio_items;

  select count(*)
    into v_normal_count
  from public.property_unlocks pu
  where pu.property_id = p_property_id
    and pu.mode = 'normal';

  select pu.id
    into v_active_exclusive_id
  from public.property_unlocks pu
  where pu.property_id = p_property_id
    and pu.mode in ('total', 'partial')
    and pu.status = 'active'
    and pu.expires_at > now()
  order by pu.created_at desc
  limit 1;

  if v_active_exclusive_id is not null then
    raise exception 'property is under active exclusivity' using errcode = '55000';
  end if;

  if v_mode = 'total' then
    if v_normal_count <> 0 then
      raise exception 'total exclusivity requires zero previous normal unlocks' using errcode = '55000';
    end if;
    v_exclusivity_cost := 20;
    v_expires_at := now() + interval '7 days';
  elsif v_mode = 'partial' then
    if v_normal_count < 1 or v_normal_count > 2 then
      raise exception 'partial exclusivity requires one or two previous normal unlocks' using errcode = '55000';
    end if;
    v_exclusivity_cost := 18;
    v_expires_at := now() + interval '7 days';
  end if;

  v_total_cost := v_base_cost + v_exclusivity_cost;

  if v_intent.total_cost <> v_total_cost
     or v_intent.base_cost <> v_base_cost
     or v_intent.exclusivity_cost <> v_exclusivity_cost
     or v_intent.normal_unlock_count <> v_normal_count then
    update public.unlock_intents set status = 'expired' where id = v_intent.id;
    raise exception 'unlock cost changed; current_cost=%', v_total_cost using errcode = '40001';
  end if;

  perform public.ds_require_plan_action('unlock');

  select coalesce(u.nuggets, 0), coalesce(u.is_admin, false)
    into v_remaining, v_is_admin
  from public.users u
  where u.id = v_buyer_id
  for update;

  if v_remaining is null then
    raise exception 'user profile not found' using errcode = 'P0002';
  end if;

  v_charge_cost := case when v_is_admin then 0 else v_total_cost end;

  if not v_is_admin then
    update public.users u
    set nuggets = coalesce(u.nuggets, 0) - v_total_cost,
        updated_at = now()
    where u.id = v_buyer_id
      and coalesce(u.nuggets, 0) >= v_total_cost
    returning u.nuggets into v_remaining;

    if v_remaining is null then
      raise exception 'not enough nuggets' using errcode = '22003';
    end if;
  end if;

  insert into public.property_unlocks(
    property_id,
    owner_id,
    buyer_id,
    mode,
    base_cost,
    exclusivity_cost,
    total_cost,
    normal_unlock_count_at_purchase,
    metadata,
    expires_at
  )
  values (
    p_property_id,
    v_owner_id,
    v_buyer_id,
    v_mode,
    v_base_cost,
    v_exclusivity_cost,
    v_charge_cost,
    v_normal_count,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('intentToken', p_intent_token, 'adminBypass', v_is_admin, 'listedCost', v_total_cost),
    v_expires_at
  )
  returning id into v_unlock_id;

  update public.unlock_intents
  set status = 'consumed',
      consumed_at = now()
  where id = v_intent.id;

  update public.unlocks ul
  set nuggets_spent = coalesce(ul.nuggets_spent, 0) + v_charge_cost
  where ul.buyer_id = v_buyer_id
    and ul.seller_id = v_owner_id;

  if not found then
    insert into public.unlocks(buyer_id, seller_id, nuggets_spent)
    select v_buyer_id, v_owner_id, v_charge_cost
    where not exists (
      select 1
      from public.unlocks ul2
      where ul2.buyer_id = v_buyer_id
        and ul2.seller_id = v_owner_id
    );
  end if;

  insert into public.app_events(user_id, event_type, entity_type, entity_id, value_nuggets, metadata)
  values (
    v_buyer_id,
    case when v_mode = 'normal' then 'property_unlock_normal' else 'exclusive_contact_purchased' end,
    'property',
    p_property_id::text,
    v_charge_cost,
    jsonb_build_object(
      'mode', v_mode,
      'ownerId', v_owner_id,
      'baseCost', v_base_cost,
      'exclusivityCost', v_exclusivity_cost,
      'normalUnlockCount', v_normal_count,
      'intentToken', p_intent_token,
      'adminBypass', v_is_admin,
      'listedCost', v_total_cost
    )
  );

  return query
  select
    v_unlock_id,
    p_property_id,
    v_owner_id,
    v_buyer_id,
    v_mode,
    v_base_cost,
    v_exclusivity_cost,
    v_charge_cost,
    v_expires_at,
    v_remaining,
    v_normal_count;
end;
$$;

grant execute on function public.ds_purchase_property_unlock(uuid, text, jsonb, uuid) to authenticated;

create or replace function public.ds_purchase_contact_unlock(
  p_seller_id uuid,
  p_intent_token uuid
)
returns table (
  unlock_id uuid,
  seller_id uuid,
  total_cost integer,
  remaining_nuggets integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer_id uuid := auth.uid();
  v_seller_id uuid := p_seller_id;
  v_unlock_id uuid;
  v_total_cost integer;
  v_charge_cost integer := 0;
  v_remaining integer;
  v_is_admin boolean := false;
  v_intent public.unlock_intents%rowtype;
begin
  if v_buyer_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if v_seller_id is null then
    raise exception 'seller required' using errcode = '22023';
  end if;
  if p_intent_token is null then
    raise exception 'unlock intent required' using errcode = '22023';
  end if;
  if v_buyer_id = v_seller_id then
    raise exception 'cannot unlock own contact' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('contact-unlock:' || v_buyer_id::text || ':' || v_seller_id::text));

  select u.id
  into v_unlock_id
  from public.unlocks u
  where u.buyer_id = v_buyer_id
    and u.seller_id = v_seller_id
  limit 1;

  if v_unlock_id is not null then
    select u.nuggets into v_remaining from public.users u where u.id = v_buyer_id;
    return query select v_unlock_id, v_seller_id, 0, coalesce(v_remaining, 0);
    return;
  end if;

  if public.ds_has_active_owner_exclusivity(v_seller_id, v_buyer_id) then
    raise exception 'contact is under active exclusivity' using errcode = '55000';
  end if;

  select *
    into v_intent
  from public.unlock_intents ui
  where ui.id = p_intent_token
    and ui.buyer_id = v_buyer_id
    and ui.seller_id = v_seller_id
    and ui.scope = 'contact'
    and ui.mode = 'normal'
    and ui.status = 'pending'
  for update;

  if v_intent.id is null then
    raise exception 'unlock intent invalid' using errcode = '22023';
  end if;

  if v_intent.expires_at <= now() then
    update public.unlock_intents set status = 'expired' where id = v_intent.id;
    raise exception 'unlock intent expired' using errcode = '57014';
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
  into v_total_cost;

  if v_intent.total_cost <> v_total_cost then
    update public.unlock_intents set status = 'expired' where id = v_intent.id;
    raise exception 'unlock cost changed; current_cost=%', v_total_cost using errcode = '40001';
  end if;

  perform public.ds_require_plan_action('unlock');

  select coalesce(u.nuggets, 0), coalesce(u.is_admin, false)
    into v_remaining, v_is_admin
  from public.users u
  where u.id = v_buyer_id
  for update;

  if v_remaining is null then
    raise exception 'user profile not found' using errcode = 'P0002';
  end if;

  v_charge_cost := case when v_is_admin then 0 else v_total_cost end;

  if not v_is_admin then
    update public.users u
    set nuggets = coalesce(u.nuggets, 0) - v_total_cost,
        updated_at = now()
    where u.id = v_buyer_id
      and coalesce(u.nuggets, 0) >= v_total_cost
    returning u.nuggets into v_remaining;

    if v_remaining is null then
      raise exception 'not enough nuggets' using errcode = '22003';
    end if;
  end if;

  insert into public.unlocks(buyer_id, seller_id, nuggets_spent)
  values (v_buyer_id, v_seller_id, v_charge_cost)
  returning id into v_unlock_id;

  update public.unlock_intents
  set status = 'consumed',
      consumed_at = now()
  where id = v_intent.id;

  insert into public.user_feed_actions(user_id, action, entity_type, entity_id, payload)
  values (
    v_buyer_id,
    'unlocked',
    'person',
    v_seller_id::text,
    jsonb_build_object('source', 'contact_unlock_rpc', 'cost', v_charge_cost, 'listedCost', v_total_cost, 'intentToken', p_intent_token, 'adminBypass', v_is_admin)
  )
  on conflict (user_id, action, entity_type, entity_id)
  do update set payload = excluded.payload;

  insert into public.app_events(user_id, event_type, entity_type, entity_id, value_nuggets, metadata)
  values (
    v_buyer_id,
    'contact_unlock_purchased',
    'person',
    v_seller_id::text,
    v_charge_cost,
    jsonb_build_object('source', 'contact_unlock_rpc', 'intentToken', p_intent_token, 'adminBypass', v_is_admin, 'listedCost', v_total_cost)
  );

  return query select v_unlock_id, v_seller_id, v_charge_cost, v_remaining;
end;
$$;

grant execute on function public.ds_purchase_contact_unlock(uuid, uuid) to authenticated;
