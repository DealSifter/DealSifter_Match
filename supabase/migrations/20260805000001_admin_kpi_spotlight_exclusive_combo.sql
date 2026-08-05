-- Admin KPI refinement: spotlight and exclusivity cards now expose
-- all-time done count, currently active count, and cumulative nugget value.

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
  v_exclusive_active integer := 0;
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

  select count(*)
    into v_exclusive_active
  from public.property_unlocks
  where mode in ('total', 'partial')
    and status = 'active'
    and expires_at > now();

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
      select jsonb_agg(jsonb_build_object(
        'label', to_char(day_start, 'MM/DD'),
        'value', (
          select count(*) from public.card_spotlights cs
          where cs.created_at >= day_start
            and cs.created_at < (day_start + interval '1 day')
        ),
        'total', (
          select count(*) from public.card_spotlights cs
          where cs.created_at >= day_start
            and cs.created_at < (day_start + interval '1 day')
        ),
        'active', (
          select count(*) from public.card_spotlights cs
          where cs.starts_at <= (
              case when day_start::date = now()::date
                then now()
                else day_start + interval '1 day'
              end
            )
            and cs.expires_at > (
              case when day_start::date = now()::date
                then now()
                else day_start + interval '1 day'
              end
            )
        ),
        'nuggets', (
          select coalesce(sum(cs.nuggets_spent), 0) from public.card_spotlights cs
          where cs.created_at < (
              case when day_start::date = now()::date
                then now()
                else day_start + interval '1 day'
              end
            )
        )
      ) order by day_start)
      from generate_series(v_day_start::timestamp, now()::date::timestamp, interval '1 day') day_start
    ),
    'exclusive-contacts', (
      select jsonb_agg(jsonb_build_object(
        'label', to_char(day_start, 'MM/DD'),
        'value', (
          select count(*) from public.property_unlocks pu
          where pu.mode in ('total','partial')
            and pu.created_at >= day_start
            and pu.created_at < (day_start + interval '1 day')
        ),
        'total', (
          select count(*) from public.property_unlocks pu
          where pu.mode in ('total','partial')
            and pu.created_at >= day_start
            and pu.created_at < (day_start + interval '1 day')
        ),
        'active', (
          select count(*) from public.property_unlocks pu
          where pu.mode in ('total','partial')
            and pu.status = 'active'
            and pu.created_at < (
              case when day_start::date = now()::date
                then now()
                else day_start + interval '1 day'
              end
            )
            and pu.expires_at > (
              case when day_start::date = now()::date
                then now()
                else day_start + interval '1 day'
              end
            )
        ),
        'nuggets', (
          select coalesce(sum(pu.exclusivity_cost), 0) from public.property_unlocks pu
          where pu.mode in ('total','partial')
            and pu.created_at < (
              case when day_start::date = now()::date
                then now()
                else day_start + interval '1 day'
              end
            )
        )
      ) order by day_start)
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
      'exclusiveContactsActive', v_exclusive_active,
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
