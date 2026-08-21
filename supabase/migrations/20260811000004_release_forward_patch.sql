-- Forward patch for release/maxxis-mvp.
-- Some fixes in this release correct historical migration files so fresh
-- database rebuilds work cleanly. Production databases have already executed
-- those historical migrations, so this patch reapplies the corrected runtime
-- functions in a new migration that Supabase will execute forward.

create or replace function public.ds_redact_inline_media_jsonb(value jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  result jsonb;
  item jsonb;
  key text;
  item_value jsonb;
  scalar_text text;
begin
  if value is null then
    return null;
  end if;

  if jsonb_typeof(value) = 'string' then
    scalar_text := value #>> '{}';
    if scalar_text ~* '^data:(image|video|audio|application)/' then
      return to_jsonb(''::text);
    end if;
    return value;
  end if;

  if jsonb_typeof(value) = 'array' then
    result := '[]'::jsonb;
    for item in select jsonb_array_elements(value)
    loop
      result := result || jsonb_build_array(public.ds_redact_inline_media_jsonb(item));
    end loop;
    return result;
  end if;

  if jsonb_typeof(value) = 'object' then
    result := '{}'::jsonb;
    for key, item_value in select * from jsonb_each(value)
    loop
      result := result || jsonb_build_object(key, public.ds_redact_inline_media_jsonb(item_value));
    end loop;
    return result;
  end if;

  return value;
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
  v_actions text[] := '{}'::text[];
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

grant execute on function public.ds_consume_plan_actions(text[]) to authenticated;

create or replace function public.ds_contact_methods_include_chat(p_methods jsonb)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from jsonb_array_elements_text(coalesce(p_methods, '[]'::jsonb)) as method(value)
    where regexp_replace(lower(trim(method.value)), '[^a-z0-9]+', '', 'g') in (
      'chat',
      'dealsifterchat',
      'dealsifter'
    )
  );
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
    v_email_hash := encode(extensions.digest(lower(trim(v_email)), 'sha256'), 'hex');
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
  where u.id = p_target_user_id;

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
#variable_conflict use_column
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
    update public.unlock_intents ui set status = 'expired' where ui.id = v_intent.id;
    raise exception 'unlock intent expired' using errcode = '57014';
  end if;

  v_base_cost := public.ds_profile_portfolio_cost(v_owner_id, v_profile_scope);
  select count(*) into v_normal_count
  from public.property_unlocks pu
  where pu.property_id = p_property_id
    and pu.mode = 'normal';
  if exists (
    select 1 from public.property_unlocks pu
    where pu.property_id = p_property_id
      and pu.mode in ('total', 'partial')
      and pu.status = 'active'
      and pu.expires_at > now()
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
    update public.unlock_intents ui set status = 'expired' where ui.id = v_intent.id;
    raise exception 'unlock cost changed; current_cost=%', v_listed_cost using errcode = '40001';
  end if;

  perform public.ds_require_plan_action('unlock');
  select coalesce(u.nuggets, 0), coalesce(u.is_admin, false)
    into v_remaining, v_is_admin
  from public.users u where u.id = v_buyer_id for update;
  v_charge_cost := case when v_is_admin then 0 else v_listed_cost end;
  if not v_is_admin then
    update public.users u
    set nuggets = coalesce(u.nuggets, 0) - v_listed_cost, updated_at = now()
    where u.id = v_buyer_id and coalesce(u.nuggets, 0) >= v_listed_cost
    returning u.nuggets into v_remaining;
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

  update public.unlock_intents ui set status = 'consumed', consumed_at = now() where ui.id = v_intent.id;
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

create or replace function public.ds_validate_maxxis_profile_suggestion(
  p_operation text,
  p_dimension text,
  p_suggested_value text
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_operation text := lower(trim(coalesce(p_operation, '')));
  v_dimension text := lower(trim(coalesce(p_dimension, '')));
  v_value text := trim(coalesce(p_suggested_value, ''));
  v_allowed text[];
begin
  if v_operation = 'add_market' then
    if v_dimension <> 'market' then
      raise exception 'profile suggestion dimension mismatch' using errcode = '22023';
    end if;
    v_value := public.ds_maxxis_state_code(v_value);
    if not (v_value = any(array['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'])) then
      raise exception 'profile suggestion value not allowed' using errcode = '22023';
    end if;
  elsif v_operation = 'add_property_type' then
    if v_dimension <> 'property_type' then
      raise exception 'profile suggestion dimension mismatch' using errcode = '22023';
    end if;
    v_allowed := array['Single Family','Multi-Family 2-4','Multi-Family 5+','Condo / Townhouse','Land','Commercial','Mixed-Use','Mobile / Manufactured'];
    select allowed.candidate into v_value
      from unnest(v_allowed) as allowed(candidate)
      where lower(allowed.candidate) = lower(v_value)
      limit 1;
    if v_value is null then raise exception 'profile suggestion value not allowed' using errcode = '22023'; end if;
  elsif v_operation = 'add_strategy' then
    if v_dimension <> 'strategy' then
      raise exception 'profile suggestion dimension mismatch' using errcode = '22023';
    end if;
    v_allowed := array['Buy & Hold','Fix & Flip','BRRRR','Wholesale','Wholetail','Short-Term Rental','Mid-Term Rental','Development','Value-Add','Creative Finance','Distressed Assets','Tax Strategies','Notes / Paper'];
    select allowed.candidate into v_value
      from unnest(v_allowed) as allowed(candidate)
      where lower(allowed.candidate) = lower(v_value)
      limit 1;
    if v_value is null then raise exception 'profile suggestion value not allowed' using errcode = '22023'; end if;
  else
    raise exception 'profile suggestion operation not allowed' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'operation', v_operation,
    'dimension', v_dimension,
    'suggestedValue', v_value
  );
end;
$$;

create or replace function public.ds_prepare_maxxis_profile_actions(p_suggestions jsonb)
returns table(action_id uuid, operation text, suggested_value text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_payload jsonb;
  v_action_id uuid;
  v_expires_at timestamptz;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if jsonb_typeof(p_suggestions) <> 'array' or jsonb_array_length(p_suggestions) > 3 or octet_length(p_suggestions::text) > 4096 then
    raise exception 'invalid profile suggestions' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('maxxis-profile-actions:' || v_user_id::text));
  update public.maxxis_pending_actions as a
    set status = 'expired'
    where a.user_id = v_user_id and a.status = 'pending' and a.expires_at <= now();

  for v_item in select value from jsonb_array_elements(p_suggestions)
  loop
    v_payload := public.ds_validate_maxxis_profile_suggestion(
      v_item->>'operation',
      v_item->>'dimension',
      v_item->>'suggestedValue'
    );

    select a.id, a.expires_at into v_action_id, v_expires_at
      from public.maxxis_pending_actions a
      where a.user_id = v_user_id
        and a.action_type = 'update_investment_profile'
        and a.status = 'pending'
        and a.expires_at > now()
        and a.payload->>'operation' = v_payload->>'operation'
        and lower(a.payload->>'suggestedValue') = lower(v_payload->>'suggestedValue')
      order by a.created_at desc
      limit 1;

    if v_action_id is null then
      v_expires_at := now() + interval '24 hours';
      insert into public.maxxis_pending_actions(user_id, action_type, payload, expires_at)
      values (v_user_id, 'update_investment_profile', v_payload, v_expires_at)
      returning id into v_action_id;
    end if;

    action_id := v_action_id;
    operation := v_payload->>'operation';
    suggested_value := v_payload->>'suggestedValue';
    expires_at := v_expires_at;
    return next;
    v_action_id := null;
    v_expires_at := null;
  end loop;
end;
$$;

revoke all on function public.ds_validate_maxxis_profile_suggestion(text, text, text) from public;
revoke all on function public.ds_prepare_maxxis_profile_actions(jsonb) from public;
grant execute on function public.ds_prepare_maxxis_profile_actions(jsonb) to authenticated;

create or replace function public.ds_merge_professional_profile_payload(
  p_current jsonb,
  p_incoming jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_current jsonb := case when jsonb_typeof(p_current) = 'object' then p_current else '{}'::jsonb end;
  v_incoming jsonb := case when jsonb_typeof(p_incoming) = 'object' then p_incoming else '{}'::jsonb end;
  v_result jsonb;
  v_profiles jsonb;
  v_incoming_profiles jsonb;
  v_resolved jsonb;
  v_incoming_resolved jsonb;
  v_legacy jsonb;
  v_incoming_legacy jsonb;
  v_current_branch jsonb;
  v_incoming_branch jsonb;
  v_existing_investment_profile jsonb;
  v_investment_profile jsonb;
begin
  v_result := v_current;

  if jsonb_typeof(v_incoming->'version') = 'number' then
    v_result := jsonb_set(v_result, '{version}', v_incoming->'version', true);
  end if;
  if jsonb_typeof(v_incoming->'accountType') = 'string' then
    v_result := jsonb_set(v_result, '{accountType}', v_incoming->'accountType', true);
  end if;

  v_profiles := case when jsonb_typeof(v_current->'profiles') = 'object' then v_current->'profiles' else '{}'::jsonb end;
  v_incoming_profiles := case when jsonb_typeof(v_incoming->'profiles') = 'object' then v_incoming->'profiles' else '{}'::jsonb end;
  v_existing_investment_profile := case
    when jsonb_typeof(v_profiles->'professional'->'investmentProfile') = 'object'
      then v_profiles->'professional'->'investmentProfile'
    when jsonb_typeof(v_current->'legacy'->'professionalProfile'->'investmentProfile') = 'object'
      then v_current->'legacy'->'professionalProfile'->'investmentProfile'
    else '{}'::jsonb
  end;
  v_current_branch := case when jsonb_typeof(v_profiles->'personal') = 'object' then v_profiles->'personal' else '{}'::jsonb end;
  v_incoming_branch := v_incoming_profiles->'personal';
  if jsonb_typeof(v_incoming_branch) = 'object' then
    v_profiles := jsonb_set(v_profiles, '{personal}', v_current_branch || v_incoming_branch, true);
  end if;
  v_current_branch := case when jsonb_typeof(v_profiles->'professional') = 'object' then v_profiles->'professional' else '{}'::jsonb end;
  v_incoming_branch := v_incoming_profiles->'professional';
  if jsonb_typeof(v_incoming_branch) = 'object' then
    v_profiles := jsonb_set(v_profiles, '{professional}', v_current_branch || v_incoming_branch, true);
  end if;
  v_current_branch := case when jsonb_typeof(v_profiles->'fsbo') = 'object' then v_profiles->'fsbo' else '{}'::jsonb end;
  v_incoming_branch := v_incoming_profiles->'fsbo';
  if jsonb_typeof(v_incoming_branch) = 'object' then
    v_profiles := jsonb_set(v_profiles, '{fsbo}', v_current_branch || v_incoming_branch, true);
  end if;

  v_resolved := case when jsonb_typeof(v_current->'resolved') = 'object' then v_current->'resolved' else '{}'::jsonb end;
  v_incoming_resolved := case when jsonb_typeof(v_incoming->'resolved') = 'object' then v_incoming->'resolved' else '{}'::jsonb end;
  v_current_branch := case when jsonb_typeof(v_resolved->'personal') = 'object' then v_resolved->'personal' else '{}'::jsonb end;
  v_incoming_branch := v_incoming_resolved->'personal';
  if jsonb_typeof(v_incoming_branch) = 'object' then v_resolved := jsonb_set(v_resolved, '{personal}', v_current_branch || v_incoming_branch, true); end if;
  v_current_branch := case when jsonb_typeof(v_resolved->'professional') = 'object' then v_resolved->'professional' else '{}'::jsonb end;
  v_incoming_branch := v_incoming_resolved->'professional';
  if jsonb_typeof(v_incoming_branch) = 'object' then v_resolved := jsonb_set(v_resolved, '{professional}', v_current_branch || v_incoming_branch, true); end if;
  v_current_branch := case when jsonb_typeof(v_resolved->'fsbo') = 'object' then v_resolved->'fsbo' else '{}'::jsonb end;
  v_incoming_branch := v_incoming_resolved->'fsbo';
  if jsonb_typeof(v_incoming_branch) = 'object' then v_resolved := jsonb_set(v_resolved, '{fsbo}', v_current_branch || v_incoming_branch, true); end if;

  v_legacy := case when jsonb_typeof(v_current->'legacy') = 'object' then v_current->'legacy' else '{}'::jsonb end;
  v_incoming_legacy := case when jsonb_typeof(v_incoming->'legacy') = 'object' then v_incoming->'legacy' else '{}'::jsonb end;
  v_current_branch := case when jsonb_typeof(v_legacy->'personalProfile') = 'object' then v_legacy->'personalProfile' else '{}'::jsonb end;
  v_incoming_branch := v_incoming_legacy->'personalProfile';
  if jsonb_typeof(v_incoming_branch) = 'object' then v_legacy := jsonb_set(v_legacy, '{personalProfile}', v_current_branch || v_incoming_branch, true); end if;
  v_current_branch := case when jsonb_typeof(v_legacy->'professionalProfile') = 'object' then v_legacy->'professionalProfile' else '{}'::jsonb end;
  v_incoming_branch := v_incoming_legacy->'professionalProfile';
  if jsonb_typeof(v_incoming_branch) = 'object' then v_legacy := jsonb_set(v_legacy, '{professionalProfile}', v_current_branch || v_incoming_branch, true); end if;

  v_investment_profile := case
    when jsonb_typeof(v_incoming_profiles->'professional'->'investmentProfile') = 'object'
      then v_existing_investment_profile || (v_incoming_profiles->'professional'->'investmentProfile')
    when jsonb_typeof(v_incoming_legacy->'professionalProfile'->'investmentProfile') = 'object'
      then v_existing_investment_profile || (v_incoming_legacy->'professionalProfile'->'investmentProfile')
    else null
  end;
  if v_investment_profile is not null then
    v_current_branch := case when jsonb_typeof(v_profiles->'professional') = 'object' then v_profiles->'professional' else '{}'::jsonb end;
    v_profiles := jsonb_set(v_profiles, '{professional}', jsonb_set(v_current_branch, '{investmentProfile}', v_investment_profile, true), true);
    v_current_branch := case when jsonb_typeof(v_legacy->'professionalProfile') = 'object' then v_legacy->'professionalProfile' else '{}'::jsonb end;
    v_legacy := jsonb_set(v_legacy, '{professionalProfile}', jsonb_set(v_current_branch, '{investmentProfile}', v_investment_profile, true), true);
  end if;

  v_result := jsonb_set(v_result, '{profiles}', v_profiles, true);
  v_result := jsonb_set(v_result, '{resolved}', v_resolved, true);
  v_result := jsonb_set(v_result, '{legacy}', v_legacy, true);
  return v_result;
end;
$$;

revoke all on function public.ds_merge_professional_profile_payload(jsonb, jsonb) from public, anon, authenticated;
