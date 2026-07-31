-- Unlock entitlement is scoped to one independent profile owned by an account.
-- The security identity is (owner_id, profile_scope), never owner_id alone.

create or replace function public.ds_normalize_profile_scope(p_scope text)
returns text
language sql
immutable
set search_path = public
as $$
  select case lower(trim(coalesce(p_scope, '')))
    when 'professional' then 'professional'
    when 'fsbo' then 'fsbo'
    else 'personal'
  end;
$$;

alter table public.unlock_intents
  add column if not exists profile_scope text;
alter table public.unlocks
  add column if not exists profile_scope text;
alter table public.property_unlocks
  add column if not exists profile_scope text;

update public.property_unlocks pu
set profile_scope = public.ds_normalize_profile_scope(p.primary_profile)
from public.properties p
where p.id = pu.property_id
  and pu.profile_scope is null;

update public.unlock_intents ui
set profile_scope = public.ds_normalize_profile_scope(
  coalesce(
    p.primary_profile,
    ui.metadata->>'profileScope',
    ui.metadata->>'primaryProfile',
    'personal'
  )
)
from public.properties p
where p.id = ui.property_id
  and ui.profile_scope is null;

update public.unlock_intents ui
set profile_scope = public.ds_normalize_profile_scope(
  coalesce(ui.metadata->>'profileScope', ui.metadata->>'primaryProfile', 'personal')
)
where ui.profile_scope is null;

update public.unlocks u
set profile_scope = public.ds_normalize_profile_scope(coalesce(
  (
    select ui.profile_scope
    from public.unlock_intents ui
    where ui.buyer_id = u.buyer_id
      and ui.seller_id = u.seller_id
      and ui.status = 'consumed'
    order by ui.consumed_at desc nulls last, ui.created_at desc
    limit 1
  ),
  (
    select pu.profile_scope
    from public.property_unlocks pu
    where pu.buyer_id = u.buyer_id
      and pu.owner_id = u.seller_id
    order by pu.created_at desc
    limit 1
  ),
  'personal'
))
where u.profile_scope is null;

alter table public.unlock_intents
  alter column profile_scope set default 'personal',
  alter column profile_scope set not null;
alter table public.unlocks
  alter column profile_scope set default 'personal',
  alter column profile_scope set not null;
alter table public.property_unlocks
  alter column profile_scope set default 'personal',
  alter column profile_scope set not null;

alter table public.unlock_intents drop constraint if exists unlock_intents_profile_scope_check;
alter table public.unlock_intents add constraint unlock_intents_profile_scope_check
  check (profile_scope in ('personal', 'professional', 'fsbo'));
alter table public.unlocks drop constraint if exists unlocks_profile_scope_check;
alter table public.unlocks add constraint unlocks_profile_scope_check
  check (profile_scope in ('personal', 'professional', 'fsbo'));
alter table public.property_unlocks drop constraint if exists property_unlocks_profile_scope_check;
alter table public.property_unlocks add constraint property_unlocks_profile_scope_check
  check (profile_scope in ('personal', 'professional', 'fsbo'));

alter table public.unlocks drop constraint if exists unlocks_buyer_id_seller_id_key;
create unique index if not exists unlocks_buyer_seller_profile_unique
  on public.unlocks(buyer_id, seller_id, profile_scope);
create index if not exists idx_property_unlocks_owner_profile
  on public.property_unlocks(owner_id, profile_scope, created_at desc);

create or replace function public.ds_profile_portfolio_cost(
  p_owner_id uuid,
  p_profile_scope text
)
returns integer
language sql
stable
set search_path = public
as $$
  select greatest(1, (
    (select count(*)::integer
     from public.properties p
     where p.owner_id = p_owner_id
       and public.ds_normalize_profile_scope(p.primary_profile) = public.ds_normalize_profile_scope(p_profile_scope)
       and coalesce(p.is_active, true)
       and coalesce(p.publish_to_showcase, true)
       and not coalesce(p.deal_closed, false))
    +
    (select count(*)::integer
     from public.services s
     where s.owner_id = p_owner_id
       and public.ds_normalize_profile_scope(s.primary_profile) = public.ds_normalize_profile_scope(p_profile_scope)
       and coalesce(s.publish_to_connections, true))
  ));
$$;

create or replace function public.ds_has_active_profile_exclusivity(
  p_owner_id uuid,
  p_profile_scope text,
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
      and pu.profile_scope = public.ds_normalize_profile_scope(p_profile_scope)
      and pu.mode in ('total', 'partial')
      and coalesce(pu.status, 'active') = 'active'
      and pu.expires_at > now()
      and (p_buyer_id is null or pu.buyer_id is distinct from p_buyer_id)
  );
