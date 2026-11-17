-- PROPOSAL ONLY. Not applied. Requires separate staging authorization and dry-run.
begin;
create table public.report_mail_deliveries (
  delivery_key text primary key check(length(delivery_key)=64),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_id uuid not null references public.maxxis_reports(id) on delete cascade,
  property_id uuid not null,
  report_fingerprint text not null,
  recipient_hash text not null,
  attachment_hashes jsonb not null,
  state text not null check(state in ('SENDING','ACCEPTED','FAILED','INDETERMINATE')),
  provider_message_id text,
  http_status integer,
  retry_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.report_mail_deliveries enable row level security;
revoke all on public.report_mail_deliveries from public,anon,authenticated;
grant select,insert,update on public.report_mail_deliveries to service_role;
-- No raw recipients, message bodies, PDF bytes, photos or OAuth tokens in this audit ledger.
rollback;
