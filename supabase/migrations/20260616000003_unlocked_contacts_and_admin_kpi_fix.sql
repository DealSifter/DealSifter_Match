-- Restores paid unlock traceability across devices and tightens admin KPI charts.
-- Contacts are exposed only to the authenticated buyer who already has an unlock row.

create or replace function public.ds_get_unlocked_contact_snapshots()
returns table (
  seller_id uuid,
  nuggets_spent integer,
  unlocked_at timestamptz,
  contact jsonb
)
language sql
security definer
set search_path = public
as $$
  with latest_unlocks as (
    select distinct on (u.seller_id)
      u.seller_id,
      u.nuggets_spent,
      u.created_at as unlocked_at
    from public.unlocks u
    where u.buyer_id = auth.uid()
    order by u.seller_id, u.created_at desc
  ),
  profile_scope as (
    select
      lu.*,
      coalesce(
        nullif(p.primary_profile, ''),
        nullif(s.primary_profile, ''),
        'personal'
      ) as scope_key
    from latest_unlocks lu
    left join lateral (
      select primary_profile
      from public.properties p
      where p.owner_id = lu.seller_id
      order by p.updated_at desc nulls last, p.created_at desc
      limit 1
    ) p on true
    left join lateral (
      select primary_profile
      from public.services s
      where s.owner_id = lu.seller_id
      order by s.updated_at desc nulls last, s.created_at desc
      limit 1
    ) s on true
  ),
  contact_source as (
    select
      ps.*,
      usr.email as account_email,
      usr.full_name as account_name,
      usr.phone as account_phone,
      usr.settings_payload,
      up.full_name as profile_name,
      up.photo_url as profile_photo,
      pp.category,
      pp.subcategory,
      pp.primary_category,
      pp.category_b,
      pp.primary_category_b,
      pp.photo_b_url,
      pp.profile_payload,
      coalesce(pp.profile_payload->'resolved', '{}'::jsonb) as resolved_profiles
    from profile_scope ps
    join public.users usr on usr.id = ps.seller_id
    left join public.user_profiles up on up.user_id = ps.seller_id
    left join public.professional_profiles pp on pp.user_id = ps.seller_id
  ),
  selected_profile as (
    select
      cs.*,
      coalesce(
        nullif(cs.resolved_profiles -> cs.scope_key, '{}'::jsonb),
        nullif(cs.resolved_profiles -> 'personal', '{}'::jsonb),
        nullif(cs.resolved_profiles -> 'professional', '{}'::jsonb),
        '{}'::jsonb
      ) as resolved_profile
    from contact_source cs
  )
  select
    sp.seller_id,
    sp.nuggets_spent,
    sp.unlocked_at,
    jsonb_build_object(
      'id', sp.seller_id::text,
      'ownerId', sp.seller_id::text,
      'unlockOwnerId', sp.seller_id::text,
      'primaryProfile', coalesce(nullif(sp.scope_key, ''), 'personal'),
      'name', coalesce(
        nullif(sp.resolved_profile->>'name', ''),
        nullif(sp.profile_name, ''),
        nullif(sp.account_name, ''),
        nullif(sp.account_email, ''),
        'Unlocked contact'
      ),
      'title', coalesce(
        nullif(sp.resolved_profile->>'name', ''),
        nullif(sp.profile_name, ''),
        nullif(sp.account_name, ''),
        nullif(sp.account_email, ''),
        'Unlocked contact'
      ),
      'type', coalesce(
        nullif(sp.resolved_profile->>'categoryLabelFallback', ''),
        nullif(sp.primary_category_b, ''),
        nullif(sp.category_b, ''),
        nullif(sp.primary_category, ''),
        nullif(sp.category, ''),
        'Contact'
      ),
      'cat', coalesce(nullif(sp.primary_category, ''), nullif(sp.category, ''), ''),
      'badge', coalesce(nullif(sp.resolved_profile->>'badge', ''), ''),
      'loc', coalesce(nullif(sp.resolved_profile->>'loc', ''), ''),
      'photo', coalesce(
        nullif(sp.resolved_profile->>'photo', ''),
        nullif(sp.profile_photo, ''),
        nullif(sp.photo_b_url, ''),
        ''
      ),
      'contactMethods', coalesce(sp.resolved_profile->'contactMethods', '[]'::jsonb),
      'primaryPhone', coalesce(
        nullif(sp.resolved_profile->>'primaryPhone', ''),
        nullif(sp.settings_payload #>> '{systemAccount,phone}', ''),
        nullif(sp.account_phone, ''),
        ''
      ),
      'phone', coalesce(
        nullif(sp.resolved_profile->>'primaryPhone', ''),
        nullif(sp.settings_payload #>> '{systemAccount,phone}', ''),
        nullif(sp.account_phone, ''),
        ''
      ),
      'secondaryPhone', coalesce(nullif(sp.resolved_profile->>'secondaryPhone', ''), ''),
      'tertiaryPhone', coalesce(nullif(sp.resolved_profile->>'tertiaryPhone', ''), ''),
      'whatsapp', coalesce(
        nullif(sp.resolved_profile->>'whatsapp', ''),
        nullif(sp.resolved_profile->>'secondaryPhone', ''),
        ''
      ),
      'email', coalesce(
        nullif(sp.resolved_profile->>'email', ''),
        nullif(sp.settings_payload #>> '{systemAccount,email}', ''),
        nullif(sp.account_email, ''),
        ''
      ),
      'source', 'remote-unlock'
    ) as contact
  from selected_profile sp;
$$;

grant execute on function public.ds_get_unlocked_contact_snapshots() to authenticated;

do $$
begin
  if to_regprocedure('public.admin_get_dashboard_snapshot_base_20260616()') is null
     and to_regprocedure('public.admin_get_dashboard_snapshot()') is not null then
    alter function public.admin_get_dashboard_snapshot() rename to admin_get_dashboard_snapshot_base_20260616;
  end if;
end $$;

create or replace function public.admin_get_dashboard_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base jsonb := '{}'::jsonb;
  v_day_start date := (now()::date - interval '9 days')::date;
  v_exclusive_total integer := 0;
  v_exclusive_today integer := 0;
  v_exclusive_nuggets integer := 0;
  v_exclusive_nuggets_today integer := 0;
  v_highlights_active integer := 0;
  v_highlights_today integer := 0;
  v_highlights_total integer := 0;
  v_highlights_nuggets integer := 0;
  v_highlights_nuggets_today integer := 0;
  v_series jsonb := '{}'::jsonb;
begin
  if not public.ds_is_current_user_admin() then
    raise exception 'admin access required';
  end if;

  if to_regprocedure('public.admin_get_dashboard_snapshot_base_20260616()') is not null then
    v_base := public.admin_get_dashboard_snapshot_base_20260616();
  end if;

  select count(*), coalesce(sum(exclusivity_cost), 0)
    into v_exclusive_total, v_exclusive_nuggets
  from public.property_unlocks
  where mode in ('total', 'partial');

  select count(*), coalesce(sum(exclusivity_cost), 0)
    into v_exclusive_today, v_exclusive_nuggets_today
  from public.property_unlocks
  where mode in ('total', 'partial')
    and created_at >= now()::date;

  select count(*)
    into v_highlights_active
  from public.card_spotlights
  where starts_at <= now()
    and expires_at > now();

  select count(*), coalesce(sum(nuggets_spent), 0)
    into v_highlights_today, v_highlights_nuggets_today
  from public.card_spotlights
  where created_at >= now()::date;

  select count(*), coalesce(sum(nuggets_spent), 0)
    into v_highlights_total, v_highlights_nuggets
  from public.card_spotlights;

  v_series := jsonb_build_object(
    'swipes-today', (
      select jsonb_agg(jsonb_build_object('label', to_char(day_start, 'MM/DD'), 'value', (
        select count(*) from public.app_events e where e.event_type = 'swipe_given' and e.created_at >= day_start and e.created_at < (day_start + interval '1 day')
      )) order by day_start)
      from generate_series(v_day_start::timestamp, now()::date::timestamp, interval '1 day') day_start
    ),
    'support-msgs', (
      select jsonb_agg(jsonb_build_object('label', to_char(day_start, 'MM/DD'), 'value', (
        select count(*) from public.app_events e where e.event_type = 'support_message_sent' and e.created_at >= day_start and e.created_at < (day_start + interval '1 day')
      )) order by day_start)
      from generate_series(v_day_start::timestamp, now()::date::timestamp, interval '1 day') day_start
    ),
    'highlights', (
      select jsonb_agg(jsonb_build_object('label', to_char(day_start, 'MM/DD'), 'value', (
        select count(*) from public.card_spotlights cs where cs.created_at >= day_start and cs.created_at < (day_start + interval '1 day')
      )) order by day_start)
      from generate_series(v_day_start::timestamp, now()::date::timestamp, interval '1 day') day_start
    ),
    'exclusive-contacts', (
      select jsonb_agg(jsonb_build_object('label', to_char(day_start, 'MM/DD'), 'value', (
        select count(*) from public.property_unlocks pu where pu.mode in ('total','partial') and pu.created_at >= day_start and pu.created_at < (day_start + interval '1 day')
      )) order by day_start)
      from generate_series(v_day_start::timestamp, now()::date::timestamp, interval '1 day') day_start
    ),
    'stripe-issues', (
      select jsonb_agg(jsonb_build_object('label', to_char(day_start, 'MM/DD'), 'value', (
        select count(*) from public.service_health_events h where h.service in ('stripe', 'checkout', 'webhook') and h.status in ('down', 'error', 'degraded') and h.created_at >= day_start and h.created_at < (day_start + interval '1 day')
      )) order by day_start)
      from generate_series(v_day_start::timestamp, now()::date::timestamp, interval '1 day') day_start
    ),
    'supabase-issues', (
      select jsonb_agg(jsonb_build_object('label', to_char(day_start, 'MM/DD'), 'value', (
        select count(*) from public.service_health_events h where h.service = 'supabase' and h.status in ('down', 'error', 'degraded') and h.created_at >= day_start and h.created_at < (day_start + interval '1 day')
      )) order by day_start)
      from generate_series(v_day_start::timestamp, now()::date::timestamp, interval '1 day') day_start
    ),
    'free-plan-pressure', (
      select jsonb_agg(jsonb_build_object('label', to_char(day_start, 'MM/DD'), 'value', (
        select count(*) from public.app_events e where e.event_type = 'plan_gate_shown' and e.created_at >= day_start and e.created_at < (day_start + interval '1 day')
      )) order by day_start)
      from generate_series(v_day_start::timestamp, now()::date::timestamp, interval '1 day') day_start
    )
  );

  return v_base
    || jsonb_build_object(
      'exclusiveContactsToday', v_exclusive_today,
      'exclusiveContactsTotal', v_exclusive_total,
      'exclusiveContactsNuggetsSpent', v_exclusive_nuggets,
      'exclusiveContactsNuggetsSpentToday', v_exclusive_nuggets_today,
      'highlightsActive', v_highlights_active,
      'highlightsPurchasedToday', v_highlights_today,
      'highlightsTotal', v_highlights_total,
      'highlightsNuggetsSpent', v_highlights_nuggets,
      'highlightsNuggetsSpentToday', v_highlights_nuggets_today,
      'series', coalesce(v_base->'series', '{}'::jsonb) || v_series
    );
end;
$$;

grant execute on function public.admin_get_dashboard_snapshot() to authenticated;
