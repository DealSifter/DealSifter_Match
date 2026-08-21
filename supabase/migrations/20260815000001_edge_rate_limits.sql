-- Phase 5C: atomic server-side Edge Function rate limiting.
-- Stores only an authenticated subject UUID and a controlled operation code.

create table if not exists public.edge_rate_limits (
  subject_id uuid not null,
  operation text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 1 check (request_count between 1 and 1000000),
  expires_at timestamptz not null,
  primary key (subject_id, operation, window_started_at),
  constraint edge_rate_limits_operation_format check (operation ~ '^[a-z][a-z0-9_]{1,63}$')
);

create index if not exists edge_rate_limits_expires_at_idx
  on public.edge_rate_limits (expires_at);

alter table public.edge_rate_limits enable row level security;

revoke all on table public.edge_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.edge_rate_limits to service_role;

create or replace function public.ds_consume_edge_rate_limit(
  p_subject_id uuid,
  p_operation text,
  p_window_seconds integer,
  p_max_requests integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_reset_at timestamptz;
  v_count integer;
begin
  if p_subject_id is null
     or p_operation !~ '^[a-z][a-z0-9_]{1,63}$'
     or p_window_seconds not between 1 and 86400
     or p_max_requests not between 1 and 10000 then
    raise exception 'invalid rate limit parameters' using errcode = '22023';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
  );
  v_reset_at := v_window_start + make_interval(secs => p_window_seconds);

  insert into public.edge_rate_limits (
    subject_id, operation, window_started_at, request_count, expires_at
  ) values (
    p_subject_id, p_operation, v_window_start, 1, v_reset_at + interval '5 minutes'
  )
  on conflict (subject_id, operation, window_started_at)
  do update set
    request_count = least(public.edge_rate_limits.request_count + 1, p_max_requests + 1),
    expires_at = excluded.expires_at
  returning request_count into v_count;

  if random() < 0.01 then
    delete from public.edge_rate_limits
    where ctid in (
      select ctid from public.edge_rate_limits
      where expires_at < v_now
      order by expires_at
      limit 500
    );
  end if;

  return query select
    v_count <= p_max_requests,
    greatest(p_max_requests - v_count, 0),
    greatest(ceil(extract(epoch from (v_reset_at - v_now)))::integer, 1),
    v_reset_at;
end;
$$;

revoke all on function public.ds_consume_edge_rate_limit(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.ds_consume_edge_rate_limit(uuid, text, integer, integer) to service_role;

comment on table public.edge_rate_limits is
  'Short-lived, non-PII counters for atomic Edge Function abuse protection.';

-- One live provider-message preparation per user/idempotency key. The Edge
-- handler derives a stable key when the client omits one, so double-clicks and
-- concurrent retries reuse the existing pending action.
with ranked as (
  select id,
         row_number() over (
           partition by user_id, action_type, payload->>'idempotencyKey'
           order by created_at desc, id desc
         ) as position
  from public.maxxis_pending_actions
  where action_type = 'send_provider_message'
    and status = 'pending'
    and nullif(payload->>'idempotencyKey', '') is not null
)
update public.maxxis_pending_actions action
set status = 'cancelled', cancelled_at = now()
from ranked
where action.id = ranked.id and ranked.position > 1;

create unique index if not exists maxxis_pending_message_idempotency_idx
  on public.maxxis_pending_actions (
    user_id,
    action_type,
    (payload->>'idempotencyKey')
  )
  where action_type = 'send_provider_message'
    and status = 'pending'
    and nullif(payload->>'idempotencyKey', '') is not null;

-- Rollback:
-- drop function if exists public.ds_consume_edge_rate_limit(uuid, text, integer, integer);
-- drop table if exists public.edge_rate_limits;
