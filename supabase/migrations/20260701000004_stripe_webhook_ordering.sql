-- Stripe webhook ordering and observability.
-- Stripe can deliver events more than once and out of chronological order.

create table if not exists public.stripe_events_processed (
  stripe_event_id text primary key,
  event_type text not null,
  first_received_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'claimed'
    check (status in ('claimed', 'processed', 'skipped', 'queued', 'failed')),
  skip_reason text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_stripe_events_processed_status_updated
  on public.stripe_events_processed(status, updated_at desc);

alter table public.stripe_events_processed enable row level security;

drop policy if exists stripe_events_processed_service_all on public.stripe_events_processed;
create policy stripe_events_processed_service_all
  on public.stripe_events_processed for all
  using (current_setting('role') = 'service_role')
  with check (current_setting('role') = 'service_role');

create table if not exists public.stripe_events_log (
  id bigserial primary key,
  event_id text not null,
  event_type text not null,
  received_at timestamptz not null default now(),
  processed boolean not null default false,
  skip_reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_stripe_events_log_received
  on public.stripe_events_log(received_at desc);

create index if not exists idx_stripe_events_log_skipped
  on public.stripe_events_log(processed, received_at desc)
  where processed = false;

alter table public.stripe_events_log enable row level security;

drop policy if exists stripe_events_log_service_all on public.stripe_events_log;
create policy stripe_events_log_service_all
  on public.stripe_events_log for all
  using (current_setting('role') = 'service_role')
  with check (current_setting('role') = 'service_role');

create table if not exists public.stripe_event_reprocess_queue (
  stripe_event_id text primary key,
  event_type text not null,
  raw_event jsonb not null,
  available_at timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'processed', 'skipped', 'failed')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_stripe_event_reprocess_queue_due
  on public.stripe_event_reprocess_queue(status, available_at);

alter table public.stripe_event_reprocess_queue enable row level security;

drop policy if exists stripe_event_reprocess_queue_service_all on public.stripe_event_reprocess_queue;
create policy stripe_event_reprocess_queue_service_all
  on public.stripe_event_reprocess_queue for all
  using (current_setting('role') = 'service_role')
  with check (current_setting('role') = 'service_role');

alter table public.subscriptions
  add column if not exists current_period_start timestamptz;

do $$
begin
  if to_regprocedure('public.admin_get_dashboard_snapshot_base_20260701_stripe_ordering()') is null
     and to_regprocedure('public.admin_get_dashboard_snapshot()') is not null then
    alter function public.admin_get_dashboard_snapshot() rename to admin_get_dashboard_snapshot_base_20260701_stripe_ordering;
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
  v_alerts jsonb := '[]'::jsonb;
  v_skipped_day integer := 0;
  v_day_start date := (now()::date - interval '9 days')::date;
  v_series jsonb := '{}'::jsonb;
begin
  if not public.ds_is_current_user_admin() then
    raise exception 'admin access required';
  end if;

  if to_regprocedure('public.admin_get_dashboard_snapshot_base_20260701_stripe_ordering()') is not null then
    v_base := public.admin_get_dashboard_snapshot_base_20260701_stripe_ordering();
  end if;

  select count(*)
    into v_skipped_day
  from public.stripe_events_log
  where processed = false
    and received_at >= now() - interval '1 day'
    and coalesce(skip_reason, '') <> '';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'eventId', event_id,
        'eventType', event_type,
        'receivedAt', received_at,
        'skipReason', skip_reason
      )
      order by received_at desc
    ),
    '[]'::jsonb
  )
    into v_alerts
  from (
    select event_id, event_type, received_at, skip_reason
    from public.stripe_events_log
    where processed = false
      and received_at >= now() - interval '7 days'
      and coalesce(skip_reason, '') <> ''
    order by received_at desc
    limit 8
  ) recent_skipped;

  v_series := jsonb_build_object(
    'stripe-webhook-skips', (
      select jsonb_agg(jsonb_build_object('label', to_char(day_start, 'MM/DD'), 'value', (
        select count(*)
        from public.stripe_events_log l
        where l.processed = false
          and coalesce(l.skip_reason, '') <> ''
          and l.received_at >= day_start
          and l.received_at < (day_start + interval '1 day')
      )) order by day_start)
      from generate_series(v_day_start::timestamp, now()::date::timestamp, interval '1 day') day_start
    )
  );

  return v_base || jsonb_build_object(
    'stripeWebhookSkippedDay', v_skipped_day,
    'stripeWebhookAlerts', v_alerts,
    'stripeIssuesDay', coalesce((v_base->>'stripeIssuesDay')::integer, 0) + v_skipped_day,
    'series', coalesce(v_base->'series', '{}'::jsonb) || v_series
  );
end;
$$;

grant execute on function public.admin_get_dashboard_snapshot() to authenticated;
