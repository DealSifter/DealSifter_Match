-- Account deletion strategy for production:
-- soft-delete application data, keep audit/KPI ownership links, and remove PII.

create extension if not exists pgcrypto;

alter table public.users
  alter column email drop not null,
  add column if not exists deleted_at timestamptz,
  add column if not exists deletion_id uuid;

create table if not exists public.account_deletions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email_hash text,
  deleted_at timestamptz not null default now(),
  reason text,
  active_plan_id text,
  active_plan_name text,
  active_subscription_status text,
  stripe_customer_id text,
  stripe_sub_id text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_account_deletions_user_id_deleted_at
  on public.account_deletions(user_id, deleted_at desc);

create index if not exists idx_account_deletions_email_hash
  on public.account_deletions(email_hash);

alter table public.account_deletions enable row level security;

drop policy if exists account_deletions_service_all on public.account_deletions;
create policy account_deletions_service_all
  on public.account_deletions for all
  using (current_setting('role', true) = 'service_role')
  with check (current_setting('role', true) = 'service_role');

create or replace function public.ds_jsonb_strip_personal_fields(p_payload jsonb)
returns jsonb
language plpgsql
immutable
as $$
begin
  if p_payload is null then
    return '{}'::jsonb;
  end if;

  return p_payload
    - 'email'
    - 'emailA'
    - 'emailB'
    - 'phone'
    - 'phoneA'
    - 'phoneB'
    - 'whatsapp'
    - 'whatsappA'
    - 'whatsappB'
    - 'photo'
    - 'photoA'
    - 'photoB'
    - 'photoUrl'
    - 'photoBUrl'
    - 'avatar'
    - 'fullName'
    - 'fullNameA'
    - 'fullNameB'
    - 'name'
    - 'nameA'
    - 'nameB';
end;
$$;

