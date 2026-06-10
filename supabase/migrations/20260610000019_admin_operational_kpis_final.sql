-- Operational KPIs for launch readiness.
-- Uses compact aggregates only; no large payloads or image duplication.

create or replace function public.admin_get_dashboard_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_month_start date := (date_trunc('month', now())::date - interval '11 months')::date;
  v_day_start date := (now()::date - interval '11 days')::date;
  v_db_limit_bytes bigint := 524288000; -- 500 MB Supabase free DB quota guardrail.
  v_db_size_bytes bigint := pg_database_size(current_database());
  v_total_users integer := 0;
  v_profile_users integer := 0;
  v_investor_profile_users integer := 0;
  v_card_users integer := 0;
  v_swipe_users integer := 0;
  v_match_users integer := 0;
  v_unlock_users integer := 0;
  v_total_cards integer := 0;
  v_healthy_cards integer := 0;
  v_missing_media integer := 0;
  v_missing_location integer := 0;
  v_missing_value integer := 0;
  v_missing_objective integer := 0;
  v_free_gate_count integer := 0;
  v_free_upgrade_count integer := 0;
  v_checkout_clicked integer := 0;
  v_checkout_terms integer := 0;
  v_checkout_opened integer := 0;
  v_checkout_completed integer := 0;
begin
  if not public.ds_is_current_user_admin() then
    raise exception 'admin access required';
  end if;

  select count(*) into v_total_users from public.users;

  select count(distinct u.id)
    into v_profile_users
  from public.users u
  left join public.user_profiles up on up.user_id = u.id
  where coalesce(nullif(trim(u.full_name), ''), nullif(trim(up.full_name), ''), nullif(trim(u.phone), ''), nullif(trim(up.bio), '')) is not null;

  select count(distinct pp.user_id)
    into v_investor_profile_users
  from public.professional_profiles pp
  where coalesce(nullif(trim(pp.category), ''), nullif(trim(pp.subcategory), ''), nullif(trim(pp.pitch), '')) is not null
     or cardinality(coalesce(pp.markets, '{}'::text[])) > 0
     or cardinality(coalesce(pp.skills, '{}'::text[])) > 0
     or cardinality(coalesce(pp.services, '{}'::text[])) > 0;

  select count(distinct owner_id)
    into v_card_users
  from (
    select owner_id from public.properties
    union all
    select owner_id from public.services
  ) owners;

  select count(distinct user_id)
    into v_swipe_users
  from public.app_events
  where event_type = 'swipe_given';

  select count(distinct buyer_id)
    into v_match_users
  from public.matches;

  select count(distinct buyer_id)
    into v_unlock_users
  from public.unlocks;

  select count(*)
    into v_total_cards
  from (
    select id from public.properties
    union all
    select id from public.services
  ) cards;

  with card_health as (
    select
      true as is_property,
      (
        coalesce(nullif(trim(p.type), ''), '') <> ''
        and coalesce(nullif(trim(p.address), ''), '') <> ''
        and coalesce(nullif(trim(p.city), ''), '') <> ''
        and coalesce(nullif(trim(p.state), ''), '') <> ''
        and coalesce(nullif(trim(p.zip), ''), '') <> ''
        and coalesce(p.price, 0) > 0
        and coalesce(nullif(trim(p.objective), ''), '') <> ''
        and exists (select 1 from public.property_images pi where pi.property_id = p.id)
      ) as healthy,
      not exists (select 1 from public.property_images pi where pi.property_id = p.id) as missing_media,
      (
        coalesce(nullif(trim(p.city), ''), '') = ''
        or coalesce(nullif(trim(p.state), ''), '') = ''
        or coalesce(nullif(trim(p.zip), ''), '') = ''
      ) as missing_location,
      coalesce(p.price, 0) <= 0 as missing_value,
      coalesce(nullif(trim(p.objective), ''), '') = '' as missing_objective
    from public.properties p
    union all
    select
      false as is_property,
      (
        coalesce(nullif(trim(s.title), ''), '') <> ''
        and coalesce(nullif(trim(s.category), ''), '') <> ''
        and coalesce(nullif(trim(s.description), ''), '') <> ''
        and cardinality(coalesce(s.media_images, '{}'::text[])) > 0
      ) as healthy,
      cardinality(coalesce(s.media_images, '{}'::text[])) = 0 as missing_media,
      cardinality(coalesce(s.markets, '{}'::text[])) = 0 as missing_location,
      false as missing_value,
      coalesce(nullif(trim(s.category), ''), '') = '' as missing_objective
    from public.services s
  )
  select
    count(*) filter (where healthy),
    count(*) filter (where missing_media),
    count(*) filter (where missing_location),
    count(*) filter (where missing_value),
    count(*) filter (where missing_objective)
  into v_healthy_cards, v_missing_media, v_missing_location, v_missing_value, v_missing_objective
  from card_health;

  select count(*)
    into v_free_gate_count
  from public.app_events
  where event_type = 'plan_gate_shown'
    and created_at >= now() - interval '30 days';

  select count(*)
    into v_free_upgrade_count
  from public.app_events
  where event_type = 'plan_gate_upgrade_clicked'
    and created_at >= now() - interval '30 days';

  select count(*) into v_checkout_clicked
  from public.app_events
  where event_type = 'checkout_pricing_clicked'
    and created_at >= now() - interval '30 days';

  select count(*) into v_checkout_terms
  from public.app_events
  where event_type = 'checkout_terms_accepted'
    and created_at >= now() - interval '30 days';

  select count(*) into v_checkout_opened
  from public.app_events
  where event_type = 'checkout_stripe_opened'
    and created_at >= now() - interval '30 days';

  select (
    (select count(*) from public.nugget_purchases where status = 'completed' and created_at >= now() - interval '30 days')
    + (select count(*) from public.subscriptions where status in ('active', 'trialing') and created_at >= now() - interval '30 days')
  ) into v_checkout_completed;

  select jsonb_build_object(
    'activeUsersNow', (select count(*) from public.user_activity_heartbeats where last_seen_at >= now() - interval '5 minutes'),
    'totalUsers', v_total_users,
    'adminAccounts', (select count(*) from public.users where is_admin = true),
    'newUsersDay', (select count(*) from public.users where created_at >= now() - interval '1 day'),
    'newUsersWeek', (select count(*) from public.users where created_at >= now() - interval '7 days'),
    'newUsersMonth', (select count(*) from public.users where created_at >= now() - interval '30 days'),
    'deletedUsersDay', (select count(*) from public.deleted_records_audit where table_name = 'users' and deleted_at >= now() - interval '1 day'),
    'deletedUsersWeek', (select count(*) from public.deleted_records_audit where table_name = 'users' and deleted_at >= now() - interval '7 days'),
    'deletedUsersMonth', (select count(*) from public.deleted_records_audit where table_name = 'users' and deleted_at >= now() - interval '30 days'),
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
    'freePlanPressureTotal', v_free_gate_count,
    'freePlanUpgradeClicks', v_free_upgrade_count,
    'freePlanUpgradeRate', case when v_free_gate_count > 0 then round((v_free_upgrade_count::numeric / v_free_gate_count::numeric) * 100, 1) else 0 end,
    'checkoutClicked30d', v_checkout_clicked,
    'checkoutTermsAccepted30d', v_checkout_terms,
    'checkoutStripeOpened30d', v_checkout_opened,
    'checkoutCompleted30d', v_checkout_completed,
    'checkoutCompletionRate', case when v_checkout_clicked > 0 then round((v_checkout_completed::numeric / v_checkout_clicked::numeric) * 100, 1) else 0 end,
    'activationRate', case when v_total_users > 0 then round((v_card_users::numeric / v_total_users::numeric) * 100, 1) else 0 end,
    'dbSizeBytes', v_db_size_bytes,
    'dbLimitBytes', v_db_limit_bytes,
    'dbUsagePct', round((v_db_size_bytes::numeric / v_db_limit_bytes::numeric) * 100, 1),
    'cardHealthPct', case when v_total_cards > 0 then round((v_healthy_cards::numeric / v_total_cards::numeric) * 100, 1) else 0 end,
    'cardHealthTotal', v_total_cards,
    'cardHealthNeedsAttention', greatest(v_total_cards - v_healthy_cards, 0),
    'cardHealthIssues', jsonb_build_object(
      'missingMedia', v_missing_media,
      'missingLocation', v_missing_location,
      'missingValue', v_missing_value,
      'missingObjective', v_missing_objective
    ),
    'series', jsonb_build_object(
      'total-users', (
        select jsonb_agg(jsonb_build_object('label', to_char(month_start, 'Mon YY'), 'value', (
          select count(*) from public.users u where u.created_at < (month_start + interval '1 month')
        )) order by month_start)
        from generate_series(v_month_start::timestamp, date_trunc('month', now()), interval '1 month') month_start
      ),
      'new-users', (
        select jsonb_agg(jsonb_build_object('label', to_char(month_start, 'Mon YY'), 'value', (
          select count(*) from public.users u where u.created_at >= month_start and u.created_at < (month_start + interval '1 month')
        )) order by month_start)
        from generate_series(v_month_start::timestamp, date_trunc('month', now()), interval '1 month') month_start
      ),
      'deleted-users', (
        select jsonb_agg(jsonb_build_object('label', to_char(month_start, 'Mon YY'), 'value', (
          select count(*) from public.deleted_records_audit d where d.table_name = 'users' and d.deleted_at >= month_start and d.deleted_at < (month_start + interval '1 month')
        )) order by month_start)
        from generate_series(v_month_start::timestamp, date_trunc('month', now()), interval '1 month') month_start
      ),
      'unlocks', (
        select jsonb_agg(jsonb_build_object('label', to_char(month_start, 'Mon YY'), 'value', (
          select count(*) from public.unlocks u where u.created_at >= month_start and u.created_at < (month_start + interval '1 month')
        )) order by month_start)
        from generate_series(v_month_start::timestamp, date_trunc('month', now()), interval '1 month') month_start
      ),
      'packs-revenue', (
        select jsonb_agg(jsonb_build_object('label', to_char(month_start, 'Mon YY'), 'value', (
          select coalesce(sum(p.price_cents), 0) from public.nugget_purchases p where p.status = 'completed' and p.created_at >= month_start and p.created_at < (month_start + interval '1 month')
        )) order by month_start)
        from generate_series(v_month_start::timestamp, date_trunc('month', now()), interval '1 month') month_start
      ),
      'subscriptions', (
        select jsonb_agg(jsonb_build_object('label', to_char(month_start, 'Mon YY'), 'value', (
          select count(*) from public.subscriptions s where s.status in ('active', 'trialing') and s.created_at >= month_start and s.created_at < (month_start + interval '1 month')
        )) order by month_start)
        from generate_series(v_month_start::timestamp, date_trunc('month', now()), interval '1 month') month_start
      ),
      'manual-grants', (
        select jsonb_agg(jsonb_build_object('label', to_char(month_start, 'Mon YY'), 'value', (
          select coalesce(sum(g.amount), 0) from public.admin_nugget_grants g where g.created_at >= month_start and g.created_at < (month_start + interval '1 month')
        )) order by month_start)
        from generate_series(v_month_start::timestamp, date_trunc('month', now()), interval '1 month') month_start
      ),
      'properties', (
        select jsonb_agg(jsonb_build_object('label', to_char(month_start, 'Mon YY'), 'value', (
          select count(*) from public.properties p where p.created_at >= month_start and p.created_at < (month_start + interval '1 month')
        )) order by month_start)
        from generate_series(v_month_start::timestamp, date_trunc('month', now()), interval '1 month') month_start
      ),
      'admin-accounts', (
        select jsonb_agg(jsonb_build_object('label', to_char(month_start, 'Mon YY'), 'value', (
          select count(*) from public.users u where u.is_admin = true and u.created_at < (month_start + interval '1 month')
        )) order by month_start)
        from generate_series(v_month_start::timestamp, date_trunc('month', now()), interval '1 month') month_start
      ),
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
          select count(*) from public.app_events e where e.event_type in ('highlight_active', 'highlight_purchased') and e.created_at >= day_start and e.created_at < (day_start + interval '1 day')
        )) order by day_start)
        from generate_series(v_day_start::timestamp, now()::date::timestamp, interval '1 day') day_start
      ),
      'exclusive-contacts', (
        select jsonb_agg(jsonb_build_object('label', to_char(day_start, 'MM/DD'), 'value', (
          select count(*) from public.app_events e where e.event_type = 'exclusive_contact_purchased' and e.created_at >= day_start and e.created_at < (day_start + interval '1 day')
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
      ),
      'checkout-dropoff', jsonb_build_array(
        jsonb_build_object('label', 'Clicked', 'value', v_checkout_clicked),
        jsonb_build_object('label', 'Terms', 'value', v_checkout_terms),
        jsonb_build_object('label', 'Stripe', 'value', v_checkout_opened),
        jsonb_build_object('label', 'Paid', 'value', v_checkout_completed)
      ),
      'activation-funnel', jsonb_build_array(
        jsonb_build_object('label', 'Users', 'value', v_total_users),
        jsonb_build_object('label', 'Profile', 'value', v_profile_users),
        jsonb_build_object('label', 'Investor', 'value', v_investor_profile_users),
        jsonb_build_object('label', 'Card', 'value', v_card_users),
        jsonb_build_object('label', 'Swipe', 'value', v_swipe_users),
        jsonb_build_object('label', 'Match', 'value', v_match_users),
        jsonb_build_object('label', 'Unlock', 'value', v_unlock_users)
      ),
      'db-storage-guardrail', jsonb_build_array(
        jsonb_build_object('label', 'Used MB', 'value', round(v_db_size_bytes::numeric / 1048576, 1)),
        jsonb_build_object('label', 'Limit MB', 'value', round(v_db_limit_bytes::numeric / 1048576, 1))
      ),
      'card-health', jsonb_build_array(
        jsonb_build_object('label', 'Healthy', 'value', v_healthy_cards),
        jsonb_build_object('label', 'No media', 'value', v_missing_media),
        jsonb_build_object('label', 'No location', 'value', v_missing_location),
        jsonb_build_object('label', 'No value', 'value', v_missing_value),
        jsonb_build_object('label', 'No objective', 'value', v_missing_objective)
      )
    ),
    'seriesStatus', jsonb_build_object(
      'active-now', 'No historical heartbeat table yet. Current value is real-time only.',
      'db-storage-guardrail', 'Current database usage only; Supabase quota resets are external.'
    )
  )
  into v_result;

  return v_result;
end;
$$;

grant execute on function public.admin_get_dashboard_snapshot() to authenticated;
