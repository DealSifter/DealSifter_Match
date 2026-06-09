-- Admin metrics foundation: small append-only tables + admin-only RPCs.
-- Keep payloads compact to protect Supabase free-tier limits.

create table if not exists public.admin_nugget_grants (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.users(id) on delete restrict,
  target_user_id uuid not null references public.users(id) on delete cascade,
  amount integer not null check (amount > 0 and amount <= 10000),
  reason text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_nugget_grants_created_at
  on public.admin_nugget_grants(created_at desc);
create index if not exists idx_admin_nugget_grants_target
  on public.admin_nugget_grants(target_user_id, created_at desc);

alter table public.admin_nugget_grants enable row level security;

drop policy if exists admin_nugget_grants_no_direct_client_access on public.admin_nugget_grants;
create policy admin_nugget_grants_no_direct_client_access
  on public.admin_nugget_grants for all
  using (false)
  with check (false);

create table if not exists public.app_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  event_type text not null,
  entity_type text,
  entity_id text,
  value_nuggets integer not null default 0,
  value_usd_cents integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint app_events_type_safe check (event_type ~ '^[a-z0-9_:-]{2,64}$'),
  constraint app_events_metadata_size check (octet_length(metadata::text) <= 2048)
);

create index if not exists idx_app_events_created_type
  on public.app_events(created_at desc, event_type);
create index if not exists idx_app_events_user_created
  on public.app_events(user_id, created_at desc);

alter table public.app_events enable row level security;

drop policy if exists app_events_insert_own on public.app_events;
create policy app_events_insert_own
  on public.app_events for insert
  with check (user_id = auth.uid());

drop policy if exists app_events_no_direct_select on public.app_events;
create policy app_events_no_direct_select
  on public.app_events for select
  using (false);