$$;

create or replace function public.ds_prevent_owner_exclusivity_overlap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select public.ds_normalize_profile_scope(p.primary_profile)
    into new.profile_scope
  from public.properties p
  where p.id = new.property_id;

  if public.ds_has_active_profile_exclusivity(new.owner_id, new.profile_scope, new.buyer_id) then
    raise exception 'profile is under active exclusivity' using errcode = '55000';
  end if;
  return new;
end;
$$;

drop function if exists public.ds_create_unlock_intent(uuid, uuid, text, jsonb);
create function public.ds_create_unlock_intent(
  p_seller_id uuid default null,
  p_property_id uuid default null,
  p_profile_scope text default 'personal',
  p_mode text default 'normal',
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  intent_token uuid,
  seller_id uuid,
  property_id uuid,
  profile_scope text,
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
  v_profile_scope text := public.ds_normalize_profile_scope(p_profile_scope);
  v_scope text := case when p_property_id is null then 'contact' else 'property' end;
  v_mode text := lower(trim(coalesce(p_mode, 'normal')));
  v_base_cost integer := 1;
  v_exclusivity_cost integer := 0;
  v_total_cost integer := 1;
  v_normal_count integer := 0;
  v_token uuid;
  v_expires_at timestamptz := now() + interval '5 minutes';
begin
  if v_buyer_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if v_mode not in ('normal', 'total', 'partial') then
    raise exception 'invalid unlock mode' using errcode = '22023';
  end if;
  if p_metadata is not null and (
    octet_length(p_metadata::text) > 1024
    or public.ds_redact_inline_media_jsonb(p_metadata) <> p_metadata
  ) then
    raise exception 'metadata too large or unsafe' using errcode = '22023';
  end if;

  if v_property_id is not null then
    select p.owner_id, public.ds_normalize_profile_scope(p.primary_profile)
      into v_seller_id, v_profile_scope
    from public.properties p
    where p.id = v_property_id
      and coalesce(p.is_active, true)
      and not coalesce(p.deal_closed, false);
  end if;
  if v_seller_id is null then
    raise exception 'seller required' using errcode = '22023';
  end if;
  if v_seller_id = v_buyer_id then
    raise exception 'cannot unlock own contact' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(
    'profile-unlock-intent:' || v_buyer_id::text || ':' || v_seller_id::text || ':' || v_profile_scope
  ));
  if public.ds_has_active_profile_exclusivity(v_seller_id, v_profile_scope, v_buyer_id) then
    raise exception 'profile is under active exclusivity' using errcode = '55000';
  end if;

  if v_property_id is not null then
    perform public.ds_prune_property_unlocks();
    select count(*) into v_normal_count
    from public.property_unlocks pu
    where pu.property_id = v_property_id and pu.mode = 'normal';
    if exists (
      select 1 from public.property_unlocks pu
      where pu.property_id = v_property_id
        and pu.mode in ('total', 'partial')
        and coalesce(pu.status, 'active') = 'active'
        and pu.expires_at > now()
    ) then
      raise exception 'property is under active exclusivity' using errcode = '55000';
    end if;
  end if;

  v_base_cost := public.ds_profile_portfolio_cost(v_seller_id, v_profile_scope);
  if v_mode = 'total' then
    if v_property_id is null or v_normal_count <> 0 then
      raise exception 'total exclusivity unavailable' using errcode = '55000';
    end if;
    v_exclusivity_cost := 20;
  elsif v_mode = 'partial' then
    if v_property_id is null or v_normal_count < 1 or v_normal_count > 2 then
      raise exception 'partial exclusivity unavailable' using errcode = '55000';
    end if;
    v_exclusivity_cost := 18;
  end if;
  v_total_cost := v_base_cost + v_exclusivity_cost;

  update public.unlock_intents
  set status = 'expired'
  where buyer_id = v_buyer_id and status = 'pending' and expires_at <= now();

  insert into public.unlock_intents(
    buyer_id, seller_id, property_id, profile_scope, scope, mode,
    base_cost, exclusivity_cost, total_cost, normal_unlock_count,
    expires_at, metadata
  ) values (
    v_buyer_id, v_seller_id, v_property_id, v_profile_scope, v_scope, v_mode,
    v_base_cost, v_exclusivity_cost, v_total_cost, v_normal_count,
    v_expires_at,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('profileScope', v_profile_scope)
  )
  returning id into v_token;

  return query select
    v_token, v_seller_id, v_property_id, v_profile_scope, v_scope, v_mode,
    v_base_cost, v_exclusivity_cost, v_total_cost, v_normal_count,
    v_expires_at, false;
