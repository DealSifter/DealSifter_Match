-- Phase 3I: Maxxis Deal AI provider contact unlock bridge.
-- Reuses the existing unlock_intents/unlocks/Nuggets machinery. This migration
-- only adds safe provider access quotes and a no-debit intent cancellation RPC.

create or replace function public.ds_get_provider_contact_access(p_service_ids uuid[])
returns table (
  service_id uuid,
  status text,
  cost integer,
  currency text,
  profile_scope text,
  reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan_id text;
  v_is_admin boolean := false;
  v_nuggets integer := 0;
  v_limit integer;
  v_used integer := 0;
  v_month date := date_trunc('month', now() at time zone 'utc')::date;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select
    coalesce(nullif(lower(trim(u.plan_id)), ''), 'free'),
    coalesce(u.is_admin, false),
    coalesce(u.nuggets, 0)
  into v_plan_id, v_is_admin, v_nuggets
  from public.users u
  where u.id = v_user_id;

  if v_plan_id is null then
    raise exception 'user profile not found' using errcode = 'P0002';
  end if;

  v_limit := public.ds_plan_limit_for_action(v_plan_id, v_is_admin, 'unlock');
  if v_limit is not null then
    select greatest(
      coalesce((
        select puc.count
        from public.plan_usage_counters puc
        where puc.user_id = v_user_id
          and puc.action = 'unlock'
          and puc.period_scope = 'month'
          and puc.period_start = v_month
      ), 0),
      (select greatest(
        (select count(*)::integer from public.unlocks u where u.buyer_id = v_user_id and u.created_at >= v_month),
        (select count(*)::integer from public.property_unlocks pu where pu.buyer_id = v_user_id and pu.created_at >= v_month)
      ))
    ) into v_used;
  end if;

  return query
  with requested as (
    select distinct unnest(coalesce(p_service_ids, '{}'::uuid[])) as id
  ),
  service_rows as (
    select
      r.id service_id,
      s.owner_id,
      public.ds_normalize_profile_scope(s.primary_profile) profile_scope,
      coalesce(s.publish_to_connections, true) published
    from requested r
    left join public.services s on s.id = r.id
  ),
  evaluated as (
    select
      sr.service_id,
      sr.owner_id,
      sr.profile_scope,
      case
        when sr.owner_id is null or not coalesce(sr.published, false) then 'unavailable'
        when sr.owner_id = v_user_id then 'unavailable'
        when exists (
          select 1 from public.unlocks u
          where u.buyer_id = v_user_id
            and u.seller_id = sr.owner_id
            and u.profile_scope = sr.profile_scope
        ) then 'already_unlocked'
        when exists (
          select 1 from public.property_unlocks pu
          where pu.buyer_id = v_user_id
            and pu.owner_id = sr.owner_id
            and pu.profile_scope = sr.profile_scope
            and coalesce(pu.status, 'active') = 'active'
            and (pu.mode = 'normal' or pu.expires_at > now())
        ) then 'already_unlocked'
        when public.ds_has_active_profile_exclusivity(sr.owner_id, sr.profile_scope, v_user_id) then 'unavailable'
        when v_limit is not null and v_used >= v_limit then 'unavailable'
        when not v_is_admin and v_nuggets < public.ds_profile_portfolio_cost(sr.owner_id, sr.profile_scope) then 'insufficient_balance'
        else 'locked'
      end status,
      case
        when sr.owner_id is null or not coalesce(sr.published, false) or sr.owner_id = v_user_id then null::integer
        when exists (
          select 1 from public.unlocks u
          where u.buyer_id = v_user_id
            and u.seller_id = sr.owner_id
            and u.profile_scope = sr.profile_scope
        ) then 0
        when exists (
          select 1 from public.property_unlocks pu
          where pu.buyer_id = v_user_id
            and pu.owner_id = sr.owner_id
            and pu.profile_scope = sr.profile_scope
            and coalesce(pu.status, 'active') = 'active'
            and (pu.mode = 'normal' or pu.expires_at > now())
        ) then 0
        when v_is_admin then 0
        else public.ds_profile_portfolio_cost(sr.owner_id, sr.profile_scope)
      end cost,
      case
        when sr.owner_id is null or not coalesce(sr.published, false) then 'service_unavailable'
        when sr.owner_id = v_user_id then 'own_service'
        when public.ds_has_active_profile_exclusivity(sr.owner_id, sr.profile_scope, v_user_id) then 'active_exclusivity'
        when v_limit is not null and v_used >= v_limit then 'plan_limit_reached'
        when not v_is_admin and v_nuggets < public.ds_profile_portfolio_cost(sr.owner_id, sr.profile_scope) then 'insufficient_nuggets'
        else null
      end reason
    from service_rows sr
  )
  select
    e.service_id,
    e.status,
    e.cost,
    'nuggets'::text,
    coalesce(e.profile_scope, 'personal'),
    e.reason
  from evaluated e;
end;
$$;

create or replace function public.ds_cancel_unlock_intent(p_intent_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_intent public.unlock_intents%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_intent_token is null then
    raise exception 'unlock intent required' using errcode = '22023';
  end if;

  select * into v_intent
  from public.unlock_intents ui
  where ui.id = p_intent_token
    and ui.buyer_id = v_user_id
  for update;

  if v_intent.id is null then
    return jsonb_build_object('success', false, 'status', 'not_found');
  end if;
  if v_intent.status = 'consumed' then
    return jsonb_build_object('success', false, 'status', 'consumed');
  end if;
  if v_intent.status = 'expired' then
    return jsonb_build_object('success', true, 'status', 'cancelled');
  end if;

  update public.unlock_intents
  set status = 'expired'
  where id = v_intent.id;

  insert into public.app_events(user_id, event_type, entity_type, entity_id, value_nuggets, metadata)
  values (
    v_user_id,
    'unlock_intent_cancelled',
    coalesce(v_intent.scope, 'contact'),
    v_intent.id::text,
    0,
    jsonb_build_object('source', 'maxxis_provider_contact_unlock', 'serviceId', v_intent.metadata->>'serviceId')
  );

  return jsonb_build_object('success', true, 'status', 'cancelled');
end;
$$;

revoke all on function public.ds_get_provider_contact_access(uuid[]) from public;
revoke all on function public.ds_cancel_unlock_intent(uuid) from public;
grant execute on function public.ds_get_provider_contact_access(uuid[]) to authenticated;
grant execute on function public.ds_cancel_unlock_intent(uuid) to authenticated;

-- Rollback:
-- revoke all on function public.ds_get_provider_contact_access(uuid[]) from public;
-- revoke all on function public.ds_cancel_unlock_intent(uuid) from public;
-- drop function if exists public.ds_get_provider_contact_access(uuid[]);
-- drop function if exists public.ds_cancel_unlock_intent(uuid);