create or replace function public.delete_user_account(target_user_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := target_user_id;
  v_actor uuid;
  v_role text;
  v_email text;
  v_email_hash text;
  v_plan_id text;
  v_plan_name text;
  v_sub_status text;
  v_stripe_customer_id text;
  v_stripe_sub_id text;
  v_deletion_id uuid;
  v_now timestamptz := now();
begin
  begin
    v_actor := auth.uid();
  exception when others then
    v_actor := null;
  end;
  v_role := current_setting('role', true);

  if v_actor is distinct from v_user_id and coalesce(v_role, '') <> 'service_role' then
    raise exception 'Unauthorized';
  end if;

  select u.email, u.plan_id
    into v_email, v_plan_id
  from public.users u
  where u.id = v_user_id
  for update;

  if not found then
    raise exception 'User not found';
  end if;

  select s.plan_id, s.plan_name, s.status, s.stripe_customer_id, s.stripe_sub_id
    into v_plan_id, v_plan_name, v_sub_status, v_stripe_customer_id, v_stripe_sub_id
  from public.subscriptions s
  where s.user_id = v_user_id
  order by
    case when s.status in ('active', 'trialing', 'past_due') then 0 else 1 end,
    s.updated_at desc nulls last,
    s.created_at desc
  limit 1;

  if nullif(trim(coalesce(v_email, '')), '') is not null then
    v_email_hash := encode(digest(lower(trim(v_email)), 'sha256'), 'hex');
  end if;

  insert into public.account_deletions (
    user_id,
    email_hash,
    deleted_at,
    reason,
    active_plan_id,
    active_plan_name,
    active_subscription_status,
    stripe_customer_id,
    stripe_sub_id,
    metadata
  ) values (
    v_user_id,
    v_email_hash,
    v_now,
    nullif(trim(coalesce(p_reason, '')), ''),
    coalesce(v_plan_id, 'free'),
    coalesce(v_plan_name, 'Free'),
    coalesce(v_sub_status, 'none'),
    v_stripe_customer_id,
    v_stripe_sub_id,
    jsonb_build_object('actorUserId', v_actor, 'strategy', 'soft-delete-v1')
  )
  returning id into v_deletion_id;

  update public.properties
  set is_active = false,
      publish_to_showcase = false,
      include_in_preview = false,
      address = null,
      description = null,
      updated_at = v_now
  where owner_id = v_user_id;

  update public.services
  set publish_to_connections = false,
      title = 'Deleted User',
      description = null,
      media_images = '{}'::text[],
      updated_at = v_now
  where owner_id = v_user_id;

  update public.card_spotlights
  set expires_at = least(expires_at, v_now)
  where user_id = v_user_id
     or owner_id = v_user_id;

  update public.subscriptions
  set status = 'canceled',
      plan_id = 'free',
      plan_name = 'Free',
      updated_at = v_now
  where user_id = v_user_id;

  update public.users
  set email = null,
      full_name = 'Deleted User',
      phone = null,
      settings_payload = '{}'::jsonb,
      plan_id = 'free',
      deleted_at = v_now,
      deletion_id = v_deletion_id,
      updated_at = v_now
  where id = v_user_id;

  update public.user_profiles
  set full_name = 'Deleted User',
      photo_url = null,
      bio = null,
      visibility = 'hidden',
      updated_at = v_now
  where user_id = v_user_id;

  update public.professional_profiles
  set category = null,
      subcategory = null,
      markets = '{}'::text[],
      skills = '{}'::text[],
      services = '{}'::text[],
      pitch = null,
      primary_category = null,
      category_b = null,
      primary_category_b = null,
      photo_b_url = null,
      profile_payload = public.ds_jsonb_strip_personal_fields(profile_payload),
      updated_at = v_now
  where user_id = v_user_id;

  update public.consent_records
  set user_id = null,
      anonymous_id = 'deleted-' || v_user_id::text,
      revoked_at = coalesce(revoked_at, v_now)
  where user_id = v_user_id;

  -- Deliberately keep unlocks/property_unlocks/nugget_purchases/app_events.
  -- They retain owner_id/user_id for KPI audit, while public profile PII is now removed.

  return jsonb_build_object(
    'ok', true,
    'deletionId', v_deletion_id,
    'userId', v_user_id,
    'emailHash', v_email_hash,
    'stripeSubId', v_stripe_sub_id
  );
end;
$$;

grant execute on function public.delete_user_account(uuid, text) to authenticated, service_role;

-- Backward-compatible wrapper for any older client that still sends only user_id.
create or replace function public.delete_user_account(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.delete_user_account(target_user_id, null);
end;
$$;

grant execute on function public.delete_user_account(uuid) to authenticated;

create or replace function public.handle_new_auth_user()
returns trigger as $$
begin
  insert into public.users (id, email, full_name, deleted_at, deletion_id)
  values (
    new.id,
    nullif(new.email, ''),
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), nullif(new.raw_user_meta_data->>'name', ''), ''),
    null,
    null
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(nullif(excluded.full_name, ''), public.users.full_name),
      deleted_at = null,
      deletion_id = null,
      updated_at = now()
  where public.users.deleted_at is null;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

drop policy if exists users_select_showcase on public.users;
create policy users_select_showcase on public.users
for select using (
  deleted_at is null
  and (
    exists (
      select 1 from public.properties p
      where p.owner_id = id
        and p.is_active = true
        and p.publish_to_showcase = true
    )
    or exists (
      select 1 from public.services s
      where s.owner_id = id
        and s.publish_to_connections = true
    )
  )
);

drop policy if exists professional_profile_select_showcase on public.professional_profiles;
create policy professional_profile_select_showcase on public.professional_profiles
for select using (
  exists (
    select 1 from public.users u
    where u.id = user_id
      and u.deleted_at is null
  )
  and (
    exists (
      select 1 from public.properties p
      where p.owner_id = user_id
        and p.is_active = true
        and p.publish_to_showcase = true
    )
    or exists (
      select 1 from public.services s
      where s.owner_id = user_id
        and s.publish_to_connections = true
    )
  )
);
