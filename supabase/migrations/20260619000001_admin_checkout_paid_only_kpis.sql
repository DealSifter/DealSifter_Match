-- Fix admin checkout KPI semantics: free subscription rows are not paid checkout completions.
-- This wrapper keeps the existing dashboard payload and overrides only payment-related fields.

do $$
begin
  if to_regprocedure('public.admin_get_dashboard_snapshot_base_20260619_checkout_fix()') is null
     and to_regprocedure('public.admin_get_dashboard_snapshot()') is not null then
    alter function public.admin_get_dashboard_snapshot() rename to admin_get_dashboard_snapshot_base_20260619_checkout_fix;
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
  v_checkout_clicked integer := 0;
  v_pack_completed_30d integer := 0;
  v_paid_sub_completed_30d integer := 0;
  v_checkout_completed integer := 0;
  v_pack_completed_total integer := 0;
  v_pack_revenue_cents integer := 0;
  v_nuggets_purchased integer := 0;
  v_active_paid_subs integer := 0;
  v_subscription_revenue_cents integer := 0;
  v_series jsonb := '{}'::jsonb;
begin
  if not public.ds_is_current_user_admin() then
    raise exception 'admin access required';
  end if;

  if to_regprocedure('public.admin_get_dashboard_snapshot_base_20260619_checkout_fix()') is not null then
    v_base := public.admin_get_dashboard_snapshot_base_20260619_checkout_fix();
  end if;

  select count(*) into v_checkout_clicked
  from public.app_events
  where event_type = 'checkout_pricing_clicked'
    and created_at >= now() - interval '30 days';

  select
    count(*),
    coalesce(sum(price_cents), 0),
    coalesce(sum(qty + bonus), 0)
  into v_pack_completed_total, v_pack_revenue_cents, v_nuggets_purchased
  from public.nugget_purchases
  where status = 'completed';

  select count(*) into v_pack_completed_30d
  from public.nugget_purchases
  where status = 'completed'
    and created_at >= now() - interval '30 days';

  select
    count(*),
    coalesce(sum(price_cents), 0)
  into v_active_paid_subs, v_subscription_revenue_cents
  from public.subscriptions
  where status in ('active', 'trialing')
    and coalesce(price_cents, 0) > 0
    and stripe_sub_id is not null;

  select count(*) into v_paid_sub_completed_30d
  from public.subscriptions
  where status in ('active', 'trialing')
    and coalesce(price_cents, 0) > 0
    and stripe_sub_id is not null
    and created_at >= now() - interval '30 days';

  v_checkout_completed := v_pack_completed_30d + v_paid_sub_completed_30d;

  v_series := jsonb_build_object(
    'packs-revenue', (
      select jsonb_agg(jsonb_build_object('label', to_char(day_start, 'MM/DD'), 'value', (
        select coalesce(sum(p.price_cents), 0)
        from public.nugget_purchases p
        where p.status = 'completed'
          and p.created_at >= day_start
          and p.created_at < (day_start + interval '1 day')
      )) order by day_start)
      from generate_series(v_day_start::timestamp, now()::date::timestamp, interval '1 day') day_start
    ),
    'subscriptions', (
      select jsonb_agg(jsonb_build_object('label', to_char(day_start, 'MM/DD'), 'value', (
        select coalesce(sum(s.price_cents), 0)
        from public.subscriptions s
        where s.status in ('active', 'trialing')
          and coalesce(s.price_cents, 0) > 0
          and s.stripe_sub_id is not null
          and s.created_at >= day_start
          and s.created_at < (day_start + interval '1 day')
      )) order by day_start)
      from generate_series(v_day_start::timestamp, now()::date::timestamp, interval '1 day') day_start
    ),
    'checkout-dropoff', jsonb_build_array(
      jsonb_build_object('label', 'Completed', 'value', v_checkout_completed),
      jsonb_build_object('label', 'Abandoned', 'value', greatest(v_checkout_clicked - v_checkout_completed, 0))
    )
  );

  return v_base
    || jsonb_build_object(
      'nuggetsPurchased', v_nuggets_purchased,
      'packPurchasesCompleted', v_pack_completed_total,
      'packRevenueUsdCents', v_pack_revenue_cents,
      'activeSubscriptions', v_active_paid_subs,
      'subscriptionRevenueUsdCents', v_subscription_revenue_cents,
      'checkoutClicked30d', v_checkout_clicked,
      'checkoutCompleted30d', v_checkout_completed,
      'checkoutCompletionRate', case when v_checkout_clicked > 0 then round((v_checkout_completed::numeric / v_checkout_clicked::numeric) * 100, 1) else 0 end,
      'series', coalesce(v_base->'series', '{}'::jsonb) || v_series
    );
end;
$$;

grant execute on function public.admin_get_dashboard_snapshot() to authenticated;
