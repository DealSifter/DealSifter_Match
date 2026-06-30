-- Make plan limits server-authoritative. Browser storage may cache usage for UX,
-- but every limited action must be checked/consumed here to prevent bypass by
-- clearing localStorage or switching devices.

create table if not exists public.plan_usage_counters (
  user_id uuid not null references public.users(id) on delete cascade,
  action text not null check (action in ('swipe', 'like', 'unlock')),
  period_scope text not null check (period_scope in ('day', 'month')),
  period_start date not null,
  count integer not null default 0 check (count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, action, period_scope, period_start)
);

create index if not exists idx_plan_usage_counters_user_period
  on public.plan_usage_counters(user_id, period_scope, period_start desc);

alter table public.plan_usage_counters enable row level security;

drop policy if exists plan_usage_counters_select_own on public.plan_usage_counters;
create policy plan_usage_counters_select_own
  on public.plan_usage_counters for select
  using (auth.uid() = user_id);

drop policy if exists plan_usage_counters_no_client_writes on public.plan_usage_counters;
create policy plan_usage_counters_no_client_writes
  on public.plan_usage_counters for all
  using (false)
  with check (false);

-- Feed actions drive daily likes/favorites and match state. Direct table writes
-- would bypass ds_consume_plan_actions, so writes must go through RPCs only.
drop policy if exists user_feed_actions_insert_own on public.user_feed_actions;
drop policy if exists user_feed_actions_update_own on public.user_feed_actions;
drop policy if exists user_feed_actions_no_client_insert on public.user_feed_actions;
create policy user_feed_actions_no_client_insert
  on public.user_feed_actions for insert
  with check (false);
drop policy if exists user_feed_actions_no_client_update on public.user_feed_actions;
create policy user_feed_actions_no_client_update
  on public.user_feed_actions for update
  using (false)
  with check (false);

create or replace function public.ds_plan_limit_for_action(
  p_plan_id text,
  p_is_admin boolean,
  p_action text
)
returns integer
language plpgsql
stable
set search_path = public
as $$
declare
  v_plan text := lower(trim(coalesce(p_plan_id, 'free')));
  v_action text := lower(trim(coalesce(p_action, '')));
begin
  if coalesce(p_is_admin, false) or v_plan = 'admin' then
    return null;
  end if;

  if v_action = 'swipe' then
    if v_plan = 'free' then return 20; end if;
    return null;
  end if;

  if v_action = 'like' then
    if v_plan = 'free' then return 5; end if;
    return null;
  end if;

  if v_action = 'unlock' then
    if v_plan = 'free' then return 3; end if;
    if v_plan = 'pro' then return 10; end if;
    return null;
  end if;

  if v_action = 'match' then
    if v_plan = 'free' then return 3; end if;
    if v_plan = 'pro' then return 15; end if;
    return null;
  end if;

  return null;
end;
$$;

