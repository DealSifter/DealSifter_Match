-- Property-level unlock/exclusivity foundation.
-- Guardrail notes:
-- - No backfill and no mock data inserts.
-- - Metadata is capped and inline media is blocked.
-- - Expired exclusive rows are retained briefly for KPIs/debugging, then pruned by RPC.

create table if not exists public.property_unlocks (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  owner_id uuid not null references public.users(id) on delete cascade,
  buyer_id uuid not null references public.users(id) on delete cascade,
  mode text not null default 'normal' check (mode in ('normal', 'total', 'partial')),
  base_cost integer not null default 0 check (base_cost >= 0 and base_cost <= 10000),
  exclusivity_cost integer not null default 0 check (exclusivity_cost >= 0 and exclusivity_cost <= 10000),
  total_cost integer not null default 0 check (total_cost >= 0 and total_cost <= 20000),
  normal_unlock_count_at_purchase integer not null default 0 check (normal_unlock_count_at_purchase >= 0),
  status text not null default 'active' check (status in ('active', 'expired', 'canceled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  constraint property_unlocks_metadata_safe check (
    octet_length(metadata::text) <= 1024
    and public.ds_redact_inline_media_jsonb(metadata) = metadata
  ),
  constraint property_unlocks_exclusive_expiry check (
    (mode = 'normal' and expires_at is null)
    or (mode in ('total', 'partial') and expires_at is not null)
  )
);

create index if not exists idx_property_unlocks_property_created
  on public.property_unlocks(property_id, created_at desc);

create index if not exists idx_property_unlocks_buyer_created
  on public.property_unlocks(buyer_id, created_at desc);

create index if not exists idx_property_unlocks_owner_created
  on public.property_unlocks(owner_id, created_at desc);

create index if not exists idx_property_unlocks_active_exclusive
  on public.property_unlocks(property_id, expires_at desc)
  where mode in ('total', 'partial') and status = 'active';

alter table public.property_unlocks enable row level security;

drop policy if exists property_unlocks_select_participants on public.property_unlocks;
create policy property_unlocks_select_participants
  on public.property_unlocks for select
  using (buyer_id = auth.uid() or owner_id = auth.uid());

drop policy if exists property_unlocks_no_direct_insert on public.property_unlocks;
create policy property_unlocks_no_direct_insert
  on public.property_unlocks for insert
  with check (false);

drop policy if exists property_unlocks_no_direct_update on public.property_unlocks;
create policy property_unlocks_no_direct_update
  on public.property_unlocks for update
  using (false)
  with check (false);

drop policy if exists property_unlocks_no_direct_delete on public.property_unlocks;
create policy property_unlocks_no_direct_delete
  on public.property_unlocks for delete
  using (false);

create or replace function public.ds_prune_property_unlocks()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
begin
  update public.property_unlocks
  set status = 'expired'
  where mode in ('total', 'partial')
    and status = 'active'
    and expires_at <= now();

  delete from public.property_unlocks
  where status in ('expired', 'canceled')
    and coalesce(expires_at, created_at) < now() - interval '90 days';

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

create or replace function public.ds_get_property_exclusivity_status(p_property_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_normal_count integer := 0;
  v_exclusive public.property_unlocks%rowtype;
begin
  perform public.ds_prune_property_unlocks();

  select count(*)
    into v_normal_count
  from public.property_unlocks
  where property_id = p_property_id
    and mode = 'normal';

  select *
    into v_exclusive
  from public.property_unlocks
  where property_id = p_property_id
    and mode in ('total', 'partial')
    and status = 'active'
    and expires_at > now()
  order by created_at desc
  limit 1;

  if v_exclusive.id is not null then
    return jsonb_build_object(
      'kind', 'blocked',
      'mode', v_exclusive.mode,
      'unlockCount', v_normal_count,
      'expiresAt', v_exclusive.expires_at
    );
  end if;

  if v_normal_count = 0 then
    return jsonb_build_object('kind', 'new', 'unlockCount', 0, 'exclusiveCost', 20);
  end if;

  if v_normal_count <= 2 then
    return jsonb_build_object('kind', 'partial', 'unlockCount', v_normal_count, 'exclusiveCost', 18);
  end if;

  return jsonb_build_object('kind', 'standard', 'unlockCount', v_normal_count, 'exclusiveCost', 0);
end;
$$;

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
    and p.publish_to_showcase = true;

  if v_owner_id is null then
    raise exception 'property not available for unlock' using errcode = 'P0002';
  end if;

  if v_owner_id = v_buyer_id then
    raise exception 'cannot unlock own property' using errcode = '22023';
  end if;

  select greatest(1, count(*)::integer)
    into v_base_cost
  from (
    select id from public.properties
    where owner_id = v_owner_id
      and is_active = true
      and publish_to_showcase = true
    union all
    select id from public.services
    where owner_id = v_owner_id
      and publish_to_connections = true
  ) portfolio_items;

  select count(*)
    into v_normal_count
  from public.property_unlocks
  where property_id = p_property_id
    and mode = 'normal';

  select id
    into v_active_exclusive_id
  from public.property_unlocks
  where property_id = p_property_id
    and mode in ('total', 'partial')
    and status = 'active'
    and expires_at > now()
  order by created_at desc
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

  insert into public.unlocks(buyer_id, seller_id, nuggets_spent)
  values (v_buyer_id, v_owner_id, v_total_cost)
  on conflict (buyer_id, seller_id)
  do update set nuggets_spent = public.unlocks.nuggets_spent + excluded.nuggets_spent;

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

grant execute on function public.ds_prune_property_unlocks() to authenticated;
grant execute on function public.ds_get_property_exclusivity_status(uuid) to authenticated;
grant execute on function public.ds_purchase_property_unlock(uuid, text, jsonb) to authenticated;
