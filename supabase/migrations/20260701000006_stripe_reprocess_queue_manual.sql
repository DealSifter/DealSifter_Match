-- Independent Stripe queue reprocessing support.
-- Claims pending events atomically with SELECT FOR UPDATE SKIP LOCKED so
-- parallel manual/cron executions do not process the same event twice.

alter table public.stripe_event_reprocess_queue
  add column if not exists scheduled_for timestamptz;

update public.stripe_event_reprocess_queue
set scheduled_for = coalesce(scheduled_for, available_at, now())
where scheduled_for is null;

alter table public.stripe_event_reprocess_queue
  alter column scheduled_for set default now();

alter table public.stripe_event_reprocess_queue
  alter column scheduled_for set not null;

do $$
begin
  alter table public.stripe_event_reprocess_queue
    drop constraint if exists stripe_event_reprocess_queue_status_check;

  alter table public.stripe_event_reprocess_queue
    add constraint stripe_event_reprocess_queue_status_check
    check (status in ('pending', 'processing', 'processed', 'skipped', 'failed'));
end $$;

create index if not exists idx_stripe_event_reprocess_queue_scheduled
  on public.stripe_event_reprocess_queue(status, scheduled_for);

create or replace function public.claim_stripe_reprocess_queue(p_limit integer default 10)
returns table (
  stripe_event_id text,
  event_type text,
  raw_event jsonb,
  attempts integer,
  scheduled_for timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('role', true) <> 'service_role' then
    raise exception 'service role required';
  end if;

  return query
  with claimed as (
    select q.stripe_event_id
    from public.stripe_event_reprocess_queue q
    where q.status = 'pending'
      and q.scheduled_for <= now()
    order by q.scheduled_for asc
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 10))
  )
  update public.stripe_event_reprocess_queue q
  set
    status = 'processing',
    attempts = q.attempts + 1,
    updated_at = now()
  from claimed
  where q.stripe_event_id = claimed.stripe_event_id
  returning
    q.stripe_event_id,
    q.event_type,
    q.raw_event,
    q.attempts,
    q.scheduled_for;
end;
$$;

grant execute on function public.claim_stripe_reprocess_queue(integer) to service_role;

do $$
begin
  if to_regprocedure('public.admin_get_dashboard_snapshot_base_20260701_stripe_reprocess_queue()') is null
     and to_regprocedure('public.admin_get_dashboard_snapshot()') is not null then
    alter function public.admin_get_dashboard_snapshot() rename to admin_get_dashboard_snapshot_base_20260701_stripe_reprocess_queue;
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
  v_pending integer := 0;
  v_processing integer := 0;
  v_failed integer := 0;
begin
  if not public.ds_is_current_user_admin() then
    raise exception 'admin access required';
  end if;

  if to_regprocedure('public.admin_get_dashboard_snapshot_base_20260701_stripe_reprocess_queue()') is not null then
    v_base := public.admin_get_dashboard_snapshot_base_20260701_stripe_reprocess_queue();
  end if;

  select count(*) into v_pending
  from public.stripe_event_reprocess_queue
  where status = 'pending'
    and scheduled_for <= now();

  select count(*) into v_processing
  from public.stripe_event_reprocess_queue
  where status = 'processing';

  select count(*) into v_failed
  from public.stripe_event_reprocess_queue
  where status = 'failed'
    and updated_at >= now() - interval '7 days';

  return v_base || jsonb_build_object(
    'stripeReprocessPending', v_pending,
    'stripeReprocessProcessing', v_processing,
    'stripeReprocessFailed7d', v_failed,
    'stripeIssuesDay', coalesce((v_base->>'stripeIssuesDay')::integer, 0) + v_pending
  );
end;
$$;

grant execute on function public.admin_get_dashboard_snapshot() to authenticated;
