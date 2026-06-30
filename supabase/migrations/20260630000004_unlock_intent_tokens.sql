create table if not exists public.unlock_intents (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.users(id) on delete cascade,
  seller_id uuid not null references public.users(id) on delete cascade,
  property_id uuid null references public.properties(id) on delete cascade,
  scope text not null default 'contact' check (scope in ('contact', 'property')),
  mode text not null default 'normal' check (mode in ('normal', 'total', 'partial')),
  base_cost integer not null check (base_cost >= 1),
  exclusivity_cost integer not null default 0 check (exclusivity_cost >= 0),
  total_cost integer not null check (total_cost >= 1),
  normal_unlock_count integer not null default 0 check (normal_unlock_count >= 0),
  status text not null default 'pending' check (status in ('pending', 'consumed', 'expired')),
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  consumed_at timestamptz null
);

create index if not exists idx_unlock_intents_buyer_status
  on public.unlock_intents(buyer_id, status, expires_at desc);

create index if not exists idx_unlock_intents_seller_created
  on public.unlock_intents(seller_id, created_at desc);

alter table public.unlock_intents enable row level security;

drop policy if exists unlock_intents_select_own on public.unlock_intents;
create policy unlock_intents_select_own
  on public.unlock_intents for select
  using (buyer_id = auth.uid());

drop policy if exists unlock_intents_no_direct_insert on public.unlock_intents;
create policy unlock_intents_no_direct_insert
  on public.unlock_intents for insert
  with check (false);

drop policy if exists unlock_intents_no_direct_update on public.unlock_intents;
create policy unlock_intents_no_direct_update
  on public.unlock_intents for update
  using (false);

drop policy if exists unlock_intents_no_direct_delete on public.unlock_intents;
create policy unlock_intents_no_direct_delete
  on public.unlock_intents for delete
  using (false);

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

  update public.unlock_intents
  set status = 'expired'
  where buyer_id = v_buyer_id
    and status = 'pending'
    and expires_at <= now();

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

drop function if exists public.ds_purchase_property_unlock(uuid, text, jsonb, integer);

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
  v_normal_count integer := 0;
  v_active_exclusive_id uuid;
  v_expires_at timestamptz := null;
  v_remaining integer;
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

  update public.users u
  set nuggets = coalesce(u.nuggets, 0) - v_total_cost,
      updated_at = now()
  where u.id = v_buyer_id
    and coalesce(u.nuggets, 0) >= v_total_cost
  returning u.nuggets into v_remaining;

  if v_remaining is null then
    raise exception 'not enough nuggets' using errcode = '22003';
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
    v_total_cost,
    v_normal_count,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('intentToken', p_intent_token),
    v_expires_at
  )
  returning id into v_unlock_id;

  update public.unlock_intents
  set status = 'consumed',
      consumed_at = now()
  where id = v_intent.id;

  update public.unlocks ul
  set nuggets_spent = coalesce(ul.nuggets_spent, 0) + v_total_cost
  where ul.buyer_id = v_buyer_id
    and ul.seller_id = v_owner_id;

  if not found then
    insert into public.unlocks(buyer_id, seller_id, nuggets_spent)
    select v_buyer_id, v_owner_id, v_total_cost
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
    v_total_cost,
    jsonb_build_object(
      'mode', v_mode,
      'ownerId', v_owner_id,
      'baseCost', v_base_cost,
      'exclusivityCost', v_exclusivity_cost,
      'normalUnlockCount', v_normal_count,
      'intentToken', p_intent_token
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
    v_total_cost,
    v_expires_at,
    v_remaining,
    v_normal_count;
end;
$$;

grant execute on function public.ds_purchase_property_unlock(uuid, text, jsonb, uuid) to authenticated;

drop function if exists public.ds_purchase_contact_unlock(uuid, integer);

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
