-- Allow admins to grant plan privileges without creating a Stripe subscription.
-- The runtime source of truth remains public.users.plan_id, so existing limits
-- and feature gates immediately recognize the manual grant.

create table if not exists public.admin_plan_grants (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.users(id) on delete restrict,
  target_user_id uuid not null references public.users(id) on delete cascade,
  previous_plan_id text,
  granted_plan_id text not null check (granted_plan_id in ('free', 'pro', 'enterprise')),
  reason text not null default '',
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_plan_grants_created_at
  on public.admin_plan_grants(created_at desc);

create index if not exists idx_admin_plan_grants_target
  on public.admin_plan_grants(target_user_id, created_at desc);

alter table public.admin_plan_grants enable row level security;

drop policy if exists admin_plan_grants_no_direct_client_access on public.admin_plan_grants;
create policy admin_plan_grants_no_direct_client_access
  on public.admin_plan_grants for all
  using (false)
  with check (false);

alter table public.users
  add column if not exists plan_override_source text,
  add column if not exists plan_override_reason text,
  add column if not exists plan_override_expires_at timestamptz,
  add column if not exists plan_override_updated_at timestamptz;

create or replace function public.admin_set_user_plan_override(
  p_target_user_id uuid,
  p_plan_id text,
  p_reason text default '',
  p_expires_at timestamptz default null
)
returns table (
  user_id uuid,
  email text,
  previous_plan_id text,
  plan_id text,
  plan_override_source text,
  plan_override_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_plan text := lower(trim(coalesce(p_plan_id, '')));
  v_previous_plan text;
  v_new_plan text;
begin
  if not public.ds_is_current_user_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;

  if v_plan not in ('free', 'pro', 'enterprise') then
    raise exception 'plan must be free, pro or enterprise' using errcode = '22023';
  end if;

  select coalesce(nullif(lower(trim(u.plan_id)), ''), 'free')
    into v_previous_plan
  from public.users u
  where u.id = p_target_user_id;

  if v_previous_plan is null then
    raise exception 'target user not found' using errcode = 'P0002';
  end if;

  update public.users u
  set plan_id = v_plan,
      plan_override_source = case when v_plan = 'free' then null else 'admin_manual' end,
      plan_override_reason = case when v_plan = 'free' then null else left(coalesce(p_reason, ''), 280) end,
      plan_override_expires_at = case when v_plan = 'free' then null else p_expires_at end,
      plan_override_updated_at = now(),
      updated_at = now()
  where u.id = p_target_user_id
  returning coalesce(nullif(lower(trim(u.plan_id)), ''), 'free')
    into v_new_plan;

  insert into public.admin_plan_grants(
    admin_id,
    target_user_id,
    previous_plan_id,
    granted_plan_id,
    reason,
    expires_at
  )
  values (
    v_admin_id,
    p_target_user_id,
    v_previous_plan,
    v_plan,
    left(coalesce(p_reason, ''), 280),
    p_expires_at
  );

  insert into public.app_events(user_id, event_type, entity_type, entity_id, metadata)
  values (
    p_target_user_id,
    'admin_plan_override_set',
    'user',
    p_target_user_id::text,
    jsonb_build_object(
      'admin_id', v_admin_id,
      'previous_plan_id', v_previous_plan,
      'plan_id', v_plan,
      'source', case when v_plan = 'free' then 'admin_manual_removed' else 'admin_manual' end,
      'reason', left(coalesce(p_reason, ''), 280),
      'expires_at', p_expires_at
    )
  );

  return query
  select
    u.id,
    u.email,
    v_previous_plan,
    coalesce(nullif(lower(trim(u.plan_id)), ''), 'free'),
    u.plan_override_source,
    u.plan_override_expires_at
  from public.users u
  where u.id = p_target_user_id;
end;
$$;

grant execute on function public.admin_set_user_plan_override(uuid, text, text, timestamptz) to authenticated;
