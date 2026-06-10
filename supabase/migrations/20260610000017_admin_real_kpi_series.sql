-- Real KPI chart series for the admin dashboard.
-- The snapshot keeps current totals and adds compact real series.

create or replace function public.admin_get_dashboard_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_month_start date := date_trunc('month', now())::date - interval '11 months';
  v_day_start date := (now()::date - interval '11 days')::date;
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
    'supabaseIssuesDay', (select count(*) from public.service_health_events where service = 'supabase' and status in ('down', 'error', 'degraded') and created_at >= now() - interval '1 day'),
    'series', jsonb_build_object(
      'total-users', (
        select jsonb_agg(jsonb_build_object('label', to_char(month_start, 'Mon YY'), 'value', (
          select count(*) from public.users u where u.created_at < (month_start + interval '1 month')
        )) order by month_start)
        from generate_series(v_month_start::timestamp, date_trunc('month', now()), interval '1 month') month_start
      ),
      'new-users', (
        select jsonb_agg(jsonb_build_object('label', to_char(month_start, 'Mon YY'), 'value', (
          select count(*) from public.users u
          where u.created_at >= month_start
            and u.created_at < (month_start + interval '1 month')
        )) order by month_start)
        from generate_series(v_month_start::timestamp, date_trunc('month', now()), interval '1 month') month_start
      ),
      'deleted-users', (
        select jsonb_agg(jsonb_build_object('label', to_char(month_start, 'Mon YY'), 'value', (
          select count(*) from public.deleted_records_audit d
          where d.table_name = 'users'
            and d.deleted_at >= month_start
            and d.deleted_at < (month_start + interval '1 month')
        )) order by month_start)
        from generate_series(v_month_start::timestamp, date_trunc('month', now()), interval '1 month') month_start
      ),
      'unlocks', (
        select jsonb_agg(jsonb_build_object('label', to_char(month_start, 'Mon YY'), 'value', (
          select count(*) from public.unlocks u
          where u.created_at >= month_start
            and u.created_at < (month_start + interval '1 month')
        )) order by month_start)
        from generate_series(v_month_start::timestamp, date_trunc('month', now()), interval '1 month') month_start
      ),
      'packs-revenue', (
        select jsonb_agg(jsonb_build_object('label', to_char(month_start, 'Mon YY'), 'value', (
          select coalesce(sum(p.price_cents), 0) from public.nugget_purchases p
          where p.status = 'completed'
            and p.created_at >= month_start
            and p.created_at < (month_start + interval '1 month')
        )) order by month_start)
        from generate_series(v_month_start::timestamp, date_trunc('month', now()), interval '1 month') month_start
      ),
      'subscriptions', (
        select jsonb_agg(jsonb_build_object('label', to_char(month_start, 'Mon YY'), 'value', (
          select count(*) from public.subscriptions s
          where s.status in ('active', 'trialing')
            and s.created_at >= month_start
            and s.created_at < (month_start + interval '1 month')
        )) order by month_start)
        from generate_series(v_month_start::timestamp, date_trunc('month', now()), interval '1 month') month_start
      ),
      'manual-grants', (
        select jsonb_agg(jsonb_build_object('label', to_char(month_start, 'Mon YY'), 'value', (
          select coalesce(sum(g.amount), 0) from public.admin_nugget_grants g
          where g.created_at >= month_start
            and g.created_at < (month_start + interval '1 month')
        )) order by month_start)
        from generate_series(v_month_start::timestamp, date_trunc('month', now()), interval '1 month') month_start
      ),
      'properties', (
        select jsonb_agg(jsonb_build_object('label', to_char(month_start, 'Mon YY'), 'value', (
          select count(*) from public.properties p
          where p.created_at >= month_start
            and p.created_at < (month_start + interval '1 month')
        )) order by month_start)
        from generate_series(v_month_start::timestamp, date_trunc('month', now()), interval '1 month') month_start
      ),
      'admin-accounts', (
        select jsonb_agg(jsonb_build_object('label', to_char(month_start, 'Mon YY'), 'value', (
          select count(*) from public.users u
          where u.is_admin = true
            and u.created_at < (month_start + interval '1 month')
        )) order by month_start)
        from generate_series(v_month_start::timestamp, date_trunc('month', now()), interval '1 month') month_start
      ),
      'swipes-today', (
        select jsonb_agg(jsonb_build_object('label', to_char(day_start, 'MM/DD'), 'value', (
          select count(*) from public.app_events e
          where e.event_type = 'swipe_given'
            and e.created_at >= day_start
            and e.created_at < (day_start + interval '1 day')
        )) order by day_start)
        from generate_series(v_day_start::timestamp, now()::date::timestamp, interval '1 day') day_start
      ),
      'support-msgs', (
        select jsonb_agg(jsonb_build_object('label', to_char(day_start, 'MM/DD'), 'value', (
          select count(*) from public.app_events e
          where e.event_type = 'support_message_sent'
            and e.created_at >= day_start
            and e.created_at < (day_start + interval '1 day')
        )) order by day_start)
        from generate_series(v_day_start::timestamp, now()::date::timestamp, interval '1 day') day_start
      ),
      'highlights', (
        select jsonb_agg(jsonb_build_object('label', to_char(day_start, 'MM/DD'), 'value', (
          select count(*) from public.app_events e
          where e.event_type in ('highlight_active', 'highlight_purchased')
            and e.created_at >= day_start
            and e.created_at < (day_start + interval '1 day')
        )) order by day_start)
        from generate_series(v_day_start::timestamp, now()::date::timestamp, interval '1 day') day_start
      ),
      'exclusive-contacts', (
        select jsonb_agg(jsonb_build_object('label', to_char(day_start, 'MM/DD'), 'value', (
          select count(*) from public.app_events e
          where e.event_type = 'exclusive_contact_purchased'
            and e.created_at >= day_start
            and e.created_at < (day_start + interval '1 day')
        )) order by day_start)
        from generate_series(v_day_start::timestamp, now()::date::timestamp, interval '1 day') day_start
      ),
      'stripe-issues', (
        select jsonb_agg(jsonb_build_object('label', to_char(day_start, 'MM/DD'), 'value', (
          select count(*) from public.service_health_events h
          where h.service in ('stripe', 'checkout', 'webhook')
            and h.status in ('down', 'error', 'degraded')
            and h.created_at >= day_start
            and h.created_at < (day_start + interval '1 day')
        )) order by day_start)
        from generate_series(v_day_start::timestamp, now()::date::timestamp, interval '1 day') day_start
      ),
      'supabase-issues', (
        select jsonb_agg(jsonb_build_object('label', to_char(day_start, 'MM/DD'), 'value', (
          select count(*) from public.service_health_events h
          where h.service = 'supabase'
            and h.status in ('down', 'error', 'degraded')
            and h.created_at >= day_start
            and h.created_at < (day_start + interval '1 day')
        )) order by day_start)
        from generate_series(v_day_start::timestamp, now()::date::timestamp, interval '1 day') day_start
      )
    ),
    'seriesStatus', jsonb_build_object(
      'active-now', 'No historical heartbeat table yet. Current value is real-time only.'
    )
  )
  into v_result;

  return v_result;
end;
$$;

grant execute on function public.admin_get_dashboard_snapshot() to authenticated;