end;
$$;

grant execute on function public.ds_create_unlock_intent(uuid, uuid, text, text, jsonb) to authenticated;

drop function if exists public.ds_purchase_contact_unlock(uuid, uuid);
create function public.ds_purchase_contact_unlock(
  p_seller_id uuid,
  p_intent_token uuid,
  p_profile_scope text default 'personal'
)
returns table (
  unlock_id uuid,
  seller_id uuid,
  profile_scope text,
  total_cost integer,
  remaining_nuggets integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer_id uuid := auth.uid();
  v_profile_scope text := public.ds_normalize_profile_scope(p_profile_scope);
  v_unlock_id uuid;
  v_total_cost integer;
  v_charge_cost integer;
  v_remaining integer;
  v_is_admin boolean := false;
  v_intent public.unlock_intents%rowtype;
begin
  if v_buyer_id is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_seller_id is null or p_intent_token is null then raise exception 'unlock target required' using errcode = '22023'; end if;
  if v_buyer_id = p_seller_id then raise exception 'cannot unlock own contact' using errcode = '22023'; end if;

  perform pg_advisory_xact_lock(hashtext(
    'profile-unlock:' || v_buyer_id::text || ':' || p_seller_id::text || ':' || v_profile_scope
  ));

  select u.id into v_unlock_id
  from public.unlocks u
  where u.buyer_id = v_buyer_id
    and u.seller_id = p_seller_id
    and u.profile_scope = v_profile_scope
  limit 1;
  if v_unlock_id is not null then
    select coalesce(u.nuggets, 0) into v_remaining from public.users u where u.id = v_buyer_id;
    return query select v_unlock_id, p_seller_id, v_profile_scope, 0, v_remaining;
    return;
  end if;

  if public.ds_has_active_profile_exclusivity(p_seller_id, v_profile_scope, v_buyer_id) then
    raise exception 'profile is under active exclusivity' using errcode = '55000';
  end if;

  select * into v_intent
  from public.unlock_intents ui
  where ui.id = p_intent_token
    and ui.buyer_id = v_buyer_id
    and ui.seller_id = p_seller_id
    and ui.profile_scope = v_profile_scope
    and ui.scope = 'contact'
    and ui.mode = 'normal'
    and ui.status = 'pending'
  for update;
  if v_intent.id is null then raise exception 'unlock intent invalid' using errcode = '22023'; end if;
  if v_intent.expires_at <= now() then
    update public.unlock_intents set status = 'expired' where id = v_intent.id;
    raise exception 'unlock intent expired' using errcode = '57014';
  end if;

  v_total_cost := public.ds_profile_portfolio_cost(p_seller_id, v_profile_scope);
  if v_intent.total_cost <> v_total_cost then
    update public.unlock_intents set status = 'expired' where id = v_intent.id;
    raise exception 'unlock cost changed; current_cost=%', v_total_cost using errcode = '40001';
  end if;

  perform public.ds_require_plan_action('unlock');
  select coalesce(u.nuggets, 0), coalesce(u.is_admin, false)
    into v_remaining, v_is_admin
  from public.users u where u.id = v_buyer_id for update;
  if v_remaining is null then raise exception 'user profile not found' using errcode = 'P0002'; end if;
  v_charge_cost := case when v_is_admin then 0 else v_total_cost end;
  if not v_is_admin then
    update public.users
    set nuggets = coalesce(nuggets, 0) - v_total_cost, updated_at = now()
    where id = v_buyer_id and coalesce(nuggets, 0) >= v_total_cost
    returning nuggets into v_remaining;
    if v_remaining is null then raise exception 'not enough nuggets' using errcode = '22003'; end if;
  end if;

  insert into public.unlocks(buyer_id, seller_id, profile_scope, nuggets_spent)
  values (v_buyer_id, p_seller_id, v_profile_scope, v_charge_cost)
  returning id into v_unlock_id;
  update public.unlock_intents set status = 'consumed', consumed_at = now() where id = v_intent.id;

  insert into public.user_feed_actions(user_id, action, entity_type, entity_id, payload)
  values (
    v_buyer_id, 'unlocked', 'person',
    p_seller_id::text || ':' || v_profile_scope,
    jsonb_build_object('source', 'contact_unlock_rpc', 'cost', v_charge_cost, 'profileScope', v_profile_scope)
  )
  on conflict (user_id, action, entity_type, entity_id)
  do update set payload = excluded.payload;

  insert into public.app_events(user_id, event_type, entity_type, entity_id, value_nuggets, metadata)
  values (
    v_buyer_id, 'contact_unlock_purchased', 'person',
    p_seller_id::text || ':' || v_profile_scope,
    v_charge_cost,
    jsonb_build_object('ownerId', p_seller_id, 'profileScope', v_profile_scope, 'intentToken', p_intent_token)
  );

  return query select v_unlock_id, p_seller_id, v_profile_scope, v_charge_cost, v_remaining;
end;
$$;

grant execute on function public.ds_purchase_contact_unlock(uuid, uuid, text) to authenticated;

-- Property purchase keeps its public signature; profile scope is derived from
-- the persisted property and cannot be chosen by the browser.
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
  if public.ds_has_active_profile_exclusivity(v_owner_id, v_profile_scope, v_buyer_id) then
    raise exception 'profile is under active exclusivity' using errcode = '55000';
  end if;

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
    update public.unlock_intents set status = 'expired' where id = v_intent.id;
    raise exception 'unlock intent expired' using errcode = '57014';
  end if;

  v_base_cost := public.ds_profile_portfolio_cost(v_owner_id, v_profile_scope);
  select count(*) into v_normal_count
  from public.property_unlocks where property_id = p_property_id and mode = 'normal';
  if exists (
    select 1 from public.property_unlocks
    where property_id = p_property_id
      and mode in ('total', 'partial')
      and status = 'active' and expires_at > now()
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
    update public.unlock_intents set status = 'expired' where id = v_intent.id;
    raise exception 'unlock cost changed; current_cost=%', v_listed_cost using errcode = '40001';
  end if;

  perform public.ds_require_plan_action('unlock');
  select coalesce(nuggets, 0), coalesce(is_admin, false)
    into v_remaining, v_is_admin
  from public.users where id = v_buyer_id for update;
  v_charge_cost := case when v_is_admin then 0 else v_listed_cost end;
  if not v_is_admin then
    update public.users
    set nuggets = coalesce(nuggets, 0) - v_listed_cost, updated_at = now()
    where id = v_buyer_id and coalesce(nuggets, 0) >= v_listed_cost
    returning nuggets into v_remaining;
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

  update public.unlock_intents set status = 'consumed', consumed_at = now() where id = v_intent.id;
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

create or replace function public.ds_get_unlocked_contact_cards(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
      bool_or(unlock_scope = 'contact') contact_entitlement
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
        'email', case when not c.active_other then coalesce(nullif(c.profile->>'email', ''), nullif(c.account_email, '')) end,
        'phone_primary', case when not c.active_other then coalesce(nullif(c.profile->>'primaryPhone', ''), nullif(c.account_phone, '')) end,
        'phone_secondary', case when not c.active_other then nullif(c.profile->>'secondaryPhone', '') end,
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
$$;

grant execute on function public.ds_get_unlocked_contact_cards(uuid) to authenticated, service_role;

create or replace function public.ds_notify_contact_unlock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.seller_id is null or new.buyer_id is null or new.seller_id = new.buyer_id then
    return new;
  end if;
  if exists (
    select 1 from public.property_unlocks pu
    where pu.owner_id = new.seller_id
      and pu.buyer_id = new.buyer_id
      and pu.profile_scope = new.profile_scope
      and pu.created_at >= now() - interval '10 seconds'
  ) then
    return new;
  end if;
  insert into public.notifications(user_id, type, payload)
  values (
    new.seller_id,
    'unlock',
    jsonb_build_object(
      'unlocker_id', new.buyer_id,
      'card_id', new.seller_id,
      'profile_scope', new.profile_scope,
      'property_id', null,
      'nuggets_spent', coalesce(new.nuggets_spent, 0),
      'unlock_id', new.id
    )
  );
  return new;
end;
$$;

create or replace function public.ds_notify_property_unlock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_id is null or new.buyer_id is null or new.owner_id = new.buyer_id then
    return new;
  end if;
  insert into public.notifications(user_id, type, payload)
  values (
    new.owner_id,
    case when new.mode in ('total', 'partial') then 'exclusive' else 'unlock' end,
    jsonb_build_object(
      'unlocker_id', new.buyer_id,
      'card_id', new.owner_id,
      'profile_scope', new.profile_scope,
      'property_id', new.property_id,
      'nuggets_spent', coalesce(new.total_cost, 0),
      'base_cost', coalesce(new.base_cost, 0),
      'exclusivity_cost', coalesce(new.exclusivity_cost, 0),
      'mode', new.mode,
      'unlock_id', new.id
    )
  );
  return new;
end;
$$;

comment on function public.ds_get_unlocked_contact_cards(uuid) is
  'Canonical profile-scoped unlock graph. Sensitive contact data and portfolio are isolated by (owner_id, primary_profile).';
