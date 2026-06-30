-- Stripe webhook idempotency ledger.
-- Financial state changes must be applied by the webhook exactly once per Stripe event.

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  status text not null default 'processing'
    check (status in ('processing', 'processed', 'failed')),
  attempts integer not null default 1 check (attempts >= 1),
  last_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists idx_stripe_webhook_events_status_updated
  on public.stripe_webhook_events(status, updated_at desc);

alter table public.stripe_webhook_events enable row level security;

drop policy if exists stripe_webhook_events_service_all on public.stripe_webhook_events;
create policy stripe_webhook_events_service_all
  on public.stripe_webhook_events for all
  using (current_setting('role') = 'service_role')
  with check (current_setting('role') = 'service_role');

create or replace function public.increment_stripe_webhook_attempts(p_event_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.stripe_webhook_events
  set attempts = attempts + 1,
      updated_at = now()
  where event_id = p_event_id;
end;
$$;