create or replace function public.ds_get_plan_usage_snapshot()
returns table (
  plan_id text,
  is_admin boolean,
  swipes_today integer,
  likes_today integer,
  unlocks_this_month integer,
  active_matches integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
  v_month date := date_trunc('month', now() at time zone 'utc')::date;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  return query
  with current_user_row as (
    select
      coalesce(nullif(lower(trim(u.plan_id)), ''), 'free') as plan_id,
      coalesce(u.is_admin, false) as is_admin
    from public.users u
    where u.id = v_user_id
  ),
  usage_rows as (
    select
      coalesce(sum(count) filter (where action = 'swipe' and period_scope = 'day' and period_start = v_today), 0)::integer as swipes_today,
      coalesce(sum(count) filter (where action = 'like' and period_scope = 'day' and period_start = v_today), 0)::integer as likes_today,
      coalesce(sum(count) filter (where action = 'unlock' and period_scope = 'month' and period_start = v_month), 0)::integer as unlocks_counter_month
    from public.plan_usage_counters
    where user_id = v_user_id
  ),
  legacy_unlocks as (
    select greatest(
      (select count(*)::integer from public.unlocks u where u.buyer_id = v_user_id and u.created_at >= v_month),
      (select count(*)::integer from public.property_unlocks pu where pu.buyer_id = v_user_id and pu.created_at >= v_month)
    ) as unlocks_this_month
  ),
  active_unlocks as (
    select count(distinct owner_id)::integer as active_matches
    from (
      select u.seller_id as owner_id
      from public.unlocks u
      where u.buyer_id = v_user_id
      union
      select pu.owner_id as owner_id
      from public.property_unlocks pu
      where pu.buyer_id = v_user_id
        and pu.owner_id is not null
    ) active_owner_rows
  )
  select
    cur.plan_id,
    cur.is_admin,
    ur.swipes_today,
    ur.likes_today,
    greatest(ur.unlocks_counter_month, lu.unlocks_this_month)::integer as unlocks_this_month,
    au.active_matches
  from current_user_row cur
  cross join usage_rows ur
  cross join legacy_unlocks lu
  cross join active_unlocks au;
end;
$$;

create or replace function public.ds_consume_plan_actions(p_actions text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan_id text;
  v_is_admin boolean;
  v_action text;
  v_actions text[] := '{}';
  v_limit integer;
  v_used integer;
  v_today date := (now() at time zone 'utc')::date;
  v_month date := date_trunc('month', now() at time zone 'utc')::date;
  v_scope text;
  v_period date;
  v_snapshot jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select coalesce(nullif(lower(trim(u.plan_id)), ''), 'free'), coalesce(u.is_admin, false)
  into v_plan_id, v_is_admin
  from public.users u
  where u.id = v_user_id;

  if v_plan_id is null then
    raise exception 'user profile not found' using errcode = 'P0002';
  end if;

  select array_agg(distinct action)
  into v_actions
  from (
    select lower(trim(unnest(coalesce(p_actions, '{}'::text[])))) as action
  ) a
  where action in ('swipe', 'like', 'unlock', 'match');

  if coalesce(array_length(v_actions, 1), 0) = 0 then
    select to_jsonb(s) into v_snapshot from public.ds_get_plan_usage_snapshot() s;
    return jsonb_build_object('allowed', true, 'usages', v_snapshot);
  end if;

  -- Serialize each user's limit consumption so two devices cannot both pass the
  -- same remaining quota at the same time.
  perform pg_advisory_xact_lock(hashtext('plan-usage:' || v_user_id::text));

  foreach v_action in array v_actions
  loop
    v_limit := public.ds_plan_limit_for_action(v_plan_id, v_is_admin, v_action);
    if v_limit is null then
      continue;
    end if;

    if v_action = 'match' then
      select count(distinct owner_id)::integer
      into v_used
      from (
        select u.seller_id as owner_id
        from public.unlocks u
        where u.buyer_id = v_user_id
        union
        select pu.owner_id as owner_id
        from public.property_unlocks pu
        where pu.buyer_id = v_user_id
          and pu.owner_id is not null
      ) active_owner_rows;
    else
      v_scope := case when v_action = 'unlock' then 'month' else 'day' end;
      v_period := case when v_action = 'unlock' then v_month else v_today end;

      select coalesce(count, 0)
      into v_used
      from public.plan_usage_counters
      where user_id = v_user_id
        and action = v_action
        and period_scope = v_scope
        and period_start = v_period;

      v_used := coalesce(v_used, 0);
    end if;

    if v_action = 'unlock' then
      v_used := greatest(
        v_used,
        (select greatest(
          (select count(*)::integer from public.unlocks u where u.buyer_id = v_user_id and u.created_at >= v_month),
          (select count(*)::integer from public.property_unlocks pu where pu.buyer_id = v_user_id and pu.created_at >= v_month)
        ))
      );
    end if;

    if v_used >= v_limit then
      select to_jsonb(s) into v_snapshot from public.ds_get_plan_usage_snapshot() s;
      return jsonb_build_object(
        'allowed', false,
        'failed_action', v_action,
        'reason', 'plan_limit_reached',
        'used', v_used,
        'limit', v_limit,
        'usages', v_snapshot
      );
    end if;
  end loop;

  foreach v_action in array v_actions
  loop
    v_limit := public.ds_plan_limit_for_action(v_plan_id, v_is_admin, v_action);
    if v_limit is null then
      continue;
    end if;

    if v_action = 'match' then
      continue;
    end if;

    v_scope := case when v_action = 'unlock' then 'month' else 'day' end;
    v_period := case when v_action = 'unlock' then v_month else v_today end;

    insert into public.plan_usage_counters(user_id, action, period_scope, period_start, count)
    values (v_user_id, v_action, v_scope, v_period, 1)
    on conflict (user_id, action, period_scope, period_start)
    do update set count = public.plan_usage_counters.count + 1, updated_at = now();
  end loop;

  select to_jsonb(s) into v_snapshot from public.ds_get_plan_usage_snapshot() s;
  return jsonb_build_object('allowed', true, 'usages', v_snapshot);
end;
$$;

grant execute on function public.ds_plan_limit_for_action(text, boolean, text) to authenticated;
grant execute on function public.ds_get_plan_usage_snapshot() to authenticated;
grant execute on function public.ds_consume_plan_actions(text[]) to authenticated;

create or replace function public.ds_require_plan_action(p_action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  v_result := public.ds_consume_plan_actions(array[p_action]);
  if not coalesce((v_result ->> 'allowed')::boolean, false) then
    raise exception 'plan_limit_reached:%', coalesce(v_result ->> 'failed_action', p_action)
      using errcode = 'P0001',
            detail = v_result::text;
  end if;
end;
$$;

grant execute on function public.ds_require_plan_action(text) to authenticated;

create or replace function public.ds_purchase_property_unlock(
  p_property_id uuid,
  p_mode text default 'normal',
  p_metadata jsonb default '{}'::jsonb
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

  -- Authoritative plan enforcement lives inside the purchase RPC so browser
  -- state, direct RPC calls, another device, or cleared storage cannot bypass it.
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
    coalesce(p_metadata, '{}'::jsonb),
    v_expires_at
  )
  returning id into v_unlock_id;

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
      'normalUnlockCount', v_normal_count
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

grant execute on function public.ds_purchase_property_unlock(uuid, text, jsonb) to authenticated;

create or replace function public.ds_purchase_contact_unlock(p_seller_id uuid)
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
begin
  if v_buyer_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if v_seller_id is null then
    raise exception 'seller required' using errcode = '22023';
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

  -- Same protection for contact unlocks: the DB consumes/checks the monthly
  -- unlock quota before any paid state can be created.
  perform public.ds_require_plan_action('unlock');

  select greatest(1, (
    (select count(*)::integer
     from public.properties p
     where p.owner_id = v_seller_id
       and coalesce(p.is_active, true) = true
       and coalesce(p.publish_to_showcase, true) = true)
    +
    (select count(*)::integer
     from public.services s
     where s.owner_id = v_seller_id
       and coalesce(s.publish_to_connections, true) = true)
  ))
  into v_total_cost;

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

  insert into public.user_feed_actions(user_id, action, entity_type, entity_id, payload)
  values (
    v_buyer_id,
    'unlocked',
    'person',
    v_seller_id::text,
    jsonb_build_object('source', 'contact_unlock_rpc', 'cost', v_total_cost)
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
    jsonb_build_object('source', 'contact_unlock_rpc')
  );

  return query select v_unlock_id, v_seller_id, v_total_cost, v_remaining;
end;
$$;

grant execute on function public.ds_purchase_contact_unlock(uuid) to authenticated;
