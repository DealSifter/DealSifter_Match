-- Exclusivity now locks the whole contact owner while the timer is active.
-- Rationale: contact channels live on the owner/profile, so allowing another
-- user to unlock the personal/business/FSBO card during a property exclusivity
-- would leak the exclusive contact.

create or replace function public.ds_has_active_owner_exclusivity(
  p_owner_id uuid,
  p_buyer_id uuid default null
)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.property_unlocks pu
    where pu.owner_id = p_owner_id
      and pu.mode in ('total', 'partial')
      and coalesce(pu.status, 'active') = 'active'
      and pu.expires_at is not null
      and pu.expires_at > now()
      and (p_buyer_id is null or pu.buyer_id is distinct from p_buyer_id)
  );
$$;

grant execute on function public.ds_has_active_owner_exclusivity(uuid, uuid) to authenticated, service_role;

create or replace function public.ds_prevent_owner_exclusivity_overlap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_id is null or new.buyer_id is null then
    return new;
  end if;

  if public.ds_has_active_owner_exclusivity(new.owner_id, new.buyer_id) then
    raise exception 'contact is under active exclusivity' using errcode = '55000';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_owner_exclusivity_overlap on public.property_unlocks;
create trigger trg_prevent_owner_exclusivity_overlap
before insert on public.property_unlocks
for each row execute function public.ds_prevent_owner_exclusivity_overlap();

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

  -- If another buyer holds exclusivity anywhere in this owner's portfolio,
  -- no new contact/property unlock intent can be issued until it expires.
  if public.ds_has_active_owner_exclusivity(v_seller_id, v_buyer_id) then
    raise exception 'contact is under active exclusivity' using errcode = '55000';
  end if;

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
      and coalesce(pu.status, 'active') = 'active'
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
  v_remaining integer;
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

  update public.users u
  set nuggets = coalesce(u.nuggets, 0) - v_total_cost,
      updated_at = now()
  where u.id = v_buyer_id
    and coalesce(u.nuggets, 0) >= v_total_cost
  returning u.nuggets into v_remaining;

  if v_remaining is null then
    raise exception 'not enough nuggets' using errcode = '22003';
  end if;

  insert into public.unlocks(buyer_id, seller_id, nuggets_spent)
  values (v_buyer_id, v_seller_id, v_total_cost)
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
    jsonb_build_object('source', 'contact_unlock_rpc', 'cost', v_total_cost, 'intentToken', p_intent_token)
  )
  on conflict (user_id, action, entity_type, entity_id)
  do update set payload = excluded.payload;

  insert into public.app_events(user_id, event_type, entity_type, entity_id, value_nuggets, metadata)
  values (
    v_buyer_id,
    'contact_unlock_purchased',
    'person',
    v_seller_id::text,
    v_total_cost,
    jsonb_build_object('source', 'contact_unlock_rpc', 'intentToken', p_intent_token)
  );

  return query select v_unlock_id, v_seller_id, v_total_cost, v_remaining;
end;
$$;

grant execute on function public.ds_purchase_contact_unlock(uuid, uuid) to authenticated;
