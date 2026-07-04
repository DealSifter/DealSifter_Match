-- Preserve legal proof of terms/privacy acceptance when an account is soft-deleted.
-- This keeps a non-PII audit trail suitable for later legal review.

create extension if not exists pgcrypto;

alter table public.consent_records
  drop constraint if exists consent_records_user_id_fkey;

alter table public.consent_records
  add constraint consent_records_user_id_fkey
  foreign key (user_id) references public.users(id) on delete set null;

alter table public.account_deletions
  add column if not exists signed_up_at timestamptz,
  add column if not exists last_sign_in_at timestamptz,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version text,
  add column if not exists privacy_accepted_at timestamptz,
  add column if not exists privacy_version text,
  add column if not exists legal_audit_snapshot jsonb not null default '{}'::jsonb;

create table if not exists public.account_deletion_legal_audit (
  id uuid primary key default gen_random_uuid(),
  deletion_id uuid references public.account_deletions(id) on delete set null,
  user_id uuid not null,
  email_hash text,
  signed_up_at timestamptz,
  last_sign_in_at timestamptz,
  deleted_at timestamptz not null,
  terms_accepted_at timestamptz,
  terms_version text,
  privacy_accepted_at timestamptz,
  privacy_version text,
  consent_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_account_deletion_legal_audit_user_deleted
  on public.account_deletion_legal_audit(user_id, deleted_at desc);

create index if not exists idx_account_deletion_legal_audit_email_hash
  on public.account_deletion_legal_audit(email_hash);

create index if not exists idx_account_deletion_legal_audit_deletion_id
  on public.account_deletion_legal_audit(deletion_id);

alter table public.account_deletion_legal_audit enable row level security;

drop policy if exists account_deletion_legal_audit_service_all on public.account_deletion_legal_audit;
create policy account_deletion_legal_audit_service_all
  on public.account_deletion_legal_audit for all
  using (current_setting('role', true) = 'service_role')
  with check (current_setting('role', true) = 'service_role');

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
  v_signed_up_at timestamptz;
  v_last_sign_in_at timestamptz;
  v_terms_accepted_at timestamptz;
  v_terms_version text;
  v_privacy_accepted_at timestamptz;
  v_privacy_version text;
  v_consent_snapshot jsonb := '[]'::jsonb;
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

  select au.created_at, au.last_sign_in_at
    into v_signed_up_at, v_last_sign_in_at
  from auth.users au
  where au.id = v_user_id;

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

  select cr.accepted_at, cr.version
    into v_terms_accepted_at, v_terms_version
  from public.consent_records cr
  where cr.user_id = v_user_id
    and cr.consent_type = 'terms_of_use'
    and cr.revoked_at is null
  order by cr.accepted_at desc
  limit 1;

  select cr.accepted_at, cr.version
    into v_privacy_accepted_at, v_privacy_version
  from public.consent_records cr
  where cr.user_id = v_user_id
    and cr.consent_type = 'data_processing'
    and cr.revoked_at is null
  order by cr.accepted_at desc
  limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', cr.id,
    'consentType', cr.consent_type,
    'version', cr.version,
    'acceptedAt', cr.accepted_at,
    'revokedAt', cr.revoked_at,
    'anonymousId', cr.anonymous_id,
    'userAgent', cr.user_agent
  ) order by cr.accepted_at asc), '[]'::jsonb)
    into v_consent_snapshot
  from public.consent_records cr
  where cr.user_id = v_user_id;

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
    signed_up_at,
    last_sign_in_at,
    terms_accepted_at,
    terms_version,
    privacy_accepted_at,
    privacy_version,
    legal_audit_snapshot,
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
    v_signed_up_at,
    v_last_sign_in_at,
    v_terms_accepted_at,
    v_terms_version,
    v_privacy_accepted_at,
    v_privacy_version,
    jsonb_build_object(
      'signedUpAt', v_signed_up_at,
      'lastSignInAt', v_last_sign_in_at,
      'termsAcceptedAt', v_terms_accepted_at,
      'termsVersion', v_terms_version,
      'privacyAcceptedAt', v_privacy_accepted_at,
      'privacyVersion', v_privacy_version,
      'consents', v_consent_snapshot
    ),
    jsonb_build_object('actorUserId', v_actor, 'strategy', 'soft-delete-v2-legal-audit')
  )
  returning id into v_deletion_id;

  insert into public.account_deletion_legal_audit (
    deletion_id,
    user_id,
    email_hash,
    signed_up_at,
    last_sign_in_at,
    deleted_at,
    terms_accepted_at,
    terms_version,
    privacy_accepted_at,
    privacy_version,
    consent_snapshot
  ) values (
    v_deletion_id,
    v_user_id,
    v_email_hash,
    v_signed_up_at,
    v_last_sign_in_at,
    v_now,
    v_terms_accepted_at,
    v_terms_version,
    v_privacy_accepted_at,
    v_privacy_version,
    v_consent_snapshot
  );

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

  return jsonb_build_object(
    'ok', true,
    'deletionId', v_deletion_id,
    'userId', v_user_id,
    'emailHash', v_email_hash,
    'stripeSubId', v_stripe_sub_id,
    'termsAcceptedAt', v_terms_accepted_at,
    'privacyAcceptedAt', v_privacy_accepted_at
  );
end;
$$;

grant execute on function public.delete_user_account(uuid, text) to authenticated, service_role;