create table if not exists public.user_activity_heartbeats (
  user_id uuid primary key references public.users(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  page text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_activity_heartbeats_last_seen
  on public.user_activity_heartbeats(last_seen_at desc);

alter table public.user_activity_heartbeats enable row level security;

drop policy if exists user_activity_heartbeats_upsert_own on public.user_activity_heartbeats;
create policy user_activity_heartbeats_upsert_own
  on public.user_activity_heartbeats for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table if not exists public.service_health_events (
  id uuid primary key default gen_random_uuid(),
  service text not null check (service in ('supabase', 'stripe', 'checkout', 'webhook', 'app')),
  status text not null check (status in ('ok', 'degraded', 'down', 'error')),
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint service_health_metadata_size check (octet_length(metadata::text) <= 2048)
);

create index if not exists idx_service_health_events_created_service
  on public.service_health_events(created_at desc, service);

alter table public.service_health_events enable row level security;

drop policy if exists service_health_events_no_direct_client_access on public.service_health_events;
create policy service_health_events_no_direct_client_access
  on public.service_health_events for all
  using (false)
  with check (false);

create or replace function public.ds_is_current_user_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.is_admin = true
  );
$$;

create or replace function public.admin_find_users(p_search text, p_limit integer default 8)
returns table (
  id uuid,
  email text,
  full_name text,
  nuggets integer,
  plan_id text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ds_is_current_user_admin() then
    raise exception 'admin access required';
  end if;

  return query
  select u.id, u.email, u.full_name, u.nuggets, u.plan_id, u.created_at
  from public.users u
  where trim(coalesce(p_search, '')) = ''
     or u.email ilike '%' || trim(p_search) || '%'
     or u.full_name ilike '%' || trim(p_search) || '%'
  order by u.created_at desc
  limit least(greatest(coalesce(p_limit, 8), 1), 20);
end;
$$;

create or replace function public.admin_grant_nuggets(p_target_user_id uuid, p_amount integer, p_reason text default '')
returns table (
  user_id uuid,
  email text,
  new_balance integer,
  granted_amount integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_new_balance integer;
begin
  if not public.ds_is_current_user_admin() then
    raise exception 'admin access required';
  end if;

  if p_amount is null or p_amount <= 0 or p_amount > 10000 then
    raise exception 'amount must be between 1 and 10000';
  end if;

  update public.users u
  set nuggets = coalesce(u.nuggets, 0) + p_amount,
      updated_at = now()
  where u.id = p_target_user_id
  returning u.nuggets into v_new_balance;

  if v_new_balance is null then
    raise exception 'target user not found';
  end if;

  insert into public.admin_nugget_grants(admin_id, target_user_id, amount, reason)
  values (v_admin_id, p_target_user_id, p_amount, left(coalesce(p_reason, ''), 280));

  insert into public.app_events(user_id, event_type, entity_type, entity_id, value_nuggets, metadata)
  values (
    p_target_user_id,
    'admin_nuggets_granted',
    'user',
    p_target_user_id::text,
    p_amount,
    jsonb_build_object('admin_id', v_admin_id, 'reason', left(coalesce(p_reason, ''), 280))
  );

  return query
  select u.id, u.email, u.nuggets, p_amount
  from public.users u
  where u.id = p_target_user_id;
end;
$$;

create or replace function public.track_app_event(
  p_event_type text,
  p_entity_type text default null,
  p_entity_id text default null,
  p_value_nuggets integer default 0,
  p_value_usd_cents integer default 0,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  insert into public.app_events(
    user_id,
    event_type,
    entity_type,
    entity_id,
    value_nuggets,
    value_usd_cents,
    metadata
  )
  values (
    auth.uid(),
    lower(left(coalesce(p_event_type, 'unknown'), 64)),
    left(p_entity_type, 48),
    left(p_entity_id, 96),
    coalesce(p_value_nuggets, 0),
    coalesce(p_value_usd_cents, 0),
    coalesce(p_metadata, '{}'::jsonb)
  );
exception
  when others then
    -- Analytics must never break user flows.
    return;
end;
$$;

create or replace function public.track_user_heartbeat(p_page text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  insert into public.user_activity_heartbeats(user_id, last_seen_at, page, updated_at)
  values (auth.uid(), now(), left(p_page, 48), now())
  on conflict (user_id)
  do update set
    last_seen_at = excluded.last_seen_at,
    page = excluded.page,
    updated_at = excluded.updated_at;
exception
  when others then
    return;
end;
$$;

create or replace function public.admin_get_dashboard_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.ds_is_current_user_admin() then
    raise exception 'admin access required';
  end if;

  select jsonb_build_object(
    'activeUsersNow', (select count(*) from public.user_activity_heartbeats where last_seen_at >= now() - interval '5 minutes'),
    'totalUsers', (select count(*) from public.users),
    'adminAccounts', (select count(*) from public.users where is_admin = true),
    'newUsersDay', (select count(*) from public.users where created_at >= now() - interval '1 day'),
    'newUsersWeek', (select count(*) from public.users where created_at >= now() - interval '7 days'),
    'newUsersMonth', (select count(*) from public.users where created_at >= now() - interval '30 days'),
    'totalProperties', (select count(*) from public.properties),
    'totalUnlocks', (select count(*) from public.unlocks),
    'usersWithUnlocks', (select count(distinct buyer_id) from public.unlocks),
    'nuggetsPurchased', coalesce((select sum(qty + bonus) from public.nugget_purchases where status = 'completed'), 0),
    'packRevenueUsdCents', coalesce((select sum(price_cents) from public.nugget_purchases where status = 'completed'), 0),
    'activeSubscriptions', (select count(*) from public.subscriptions where status in ('active', 'trialing')),
    'subscriptionRevenueUsdCents', coalesce((select sum(price_cents) from public.subscriptions where status in ('active', 'trialing')), 0),
    'manualNuggetsGranted', coalesce((select sum(amount) from public.admin_nugget_grants), 0),
    'manualNuggetsGrantedToday', coalesce((select sum(amount) from public.admin_nugget_grants where created_at >= now() - interval '1 day'), 0),
    'supportMessagesToday', (select count(*) from public.app_events where event_type = 'support_message_sent' and created_at >= now() - interval '1 day'),
    'swipesToday', (select count(*) from public.app_events where event_type = 'swipe_given' and created_at >= now() - interval '1 day'),
    'exclusiveContactsToday', (select count(*) from public.app_events where event_type = 'exclusive_contact_purchased' and created_at >= now() - interval '1 day'),
    'highlightsActive', (select count(*) from public.app_events where event_type = 'highlight_active'),
    'highlightsPurchasedToday', (select count(*) from public.app_events where event_type = 'highlight_purchased' and created_at >= now() - interval '1 day'),
    'stripeIssuesDay', (select count(*) from public.service_health_events where service in ('stripe', 'checkout', 'webhook') and status in ('down', 'error', 'degraded') and created_at >= now() - interval '1 day'),
    'supabaseIssuesDay', (select count(*) from public.service_health_events where service = 'supabase' and status in ('down', 'error', 'degraded') and created_at >= now() - interval '1 day')
  )
  into v_result;

  return v_result;
end;
$$;

grant execute on function public.admin_find_users(text, integer) to authenticated;
grant execute on function public.admin_grant_nuggets(uuid, integer, text) to authenticated;
grant execute on function public.admin_get_dashboard_snapshot() to authenticated;
grant execute on function public.track_app_event(text, text, text, integer, integer, jsonb) to authenticated;
grant execute on function public.track_user_heartbeat(text) to authenticated;
